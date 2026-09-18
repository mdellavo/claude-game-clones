import * as THREE from 'three';
import { mulberry32 } from './noise.js';

export const WAVE_COUNT = 8;

// Sum-of-sines ocean with peaked crests. The identical function runs in GLSL
// (see WAVE_GLSL) so rendered water and physics always agree.
export class Waves {
  constructor(cfg, seed = 1) {
    this.cfg = cfg;
    const rnd = mulberry32(seed * 977 + 3);
    this.list = [];
    const add = (lambda, amp, dir, sharp) => {
      const k = (Math.PI * 2) / lambda;
      const w = Math.sqrt(9.81 * k) * (cfg.speed ?? 1);
      this.list.push({ dx: Math.cos(dir), dz: Math.sin(dir), k, w, a: amp, sharp, ph: rnd() * Math.PI * 2 });
    };
    const d = cfg.dir;
    add(95 + rnd() * 30, cfg.swell, d + (rnd() - 0.5) * 0.3, 1.7);
    add(70 + rnd() * 20, cfg.swell * 0.65, d + 0.35 + (rnd() - 0.5) * 0.3, 1.6);
    add(52 + rnd() * 14, cfg.swell * 0.45, d - 0.4 + (rnd() - 0.5) * 0.3, 1.5);
    add(26 + rnd() * 8, cfg.chop, d + (rnd() - 0.5) * 1.6, 1.4);
    add(19 + rnd() * 6, cfg.chop * 0.8, d + (rnd() - 0.5) * 2.4, 1.3);
    add(14 + rnd() * 4, cfg.chop * 0.6, rnd() * Math.PI * 2, 1.2);
    add(8.5 + rnd() * 2, cfg.chop * 0.35, rnd() * Math.PI * 2, 1.0);
    add(6 + rnd() * 1.5, cfg.chop * 0.25, rnd() * Math.PI * 2, 1.0);

    this.maxAmp = this.list.reduce((s, w) => s + w.a, 0);
    this.uA = this.list.map((w) => new THREE.Vector4(w.dx, w.dz, w.k, w.w));
    this.uB = this.list.map((w) => new THREE.Vector4(w.a, w.sharp, w.ph, 0));
  }

  ampScale(t) {
    return 1 + (this.cfg.sets ?? 0) * Math.sin(t * 0.09);
  }

  height(x, z, t) {
    let h = 0;
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const w = L[i];
      const s = Math.sin((w.dx * x + w.dz * z) * w.k - w.w * t + w.ph);
      h += w.a * (2 * Math.pow((s + 1) * 0.5, w.sharp) - 1);
    }
    return h * this.ampScale(t);
  }
}

export const WAVE_GLSL = /* glsl */ `
uniform vec4 uWA[${WAVE_COUNT}];
uniform vec4 uWB[${WAVE_COUNT}];
uniform float uTime;
uniform float uAmpScale;
uniform sampler2D uHeight;
uniform vec4 uHBounds;

float terrainH(vec2 p) {
  vec2 uv = (p - uHBounds.xy) / uHBounds.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 30.0;
  return texture2D(uHeight, uv).r * 40.0 - 20.0;
}

float waveRaw(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < ${WAVE_COUNT}; i++) {
    vec4 A = uWA[i];
    vec4 B = uWB[i];
    float s = sin(dot(A.xy, p) * A.z - A.w * uTime + B.z);
    h += B.x * (2.0 * pow(max((s + 1.0) * 0.5, 0.0), B.y) - 1.0);
  }
  return h * uAmpScale;
}

float waveAtten(float th) { return clamp(-th / 7.0, 0.15, 1.0); }

float waterH(vec2 p) { return waveRaw(p) * waveAtten(terrainH(p)); }
`;
