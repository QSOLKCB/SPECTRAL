(function defineInput(S) {
  "use strict";

  const TEXT_EXTENSIONS = new Set(["csv", "json", "txt", "tsv", "log"]);
  const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
  const TOKEN_LIMIT = 262144;
  const MAX_TEXT_BYTES = 4 * 1024 * 1024;
  const MAX_BINARY_BYTES = 2 * 1024 * 1024;
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const MAX_IMAGE_DIMENSION = 4096;
  const MAX_IMAGE_PIXELS = 4096 * 4096;
  const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;
  const MAX_DERIVATIVE_BYTES = 16 * 1024 * 1024;
  const LIMITS = Object.freeze({
    textBytes: MAX_TEXT_BYTES,
    binaryBytes: MAX_BINARY_BYTES,
    imageBytes: MAX_IMAGE_BYTES,
    manifestBytes: MAX_MANIFEST_BYTES,
    derivativeBytes: MAX_DERIVATIVE_BYTES,
    imageDimension: MAX_IMAGE_DIMENSION,
    imagePixels: MAX_IMAGE_PIXELS
  });

  function fileLimit(kind) {
    return kind === "image" ? MAX_IMAGE_BYTES : kind === "binary" ? MAX_BINARY_BYTES : MAX_TEXT_BYTES;
  }
  function checkSize(label, bytes, maximum) {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > maximum)
      throw new RangeError("Local " + label + " exceeds the ingestion byte budget.");
  }
  async function readBoundedBytes(file, maximum, label) {
    if (!(file instanceof File)) throw new TypeError("Expected a local File");
    checkSize(label, file.size, maximum);
    const bytes = new Uint8Array(await file.arrayBuffer());
    checkSize(label, bytes.length, maximum);
    return bytes;
  }

  function extensionOf(name) {
    const parts = String(name || "").toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() : "";
  }

  function classify(name) {
    const extension = extensionOf(name);
    if (IMAGE_EXTENSIONS.has(extension)) return "image";
    if (extension === "csv" || extension === "tsv") return "tabular";
    if (extension === "json") return "json";
    if (TEXT_EXTENSIONS.has(extension)) return "text";
    return "binary";
  }

  function extractDecimalTokens(text, limit) {
    const max = Math.min(TOKEN_LIMIT, limit || TOKEN_LIMIT);
    const values = new Int32Array(max);
    const pattern = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
    let match, count = 0;
    while (count < max && (match = pattern.exec(String(text))) !== null) {
      try {
        const scaled = S.Core.decimalToScaled(match[0], 1000000);
        values[count++] = Math.max(-2147483648, Math.min(2147483647, scaled));
      } catch (_) { /* Out-of-range numbers are skipped. */ }
    }
    return values.slice(0, count);
  }

  function scaledTokens(tokens, limit) {
    const maximum = Math.min(tokens.length, limit || 262144);
    const output = new Int32Array(maximum);
    let count = 0;
    for (let i = 0; i < tokens.length && count < maximum; i += 1) {
      try {
        const scaled = S.Core.decimalToScaled(tokens[i], 1000000);
        output[count] = Math.max(-2147483648, Math.min(2147483647, scaled));
        count += 1;
      } catch (_) {
        // Values outside the fixed-point input range are skipped.
      }
    }
    return output.slice(0, count);
  }

  function extractTabularNumerics(text, delimiter, limit) {
    const fields = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i <= text.length; i += 1) {
      const character = i < text.length ? text[i] : "\n";
      if (quoted) {
        if (character === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
        else if (character === '"') quoted = false;
        else field += character;
      } else if (character === '"' && field.length === 0) quoted = true;
      else if (character === delimiter || character === "\n" || character === "\r") {
        const token = field.trim();
        if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(token)
            && fields.length < Math.min(TOKEN_LIMIT, limit || TOKEN_LIMIT)) fields.push(token);
        field = "";
        if (character === "\r" && text[i + 1] === "\n") i += 1;
      } else field += character;
    }
    if (quoted) throw new Error("Unterminated quoted field in tabular source");
    return scaledTokens(fields, limit);
  }

  function extractJsonNumerics(text, limit) {
    JSON.parse(text);
    const tokens = [], maximum = Math.min(TOKEN_LIMIT, limit || TOKEN_LIMIT);
    const numberPattern = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < text.length && tokens.length < maximum;) {
      const character = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        i += 1;
        continue;
      }
      if (character === '"') { inString = true; i += 1; continue; }
      if (character === "-" || (character >= "0" && character <= "9")) {
        numberPattern.lastIndex = i;
        const match = numberPattern.exec(text);
        if (!match) throw new Error("Invalid JSON numeric token");
        tokens.push(match[0]);
        i += match[0].length;
        continue;
      }
      i += 1;
    }
    return scaledTokens(tokens, limit);
  }

  function extractStructuredNumerics(text, kind, name) {
    if (kind === "json") return extractJsonNumerics(text);
    if (kind === "tabular") return extractTabularNumerics(text, extensionOf(name) === "tsv" ? "\t" : ",");
    return extractDecimalTokens(text);
  }

  function decodeUtf8(bytes) {
    if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(binary));
  }

  function bytesMatch(bytes, offset, expected) {
    if (offset < 0 || offset + expected.length > bytes.length) return false;
    for (let i = 0; i < expected.length; i += 1) {
      if (bytes[offset + i] !== expected[i]) return false;
    }
    return true;
  }

  function uint16BigEndian(bytes, offset) {
    if (offset < 0 || offset + 2 > bytes.length) throw new Error("Truncated image header.");
    return bytes[offset] * 256 + bytes[offset + 1];
  }

  function uint32BigEndian(bytes, offset) {
    if (offset < 0 || offset + 4 > bytes.length) throw new Error("Truncated image header.");
    return bytes[offset] * 0x1000000 + bytes[offset + 1] * 0x10000 + bytes[offset + 2] * 0x100 + bytes[offset + 3];
  }

  function uint32LittleEndian(bytes, offset) {
    if (offset < 0 || offset + 4 > bytes.length) throw new Error("Truncated image header.");
    return bytes[offset] + bytes[offset + 1] * 0x100 + bytes[offset + 2] * 0x10000 + bytes[offset + 3] * 0x1000000;
  }

  function inspectPngDimensions(bytes) {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (!bytesMatch(bytes, 0, signature) || bytes.length < 29
        || uint32BigEndian(bytes, 8) !== 13 || !bytesMatch(bytes, 12, [73, 72, 68, 82])) {
      throw new Error("Invalid PNG header.");
    }
    return { width: uint32BigEndian(bytes, 16), height: uint32BigEndian(bytes, 20) };
  }

  function inspectJpegDimensions(bytes) {
    if (!bytesMatch(bytes, 0, [255, 216])) throw new Error("Invalid JPEG header.");
    const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) throw new Error("Invalid JPEG marker sequence.");
      while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
      if (offset >= bytes.length) break;
      const marker = bytes[offset++];
      if (marker === 0x00) throw new Error("Invalid JPEG marker sequence.");
      if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (marker === 0xd9 || marker === 0xda) break;
      const length = uint16BigEndian(bytes, offset);
      if (length < 2 || offset + length > bytes.length) throw new Error("Truncated JPEG segment.");
      if (startOfFrame.has(marker)) {
        if (length < 8 || !bytes[offset + 7] || length !== 8 + bytes[offset + 7] * 3) {
          throw new Error("Invalid JPEG frame header.");
        }
        return { width: uint16BigEndian(bytes, offset + 5), height: uint16BigEndian(bytes, offset + 3) };
      }
      offset += length;
    }
    throw new Error("JPEG dimensions are missing.");
  }

  function inspectWebpDimensions(bytes) {
    if (!bytesMatch(bytes, 0, [82, 73, 70, 70]) || !bytesMatch(bytes, 8, [87, 69, 66, 80])) {
      throw new Error("Invalid WebP header.");
    }
    const containerEnd = uint32LittleEndian(bytes, 4) + 8;
    if (containerEnd < 12 || containerEnd > bytes.length) throw new Error("Truncated WebP container.");
    let offset = 12;
    while (offset + 8 <= containerEnd) {
      const chunkSize = uint32LittleEndian(bytes, offset + 4);
      const data = offset + 8;
      const chunkEnd = data + chunkSize;
      if (!Number.isSafeInteger(chunkEnd) || chunkEnd > containerEnd) throw new Error("Truncated WebP chunk.");
      if (bytesMatch(bytes, offset, [86, 80, 56, 88])) {
        if (chunkSize < 10) throw new Error("Invalid WebP extended header.");
        return {
          width: 1 + bytes[data + 4] + bytes[data + 5] * 0x100 + bytes[data + 6] * 0x10000,
          height: 1 + bytes[data + 7] + bytes[data + 8] * 0x100 + bytes[data + 9] * 0x10000
        };
      }
      if (bytesMatch(bytes, offset, [86, 80, 56, 76])) {
        if (chunkSize < 5 || bytes[data] !== 0x2f) throw new Error("Invalid lossless WebP header.");
        return {
          width: 1 + bytes[data + 1] + (bytes[data + 2] & 0x3f) * 0x100,
          height: 1 + ((bytes[data + 2] & 0xc0) >>> 6) + bytes[data + 3] * 4 + (bytes[data + 4] & 0x0f) * 0x400
        };
      }
      if (bytesMatch(bytes, offset, [86, 80, 56, 32])) {
        if (chunkSize < 10 || !bytesMatch(bytes, data + 3, [157, 1, 42])) throw new Error("Invalid lossy WebP header.");
        return {
          width: (bytes[data + 6] + bytes[data + 7] * 0x100) & 0x3fff,
          height: (bytes[data + 8] + bytes[data + 9] * 0x100) & 0x3fff
        };
      }
      offset = chunkEnd + (chunkSize & 1);
    }
    throw new Error("WebP dimensions are missing.");
  }

  function inspectImageDimensions(bytes) {
    let dimensions;
    if (bytesMatch(bytes, 0, [137, 80, 78, 71, 13, 10, 26, 10])) dimensions = inspectPngDimensions(bytes);
    else if (bytesMatch(bytes, 0, [255, 216])) dimensions = inspectJpegDimensions(bytes);
    else if (bytesMatch(bytes, 0, [82, 73, 70, 70])) dimensions = inspectWebpDimensions(bytes);
    else throw new Error("Unsupported or invalid local image header.");
    if (!dimensions.width || !dimensions.height
        || dimensions.width > MAX_IMAGE_DIMENSION
        || dimensions.height > MAX_IMAGE_DIMENSION
        || dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) {
      throw new RangeError("Image dimensions exceed the local decode budget.");
    }
    return dimensions;
  }

  function imagePixels(objectUrl, expectedDimensions) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = function onImageLoad() {
        try {
          if (image.naturalWidth !== expectedDimensions.width || image.naturalHeight !== expectedDimensions.height) {
            throw new Error("Decoded image dimensions do not match its validated header.");
          }
          const maximum = 512;
          const scale = Math.min(1, maximum / Math.max(image.naturalWidth, image.naturalHeight));
          const width = Math.max(1, Math.round(image.naturalWidth * scale));
          const height = Math.max(1, Math.round(image.naturalHeight * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
          context.imageSmoothingEnabled = false;
          context.drawImage(image, 0, 0, width, height);
          const pixels = context.getImageData(0, 0, width, height).data;
          resolve({ width, height, pixels: new Uint8ClampedArray(pixels) });
        } catch (error) {
          reject(error);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };
      image.onerror = function onImageError() {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("The browser could not decode this local image."));
      };
      image.src = objectUrl;
    });
  }

  async function fromFile(file) {
    if (!(file instanceof File)) throw new TypeError("Expected a local File");
    const kind = classify(file.name);
    const bytes = await readBoundedBytes(file, fileLimit(kind), kind + " source");
    const imageDimensions = kind === "image" ? inspectImageDimensions(bytes) : null;
    const source = {
      name: file.name,
      type: file.type || "application/octet-stream",
      kind,
      size: bytes.length,
      bytes,
      hash: S.Core.sha256Hex(bytes),
      numeric: new Int32Array(0),
      text: null,
      image: null
    };
    if (kind === "text" || kind === "tabular" || kind === "json") {
      source.text = decodeUtf8(bytes).replace(/^\uFEFF/, "");
      source.numeric = extractStructuredNumerics(source.text, kind, file.name);
    } else if (kind === "binary") {
      // The pre-read binary byte cap bounds expansion; keep all admitted bytes
      // so existing qec_triality v2.0.0 source identities and tone plans replay.
      source.numeric = Int32Array.from(bytes, value => value * 1000000);
    } else if (kind === "image") {
      source.image = await imagePixels(URL.createObjectURL(file), imageDimensions);
      const luminance = new Int32Array(source.image.width * source.image.height);
      for (let i = 0, p = 0; i < source.image.pixels.length; i += 4, p += 1) {
        luminance[p] = (source.image.pixels[i] * 2126 + source.image.pixels[i + 1] * 7152 + source.image.pixels[i + 2] * 722) * 100;
      }
      source.numeric = luminance;
    }
    return source;
  }

  function fromText(text, name) {
    const normalized = String(text);
    const kind = classify(name || "pasted.txt");
    checkSize(kind + " source text", normalized.length, fileLimit(kind));
    const bytes = S.Core.utf8(normalized);
    checkSize(kind + " source", bytes.length, fileLimit(kind));
    return {
      name: name || "pasted-source.txt",
      type: "text/plain;charset=utf-8",
      kind,
      size: bytes.length,
      bytes,
      hash: S.Core.sha256Hex(bytes),
      numeric: extractStructuredNumerics(normalized, kind, name || "pasted.txt"),
      text: normalized,
      image: null
    };
  }

  function descriptor(source) {
    if (!source) return {
      present: false,
      role: "engine_seed",
      kind: "none",
      byte_length: 0,
      sha256: S.Core.sha256Hex(new Uint8Array(0))
    };
    return {
      present: true,
      role: "primary_source",
      kind: source.kind,
      byte_length: source.size,
      sha256: source.hash
    };
  }

  async function readManifestText(file) {
    const bytes = await readBoundedBytes(file, MAX_MANIFEST_BYTES, "manifest");
    return decodeUtf8(bytes).replace(/^\uFEFF/, "");
  }

  function readDerivativeBytes(file) {
    return readBoundedBytes(file, MAX_DERIVATIVE_BYTES, "derivative audio");
  }

  S.Core.Input = Object.freeze({
    limits: LIMITS,
    classify,
    extractDecimalTokens,
    extractTabularNumerics,
    extractJsonNumerics,
    inspectImageDimensions,
    fromFile,
    fromText,
    readManifestText,
    readDerivativeBytes,
    descriptor
  });
})(window.SPECTRAL);
