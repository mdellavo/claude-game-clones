import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Noise2D, mulberry32, smoothstep, lerp, clamp } from './noise.js';

export class Heightfield {
  constructor(minX, minZ, cell, nx, nz) {
    Object.assign(this, { minX, minZ, cell, nx, nz });
    this.maxX = minX + (nx - 1) * cell;
    this.maxZ = minZ + (nz - 1) * cell;
    this.h = new Float32Array(nx * nz);
    this.dist = new Float32Array(nx * nz);
  }

  sample(x, z) {
    const fx = (x - this.minX) / this.cell, fz = (z - this.minZ) / this.cell;
    if (fx < 0 || fz < 0 || fx >= this.nx - 1 || fz >= this.nz - 1) return 40;
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const u = fx - ix, v = fz - iz;
    const nx = this.nx, H = this.h;
    const a = H[iz * nx + ix], b = H[iz * nx + ix + 1];
    const c = H[(iz + 1) * nx + ix], d = H[(iz + 1) * nx + ix + 1];
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }

  gradient(x, z) {
    const e = this.cell;
    return [
      (this.sample(x + e, z) - this.sample(x - e, z)) / (2 * e),
      (this.sample(x, z + e) - this.sample(x, z - e)) / (2 * e),
    ];
  }

  distAt(x, z) {
    const ix = Math.round((x - this.minX) / this.cell), iz = Math.round((z - this.minZ) / this.cell);
    if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) return 1e4;
    return this.dist[iz * this.nx + ix];
  }

  texture() {
    const data = new Uint8Array(this.nx * this.nz);
    for (let i = 0; i < data.length; i++) data[i] = clamp(Math.round(((this.h[i] + 20) / 40) * 255), 0, 255);
    const tex = new THREE.DataTexture(data, this.nx, this.nz, THREE.RedFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  // (minX, minZ, sizeX, sizeZ) aligned so texel centers match sample points.
  boundsVec() {
    const c = this.cell;
    return new THREE.Vector4(this.minX - c / 2, this.minZ - c / 2, this.nx * c, this.nz * c);
  }
}

export function buildHeightfield(course, track) {
  const pad = 460, cell = 4;
  const b = track.bounds;
  const minX = Math.floor((b.minX - pad) / cell) * cell;
  const minZ = Math.floor((b.minZ - pad) / cell) * cell;
  const nx = Math.ceil((b.maxX - b.minX + pad * 2) / cell) + 1;
  const nz = Math.ceil((b.maxZ - b.minZ + pad * 2) / cell) + 1;
  const hf = new Heightfield(minX, minZ, cell, nx, nz);
  const noise = new Noise2D(course.seed);
  const L = course.land;
  const w = course.width;
  const poly = track.poly;
  const P = poly.length;
  const ax = new Float32Array(P), az = new Float32Array(P), bx = new Float32Array(P), bz = new Float32Array(P);
  for (let i = 0; i < P; i++) {
    const a = poly[i], c = poly[(i + 1) % P];
    ax[i] = a[0]; az[i] = a[1]; bx[i] = c[0] - a[0]; bz[i] = c[1] - a[1];
  }

  for (let j = 0; j < nz; j++) {
    const z = minZ + j * cell;
    for (let i = 0; i < nx; i++) {
      const x = minX + i * cell;
      let best = Infinity;
      for (let k = 0; k < P; k++) {
        const px = x - ax[k], pz = z - az[k];
        const ll = bx[k] * bx[k] + bz[k] * bz[k];
        let t = (px * bx[k] + pz * bz[k]) / ll;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = px - bx[k] * t, dz = pz - bz[k] * t;
        const d2 = dx * dx + dz * dz;
        if (d2 < best) best = d2;
      }
      const d = Math.sqrt(best);
      const n1 = noise.fbm(x * 0.0042, z * 0.0042, 5);
      const n2 = noise.fbm(x * 0.019 + 50, z * 0.019 - 20, 3);
      let land = L.base + n1 * L.amp + n2 * 4;
      land += L.bank * smoothstep(w + 15, w + 95, d) * (1 - smoothstep(w + 240, w + 420, d));
      if (L.palette === 'glacier') land += Math.max(0, n1) * 30 * smoothstep(w + 60, w + 200, d);
      const k = smoothstep(w * 0.85, w + 55, d);
      let h = lerp(-7 + n2 * 1.5, land, k);
      const edge = Math.min(x - minX, minX + (nx - 1) * cell - x, z - minZ, minZ + (nz - 1) * cell - z);
      h += (1 - smoothstep(0, 300, edge)) * L.edge;
      if (h > 0 && h < 4) h *= 0.75; // flatter beaches
      hf.h[j * nx + i] = h;
      hf.dist[j * nx + i] = d;
    }
  }
  return hf;
}

const PALETTES = {
  tropical: { wet: [0.55, 0.5, 0.36], sand: [0.93, 0.85, 0.62], grassA: [0.24, 0.5, 0.17], grassB: [0.42, 0.62, 0.22], rock: [0.5, 0.46, 0.4], rockSlope: 0.55, beach: 2.6 },
  harbor: { wet: [0.45, 0.4, 0.32], sand: [0.8, 0.68, 0.5], grassA: [0.26, 0.38, 0.16], grassB: [0.4, 0.46, 0.2], rock: [0.42, 0.37, 0.35], rockSlope: 0.5, beach: 2.0 },
  storm: { wet: [0.3, 0.3, 0.28], sand: [0.55, 0.52, 0.45], grassA: [0.24, 0.32, 0.2], grassB: [0.34, 0.38, 0.26], rock: [0.3, 0.3, 0.31], rockSlope: 0.32, beach: 1.6 },
  glacier: { wet: [0.26, 0.28, 0.3], sand: [0.42, 0.43, 0.45], grassA: [0.9, 0.93, 0.98], grassB: [0.97, 0.98, 1.0], rock: [0.38, 0.4, 0.45], rockSlope: 0.45, beach: 1.8 },
};

export function buildTerrainMesh(hf, course) {
  const { nx, nz, cell, minX, minZ } = hf;
  const pal = PALETTES[course.land.palette];
  const noise = new Noise2D(course.seed + 99);
  const pos = new Float32Array(nx * nz * 3);
  const nor = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const x = minX + i * cell, z = minZ + j * cell;
      const h = hf.h[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      const hl = hf.h[j * nx + Math.max(0, i - 1)], hr = hf.h[j * nx + Math.min(nx - 1, i + 1)];
      const hd = hf.h[Math.max(0, j - 1) * nx + i], hu = hf.h[Math.min(nz - 1, j + 1) * nx + i];
      const n = new THREE.Vector3(hl - hr, 2 * cell, hd - hu).normalize();
      nor[k * 3] = n.x; nor[k * 3 + 1] = n.y; nor[k * 3 + 2] = n.z;
      const slope = 1 - n.y;
      const nn = noise.fbm(x * 0.03, z * 0.03, 3) * 0.5 + 0.5;
      let c;
      if (h < -0.6) c = pal.wet;
      else if (h < pal.beach + nn * 0.8) c = pal.sand;
      else c = pal.grassA.map((v, q) => lerp(v, pal.grassB[q], nn));
      const rockT = smoothstep(pal.rockSlope - 0.12, pal.rockSlope + 0.1, slope + (nn - 0.5) * 0.15);
      const highT = course.land.palette === 'glacier' ? 0 : smoothstep(38, 55, h + nn * 8);
      const rt = Math.max(rockT, highT);
      c = c.map((v, q) => lerp(v, pal.rock[q] * (0.85 + nn * 0.3), rt));
      const shade = 0.9 + nn * 0.2;
      col[k * 3] = c[0] * shade; col[k * 3 + 1] = c[1] * shade; col[k * 3 + 2] = c[2] * shade;
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let p = 0;
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx[p++] = a; idx[p++] = c; idx[p++] = b;
      idx[p++] = b; idx[p++] = c; idx[p++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  return new THREE.Mesh(geo, mat);
}

// ---------- Props ----------

function paint(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function palmGeometry() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.22, 0.38, 8, 7, 6);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i) + 4;
    tp.setX(i, tp.getX(i) + Math.pow(y / 8, 2) * 1.4);
    tp.setY(i, y);
  }
  trunk.computeVertexNormals();
  parts.push(paint(trunk, 0x8a6a45));
  for (let i = 0; i < 8; i++) {
    const leaf = new THREE.BoxGeometry(1.0, 0.07, 4.6, 1, 1, 4);
    const lp = leaf.attributes.position;
    for (let v = 0; v < lp.count; v++) {
      const z = lp.getZ(v) + 2.3;
      lp.setZ(v, z);
      lp.setY(v, lp.getY(v) - Math.pow(z / 4.6, 2) * 1.8);
      lp.setX(v, lp.getX(v) * (1 - z / 5.2));
    }
    leaf.computeVertexNormals();
    leaf.rotateY((i / 8) * Math.PI * 2 + (i % 2) * 0.2);
    leaf.translate(1.4, 8, 0);
    parts.push(paint(leaf, i % 2 ? 0x2f8a2a : 0x3fa336));
  }
  return mergeGeometries(parts.map((g) => g.index ? g.toNonIndexed() : g));
}

function pineGeometry(snow) {
  const parts = [paint(new THREE.CylinderGeometry(0.25, 0.35, 2, 6).translate(0, 1, 0), 0x5a4030)];
  for (let i = 0; i < 3; i++) {
    const r = 2.6 - i * 0.7, h = 3.4 - i * 0.6;
    parts.push(paint(new THREE.ConeGeometry(r, h, 8).translate(0, 2.2 + i * 1.9 + h / 2, 0), snow && i === 2 ? 0xe8f0f5 : 0x1f4d34));
  }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

function rockGeometry(rnd) {
  let g = new THREE.IcosahedronGeometry(1, 1);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const s = 0.75 + rnd() * 0.5;
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.75, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
}

function houseGeometry() {
  const walls = paint(new THREE.BoxGeometry(6, 4, 5).translate(0, 2, 0), 0xf2ede4);
  const roof = paint(new THREE.ConeGeometry(4.9, 2.6, 4).rotateY(Math.PI / 4).scale(1.05, 1, 0.9).translate(0, 5.3, 0), 0xc4553a);
  const door = paint(new THREE.BoxGeometry(1.1, 2, 0.1).translate(0, 1, 2.55), 0x5a3a2a);
  const win = paint(new THREE.BoxGeometry(1.2, 1, 0.1).translate(-1.8, 2.4, 2.55), 0x3d6d8a);
  const win2 = paint(new THREE.BoxGeometry(1.2, 1, 0.1).translate(1.8, 2.4, 2.55), 0x3d6d8a);
  return mergeGeometries([walls, roof, door, win, win2].map((g) => g.toNonIndexed()));
}

function lighthouse() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.6 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.6 });
  for (let i = 0; i < 6; i++) {
    const r0 = 3.2 - i * 0.35, r1 = 3.2 - (i + 1) * 0.35;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 4, 16), i % 2 ? red : white);
    m.position.y = 2 + i * 4;
    g.add(m);
  }
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.4, 12), new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xffe066, emissiveIntensity: 2 }));
  lamp.position.y = 25.2;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2, 12), red);
  cap.position.y = 27.4;
  g.add(lamp, cap);
  return g;
}

export function buildProps(hf, course, track, waterLevel = 0) {
  const group = new THREE.Group();
  const colliders = [];
  const rnd = mulberry32(course.seed * 13 + 5);
  const P = course.props;
  const w = course.width;
  const dummy = new THREE.Object3D();

  const scatter = (count, test, place) => {
    let placed = 0;
    for (let tries = 0; tries < count * 40 && placed < count; tries++) {
      const x = hf.minX + rnd() * (hf.maxX - hf.minX);
      const z = hf.minZ + rnd() * (hf.maxZ - hf.minZ);
      const h = hf.sample(x, z);
      const [gx, gz] = hf.gradient(x, z);
      const slope = Math.hypot(gx, gz);
      const d = hf.distAt(x, z);
      if (!test(h, slope, d)) continue;
      place(x, h, z, placed);
      placed++;
    }
    return placed;
  };

  const instanced = (geo, material, count, test, scaleFn, sink = 0.3) => {
    if (!count) return;
    const mesh = new THREE.InstancedMesh(geo, material, count);
    const n = scatter(count, test, (x, h, z, i) => {
      const s = scaleFn();
      dummy.position.set(x, h - sink * s, z);
      dummy.rotation.set((rnd() - 0.5) * 0.15, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.15);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
    return mesh;
  };

  const vmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });

  instanced(palmGeometry(), vmat, P.palms, (h, sl, d) => h > 1.0 && h < 16 && sl < 0.45 && d > w + 8, () => 0.8 + rnd() * 0.55, 0.1);
  instanced(pineGeometry(course.land.palette === 'glacier'), vmat, P.pines, (h, sl, d) => h > 2 && h < 70 && sl < 0.7 && d > w + 10, () => 0.9 + rnd() * 0.9, 0.2);
  const rockColor = course.land.palette === 'glacier' ? 0x5d636b : course.land.palette === 'storm' ? 0x3f4144 : 0x7a7166;
  instanced(rockGeometry(rnd), new THREE.MeshStandardMaterial({ color: rockColor, roughness: 0.95, flatShading: true }), P.rocks,
    (h, sl, d) => h > -2.5 && h < 6 && d > w + 6, () => 1.5 + rnd() * 4.5, 0.35);
  instanced(houseGeometry(), vmat, P.houses, (h, sl, d) => h > 2 && h < 14 && sl < 0.22 && d > w + 20 && d < w + 260, () => 0.9 + rnd() * 0.5, 0.1);

  if (P.lighthouse) {
    scatter(1, (h, sl, d) => h > 3 && h < 12 && sl < 0.3 && d > w + 35 && d < w + 110, (x, h, z) => {
      const lh = lighthouse();
      lh.position.set(x, h - 0.5, z);
      group.add(lh);
    });
  }

  if (P.posts) {
    // A pier reaching from the course edge toward shore.
    const s0 = track.length * 0.16;
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.9 });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x8d6a4a, roughness: 0.9 });
    const postGeo = new THREE.CylinderGeometry(0.35, 0.35, 8, 8);
    const rows = Math.ceil(P.posts / 2);
    for (let i = 0; i < rows; i++) {
      const s = s0 + i * 7;
      for (const lat of [-(w - 3), -(w + 7)]) {
        const p = track.pointAt(s, lat);
        const m = new THREE.Mesh(postGeo, woodMat);
        m.position.set(p.x, 0.5, p.z);
        group.add(m);
        colliders.push({ x: p.x, z: p.z, r: 0.45 });
      }
      const a = track.pointAt(s, -(w + 2));
      const deck = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 7.2), deckMat);
      deck.position.set(a.x, 4.3, a.z);
      deck.rotation.y = a.yaw + Math.PI / 2;
      group.add(deck);
    }
  }

  if (P.bergs) {
    const bergMat = new THREE.MeshStandardMaterial({ color: 0xdff4ff, roughness: 0.35, flatShading: true, emissive: 0x0a2a3a, emissiveIntensity: 0.3 });
    for (let i = 0; i < P.bergs; i++) {
      let s = rnd() * track.length;
      if (s < 60 || track.buoys.some((b) => Math.abs(b.s - s) < 20) || track.ramps.some((r) => Math.abs(r.s - s) < 40)) continue;
      const lat = (rnd() < 0.5 ? -1 : 1) * w * (0.62 + rnd() * 0.3);
      const p = track.pointAt(s, lat);
      const r = 2.5 + rnd() * 3.5;
      const g = rockGeometry(rnd);
      const m = new THREE.Mesh(g, bergMat);
      m.scale.set(r, r * (0.8 + rnd() * 0.8), r);
      m.position.set(p.x, waterLevel - r * 0.15, p.z);
      m.rotation.y = rnd() * 6;
      group.add(m);
      colliders.push({ x: p.x, z: p.z, r: r * 0.85 });
    }
  }

  return { group, colliders };
}
