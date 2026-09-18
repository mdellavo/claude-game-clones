// All sound is synthesized at runtime with WebAudio — no sample files.
export class Audio {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.engine = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.22;
    this.musicBus.connect(this.master);

    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    this.buildEngine();
    this.startMusic();
  }

  buildEngine() {
    const ctx = this.ctx;
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 23;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain);
    lfoGain.connect(o1.frequency);
    lfoGain.connect(o2.frequency);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 600;
    filt.Q.value = 3;
    const eg = ctx.createGain();
    eg.gain.value = 0;
    const g2 = ctx.createGain();
    g2.gain.value = 0.5;
    o1.connect(filt);
    o2.connect(g2);
    g2.connect(filt);
    filt.connect(eg);
    eg.connect(this.sfx);

    const water = ctx.createBufferSource();
    water.buffer = this.noiseBuf;
    water.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 900;
    wf.Q.value = 0.6;
    const wg = ctx.createGain();
    wg.gain.value = 0;
    water.connect(wf);
    wf.connect(wg);
    wg.connect(this.sfx);

    [o1, o2, lfo, water].forEach((n) => n.start());
    this.engine = { o1, o2, filt, eg, wg, wf };
  }

  setEngine({ speed, throttle, airborne, active }) {
    if (!this.engine) return;
    const e = this.engine;
    const t = this.ctx.currentTime;
    const rpm = 48 + speed * 3.4 + throttle * 26 + (airborne ? 40 * throttle : 0);
    e.o1.frequency.setTargetAtTime(rpm, t, 0.08);
    e.o2.frequency.setTargetAtTime(rpm * 0.502, t, 0.08);
    e.filt.frequency.setTargetAtTime(350 + throttle * 1400 + speed * 30, t, 0.1);
    e.eg.gain.setTargetAtTime(active ? 0.07 + throttle * 0.08 : 0, t, 0.1);
    e.wg.gain.setTargetAtTime(active && !airborne ? Math.min(0.35, speed * 0.014) : 0, t, 0.08);
    e.wf.frequency.setTargetAtTime(600 + speed * 40, t, 0.1);
  }

  noiseBurst(dur, freq, gain, type = 'lowpass') {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.25), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  tone(freq, dur, type = 'sine', gain = 0.2, when = 0, slideTo = null) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  splash(strength) {
    this.noiseBurst(0.35 + strength * 0.5, 2500 + strength * 3000, Math.min(0.6, 0.12 + strength * 0.5));
  }
  buoyGood() { this.tone(880, 0.12, 'triangle', 0.18); this.tone(1320, 0.18, 'triangle', 0.18, 0.08); }
  buoyBad() { this.tone(300, 0.35, 'square', 0.12, 0, 120); }
  bump() { this.noiseBurst(0.18, 900, 0.35, 'lowpass'); this.tone(90, 0.2, 'sine', 0.3); }
  countBeep(go) { this.tone(go ? 1046 : 523, go ? 0.6 : 0.25, 'square', 0.12); }
  trick() { [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.14, i * 0.05)); }
  crash() { this.noiseBurst(0.9, 1800, 0.55); this.tone(160, 0.5, 'sawtooth', 0.12, 0, 60); }
  menuMove() { this.tone(700, 0.06, 'triangle', 0.1); }
  menuOk() { this.tone(900, 0.08, 'triangle', 0.14); this.tone(1350, 0.12, 'triangle', 0.12, 0.06); }
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.16, i * 0.12)); }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.22 : 0, this.ctx.currentTime, 0.2);
    return this.musicOn;
  }

  // Small original step-sequenced loop.
  startMusic() {
    const ctx = this.ctx;
    const bpm = 124;
    const step = 60 / bpm / 4;
    const root = 50; // D3 in MIDI
    const prog = [[0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [7, 11, 14, 17]];
    const bassPat = [0, null, 0, 12, null, 0, 7, null, 0, null, 0, 12, null, 7, 10, null];
    const arpPat = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 2];
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    let n = 0;
    let next = ctx.currentTime + 0.1;

    const voice = (freq, t, dur, type, gain, cutoff) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(cutoff, t);
      f.frequency.exponentialRampToValueAtTime(cutoff * 0.3, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(this.musicBus);
      o.start(t); o.stop(t + dur + 0.02);
    };
    const hat = (t, gain) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(f); f.connect(g); g.connect(this.musicBus);
      src.start(t, Math.random()); src.stop(t + 0.06);
    };
    const kick = (t) => {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g); g.connect(this.musicBus);
      o.start(t); o.stop(t + 0.2);
    };

    const tick = () => {
      while (next < ctx.currentTime + 0.15) {
        const bar = Math.floor(n / 16) % prog.length;
        const s = n % 16;
        const chord = prog[bar];
        if (s % 4 === 0) kick(next);
        hat(next, s % 2 ? 0.05 : 0.1);
        const b = bassPat[s];
        if (b !== null) voice(hz(root - 12 + chord[0] + b), next, step * 1.6, 'sawtooth', 0.35, 900);
        if (s % 2 === 0 || s === 7) voice(hz(root + 12 + chord[arpPat[s]]), next, step * 1.2, 'square', 0.1, 3200);
        if (s === 0) chord.forEach((c) => voice(hz(root + c), next, step * 14, 'triangle', 0.06, 2000));
        next += step;
        n++;
      }
    };
    this.musicTimer = setInterval(tick, 50);
  }
}
