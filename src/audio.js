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

  // Soft low-passed noise (splashes) – unlike `noise` it has no harsh high end.
  wash(dur, { vol = 0.2, freq = 700, delay = 0 } = {}) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.3), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t0);
    s.stop(t0 + dur + 0.02);
  }

  // Everything is tuned to A minor pentatonic, the key of the music, so effects and music fit together.
  note(i) { return PENTA[((i % PENTA.length) + PENTA.length) % PENTA.length]; }

  // A shot is a soft "plop": a short sine drop on a note of the scale plus a little splash.
  shoot(v = 1, pitch = 1) {
    const f = this.note(Math.round((pitch - 0.5) * 6)) * 2;
    this.tone(f, 0.11, { type: 'sine', vol: 0.16 * v, slide: -f * 0.55 });
    this.wash(0.07, { vol: 0.07 * v, freq: 1400 });
  }
  splat(v = 1) { this.wash(0.2, { vol: 0.2 * v, freq: 600 }); }
  hit(v = 1) { this.tone(this.note(2), 0.07, { type: 'triangle', vol: 0.13 * v, slide: -90 }); }
  boom(v = 1) { this.wash(0.5, { vol: 0.42 * v, freq: 420 }); this.tone(55, 0.45, { type: 'sine', vol: 0.4 * v, slide: -22 }); }
  ability() { this.tone(this.note(0) * 2, 0.16, { type: 'triangle', vol: 0.12, slide: 220 }); this.wash(0.16, { vol: 0.08, freq: 1500 }); }
  ult() { [0, 2, 4, 5].forEach((n, i) => this.tone(this.note(n) * 2, 0.24, { type: 'triangle', vol: 0.13, delay: i * 0.06 })); this.boom(0.5); }
  levelUp() { [0, 2, 3, 5].forEach((n, i) => this.tone(this.note(n) * 2, 0.16, { type: 'triangle', vol: 0.16, delay: i * 0.07 })); }
  kill() { this.tone(this.note(3) * 2, 0.1, { type: 'triangle', vol: 0.16 }); this.tone(this.note(5) * 2, 0.22, { type: 'triangle', vol: 0.16, delay: 0.09 }); }
  death() { this.tone(this.note(2), 0.5, { type: 'triangle', vol: 0.16, slide: -120 }); }
  click() { this.tone(this.note(3) * 2, 0.06, { type: 'sine', vol: 0.16, slide: 120 }); }
  count() { this.tone(this.note(0) * 2, 0.12, { type: 'triangle', vol: 0.14 }); }
  go() { this.tone(this.note(5) * 2, 0.35, { type: 'triangle', vol: 0.16 }); }
  win() { [0, 2, 3, 5, 7].forEach((n, i) => this.tone(this.note(n) * 2, 0.3, { type: 'triangle', vol: 0.2, delay: i * 0.11 })); }
  lose() { [5, 3, 2, 0].forEach((n, i) => this.tone(this.note(n), 0.35, { type: 'triangle', vol: 0.18, delay: i * 0.16 })); }

  // Background groove at ~100 BPM: kick, soft snare, bass and a quiet melody over Am – F – C – G.
  startMusic(fast = false) {
    this.stopMusic();
    const roots = [110, 87.31, 130.81, 98];                 // A, F, C, G
    const thirds = [1.189, 1.26, 1.26, 1.26];               // minor third for Am, major for the rest
    const tune = [0, 2, 3, 2, 5, 3, 2, 0, 3, 5, 7, 5, 3, 2, 0, 2];
    const stepMs = fast ? 128 : 150;
    this.step = 0;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.enabled || document.hidden) return;
      const s = this.step++, beat = s % 16, bar = Math.floor(s / 16) % 4, root = roots[bar];
      if (beat % 8 === 0 || beat === 10) this.tone(120, 0.16, { type: 'sine', vol: 0.2, slide: -75 });   // kick
      if (beat % 8 === 4) this.wash(0.12, { vol: 0.07, freq: 2200 });                                      // snare
      if (beat % 2 === 1) this.wash(0.03, { vol: 0.018, freq: 6000 });                                     // hat
      if (beat % 4 === 0 || beat === 6 || beat === 14) this.tone(root, 0.24, { type: 'triangle', vol: 0.11 });
      if (beat === 0) { this.tone(root * 2, 2.2, { type: 'sine', vol: 0.03 }); this.tone(root * 2 * thirds[bar], 2.2, { type: 'sine', vol: 0.025 }); this.tone(root * 3, 2.2, { type: 'sine', vol: 0.02 }); }
      if (beat % 2 === 0 && (s >> 4) % 2 === 1) this.tone(this.note(tune[(s >> 1) % 16]) * 2, 0.18, { type: 'sine', vol: 0.035 });
    }, stepMs);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}

const PENTA = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 784];

export const audio = new AudioFX();
