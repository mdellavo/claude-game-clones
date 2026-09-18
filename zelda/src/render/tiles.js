import * as THREE from 'three';
import { W, H } from '../world/area.js';
import { hash2 } from '../engine/util.js';
import { patchWorldMaterial } from './materials.js';

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const tmpM = new THREE.Matrix4();
const tmpC = new THREE.Color();

class Batch {
  constructor(material, { cast = true, receive = true } = {}) {
    this.material = material;
    this.cast = cast;
    this.receive = receive;
    this.items = [];
  }
  // centre x,y,z and size sx,sy,sz
  add(x, y, z, sx, sy, sz, color, jitter = 0, seed = 0) {
    let c = color;
    if (jitter) {
      tmpC.setHex(color);
      const j = 1 + (hash2(Math.floor(x * 7), Math.floor(z * 7), seed + Math.floor(y * 13)) - 0.5) * jitter;
      tmpC.multiplyScalar(j);
      c = tmpC.getHex();
    }
    this.items.push([x, y, z, sx, sy, sz, c]);
  }
  build() {
    const mesh = new THREE.InstancedMesh(unitBox, this.material, Math.max(1, this.items.length));
    this.items.forEach(([x, y, z, sx, sy, sz, c], i) => {
      tmpM.makeScale(sx, sy, sz).setPosition(x, y, z);
      mesh.setMatrixAt(i, tmpM);
      mesh.setColorAt(i, tmpC.setHex(c));
    });
    mesh.count = this.items.length;
    mesh.castShadow = this.cast;
    mesh.receiveShadow = this.receive;
    mesh.frustumCulled = false;
    return mesh;
  }
}

function worldMat() {
  return patchWorldMaterial(new THREE.MeshLambertMaterial({ color: 0xffffff }));
}

export function buildAreaMesh(area) {
  const group = new THREE.Group();
  const ground = new Batch(worldMat(), { cast: false });
  const solid = new Batch(worldMat());
  const deco = new Batch(worldMat(), { cast: false });
  const water = new Batch(patchWorldMaterial(new THREE.MeshLambertMaterial({ color: 0xffffff }), { water: true }), { cast: false });

  const G = (x, z, color, jitter = 0.06) => ground.add(x + 0.5, -0.1, z + 0.5, 1, 0.2, 1, color, jitter, 1);

  for (let z = 0; z < area.height; z++) {
    for (let x = 0; x < area.width; x++) {
      const c = area.get(x, z);
      const cx = x + 0.5, cz = z + 0.5;
      const h = hash2(x, z);
      if (area.kind === 'overworld') buildOverworldTile(c, x, z, cx, cz, h, { G, solid, deco, water, area });
      else buildInteriorTile(c, x, z, cx, cz, h, { G, solid, deco, water, area });
    }
  }
  for (const b of [ground, solid, deco, water]) group.add(b.build());

  // Doors (dungeon only) are separate meshes whose visibility changes with door state.
  const doorMeshes = [];
  if (area.kind === 'dungeon') {
    for (const door of area.doors) {
      const byRoom = new Map();
      for (const t of door.tiles) {
        if (!byRoom.has(t.room)) byRoom.set(t.room, []);
        byRoom.get(t.room).push(t);
      }
      for (const [room, tiles] of byRoom) {
        const xs = tiles.map((t) => t.tx), zs = tiles.map((t) => t.tz);
        const minX = Math.min(...xs), maxX = Math.max(...xs) + 1;
        const minZ = Math.min(...zs), maxZ = Math.max(...zs) + 1;
        const [col, row] = room.split(',').map(Number);
        const lx = minX - col * W, lz = minZ - row * H;
        const low = lz >= 9 || lx >= 14;
        const hgt = low ? 0.35 : 1.5;
        const mesh = makeDoorMesh(door.type, maxX - minX, hgt, maxZ - minZ, door.vertical, low);
        mesh.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
        group.add(mesh);
        doorMeshes.push({ door, mesh, room });
      }
    }
  }
  return { group, doorMeshes };
}

function buildOverworldTile(c, x, z, cx, cz, h, { G, solid, deco, water, area }) {
  const SAND = 0xe8c894;
  switch (c) {
    case '.':
      G(x, z, (x + z) % 2 ? SAND : 0xe2c08a);
      if (h > 0.86) deco.add(cx + (h - 0.9) * 4, 0.03, cz - 0.2, 0.08, 0.06, 0.08, 0x6aa040);
      break;
    case ',': G(x, z, 0xcfa468); break;
    case 'y': G(x, z, (x + z) % 2 ? 0xf4e2ae : 0xefdba2, 0.04); break;
    case 'F':
      G(x, z, SAND);
      for (let i = 0; i < 4; i++) {
        const fx = cx + (hash2(x, z, i + 10) - 0.5) * 0.7, fz = cz + (hash2(x, z, i + 20) - 0.5) * 0.7;
        deco.add(fx, 0.05, fz, 0.04, 0.1, 0.04, 0x3a8a30);
        deco.add(fx, 0.12, fz, 0.1, 0.06, 0.1, [0xff4060, 0xffffff, 0xffd030, 0x60a0ff][i]);
      }
      break;
    case 'T': {
      G(x, z, SAND);
      const green = h > 0.5 ? 0x2e9a3c : 0x38a842;
      const s = 0.85 + h * 0.12;
      solid.add(cx, 0.15, cz, 0.22, 0.3, 0.22, 0x6a3a18);
      solid.add(cx, 0.55, cz, s, 0.55, s, green, 0.08, 2);
      solid.add(cx, 0.95, cz, s * 0.68, 0.3, s * 0.68, green, 0.1, 3);
      solid.add(cx, 1.15, cz, s * 0.3, 0.14, s * 0.3, green, 0.1, 4);
      break;
    }
    case 'R':
    case 'x': {
      const ht = 1.0 + h * 0.6;
      solid.add(cx, ht / 2 - 0.2, cz, 1, ht, 1, 0xa8521e, 0.1, 5);
      solid.add(cx, ht - 0.2 + 0.04, cz, 0.94, 0.08, 0.94, 0xc8743a, 0.08, 6);
      if (h > 0.75) solid.add(cx + (h - 0.8) * 2, ht - 0.05, cz - 0.1, 0.4, 0.25, 0.4, 0xb8622a, 0.1, 7);
      break;
    }
    case 'r':
      G(x, z, SAND);
      solid.add(cx, 0.3, cz, 0.84, 0.6, 0.84, 0x8a4a1c, 0.1, 8);
      solid.add(cx, 0.66, cz, 0.6, 0.14, 0.6, 0xa05a28, 0.1, 9);
      break;
    case 'G':
      G(x, z, 0xd8c8a0);
      solid.add(cx, 0.05, cz + 0.1, 0.7, 0.1, 0.6, 0x8a8a80);
      solid.add(cx, 0.45, cz, 0.56, 0.7, 0.2, 0xb8b8c0, 0.05, 10);
      solid.add(cx, 0.83, cz, 0.36, 0.08, 0.2, 0xb8b8c0);
      deco.add(cx, 0.5, cz + 0.105, 0.06, 0.3, 0.01, 0x505058);
      deco.add(cx, 0.55, cz + 0.105, 0.22, 0.06, 0.01, 0x505058);
      break;
    case 'S':
      G(x, z, SAND);
      solid.add(cx, 0.1, cz, 0.86, 0.2, 0.86, 0x707070);
      solid.add(cx, 0.55, cz, 0.62, 0.7, 0.52, 0x4a8a6a);
      solid.add(cx, 1.08, cz, 0.46, 0.36, 0.46, 0x4a8a6a);
      deco.add(cx - 0.1, 1.1, cz + 0.235, 0.08, 0.08, 0.01, 0xff3020);
      deco.add(cx + 0.1, 1.1, cz + 0.235, 0.08, 0.08, 0.01, 0xff3020);
      break;
    case 'W':
      water.add(cx, -0.22, cz, 1, 0.1, 1, 0x2f6fd8, 0.03, 11);
      break;
    case 'B':
      water.add(cx, -0.22, cz, 1, 0.1, 1, 0x2f6fd8, 0.03, 11);
      G(x, z, 0x9a6a3a, 0.1);
      deco.add(cx, 0.005, cz, 1, 0.01, 0.04, 0x5a3a1a);
      break;
    case 'C':
      G(x, z, 0xcfa468);
      deco.add(cx, 0.36, z + 0.02, 0.62, 0.76, 0.06, 0x050505);
      deco.add(cx, 0.8, z + 0.02, 0.4, 0.12, 0.06, 0x050505);
      break;
    case 'D':
      G(x, z, 0x909090);
      deco.add(cx, 0.45, z + 0.02, 0.7, 0.9, 0.06, 0x050505);
      solid.add(cx - 0.45, 0.55, z + 0.1, 0.18, 1.3, 0.22, 0x9a9aa0);
      solid.add(cx + 0.45, 0.55, z + 0.1, 0.18, 1.3, 0.22, 0x9a9aa0);
      solid.add(cx, 1.15, z + 0.1, 1.2, 0.2, 0.26, 0xa8a8b0);
      break;
    default:
      G(x, z, SAND);
  }
}

function buildInteriorTile(c, x, z, cx, cz, h, { G, solid, deco, water, area }) {
  if (c === ' ') return;
  const cave = area.kind === 'cave';
  const lx = x % W, lz = z % H;
  const low = lz >= 9 || lx >= 14;
  const FLOOR_A = cave ? 0x2a2218 : 0x3a5aa8;
  const FLOOR_B = cave ? 0x30271c : 0x33509a;
  switch (c) {
    case 'w': {
      const ht = low ? 0.35 : 1.5;
      const outer = lx === 0 || lz === 0 || lx === W - 1 || lz === H - 1;
      const base = cave ? 0x7a3a18 : outer ? 0x136a6e : 0x1e8a8e;
      solid.add(cx, ht / 2 - 0.2, cz, 1, ht, 1, base, 0.08, 12);
      solid.add(cx, ht - 0.2 + 0.03, cz, 0.98, 0.06, 0.98, cave ? 0x9a5a28 : 0x40b0b0, 0.06, 13);
      break;
    }
    case 'k':
      G(x, z, FLOOR_A);
      solid.add(cx, 0.35, cz, 0.96, 0.7, 0.96, 0x1a7a80);
      solid.add(cx, 0.72, cz, 0.7, 0.06, 0.7, 0x38a8a8);
      break;
    case 'S':
      G(x, z, FLOOR_A);
      solid.add(cx, 0.1, cz, 0.9, 0.2, 0.9, 0x136a6e);
      solid.add(cx, 0.55, cz, 0.6, 0.7, 0.5, 0x2a9a9a);
      solid.add(cx, 1.05, cz, 0.5, 0.36, 0.5, 0x2a9a9a);
      deco.add(cx + 0.12, 1.08, cz + 0.255, 0.08, 0.08, 0.01, 0xffff40);
      break;
    case 'W':
      water.add(cx, -0.22, cz, 1, 0.1, 1, 0x1a3a90, 0.03, 14);
      break;
    case 'E':
      G(x, z, 0x0a0a14, 0);
      break;
    case 'd':
    case 'f':
    default:
      G(x, z, (x + z) % 2 ? FLOOR_A : FLOOR_B, 0.04);
  }
}

function makeDoorMesh(type, sx, hgt, sz, vertical, low) {
  const g = new THREE.Group();
  const mat = (color, emissive = 0) => {
    const m = patchWorldMaterial(new THREE.MeshLambertMaterial({ color }));
    if (emissive) m.emissive = new THREE.Color(color).multiplyScalar(emissive);
    return m;
  };
  const add = (w, h, d, color, x, y, z, emissive) => {
    const m = new THREE.Mesh(unitBox, mat(color, emissive));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const top = hgt - 0.2;
  if (type === 'bomb') {
    add(sx, hgt, sz, 0x1e8a8e, 0, hgt / 2 - 0.2, 0);
    add(sx * 0.98, 0.06, sz * 0.98, 0x40b0b0, 0, top + 0.03, 0);
  } else if (type === 'locked') {
    add(sx, hgt, sz, 0x6a3a14, 0, hgt / 2 - 0.2, 0);
    const kx = vertical ? 0 : 0, face = 0.02;
    if (!low) {
      // keyhole on both faces
      const [w, d] = vertical ? [0.3, sz + face] : [sx + face, 0.3];
      add(w, 0.4, d, 0xf0c020, kx, 0.65, 0, 0.3);
    } else {
      add(vertical ? 0.3 : sx * 0.4, 0.05, vertical ? sz * 0.4 : 0.3, 0xf0c020, 0, top + 0.03, 0, 0.3);
    }
  } else if (type === 'shut') {
    add(sx, hgt, sz, 0x303a48, 0, hgt / 2 - 0.2, 0);
    const bars = 5;
    for (let i = 0; i < bars; i++) {
      const t = (i + 0.5) / bars - 0.5;
      if (vertical) add(0.08, hgt + 0.02, sz + 0.04, 0x8090a0, t * sx, hgt / 2 - 0.2, 0);
      else add(sx + 0.04, hgt + 0.02, 0.08, 0x8090a0, 0, hgt / 2 - 0.2, t * sz);
    }
  }
  return g;
}
