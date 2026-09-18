import * as THREE from 'three';
import { mulberry32 } from './noise.js';

export class Track {
  constructor(course) {
    const sc = course.scale ?? 1;
    const pts = course.points.map(([x, z]) => new THREE.Vector3(x * sc, 0, z * sc));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    this.length = curve.getLength();
    const N = (this.N = Math.ceil(this.length / 0.5));
    this.ds = this.length / N;
    this.width = course.width;
    const sp = curve.getSpacedPoints(N);
    this.px = new Float32Array(N);
    this.pz = new Float32Array(N);
    this.tx = new Float32Array(N);
    this.tz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      this.px[i] = sp[i].x;
      this.pz[i] = sp[i].z;
    }
    for (let i = 0; i < N; i++) {
      const a = (i - 2 + N) % N, b = (i + 2) % N;
      const dx = this.px[b] - this.px[a], dz = this.pz[b] - this.pz[a];
      const l = Math.hypot(dx, dz) || 1;
      this.tx[i] = dx / l;
      this.tz[i] = dz / l;
    }

    // Coarse polyline for distance-field generation.
    this.poly = [];
    const step = Math.max(1, Math.round(6 / this.ds));
    for (let i = 0; i < N; i += step) this.poly.push([this.px[i], this.pz[i]]);

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < N; i++) {
      minX = Math.min(minX, this.px[i]); maxX = Math.max(maxX, this.px[i]);
      minZ = Math.min(minZ, this.pz[i]); maxZ = Math.max(maxZ, this.pz[i]);
    }
    this.bounds = { minX, maxX, minZ, maxZ };

    this.ramps = (course.ramps || []).map((r) => ({ s: r.t * this.length, off: r.off }));
    this.buildBuoys(course);
  }

  buildBuoys(course) {
    const rnd = mulberry32(course.seed * 31 + 7);
    this.buoys = [];
    let side = 1;
    for (let s = 90; s < this.length - 60; s += course.buoySpacing * (0.85 + rnd() * 0.3)) {
      if (this.ramps.some((r) => Math.abs(r.s - s) < 30)) continue;
      const off = side * course.buoyOffset * (0.75 + rnd() * 0.5);
      // Red: keep the buoy on your LEFT (pass on its right). Yellow: keep it on your RIGHT.
      this.buoys.push({ s, off, color: off > 0 ? 'y' : 'r' });
      side = -side;
    }
  }

  wrap(s) {
    const L = this.length;
    return ((s % L) + L) % L;
  }

  sample(s) {
    s = this.wrap(s);
    const f = s / this.ds;
    const i = Math.floor(f) % this.N;
    const j = (i + 1) % this.N;
    const u = f - Math.floor(f);
    const x = this.px[i] + (this.px[j] - this.px[i]) * u;
    const z = this.pz[i] + (this.pz[j] - this.pz[i]) * u;
    let tx = this.tx[i] + (this.tx[j] - this.tx[i]) * u;
    let tz = this.tz[i] + (this.tz[j] - this.tz[i]) * u;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    return { x, z, tx, tz, rx: -tz, rz: tx, yaw: Math.atan2(tx, tz) };
  }

  // Lateral offset is measured along the rider's right vector (-tz, tx).
  pointAt(s, lat) {
    const p = this.sample(s);
    return { x: p.x + p.rx * lat, z: p.z + p.rz * lat, yaw: p.yaw };
  }

  nearest(x, z, hint = -1) {
    const N = this.N;
    let best = -1, bestD = Infinity;
    if (hint < 0) {
      for (let i = 0; i < N; i += 4) {
        const d = (this.px[i] - x) ** 2 + (this.pz[i] - z) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      hint = best;
    }
    const W = 120;
    for (let k = -W; k <= W; k++) {
      const i = (hint + k + N) % N;
      const d = (this.px[i] - x) ** 2 + (this.pz[i] - z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    const dx = x - this.px[best], dz = z - this.pz[best];
    const s = this.wrap(best * this.ds + dx * this.tx[best] + dz * this.tz[best]);
    const lat = dx * -this.tz[best] + dz * this.tx[best];
    return { i: best, s, lat, tx: this.tx[best], tz: this.tz[best] };
  }
}
