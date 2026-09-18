import * as THREE from 'three';

// Accumulates flat-shaded, vertex-coloured triangles with per-vertex voxel ids
// (used for fog of war) and a glow factor (unlit emissive colour).
export class GeoBuilder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.col = [];
    this.vox = [];
    this.glow = [];
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.g = 0;
  }

  setVoxel(x, y, z) {
    this.vx = x;
    this.vy = y;
    this.vz = z;
  }

  tri(a, b, c, color) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nrm.push(nx, ny, nz);
      this.col.push(color.r, color.g, color.b);
      this.vox.push(this.vx, this.vy, this.vz);
      this.glow.push(this.g);
    }
  }

  quad(a, b, c, d, color) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  // axis-aligned box: min corner & size, in world coords (y up)
  box(x, y, z, sx, sy, sz, color, { top = null, bottom = false, sides = true } = {}) {
    const x1 = x + sx, y1 = y + sy, z1 = z + sz;
    const c = color;
    const tc = top || c;
    const side = shade(c, 0.86);
    const side2 = shade(c, 0.72);
    // top
    this.quad([x, y1, z], [x, y1, z1], [x1, y1, z1], [x1, y1, z], tc);
    if (sides) {
      this.quad([x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1], side); // +z
      this.quad([x1, y, z], [x, y, z], [x, y1, z], [x1, y1, z], side); // -z
      this.quad([x1, y, z1], [x1, y, z], [x1, y1, z], [x1, y1, z1], side2); // +x
      this.quad([x, y, z], [x, y, z1], [x, y1, z1], [x, y1, z], side2); // -x
    }
    if (bottom) this.quad([x, y, z], [x1, y, z], [x1, y, z1], [x, y, z1], shade(c, 0.5));
  }

  // centered box
  cbox(cx, y, cz, sx, sy, sz, color, opts) {
    this.box(cx - sx / 2, y, cz - sz / 2, sx, sy, sz, color, opts);
  }

  // n-sided prism (cylinder) / cone (r1 = top radius)
  cyl(cx, y, cz, r0, r1, h, color, n = 8, { top = true, rot = 0 } = {}) {
    const side = shade(color, 0.85);
    for (let i = 0; i < n; i++) {
      const a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * r0, y, cz + Math.sin(a0) * r0];
      const p1 = [cx + Math.cos(a1) * r0, y, cz + Math.sin(a1) * r0];
      const q0 = [cx + Math.cos(a0) * r1, y + h, cz + Math.sin(a0) * r1];
      const q1 = [cx + Math.cos(a1) * r1, y + h, cz + Math.sin(a1) * r1];
      const s = shade(side, 0.85 + 0.15 * Math.cos(a0 - 0.8));
      if (r1 > 0.0001) this.quad(p0, q0, q1, p1, s);
      else this.tri(p0, q0, p1, s);
      if (top && r1 > 0.0001) this.tri([cx, y + h, cz], q1, q0, color);
    }
  }

  // low-poly blob (octahedron subdivided once), jittered by rnd
  blob(cx, cy, cz, rx, ry, rz, color, rnd = null) {
    const verts = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
    ];
    const faces = [
      [0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 4, 3], [4, 1, 3], [1, 5, 3], [5, 0, 3],
    ];
    const mid = new Map();
    const vs = verts.map((v) => v.slice());
    const getMid = (a, b) => {
      const k = a < b ? a + '_' + b : b + '_' + a;
      if (mid.has(k)) return mid.get(k);
      const va = vs[a], vb = vs[b];
      const m = [(va[0] + vb[0]) / 2, (va[1] + vb[1]) / 2, (va[2] + vb[2]) / 2];
      const l = Math.hypot(...m);
      vs.push([m[0] / l, m[1] / l, m[2] / l]);
      mid.set(k, vs.length - 1);
      return vs.length - 1;
    };
    const f2 = [];
    for (const [a, b, c] of faces) {
      const ab = getMid(a, b), bc = getMid(b, c), ca = getMid(c, a);
      f2.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    const pts = vs.map((v) => {
      const j = rnd ? 0.8 + rnd() * 0.35 : 1;
      return [cx + v[0] * rx * j, cy + v[1] * ry * j, cz + v[2] * rz * j];
    });
    for (const [a, b, c] of f2) {
      const ny = (vs[a][1] + vs[b][1] + vs[c][1]) / 3;
      this.tri(pts[a], pts[b], pts[c], shade(color, 0.75 + 0.3 * ny));
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aVox', new THREE.Float32BufferAttribute(this.vox, 3));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glow, 1));
    g.computeBoundingSphere();
    return g;
  }

  get empty() {
    return this.pos.length === 0;
  }
}

export function col(hex) {
  const c = new THREE.Color(hex);
  return { r: c.r, g: c.g, b: c.b };
}
export function shade(c, f) {
  return { r: Math.min(1, c.r * f), g: Math.min(1, c.g * f), b: Math.min(1, c.b * f) };
}
export function mix(a, b, t) {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}
export function jitter(c, amount, rnd) {
  const f = 1 + (rnd() - 0.5) * 2 * amount;
  return shade(c, f);
}

export function hashRand(x, y, z, salt = 0) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z + 7, 1103515245) + Math.imul(salt, 1442695041)) | 0;
  return () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = Math.imul(h ^ (h >>> 16), 668265263);
    h = h ^ (h >>> 15);
    return ((h >>> 0) % 10000) / 10000;
  };
}
