// AUDIO — WebAudio, dibuat saat gesture pertama (Enter / klik).
// Wind: noise buffer + lowpass, gain ∝ speed/42.
// Ring: chime 2 nada sine. Thermal: whoosh (noise sweep).
// Landing: thud (sine drop). Crash: noise burst.
// Mute (M): master gain 0. Semua dibungkus try/catch — audio tidak pernah
// boleh melempar error ke game.

import { CFG } from './config.js';

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.windGain = null;
    this.windFilter = null;
    this.muted = false;
    this._started = false;
  }

  // Dipanggil dari gesture pertama (Enter / klik tombol menu).
  ensure() {
    if (this._started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);

      // Wind: buffer noise 2 detik, loop, lewat lowpass.
      const len = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.value = 400;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;
      src.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.master);
      src.start();
      this._started = true;
    } catch (_err) {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
      }
    } catch (_err) {
      // abaikan
    }
  }

  // Gain angin mengikuti kecepatan (0..1 dari speed/42).
  setWind(speed) {
    try {
      if (!this.ctx || !this.windGain) return;
      const level = Math.max(0, Math.min(1, speed / CFG.MAX_SPEED));
      this.windGain.gain.setTargetAtTime(0.02 + level * 0.16, this.ctx.currentTime, 0.1);
      this.windFilter.frequency.setTargetAtTime(300 + level * 900, this.ctx.currentTime, 0.1);
    } catch (_err) {
      // abaikan
    }
  }

  _tone(freq, dur, type, vol, when) {
    try {
      if (!this.ctx || !this.master) return;
      const t0 = this.ctx.currentTime + (when || 0);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol || 0.25, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (_err) {
      // abaikan
    }
  }

  ring() {
    this._tone(880, 0.35, 'sine', 0.3, 0);
    this._tone(1318.5, 0.5, 'sine', 0.25, 0.12);
  }

  thermal() {
    try {
      if (!this.ctx || !this.master) return;
      const t0 = this.ctx.currentTime;
      const len = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(300, t0);
      filter.frequency.exponentialRampToValueAtTime(2400, t0 + 0.8);
      filter.Q.value = 1.2;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.3, t0 + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
      src.stop(t0 + 1);
    } catch (_err) {
      // abaikan
    }
  }

  landing() {
    this._tone(180, 0.4, 'sine', 0.4, 0);
    this._tone(90, 0.5, 'sine', 0.35, 0.08);
  }

  crash() {
    try {
      if (!this.ctx || !this.master) return;
      const t0 = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.5;
      src.connect(gain);
      gain.connect(this.master);
      src.start(t0);
    } catch (_err) {
      // abaikan
    }
    this._tone(60, 0.6, 'sine', 0.4, 0);
  }
}
