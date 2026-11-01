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

  function fileLimit(kind) {
    return kind === "image" ? MAX_IMAGE_BYTES : kind === "binary" ? MAX_BINARY_BYTES : MAX_TEXT_BYTES;
  }
  function checkSize(kind, bytes) {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > fileLimit(kind))
      throw new RangeError("Local " + kind + " source exceeds the ingestion byte budget.");
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

  function imagePixels(file, objectUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = function onImageLoad() {
        try {
          if (!image.naturalWidth || !image.naturalHeight
              || image.naturalWidth > MAX_IMAGE_DIMENSION
              || image.naturalHeight > MAX_IMAGE_DIMENSION
              || image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS) {
            throw new RangeError("Image dimensions exceed the local decode budget.");
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
    checkSize(kind, file.size);
    const bytes = new Uint8Array(await file.arrayBuffer());
    checkSize(kind, bytes.length);
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
      source.image = await imagePixels(file, URL.createObjectURL(file));
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
    const bytes = S.Core.utf8(normalized);
    const kind = classify(name || "pasted.txt");
    checkSize(kind, bytes.length);
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

  S.Core.Input = Object.freeze({ classify, extractDecimalTokens, extractTabularNumerics, extractJsonNumerics, fromFile, fromText, descriptor });
})(window.SPECTRAL);
