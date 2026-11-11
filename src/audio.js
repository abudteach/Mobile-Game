// All sound is synthesised with WebAudio, so the app ships without audio files.
class AudioFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicTimer = null;
    this.step = 0;
    try { this.enabled = localStorage.getItem('dc_sound') !== '0'; } catch { /* ignore */ }
  }

  // Browsers only allow audio after a user gesture, so this is called from the first tap.
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.5 : 0;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setEnabled(on) {
    this.enabled = on;
    try { localStorage.setItem('dc_sound', on ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) this.master.gain.value = on ? 0.5 : 0;
  }

  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  noise(dur, { vol = 0.3, freq = 1200, q = 1, slide = 0, delay = 0 } = {}) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t0);
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + slide), t0 + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t0);
    s.stop(t0 + dur + 0.02);
  }

  shoot(v = 1) { this.tone(620, 0.09, { type: 'square', vol: 0.1 * v, slide: -380 }); this.noise(0.08, { vol: 0.16 * v, freq: 2400, slide: -1600 }); }
  splat(v = 1) { this.noise(0.16, { vol: 0.22 * v, freq: 700, q: 0.7, slide: -500 }); }
  hit(v = 1) { this.tone(240, 0.07, { type: 'triangle', vol: 0.2 * v, slide: -120 }); }
  boom(v = 1) { this.noise(0.5, { vol: 0.5 * v, freq: 300, q: 0.5, slide: -220 }); this.tone(110, 0.4, { type: 'sine', vol: 0.4 * v, slide: -70 }); }
  ability() { this.tone(330, 0.18, { type: 'sawtooth', vol: 0.14, slide: 500 }); this.noise(0.2, { vol: 0.14, freq: 1800 }); }
  ult() { [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.22, { type: 'square', vol: 0.12, delay: i * 0.06 })); this.boom(0.6); }
  levelUp() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', vol: 0.2, delay: i * 0.07 })); }
  kill() { this.tone(880, 0.1, { type: 'square', vol: 0.14 }); this.tone(1320, 0.2, { type: 'square', vol: 0.14, delay: 0.09 }); }
  death() { this.tone(300, 0.5, { type: 'sawtooth', vol: 0.18, slide: -240 }); }
  click() { this.tone(700, 0.06, { type: 'triangle', vol: 0.2, slide: 300 }); }
  count() { this.tone(440, 0.12, { type: 'square', vol: 0.14 }); }
  go() { this.tone(880, 0.35, { type: 'square', vol: 0.16 }); }
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.22, delay: i * 0.11 })); }
  lose() { [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.2, delay: i * 0.16 })); }

  // A small looping groove: bass + arpeggio + hats, scheduled a step at a time.
  startMusic(fast = false) {
    this.stopMusic();
    const bass = [110, 110, 146.8, 130.8];
    const arp = [440, 523.3, 659.3, 523.3, 587.3, 698.5, 880, 698.5];
    const stepMs = fast ? 125 : 150;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.enabled || document.hidden) return;
      const s = this.step++;
      const bar = Math.floor(s / 8) % 4;
      const k = bass[bar] / 110;
      if (s % 4 === 0) this.tone(bass[bar], 0.22, { type: 'triangle', vol: 0.16 });
      if (s % 8 === 4) this.noise(0.09, { vol: 0.1, freq: 1900, q: 0.8 });
      if (s % 2 === 1) this.noise(0.03, { vol: 0.04, freq: 7000, q: 2 });
      this.tone(arp[s % 8] * k, 0.1, { type: 'square', vol: 0.035 });
    }, stepMs);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}

export const audio = new AudioFX();
