// Tiny chiptune-style synthesizer: every sound is generated, no samples.
let ctx = null;
let master = null;
let noiseBuf = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.25;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.25;
  return muted;
}

function tone(freq, dur, { type = 'square', vol = 0.5, slide = 0, delay = 0 } = {}) {
  const c = ensure();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.5, freq = 2000, delay = 0, q = 1 } = {}) {
  const c = ensure();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(80, t + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur + 0.02);
}

const N = (semi) => 440 * Math.pow(2, semi / 12);

export const sfx = {
  sword: () => { noise(0.12, { vol: 0.35, freq: 6000 }); tone(900, 0.08, { vol: 0.12, slide: 0.5 }); },
  beam: () => { for (let i = 0; i < 4; i++) tone(N(12 + i * 3), 0.06, { vol: 0.15, delay: i * 0.03 }); },
  hit: () => { tone(220, 0.12, { vol: 0.3, slide: 0.4 }); noise(0.08, { vol: 0.2, freq: 3000 }); },
  kill: () => { noise(0.3, { vol: 0.4, freq: 5000 }); tone(600, 0.2, { vol: 0.15, slide: 0.2 }); },
  hurt: () => { tone(300, 0.25, { vol: 0.35, slide: 0.3, type: 'sawtooth' }); },
  shield: () => { tone(1500, 0.05, { vol: 0.2 }); tone(1200, 0.05, { vol: 0.2, delay: 0.04 }); },
  rupee: () => { tone(N(15), 0.06, { vol: 0.2 }); tone(N(22), 0.12, { vol: 0.2, delay: 0.05 }); },
  heart: () => { tone(N(7), 0.08, { vol: 0.2 }); tone(N(12), 0.12, { vol: 0.2, delay: 0.07 }); },
  item: () => {
    [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => tone(N(s), 0.12, { vol: 0.2, delay: i * 0.09 }));
  },
  fanfare: () => {
    [0, 4, 7, 12, 11, 7, 12, 16, 19, 24].forEach((s, i) => {
      tone(N(s), 0.18, { vol: 0.2, delay: i * 0.13 });
      tone(N(s - 12), 0.18, { vol: 0.1, delay: i * 0.13, type: 'triangle' });
    });
  },
  secret: () => { [0, 3, 6, 9, 12, 15, 18, 24].forEach((s, i) => tone(N(s), 0.1, { vol: 0.18, delay: i * 0.08 })); },
  bombPlace: () => tone(200, 0.08, { vol: 0.25 }),
  explode: () => { noise(0.7, { vol: 0.8, freq: 1500, q: 0.5 }); tone(80, 0.4, { vol: 0.4, slide: 0.3, type: 'triangle' }); },
  door: () => { tone(150, 0.1, { vol: 0.3 }); tone(110, 0.15, { vol: 0.3, delay: 0.08 }); },
  unlock: () => { tone(N(0), 0.08, { vol: 0.25 }); tone(N(7), 0.1, { vol: 0.25, delay: 0.08 }); },
  text: () => tone(N(19), 0.03, { vol: 0.08 }),
  stairs: () => { for (let i = 0; i < 6; i++) tone(N(-i * 2), 0.08, { vol: 0.2, delay: i * 0.07 }); },
  lowHealth: () => tone(N(24), 0.08, { vol: 0.1 }),
  boomerang: () => tone(N(10), 0.05, { vol: 0.08, slide: 1.3 }),
  bossRoar: () => { tone(90, 0.6, { vol: 0.4, slide: 0.5, type: 'sawtooth' }); noise(0.5, { vol: 0.3, freq: 800 }); },
  fireball: () => noise(0.25, { vol: 0.25, freq: 1200 }),
  menu: () => tone(N(12), 0.05, { vol: 0.15 }),
  pause: () => { tone(N(12), 0.06, { vol: 0.15 }); tone(N(19), 0.06, { vol: 0.15, delay: 0.06 }); },
  die: () => { [0, -2, -4, -7, -12].forEach((s, i) => tone(N(s), 0.25, { vol: 0.25, delay: i * 0.2, type: 'triangle' })); },
  stun: () => tone(N(20), 0.1, { vol: 0.15, slide: 0.5 }),
};
