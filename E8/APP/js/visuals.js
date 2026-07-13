(function defineE8StudioVisuals(S) {
  "use strict";

  function prepareCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const context = canvas.getContext("2d", { alpha: false });
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { context, width: rect.width, height: rect.height, dpr };
  }

  function clear(context, width, height, color) {
    context.fillStyle = color || "#090c0f";
    context.fillRect(0, 0, width, height);
  }

  const PROJECTION_X = Object.freeze(Array.from({ length: 8 }, (_, axis) => Math.cos(axis * Math.PI / 4) + 0.28 * Math.cos(axis * 3 * Math.PI / 4 + 0.4)));
  const PROJECTION_Y = Object.freeze(Array.from({ length: 8 }, (_, axis) => Math.sin(axis * Math.PI / 4) + 0.28 * Math.sin(axis * 3 * Math.PI / 4 + 0.4)));

  function projectRoot(root) {
    let x = 0, y = 0;
    for (let axis = 0; axis < 8; axis += 1) { x += root[axis] * PROJECTION_X[axis]; y += root[axis] * PROJECTION_Y[axis]; }
    return [x, y];
  }

  const PROJECTED_ROOTS = Object.freeze(S.Core.ROOTS_FLOAT.map(projectRoot));
  const ROOT_RADIUS = Math.max(...PROJECTED_ROOTS.map(point => Math.hypot(point[0], point[1])));

  function selectedRoots(params) {
    const selected = new Set();
    for (let voice = 0; voice < params.voice_count; voice += 1) {
      for (const root of S.Core.sparseRootIndices(voice, params.root_density, params.root_offset)) selected.add(root);
    }
    return selected;
  }

  function drawGeometry(canvas, paramsInput, trajectory) {
    const params = S.Core.validateParams(paramsInput);
    const { context, width, height } = prepareCanvas(canvas);
    clear(context, width, height, "#090c0f");
    const cx = width * 0.5, cy = height * 0.5;
    const radius = Math.min(width, height) * 0.39;
    context.lineWidth = 1;
    context.strokeStyle = "rgba(132,150,153,0.12)";
    for (let ring = 1; ring <= 4; ring += 1) {
      context.beginPath(); context.arc(cx, cy, radius * ring / 4, 0, Math.PI * 2); context.stroke();
    }
    for (let axis = 0; axis < 8; axis += 1) {
      const angle = axis * Math.PI / 4 - Math.PI / 2;
      context.beginPath(); context.moveTo(cx, cy); context.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius); context.stroke();
      context.fillStyle = "rgba(213,202,177,0.58)";
      context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      context.textAlign = "center"; context.textBaseline = "middle";
      context.fillText("θ" + (axis + 1), cx + Math.cos(angle) * (radius + 15), cy + Math.sin(angle) * (radius + 15));
    }
    const active = selectedRoots(params);
    for (let index = 0; index < PROJECTED_ROOTS.length; index += 1) {
      const point = PROJECTED_ROOTS[index];
      const x = cx + point[0] / ROOT_RADIUS * radius;
      const y = cy + point[1] / ROOT_RADIUS * radius;
      const familyA = index < 112;
      const isActive = active.has(index);
      context.fillStyle = isActive
        ? (familyA ? "rgba(214,162,79,0.92)" : "rgba(117,184,173,0.92)")
        : (familyA ? "rgba(214,162,79,0.20)" : "rgba(117,184,173,0.18)");
      context.beginPath(); context.arc(x, y, isActive ? 2.15 : 1.15, 0, Math.PI * 2); context.fill();
    }
    if (trajectory && trajectory.length > 1) {
      const points = trajectory.map(point => {
        let x = 0, y = 0;
        for (let axis = 0; axis < 8; axis += 1) {
          const angle = point.theta_microturns[axis] / 1000000 * Math.PI * 2;
          x += Math.cos(angle) * PROJECTION_X[axis];
          y += Math.sin(angle) * PROJECTION_Y[axis];
        }
        return [cx + x / 8 * radius * 0.86, cy + y / 8 * radius * 0.86];
      });
      context.strokeStyle = "rgba(169,154,204,0.78)";
      context.lineWidth = 1.6;
      context.beginPath(); context.moveTo(points[0][0], points[0][1]);
      for (let index = 1; index < points.length; index += 1) context.lineTo(points[index][0], points[index][1]);
      context.stroke();
      const last = points[points.length - 1];
      context.fillStyle = "#e6d6b7"; context.beginPath(); context.arc(last[0], last[1], 3.4, 0, Math.PI * 2); context.fill();
    }
    context.fillStyle = "rgba(231,226,216,0.78)";
    context.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.textAlign = "left"; context.textBaseline = "top";
    context.fillText("240 ROOTS · " + active.size + " COUPLED", 12, 11);
    context.fillStyle = "rgba(231,226,216,0.42)";
    context.fillText(params.path.replace(/_/g, " ").toUpperCase(), 12, 27);
  }

  function drawWaveform(canvas, pcm, selection) {
    const { context, width, height } = prepareCanvas(canvas);
    clear(context, width, height, "#090c0f");
    context.strokeStyle = "rgba(132,150,153,0.14)"; context.lineWidth = 1;
    context.beginPath(); context.moveTo(0, height / 2); context.lineTo(width, height / 2); context.stroke();
    if (!(pcm instanceof Int16Array) || !pcm.length) {
      context.fillStyle = "rgba(231,226,216,0.42)"; context.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      context.fillText("RENDER AUDIO TO INSPECT THE WAVEFORM", 14, 20); return;
    }
    const frames = pcm.length / 2;
    const start = selection ? Math.max(0, Math.min(frames - 1, selection.start || 0)) : 0;
    const end = selection ? Math.max(start + 1, Math.min(frames, selection.end || frames)) : frames;
    const midTop = height * 0.25, midBottom = height * 0.75, scale = height * 0.205 / 32768;
    function channel(channel, mid, color) {
      context.strokeStyle = color; context.lineWidth = 1;
      context.beginPath();
      for (let x = 0; x < Math.ceil(width); x += 1) {
        const a = start + Math.floor(x * (end - start) / width);
        const b = Math.min(end, start + Math.floor((x + 1) * (end - start) / width) + 1);
        let minimum = 32767, maximum = -32768;
        for (let frame = a; frame < b; frame += 1) {
          const value = pcm[frame * 2 + channel]; minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
        }
        context.moveTo(x, mid - maximum * scale); context.lineTo(x, mid - minimum * scale);
      }
      context.stroke();
    }
    channel(0, midTop, "rgba(214,162,79,0.90)");
    channel(1, midBottom, "rgba(117,184,173,0.90)");
    context.fillStyle = "rgba(231,226,216,0.46)"; context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillText("L", 8, 11); context.fillText("R", 8, height / 2 + 11);
  }

  function reverseBits(value, bits) {
    let output = 0;
    for (let bit = 0; bit < bits; bit += 1) { output = (output << 1) | (value & 1); value >>>= 1; }
    return output;
  }

  function fftInPlace(real, imaginary) {
    const size = real.length, bits = Math.log2(size);
    for (let index = 0; index < size; index += 1) {
      const reversed = reverseBits(index, bits);
      if (reversed > index) {
        const tempReal = real[index], tempImag = imaginary[index];
        real[index] = real[reversed]; imaginary[index] = imaginary[reversed];
        real[reversed] = tempReal; imaginary[reversed] = tempImag;
      }
    }
    for (let length = 2; length <= size; length *= 2) {
      const half = length / 2, angle = -2 * Math.PI / length;
      for (let start = 0; start < size; start += length) {
        for (let offset = 0; offset < half; offset += 1) {
          const cos = Math.cos(angle * offset), sin = Math.sin(angle * offset);
          const even = start + offset, odd = even + half;
          const oddReal = real[odd] * cos - imaginary[odd] * sin;
          const oddImag = real[odd] * sin + imaginary[odd] * cos;
          real[odd] = real[even] - oddReal; imaginary[odd] = imaginary[even] - oddImag;
          real[even] += oddReal; imaginary[even] += oddImag;
        }
      }
    }
  }

  function palette(value) {
    const t = Math.max(0, Math.min(1, value));
    if (t < 0.58) {
      const u = t / 0.58;
      return [Math.round(9 + 56 * u), Math.round(12 + 115 * u), Math.round(15 + 112 * u)];
    }
    const u = (t - 0.58) / 0.42;
    return [Math.round(65 + 149 * u), Math.round(127 + 35 * u), Math.round(127 - 48 * u)];
  }

  function drawSpectrogram(canvas, pcm, sampleRate, logarithmic) {
    const { context, width, height, dpr } = prepareCanvas(canvas);
    clear(context, width, height, "#090c0f");
    if (!(pcm instanceof Int16Array) || !pcm.length) {
      context.fillStyle = "rgba(231,226,216,0.42)"; context.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      context.fillText("RENDER AUDIO TO INSPECT THE SPECTRUM", 14, 20); return;
    }
    const pixelWidth = Math.max(1, Math.floor(width * dpr));
    const pixelHeight = Math.max(1, Math.floor(height * dpr));
    const offscreen = document.createElement("canvas"); offscreen.width = pixelWidth; offscreen.height = pixelHeight;
    const off = offscreen.getContext("2d"); const image = off.createImageData(pixelWidth, pixelHeight);
    const fftSize = 512, bins = fftSize / 2, frames = pcm.length / 2;
    const real = new Float64Array(fftSize), imaginary = new Float64Array(fftSize);
    for (let x = 0; x < pixelWidth; x += 1) {
      const centre = Math.floor(x * frames / pixelWidth);
      const start = Math.max(0, Math.min(frames - fftSize, centre - fftSize / 2));
      for (let index = 0; index < fftSize; index += 1) {
        const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * index / (fftSize - 1));
        real[index] = ((pcm[(start + index) * 2] + pcm[(start + index) * 2 + 1]) / 65536) * window;
        imaginary[index] = 0;
      }
      fftInPlace(real, imaginary);
      for (let y = 0; y < pixelHeight; y += 1) {
        const normalizedY = 1 - y / Math.max(1, pixelHeight - 1);
        let bin;
        if (logarithmic) {
          const minHz = 20, maxHz = sampleRate / 2;
          const hz = minHz * Math.pow(maxHz / minHz, normalizedY);
          bin = Math.max(1, Math.min(bins - 1, Math.round(hz / sampleRate * fftSize)));
        } else bin = Math.max(1, Math.min(bins - 1, Math.round(normalizedY * (bins - 1))));
        const magnitude = Math.sqrt(real[bin] * real[bin] + imaginary[bin] * imaginary[bin]);
        const db = 20 * Math.log10(magnitude + 1e-8);
        const color = palette((db + 72) / 72);
        const offset = (y * pixelWidth + x) * 4;
        image.data[offset] = color[0]; image.data[offset + 1] = color[1]; image.data[offset + 2] = color[2]; image.data[offset + 3] = 255;
      }
    }
    off.putImageData(image, 0, 0); context.drawImage(offscreen, 0, 0, width, height);
    context.fillStyle = "rgba(9,12,15,0.72)"; context.fillRect(5, 5, 52, 20);
    context.fillStyle = "rgba(231,226,216,0.78)"; context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillText(logarithmic ? "LOG Hz" : "LIN Hz", 11, 18);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KiB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MiB";
  }

  function formatDb(milli) { return (milli / 1000).toFixed(2) + " dBFS"; }

  S.Visuals = Object.freeze({
    prepareCanvas, drawGeometry, drawWaveform, drawSpectrogram, formatBytes, formatDb
  });
})(window.E8STUDIO);
