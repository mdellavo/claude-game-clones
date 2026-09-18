// Procedural sound effects - no audio assets needed.
let ctx = null;
let master = null;
let noiseBuf = null;
export const audioSettings = { volume: 0.5, muted: false };

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = audioSettings.volume;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setVolume(v) {
  audioSettings.volume = v;
  if (master) master.gain.value = audioSettings.muted ? 0 : v;
}
export function setMuted(m) {
  audioSettings.muted = m;
  if (master) master.gain.value = m ? 0 : audioSettings.volume;
}

function noise(t, dur, { freq = 1000, q = 1, type = 'lowpass', gain = 0.5, attack = 0.002, sweepTo = null } = {}) {
  const c = ctx;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

function tone(t, dur, { freq = 440, to = null, type = 'sine', gain = 0.3, attack = 0.005 } = {}) {
  const c = ctx;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

let lastStep = 0;
export function sfx(name, arg) {
  if (audioSettings.muted) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime + 0.001;
  switch (name) {
    case 'bullet':
      noise(t, 0.18, { freq: 2200, sweepTo: 400, gain: 0.6 });
      tone(t, 0.08, { freq: 180, to: 60, type: 'square', gain: 0.15 });
      break;
    case 'shell':
      noise(t, 0.35, { freq: 1400, sweepTo: 150, gain: 0.8 });
      tone(t, 0.2, { freq: 120, to: 40, type: 'square', gain: 0.25 });
      break;
    case 'laser':
      tone(t, 0.25, { freq: 1800, to: 300, type: 'sawtooth', gain: 0.12 });
      tone(t, 0.2, { freq: 900, to: 200, type: 'sine', gain: 0.15 });
      break;
    case 'plasma':
      tone(t, 0.35, { freq: 600, to: 90, type: 'square', gain: 0.12 });
      noise(t, 0.3, { freq: 3000, sweepTo: 300, type: 'bandpass', q: 3, gain: 0.3 });
      break;
    case 'rocket':
      noise(t, 0.6, { freq: 600, sweepTo: 2000, type: 'bandpass', q: 2, gain: 0.4, attack: 0.05 });
      break;
    case 'stun':
      tone(t, 0.3, { freq: 300, to: 900, type: 'triangle', gain: 0.2 });
      break;
    case 'hit':
      noise(t, 0.08, { freq: 900, gain: 0.35 });
      break;
    case 'ricochet':
      tone(t, 0.12, { freq: 2600 + Math.random() * 800, to: 1400, type: 'sine', gain: 0.05 });
      break;
    case 'explosion': {
      const r = arg || 2;
      noise(t, 0.9 + r * 0.15, { freq: 900, sweepTo: 60, gain: 1.0, attack: 0.005 });
      tone(t, 0.6 + r * 0.1, { freq: 90, to: 30, type: 'sine', gain: 0.6 });
      break;
    }
    case 'smoke':
      noise(t, 0.8, { freq: 1500, sweepTo: 400, gain: 0.3, attack: 0.05 });
      break;
    case 'stunblast':
      tone(t, 0.6, { freq: 200, to: 1200, type: 'sine', gain: 0.3 });
      noise(t, 0.5, { freq: 3000, type: 'highpass', gain: 0.2 });
      break;
    case 'throw':
      noise(t, 0.25, { freq: 800, sweepTo: 2500, type: 'bandpass', q: 1, gain: 0.12, attack: 0.05 });
      break;
    case 'melee':
      noise(t, 0.15, { freq: 500, gain: 0.5 });
      tone(t, 0.12, { freq: 140, to: 60, type: 'square', gain: 0.2 });
      break;
    case 'step': {
      if (c.currentTime - lastStep < 0.08) return;
      lastStep = c.currentTime;
      const alien = arg && arg !== 'soldier';
      noise(t, 0.05, { freq: alien ? 600 : 1200, gain: 0.08 });
      break;
    }
    case 'door':
      noise(t, 0.4, { freq: 400, sweepTo: 2400, type: 'bandpass', q: 4, gain: 0.2, attack: 0.05 });
      break;
    case 'aliendie':
      tone(t, 0.6, { freq: 900, to: 120, type: 'sawtooth', gain: 0.12 });
      tone(t + 0.05, 0.5, { freq: 1300, to: 200, type: 'square', gain: 0.05 });
      break;
    case 'humandie':
      tone(t, 0.5, { freq: 300, to: 90, type: 'sawtooth', gain: 0.1 });
      noise(t, 0.3, { freq: 700, gain: 0.2 });
      break;
    case 'spotted':
      tone(t, 0.12, { freq: 880, type: 'square', gain: 0.08 });
      tone(t + 0.12, 0.2, { freq: 660, type: 'square', gain: 0.08 });
      break;
    case 'click':
      tone(t, 0.04, { freq: 1200, type: 'square', gain: 0.04 });
      break;
    case 'error':
      tone(t, 0.15, { freq: 180, type: 'square', gain: 0.08 });
      break;
    case 'turn':
      tone(t, 0.15, { freq: 440, type: 'triangle', gain: 0.12 });
      tone(t + 0.15, 0.3, { freq: 660, type: 'triangle', gain: 0.12 });
      break;
    case 'alienturn':
      tone(t, 0.8, { freq: 110, to: 90, type: 'sawtooth', gain: 0.08 });
      tone(t, 0.8, { freq: 165, to: 130, type: 'sine', gain: 0.1 });
      break;
    case 'victory':
      [523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.15, 0.4, { freq: f, type: 'triangle', gain: 0.15 }));
      break;
    case 'defeat':
      [392, 330, 262, 196].forEach((f, i) => tone(t + i * 0.2, 0.5, { freq: f, type: 'sawtooth', gain: 0.08 }));
      break;
  }
}
