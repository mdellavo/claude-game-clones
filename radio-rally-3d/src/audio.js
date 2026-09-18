// Tiny WebAudio synth: engine drone, chiptune SFX and a looping bassline.

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = true;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.8;
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.22;
    this.musicBus.connect(this.master);

    // engine
    const e = this.ctx.createOscillator();
    e.type = 'sawtooth';
    const e2 = this.ctx.createOscillator();
    e2.type = 'square';
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    e.connect(lp);
    e2.connect(lp);
    lp.connect(this.engineGain);
    this.engineGain.connect(this.master);
    e.start();
    e2.start();
    this.engine = e;
    this.engine2 = e2;

    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.nextNote = 0;
    this.step = 0;
    setInterval(() => this.schedule(), 25);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
    return this.muted;
  }

  setEngine(speed, throttle, active) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 48 + Math.abs(speed) * 5.2 + Math.max(0, throttle) * 12;
    this.engine.frequency.setTargetAtTime(f, t, 0.05);
    this.engine2.frequency.setTargetAtTime(f * 0.5 + 1.5, t, 0.05);
    this.engineGain.gain.setTargetAtTime(active ? 0.035 + Math.max(0, throttle) * 0.03 : 0, t, 0.08);
  }

  tone(freq, dur = 0.1, type = 'square', vol = 0.2, slide = null, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur = 0.3, vol = 0.3, freq = 1200, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(80, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  countdown(go) {
    this.tone(go ? 880 : 440, go ? 0.5 : 0.18, 'square', 0.25);
  }
  pickup() {
    [660, 880, 1320].forEach((f, i) => this.tone(f, 0.08, 'square', 0.15, null, i * 0.05));
  }
  upgrade() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.1, 'square', 0.15, null, i * 0.06));
  }
  letter() {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.25, null, i * 0.07));
  }
  missile() {
    this.tone(900, 0.35, 'sawtooth', 0.12, 200);
    this.noise(0.3, 0.15, 3000);
  }
  bombDrop() {
    this.tone(300, 0.15, 'square', 0.15, 120);
  }
  explosion() {
    this.noise(0.8, 0.5, 1800);
    this.tone(120, 0.5, 'square', 0.2, 30);
  }
  wall(power) {
    this.noise(0.12, Math.min(0.3, power * 0.015), 600);
  }
  bump() {
    this.tone(160, 0.08, 'square', 0.12, 90);
  }
  zipper() {
    this.tone(300, 0.4, 'sawtooth', 0.12, 1400);
  }
  splash() {
    this.noise(0.25, 0.15, 2500);
  }
  skid() {
    this.tone(500, 0.3, 'triangle', 0.08, 300);
  }
  land() {
    this.noise(0.15, 0.2, 400);
  }
  lap() {
    [988, 1319].forEach((f, i) => this.tone(f, 0.15, 'square', 0.18, null, i * 0.12));
  }
  fanfare() {
    const seq = [523, 523, 523, 659, 784, 659, 784, 1047];
    seq.forEach((f, i) => this.tone(f, i === seq.length - 1 ? 0.6 : 0.12, 'square', 0.18, null, i * 0.13));
  }
  sad() {
    [392, 370, 349, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.2, null, i * 0.28));
  }
  blip() {
    this.tone(1200, 0.05, 'square', 0.1);
  }

  // --- music: simple 2-voice chiptune loop
  schedule() {
    if (!this.ctx || !this.musicOn) return;
    const spb = 60 / 150 / 2; // eighth notes at 150bpm
    while (this.nextNote < this.ctx.currentTime + 0.12) {
      if (this.nextNote < this.ctx.currentTime - 0.2) this.nextNote = this.ctx.currentTime;
      this.playStep(this.step, this.nextNote);
      this.nextNote += spb;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(step, t) {
    const bassRoots = [45, 45, 41, 43]; // A, A, F, G (midi)
    const bar = Math.floor(step / 16);
    const root = bassRoots[bar];
    const bassPat = [0, 12, 0, 12, 0, 12, 7, 12];
    const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
    this.voice(midi(root + bassPat[step % 8]), t, 0.11, 'triangle', 0.5);
    const lead = [
      69, null, 72, null, 76, 74, 72, null, 69, null, 67, 69, null, null, 64, null,
      69, null, 72, null, 76, 79, 76, null, 74, null, 72, 74, null, null, 76, null,
      65, null, 69, null, 72, 74, 72, null, 69, null, 67, 65, null, null, 64, null,
      67, null, 71, null, 74, 76, 74, null, 71, 72, 74, 76, 79, null, 76, null,
    ][step];
    if (lead) this.voice(midi(lead + 12), t, 0.1, 'square', 0.18);
    if (step % 4 === 2) this.hat(t);
  }

  voice(freq, t, dur, type, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hat(t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.06);
  }
}
