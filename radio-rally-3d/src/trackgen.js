// Pure track geometry: spline sampling, nearest-point queries, height function.
// No three.js dependency so it can be validated in Node.

const STEP_TARGET = 1.0;

function centripetal(p0, p1, p2, p3, t) {
  const d = (a, b) => Math.max(Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5), 1e-4);
  const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
  const tt = t1 + (t2 - t1) * t;
  const lerp = (a, b, ta, tb) => a.map((v, i) => ((tb - tt) / (tb - ta)) * v + ((tt - ta) / (tb - ta)) * b[i]);
  const A1 = lerp(p0, p1, t0, t1), A2 = lerp(p1, p2, t1, t2), A3 = lerp(p2, p3, t2, t3);
  const B1 = lerp(A1, A2, t0, t2), B2 = lerp(A2, A3, t1, t3);
  return lerp(B1, B2, t1, t2);
}

export class Track {
  constructor(def) {
    this.def = def;
    this.hw = def.hw ?? 7;
    const pts = def.points.map((p) => [p[0], p[1], p[2] ?? 0]);
    const n = pts.length;
    const SUB = 60;
    const dense = [];
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      for (let k = 0; k < SUB; k++) dense.push(centripetal(p0, p1, p2, p3, k / SUB));
    }
    // cumulative xz arc length
    const cum = [0];
    for (let i = 1; i <= dense.length; i++) {
      const a = dense[i - 1], b = dense[i % dense.length];
      cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const total = cum[dense.length];
    const N = Math.round(total / STEP_TARGET);
    this.N = N;
    this.step = total / N;
    this.length = total;
    this.x = new Float32Array(N);
    this.z = new Float32Array(N);
    this.h = new Float32Array(N);
    this.tx = new Float32Array(N);
    this.tz = new Float32Array(N);
    this.curv = new Float32Array(N);
    let j = 0;
    for (let i = 0; i < N; i++) {
      const s = i * this.step;
      while (cum[j + 1] < s) j++;
      const f = (s - cum[j]) / Math.max(cum[j + 1] - cum[j], 1e-6);
      const a = dense[j], b = dense[(j + 1) % dense.length];
      this.x[i] = a[0] + (b[0] - a[0]) * f;
      this.z[i] = a[1] + (b[1] - a[1]) * f;
      this.h[i] = Math.max(0, a[2] + (b[2] - a[2]) * f);
    }
    for (let i = 0; i < N; i++) {
      const a = (i - 1 + N) % N, b = (i + 1) % N;
      const dx = this.x[b] - this.x[a], dz = this.z[b] - this.z[a];
      const l = Math.hypot(dx, dz) || 1;
      this.tx[i] = dx / l;
      this.tz[i] = dz / l;
    }
    for (let i = 0; i < N; i++) {
      const a = (i - 3 + N) % N, b = (i + 3) % N;
      let da = Math.atan2(this.tx[b], this.tz[b]) - Math.atan2(this.tx[a], this.tz[a]);
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      this.curv[i] = da / (6 * this.step);
    }
    // features resolved from u (0..1) to s
    this.features = (def.features || []).map((f) => ({ ...f, s: (f.u ?? 0) * this.length, lat: f.lat ?? 0 }));
    this.ramps = this.features.filter((f) => f.type === 'ramp' || f.type === 'bump');
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < N; i++) {
      minX = Math.min(minX, this.x[i]); maxX = Math.max(maxX, this.x[i]);
      minZ = Math.min(minZ, this.z[i]); maxZ = Math.max(maxZ, this.z[i]);
    }
    this.bounds = { minX, maxX, minZ, maxZ };
  }

  wrapS(s) {
    s %= this.length;
    return s < 0 ? s + this.length : s;
  }

  baseHeight(s) {
    const f = this.wrapS(s) / this.step;
    const i = Math.floor(f) % this.N, k = f - Math.floor(f);
    return this.h[i] + (this.h[(i + 1) % this.N] - this.h[i]) * k;
  }

  rampHeight(s) {
    let y = 0;
    for (const r of this.ramps) {
      let ds = s - r.s;
      ds -= Math.round(ds / this.length) * this.length;
      if (ds < 0 || ds > r.len) continue;
      if (r.type === 'ramp') y += (r.h * ds) / r.len;
      else y += r.h * Math.sin((Math.PI * ds) / r.len);
    }
    return y;
  }

  groundHeight(s) {
    return this.baseHeight(s) + this.rampHeight(s);
  }

  // Position on the track at arc length s and lateral offset (positive = right).
  posAt(s, lat = 0, out = {}) {
    const f = this.wrapS(s) / this.step;
    const i = Math.floor(f) % this.N, k = f - Math.floor(f), i2 = (i + 1) % this.N;
    const tx = this.tx[i] + (this.tx[i2] - this.tx[i]) * k;
    const tz = this.tz[i] + (this.tz[i2] - this.tz[i]) * k;
    const l = Math.hypot(tx, tz) || 1;
    out.tx = tx / l;
    out.tz = tz / l;
    out.rx = -out.tz;
    out.rz = out.tx;
    out.x = this.x[i] + (this.x[i2] - this.x[i]) * k + out.rx * lat;
    out.z = this.z[i] + (this.z[i2] - this.z[i]) * k + out.rz * lat;
    out.y = this.groundHeight(s);
    out.heading = Math.atan2(out.tx, out.tz);
    return out;
  }

  // Nearest centerline point. hint = previous sample index (or -1 for full search).
  nearest(x, z, hint = -1, out = {}) {
    let best = -1, bd = Infinity;
    if (hint < 0) {
      for (let i = 0; i < this.N; i++) {
        const dx = x - this.x[i], dz = z - this.z[i], d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
    } else {
      for (let o = -24; o <= 24; o++) {
        const i = (hint + o + this.N) % this.N;
        const dx = x - this.x[i], dz = z - this.z[i], d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
    }
    const dx = x - this.x[best], dz = z - this.z[best];
    const along = dx * this.tx[best] + dz * this.tz[best];
    out.index = best;
    out.s = this.wrapS(best * this.step + along);
    out.lat = dx * -this.tz[best] + dz * this.tx[best];
    out.rx = -this.tz[best];
    out.rz = this.tx[best];
    out.tx = this.tx[best];
    out.tz = this.tz[best];
    out.dist = Math.sqrt(bd);
    return out;
  }

  // Curvature magnitude averaged over a window ahead of s.
  curvatureAhead(s, dist) {
    const i0 = Math.floor(this.wrapS(s) / this.step);
    const n = Math.max(1, Math.floor(dist / this.step));
    let m = 0;
    for (let k = 0; k < n; k += 2) m = Math.max(m, Math.abs(this.curv[(i0 + k) % this.N]));
    return m;
  }

  // Signed delta b - a along the loop, in (-L/2, L/2].
  deltaS(a, b) {
    let d = b - a;
    d -= Math.round(d / this.length) * this.length;
    return d;
  }
}
