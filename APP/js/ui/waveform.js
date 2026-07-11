(function defineWaveform(S) {
  "use strict";

  class WaveformView {
    constructor(canvas, options) {
      this.canvas = canvas;
      this.context = canvas.getContext("2d");
      this.options = options || {};
      this.pcm = null;
      this.sampleRate = 44100;
      this.channels = 2;
      this.zoom = 1;
      this.offset = 0;
      this.selection = null;
      this.drag = null;
      this.bind();
      this.resize();
    }

    bind() {
      this.canvas.addEventListener("wheel", event => {
        if (!this.pcm) return;
        event.preventDefault();
        const bounds = this.canvas.getBoundingClientRect();
        const anchor = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
        const visibleBefore = 1 / this.zoom;
        const absoluteAnchor = this.offset + anchor * visibleBefore;
        const factor = event.deltaY < 0 ? 1.35 : 1 / 1.35;
        this.zoom = Math.max(1, Math.min(64, this.zoom * factor));
        const visibleAfter = 1 / this.zoom;
        this.offset = Math.max(0, Math.min(1 - visibleAfter, absoluteAnchor - anchor * visibleAfter));
        this.notifyView();
        this.draw();
      }, { passive: false });

      this.canvas.addEventListener("pointerdown", event => {
        if (!this.pcm) return;
        this.canvas.setPointerCapture(event.pointerId);
        this.drag = { x: event.clientX, offset: this.offset, selecting: event.shiftKey };
        if (event.shiftKey) {
          const time = this.timeAtEvent(event);
          this.selection = { start: time, end: time };
          this.notifySelection();
        }
      });
      this.canvas.addEventListener("pointermove", event => {
        if (!this.drag || !this.pcm) return;
        if (this.drag.selecting) {
          this.selection.end = this.timeAtEvent(event);
          this.notifySelection();
        } else {
          const bounds = this.canvas.getBoundingClientRect();
          const delta = (event.clientX - this.drag.x) / bounds.width / this.zoom;
          this.offset = Math.max(0, Math.min(1 - 1 / this.zoom, this.drag.offset - delta));
          this.notifyView();
        }
        this.draw();
      });
      const endDrag = event => {
        if (this.drag && this.drag.selecting && this.selection && this.selection.start > this.selection.end) {
          const temporary = this.selection.start;
          this.selection.start = this.selection.end;
          this.selection.end = temporary;
          this.notifySelection();
        }
        this.drag = null;
        if (event.pointerId != null && this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
      };
      this.canvas.addEventListener("pointerup", endDrag);
      this.canvas.addEventListener("pointercancel", endDrag);
      window.addEventListener("resize", () => this.resize());
    }

    timeAtEvent(event) {
      const bounds = this.canvas.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      const duration = this.frameCount / this.sampleRate;
      return (this.offset + ratio / this.zoom) * duration;
    }

    get frameCount() {
      return this.pcm ? Math.floor(this.pcm.length / this.channels) : 0;
    }

    setPcm(pcm, sampleRate, channels) {
      this.pcm = pcm;
      this.sampleRate = sampleRate;
      this.channels = channels;
      this.reset();
    }

    reset() {
      this.zoom = 1;
      this.offset = 0;
      this.selection = null;
      this.notifyView();
      this.notifySelection();
      this.draw();
    }

    resize() {
      const bounds = this.canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(bounds.width * ratio));
      const height = Math.max(1, Math.round(bounds.height * ratio));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.draw();
      }
    }

    notifyView() {
      if (this.options.onViewChange) this.options.onViewChange({ zoom: this.zoom, offset: this.offset });
      if (this.options.onRangeChange) {
        const duration = this.frameCount / this.sampleRate;
        this.options.onRangeChange(this.offset * duration, Math.min(duration, (this.offset + 1 / this.zoom) * duration));
      }
    }

    notifySelection() {
      if (this.options.onSelectionChange) this.options.onSelectionChange(this.selection);
    }

    drawGrid(width, height) {
      const ctx = this.context;
      ctx.fillStyle = "#080a0b";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(145,155,164,0.09)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += width / 10) {
        ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, height); ctx.stroke();
      }
      for (let y = 0; y <= height; y += height / 4) {
        ctx.beginPath(); ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(width, Math.round(y) + .5); ctx.stroke();
      }
      ctx.strokeStyle = "rgba(215,164,71,0.24)";
      ctx.beginPath(); ctx.moveTo(0, height / 2 + .5); ctx.lineTo(width, height / 2 + .5); ctx.stroke();
    }

    draw() {
      const width = this.canvas.width;
      const height = this.canvas.height;
      this.drawGrid(width, height);
      if (!this.pcm || !this.frameCount) return;
      const first = Math.floor(this.offset * this.frameCount);
      const visibleFrames = Math.max(1, Math.floor(this.frameCount / this.zoom));
      const last = Math.min(this.frameCount, first + visibleFrames);
      const framesPerPixel = Math.max(1, (last - first) / width);
      const ctx = this.context;
      const half = height / 2;
      ctx.strokeStyle = "#d7a447";
      ctx.lineWidth = Math.max(1, window.devicePixelRatio || 1);
      ctx.beginPath();
      for (let x = 0; x < width; x += 1) {
        const start = Math.floor(first + x * framesPerPixel);
        const end = Math.min(last, Math.max(start + 1, Math.floor(first + (x + 1) * framesPerPixel)));
        if (start >= last || end <= start) continue;
        let minimum = 32767;
        let maximum = -32768;
        for (let frame = start; frame < end; frame += 1) {
          let mono = 0;
          for (let channel = 0; channel < this.channels; channel += 1) mono += this.pcm[frame * this.channels + channel];
          mono = Math.trunc(mono / this.channels);
          minimum = Math.min(minimum, mono);
          maximum = Math.max(maximum, mono);
        }
        const top = half - maximum / 32768 * (half - 8);
        const bottom = half - minimum / 32768 * (half - 8);
        ctx.moveTo(x + .5, top);
        ctx.lineTo(x + .5, bottom);
      }
      ctx.stroke();

      if (this.selection) {
        const duration = this.frameCount / this.sampleRate;
        const viewStart = this.offset * duration;
        const viewDuration = duration / this.zoom;
        const startX = (this.selection.start - viewStart) / viewDuration * width;
        const endX = (this.selection.end - viewStart) / viewDuration * width;
        ctx.fillStyle = "rgba(110,141,162,0.20)";
        ctx.fillRect(Math.min(startX, endX), 0, Math.abs(endX - startX), height);
        ctx.strokeStyle = "rgba(143,173,191,0.80)";
        ctx.strokeRect(Math.min(startX, endX) + .5, .5, Math.abs(endX - startX), height - 1);
      }
    }
  }

  S.UI.WaveformView = WaveformView;
})(window.SPECTRAL);
