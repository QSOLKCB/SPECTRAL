(function defineSpectrogram(S) {
  "use strict";

  function fft(real, imag) {
    const size = real.length;
    for (let i = 1, j = 0; i < size; i += 1) {
      let bit = size >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        const temporaryReal = real[i]; real[i] = real[j]; real[j] = temporaryReal;
        const temporaryImag = imag[i]; imag[i] = imag[j]; imag[j] = temporaryImag;
      }
    }
    for (let length = 2; length <= size; length <<= 1) {
      const angle = -2 * Math.PI / length;
      const wLengthReal = Math.cos(angle);
      const wLengthImag = Math.sin(angle);
      for (let start = 0; start < size; start += length) {
        let wr = 1;
        let wi = 0;
        for (let j = 0; j < length / 2; j += 1) {
          const even = start + j;
          const odd = even + length / 2;
          const oddReal = real[odd] * wr - imag[odd] * wi;
          const oddImag = real[odd] * wi + imag[odd] * wr;
          real[odd] = real[even] - oddReal;
          imag[odd] = imag[even] - oddImag;
          real[even] += oddReal;
          imag[even] += oddImag;
          const nextWr = wr * wLengthReal - wi * wLengthImag;
          wi = wr * wLengthImag + wi * wLengthReal;
          wr = nextWr;
        }
      }
    }
  }

  function palette(value) {
    const normalized = Math.max(0, Math.min(1, value));
    if (normalized < .2) {
      const t = normalized / .2;
      return [Math.round(8 + t * 18), Math.round(10 + t * 25), Math.round(12 + t * 30)];
    }
    if (normalized < .55) {
      const t = (normalized - .2) / .35;
      return [Math.round(26 + t * 94), Math.round(35 + t * 73), Math.round(42 + t * 45)];
    }
    const t = (normalized - .55) / .45;
    return [Math.round(120 + t * 125), Math.round(108 + t * 90), Math.round(87 + t * 60)];
  }

  class SpectrogramView {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas.getContext("2d");
      this.pcm = null;
      this.sampleRate = 44100;
      this.channels = 2;
      this.fftSize = 512;
      this.scale = "log";
      this.zoom = 1;
      this.offset = 0;
      this.renderToken = 0;
      window.addEventListener("resize", () => this.resize());
      this.resize();
    }

    setPcm(pcm, sampleRate, channels) {
      this.pcm = pcm;
      this.sampleRate = sampleRate;
      this.channels = channels;
      this.draw();
    }

    setOptions(fftSize, scale) {
      this.fftSize = Number(fftSize);
      this.scale = scale;
      this.draw();
    }

    setView(view) {
      this.zoom = view.zoom;
      this.offset = view.offset;
      this.draw();
    }

    resize() {
      const bounds = this.canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const ratio = Math.min(1.5, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(bounds.width * ratio));
      const height = Math.max(1, Math.round(bounds.height * ratio));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.draw();
      }
    }

    drawEmpty() {
      const ctx = this.context;
      ctx.fillStyle = "#080a0b";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw() {
      const token = ++this.renderToken;
      this.drawEmpty();
      if (!this.pcm || !this.pcm.length) return;
      requestAnimationFrame(() => {
        if (token !== this.renderToken) return;
        this.compute(token);
      });
    }

    compute(token) {
      const width = this.canvas.width;
      const height = this.canvas.height;
      const frameCount = Math.floor(this.pcm.length / this.channels);
      const firstFrame = Math.floor(this.offset * frameCount);
      const visibleFrames = Math.max(this.fftSize, Math.floor(frameCount / this.zoom));
      const lastFrame = Math.min(frameCount, firstFrame + visibleFrames);
      const columns = Math.min(width, 720);
      const hop = Math.max(1, Math.floor((lastFrame - firstFrame - this.fftSize) / Math.max(1, columns - 1)));
      const actualColumns = Math.max(1, Math.min(columns, Math.floor(Math.max(0, lastFrame - firstFrame - this.fftSize) / hop) + 1));
      const magnitudes = new Array(actualColumns);
      let globalMaximum = 1e-12;
      const real = new Float64Array(this.fftSize);
      const imag = new Float64Array(this.fftSize);
      const bins = this.fftSize / 2;
      for (let column = 0; column < actualColumns; column += 1) {
        const start = Math.min(Math.max(0, frameCount - this.fftSize), firstFrame + column * hop);
        for (let i = 0; i < this.fftSize; i += 1) {
          let sample = 0;
          for (let channel = 0; channel < this.channels; channel += 1) sample += this.pcm[(start + i) * this.channels + channel];
          const windowValue = .5 - .5 * Math.cos(2 * Math.PI * i / (this.fftSize - 1));
          real[i] = sample / this.channels / 32768 * windowValue;
          imag[i] = 0;
        }
        fft(real, imag);
        const spectrum = new Float32Array(bins);
        for (let bin = 0; bin < bins; bin += 1) {
          const magnitude = Math.sqrt(real[bin] * real[bin] + imag[bin] * imag[bin]);
          spectrum[bin] = magnitude;
          globalMaximum = Math.max(globalMaximum, magnitude);
        }
        magnitudes[column] = spectrum;
      }
      if (token !== this.renderToken) return;

      const image = this.context.createImageData(width, height);
      const minimumHz = 20;
      const maximumHz = this.sampleRate / 2;
      for (let x = 0; x < width; x += 1) {
        const column = Math.min(actualColumns - 1, Math.floor(x * actualColumns / width));
        const spectrum = magnitudes[column];
        for (let y = 0; y < height; y += 1) {
          const vertical = 1 - y / Math.max(1, height - 1);
          const hz = this.scale === "log"
            ? minimumHz * Math.pow(maximumHz / minimumHz, vertical)
            : vertical * maximumHz;
          const bin = Math.max(0, Math.min(bins - 1, Math.round(hz / maximumHz * (bins - 1))));
          const magnitude = spectrum[bin];
          const intensity = Math.max(0, Math.min(1, (Math.log10(magnitude / globalMaximum + 1e-8) + 5) / 5));
          const color = palette(Math.pow(intensity, .72));
          const index = (y * width + x) * 4;
          image.data[index] = color[0];
          image.data[index + 1] = color[1];
          image.data[index + 2] = color[2];
          image.data[index + 3] = 255;
        }
      }
      this.context.putImageData(image, 0, 0);
      this.drawAxes();
    }

    drawAxes() {
      const ctx = this.context;
      const width = this.canvas.width;
      const height = this.canvas.height;
      ctx.strokeStyle = "rgba(229,233,236,.11)";
      ctx.fillStyle = "rgba(229,233,236,.70)";
      ctx.font = Math.max(9, Math.round(9 * (window.devicePixelRatio || 1))) + "px monospace";
      ctx.textBaseline = "top";
      const labels = this.scale === "log" ? [20,100,500,1000,5000,10000,20000] : [0,5000,10000,15000,20000];
      for (const hz of labels) {
        if (hz > this.sampleRate / 2) continue;
        const vertical = this.scale === "log" ? Math.log(hz / 20) / Math.log((this.sampleRate / 2) / 20) : hz / (this.sampleRate / 2);
        const y = height - vertical * height;
        ctx.beginPath(); ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(width, Math.round(y) + .5); ctx.stroke();
        ctx.fillText(hz >= 1000 ? (hz / 1000) + "k" : String(hz), 5, Math.max(2, y + 2));
      }
    }
  }

  S.UI.SpectrogramView = SpectrogramView;
})(window.SPECTRAL);
