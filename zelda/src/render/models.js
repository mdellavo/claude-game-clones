import * as THREE from 'three';
import { VoxelModel } from './voxel.js';

// All models face +z (towards the camera side) by default; y = 0 is the ground.

const SKIN = 0xf2b27a;
const BROWN = 0x7a4a1c;
const DARK = 0x1a1a1a;
const WHITE = 0xffffff;

function eyes(v, y, z, spread, color = DARK, size = 0.06, parent = null) {
  v.box(size, size, 0.02, color, -spread, y, z, parent, { shadow: false });
  v.box(size, size, 0.02, color, spread, y, z, parent, { shadow: false });
}

export function makeLink() {
  const v = new VoxelModel();
  const GREEN = 0x3fa33a;
  const body = v.pivot('body');
  v.parts.legL = v.box(0.14, 0.22, 0.16, BROWN, -0.1, 0.11, 0, body);
  v.parts.legR = v.box(0.14, 0.22, 0.16, BROWN, 0.1, 0.11, 0, body);
  v.box(0.42, 0.32, 0.3, GREEN, 0, 0.38, 0, body);
  v.box(0.46, 0.08, 0.34, GREEN, 0, 0.24, 0, body); // tunic skirt
  v.box(0.44, 0.05, 0.32, BROWN, 0, 0.33, 0, body); // belt
  v.parts.armL = v.pivot('armL', -0.27, 0.52, 0, body);
  v.box(0.11, 0.26, 0.12, GREEN, 0, -0.1, 0, v.parts.armL);
  v.box(0.1, 0.07, 0.1, SKIN, 0, -0.25, 0, v.parts.armL);
  v.parts.armR = v.pivot('armR', 0.27, 0.52, 0, body);
  v.box(0.11, 0.26, 0.12, GREEN, 0, -0.1, 0, v.parts.armR);
  v.box(0.1, 0.07, 0.1, SKIN, 0, -0.25, 0, v.parts.armR);
  // head
  const head = v.pivot('head', 0, 0.72, 0, body);
  v.box(0.36, 0.3, 0.32, SKIN, 0, 0, 0, head);
  v.box(0.38, 0.1, 0.34, 0xb5651d, 0, 0.12, -0.01, head); // hair
  v.box(0.08, 0.2, 0.2, 0xb5651d, -0.19, 0, -0.06, head);
  v.box(0.08, 0.2, 0.2, 0xb5651d, 0.19, 0, -0.06, head);
  v.box(0.1, 0.1, 0.04, SKIN, -0.22, 0.02, 0.02, head); // ears
  v.box(0.1, 0.1, 0.04, SKIN, 0.22, 0.02, 0.02, head);
  eyes(v, 0.0, 0.165, 0.08, 0x1a3aa0);
  v.box(0.4, 0.14, 0.36, GREEN, 0, 0.2, -0.02, head); // cap
  const tail = v.pivot('capTail', 0, 0.2, -0.18, head);
  v.box(0.24, 0.12, 0.22, GREEN, 0, -0.04, -0.1, tail);
  v.box(0.14, 0.1, 0.18, GREEN, 0, -0.12, -0.24, tail);
  // shield on left arm
  const shield = v.pivot('shield', -0.2, 0.36, 0.2, body);
  v.box(0.3, 0.34, 0.05, 0x8a5a2a, 0, 0, 0, shield);
  v.box(0.22, 0.26, 0.06, 0xc8a050, 0, 0, 0.005, shield);
  v.box(0.04, 0.2, 0.07, 0xa02020, 0, 0, 0.01, shield);
  // sword (held in right hand, visible when attacking)
  const sword = v.pivot('sword', 0.27, 0.3, 0.05, body);
  v.box(0.06, 0.06, 0.16, BROWN, 0, 0, 0.06, sword);
  v.box(0.22, 0.05, 0.05, 0x8080a0, 0, 0, 0.15, sword);
  v.box(0.06, 0.04, 0.55, 0xe8f0ff, 0, 0, 0.45, sword, { emissive: 0.15 });
  sword.visible = false;
  // held-item pose (raised above head)
  v.parts.holdAnchor = v.pivot('holdAnchor', 0, 1.25, 0.05);
  return v;
}

export function makeOctorok(color = 0xd83020) {
  const v = new VoxelModel();
  const body = v.pivot('body');
  v.box(0.62, 0.5, 0.62, color, 0, 0.38, 0, body);
  v.box(0.5, 0.12, 0.5, color, 0, 0.68, 0, body);
  v.box(0.22, 0.22, 0.24, color, 0, 0.36, 0.38, body); // snout
  v.box(0.14, 0.14, 0.02, DARK, 0, 0.36, 0.51, body, { shadow: false });
  eyes(v, 0.5, 0.315, 0.16, WHITE, 0.12, body);
  eyes(v, 0.5, 0.325, 0.16, DARK, 0.06, body);
  v.parts.legs = [];
  for (const [x, z] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]]) {
    v.parts.legs.push(v.box(0.14, 0.16, 0.14, 0xf0a060, x, 0.08, z, body));
  }
  return v;
}

export function makeMoblin(color = 0xd06020) {
  const v = new VoxelModel();
  const body = v.pivot('body');
  v.parts.legL = v.box(0.16, 0.24, 0.18, 0x5a3010, -0.12, 0.12, 0, body);
  v.parts.legR = v.box(0.16, 0.24, 0.18, 0x5a3010, 0.12, 0.12, 0, body);
  v.box(0.5, 0.4, 0.36, color, 0, 0.44, 0, body);
  v.box(0.3, 0.3, 0.05, 0xf0c080, 0, 0.44, 0.18, body); // belly
  const head = v.pivot('head', 0, 0.8, 0.02, body);
  v.box(0.42, 0.34, 0.38, color, 0, 0, 0, head);
  v.box(0.22, 0.16, 0.16, 0x9a4a20, 0, -0.06, 0.24, head); // snout
  v.box(0.08, 0.06, 0.02, DARK, 0, -0.02, 0.33, head);
  v.box(0.1, 0.18, 0.1, color, -0.2, 0.22, -0.02, head); // ears
  v.box(0.1, 0.18, 0.1, color, 0.2, 0.22, -0.02, head);
  eyes(v, 0.06, 0.195, 0.11, 0xffff40, 0.07, head);
  const spear = v.pivot('spear', 0.32, 0.45, 0, body);
  v.box(0.04, 0.04, 0.9, 0x8a6a3a, 0, 0, 0.1, spear);
  v.box(0.08, 0.08, 0.14, 0xc0c0d0, 0, 0, 0.6, spear);
  return v;
}

export function makeTektite(color = 0xd83020) {
  const v = new VoxelModel();
  const body = v.pivot('body', 0, 0.35, 0);
  v.box(0.46, 0.28, 0.42, color, 0, 0, 0, body);
  v.box(0.3, 0.1, 0.3, color, 0, 0.18, 0, body);
  v.box(0.22, 0.2, 0.04, WHITE, 0, 0.03, 0.22, body, { shadow: false });
  v.box(0.1, 0.1, 0.02, DARK, 0, 0.03, 0.245, body, { shadow: false });
  v.parts.legs = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p = v.pivot('', 0.2 * sx, 0, 0.18 * sz, body);
    v.box(0.3, 0.07, 0.07, 0x3a3a3a, 0.15 * sx, 0.08, 0, p);
    v.box(0.07, 0.4, 0.07, 0x3a3a3a, 0.3 * sx, -0.12, 0, p);
    v.parts.legs.push(p);
  }
  return v;
}

export function makeLeever(color = 0xd83020) {
  const v = new VoxelModel();
  const body = v.pivot('body');
  v.box(0.6, 0.2, 0.6, color, 0, 0.1, 0, body);
  v.box(0.5, 0.2, 0.5, 0xf0c040, 0, 0.3, 0, body);
  v.box(0.38, 0.2, 0.38, color, 0, 0.5, 0, body);
  v.box(0.24, 0.16, 0.24, 0xf0c040, 0, 0.68, 0, body);
  v.box(0.1, 0.12, 0.1, color, 0, 0.82, 0, body);
  eyes(v, 0.32, 0.26, 0.1, DARK, 0.07, body);
  return v;
}

export function makeKeese(color = 0x6a8aff) {
  const v = new VoxelModel();
  const body = v.pivot('body', 0, 0.9, 0);
  v.box(0.22, 0.22, 0.22, color, 0, 0, 0, body, { emissive: 0.25 });
  eyes(v, 0.02, 0.115, 0.05, 0xff3030, 0.06, body);
  const wl = v.pivot('wingL', -0.09, 0, 0, body);
  v.box(0.38, 0.04, 0.24, 0x9090d0, -0.19, 0, 0, wl, { emissive: 0.2 });
  const wr = v.pivot('wingR', 0.09, 0, 0, body);
  v.box(0.38, 0.04, 0.24, 0x9090d0, 0.19, 0, 0, wr, { emissive: 0.2 });
  return v;
}

export function makeGel() {
  const v = new VoxelModel();
  const body = v.pivot('body');
  v.box(0.32, 0.18, 0.32, 0x20a0a0, 0, 0.09, 0, body);
  v.box(0.2, 0.1, 0.2, 0x40d0c0, 0, 0.22, 0, body);
  eyes(v, 0.12, 0.165, 0.07, DARK, 0.05, body);
  return v;
}

export function makeStalfos() {
  const v = new VoxelModel();
  const BONE = 0xf0ece0;
  const body = v.pivot('body');
  v.parts.legL = v.box(0.08, 0.3, 0.08, BONE, -0.1, 0.15, 0, body);
  v.parts.legR = v.box(0.08, 0.3, 0.08, BONE, 0.1, 0.15, 0, body);
  v.box(0.3, 0.06, 0.16, BONE, 0, 0.32, 0, body);
  v.box(0.06, 0.3, 0.06, BONE, 0, 0.48, 0, body);
  for (let i = 0; i < 3; i++) v.box(0.3, 0.04, 0.18, BONE, 0, 0.4 + i * 0.08, 0, body);
  v.parts.armL = v.box(0.06, 0.3, 0.06, BONE, -0.2, 0.46, 0, body);
  v.parts.armR = v.box(0.06, 0.3, 0.06, BONE, 0.2, 0.46, 0, body);
  const head = v.pivot('head', 0, 0.8, 0, body);
  v.box(0.34, 0.3, 0.32, BONE, 0, 0, 0, head);
  v.box(0.28, 0.08, 0.2, BONE, 0, -0.18, 0.04, head);
  eyes(v, 0.02, 0.165, 0.08, DARK, 0.1, head);
  const sword = v.pivot('sword', 0.22, 0.34, 0.08, body);
  v.box(0.04, 0.04, 0.4, 0xc0c0d0, 0, 0, 0.18, sword);
  return v;
}

export function makeGoriya(color = 0xd03020) {
  const v = new VoxelModel();
  const body = v.pivot('body');
  v.parts.legL = v.box(0.14, 0.22, 0.16, 0x602010, -0.1, 0.11, 0, body);
  v.parts.legR = v.box(0.14, 0.22, 0.16, 0x602010, 0.1, 0.11, 0, body);
  v.box(0.42, 0.36, 0.3, color, 0, 0.4, 0, body);
  v.box(0.44, 0.06, 0.32, 0xf0c060, 0, 0.3, 0, body);
  const head = v.pivot('head', 0, 0.76, 0, body);
  v.box(0.38, 0.3, 0.34, color, 0, 0, 0, head);
  v.box(0.18, 0.14, 0.14, 0xf0c060, 0, -0.06, 0.22, head);
  v.box(0.1, 0.2, 0.06, color, -0.16, 0.22, 0, head);
  v.box(0.1, 0.2, 0.06, color, 0.16, 0.22, 0, head);
  eyes(v, 0.05, 0.175, 0.1, WHITE, 0.07, head);
  v.parts.armL = v.box(0.1, 0.26, 0.1, color, -0.26, 0.42, 0, body);
  v.parts.armR = v.box(0.1, 0.26, 0.1, color, 0.26, 0.42, 0, body);
  return v;
}

export function makeAquamentus() {
  const v = new VoxelModel();
  const G = 0x40a040;
  const LG = 0x90d060;
  const body = v.pivot('body');
  for (const [x, z] of [[-0.35, 0.3], [0.35, 0.3], [-0.35, -0.35], [0.35, -0.35]]) {
    v.box(0.3, 0.45, 0.3, G, x, 0.22, z, body);
    v.box(0.34, 0.08, 0.38, 0xe0e0c0, x, 0.04, z + 0.04, body);
  }
  v.box(1.0, 0.7, 1.2, G, 0, 0.75, 0, body);
  v.box(0.7, 0.5, 0.1, LG, 0, 0.7, 0.6, body);
  for (let i = 0; i < 4; i++) v.box(0.12, 0.2, 0.12, 0xe0c040, 0, 1.18, -0.45 + i * 0.3, body);
  const neck = v.pivot('neck', 0, 1.0, 0.45, body);
  v.box(0.45, 0.8, 0.45, G, 0, 0.35, 0.1, neck);
  const head = v.pivot('head', 0, 0.85, 0.25, neck);
  v.box(0.55, 0.45, 0.6, G, 0, 0, 0, head);
  v.box(0.45, 0.2, 0.35, G, 0, -0.08, 0.4, head);
  v.box(0.12, 0.35, 0.12, 0xe8e8d0, 0, 0.35, 0.1, head); // horn
  eyes(v, 0.08, 0.305, 0.18, 0xffff00, 0.12, head);
  v.box(0.47, 0.05, 0.3, 0x802020, 0, -0.18, 0.42, head); // mouth
  const tail = v.pivot('tail', 0, 0.6, -0.6, body);
  v.box(0.4, 0.35, 0.5, G, 0, 0, -0.2, tail);
  v.box(0.25, 0.25, 0.5, G, 0, -0.1, -0.6, tail);
  v.box(0.14, 0.14, 0.4, G, 0, -0.2, -0.95, tail);
  return v;
}

export function makeNpc(kind) {
  if (kind === 'moblinFriend') return makeMoblin(0xd06020);
  const v = new VoxelModel();
  const robe = kind === 'merchant' ? 0x3a7a3a : kind === 'oldwoman' ? 0x8040a0 : 0xc02818;
  const body = v.pivot('body');
  v.box(0.56, 0.6, 0.46, robe, 0, 0.3, 0, body);
  v.box(0.46, 0.2, 0.4, robe, 0, 0.7, 0, body);
  v.box(0.12, 0.3, 0.14, robe, -0.3, 0.55, 0.08, body);
  v.box(0.12, 0.3, 0.14, robe, 0.3, 0.55, 0.08, body);
  const head = v.pivot('head', 0, 0.98, 0, body);
  v.box(0.34, 0.32, 0.32, SKIN, 0, 0, 0, head);
  eyes(v, 0.03, 0.165, 0.08, DARK, 0.05, head);
  if (kind === 'oldman') {
    v.box(0.3, 0.3, 0.1, WHITE, 0, -0.18, 0.16, head);
    v.box(0.36, 0.06, 0.34, 0xe0e0e0, 0, 0.12, -0.02, head);
  } else if (kind === 'oldwoman') {
    v.box(0.4, 0.2, 0.36, 0x606060, 0, 0.14, -0.04, head);
    v.box(0.2, 0.18, 0.2, 0x606060, 0, 0.12, -0.24, head);
  } else {
    v.box(0.4, 0.12, 0.38, 0x2a2a60, 0, 0.18, 0, head);
    v.box(0.24, 0.1, 0.06, 0x3a2010, 0, -0.08, 0.17, head);
  }
  return v;
}

export function makeFire() {
  const v = new VoxelModel();
  const body = v.pivot('body');
  v.box(0.4, 0.4, 0.4, 0xff5010, 0, 0.2, 0, body, { emissive: 0.9, shadow: false, name: 'f1' });
  v.box(0.26, 0.3, 0.26, 0xffb020, 0, 0.5, 0, body, { emissive: 0.9, shadow: false, name: 'f2' });
  v.box(0.12, 0.2, 0.12, 0xffff80, 0, 0.72, 0, body, { emissive: 1, shadow: false, name: 'f3' });
  const light = new THREE.PointLight(0xff8030, 3, 7, 1.5);
  light.position.y = 0.6;
  body.add(light);
  v.parts.light = light;
  return v;
}

const rupeeGeo = new THREE.OctahedronGeometry(0.2, 0);

export function makeItem(kind) {
  const v = new VoxelModel();
  const g = v.pivot('spin', 0, 0.35, 0);
  g.scale.setScalar(1.35);
  switch (kind) {
    case 'rupee':
    case 'rupee5':
    case 'rupeeGift': {
      const col = kind === 'rupee' ? 0x30e060 : kind === 'rupee5' ? 0x4080ff : 0xff4060;
      const m = new THREE.Mesh(rupeeGeo, v.mat(col, 0.35));
      m.scale.set(0.8, 1.5, 0.5);
      m.castShadow = true;
      g.add(m);
      break;
    }
    case 'heart':
    case 'heartContainer': {
      const s = kind === 'heart' ? 0.07 : 0.1;
      const rows = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
      rows.forEach((r, j) => {
        for (let i = 0; i < r.length; i++) {
          if (r[i] === 'X') v.box(s, s, s, 0xe82838, (i - 3) * s, (2.5 - j) * s, 0, g, { emissive: 0.3 });
        }
      });
      if (kind === 'heartContainer') v.box(0.75, 0.65, 0.05, WHITE, 0, 0, -0.07, g, { emissive: 0.4 });
      break;
    }
    case 'key':
      v.box(0.08, 0.36, 0.06, 0xf0c020, 0, -0.02, 0, g, { emissive: 0.3 });
      v.box(0.2, 0.2, 0.06, 0xf0c020, 0, 0.2, 0, g, { emissive: 0.3 });
      v.box(0.08, 0.08, 0.07, 0x000000, 0, 0.2, 0, g, { shadow: false });
      v.box(0.12, 0.05, 0.06, 0xf0c020, 0.08, -0.14, 0, g, { emissive: 0.3 });
      v.box(0.12, 0.05, 0.06, 0xf0c020, 0.08, -0.05, 0, g, { emissive: 0.3 });
      break;
    case 'bomb':
    case 'bombs': {
      const n = kind === 'bombs' ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const ox = n > 1 ? (i - 0.5) * 0.28 : 0;
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), v.mat(0x2040a0));
        m.position.set(ox, -0.05, 0);
        m.castShadow = true;
        g.add(m);
        v.box(0.06, 0.08, 0.06, 0xd0d0d0, ox, 0.14, 0, g);
        v.box(0.03, 0.08, 0.03, 0xffa020, ox, 0.22, 0, g, { emissive: 0.8 });
      }
      break;
    }
    case 'sword':
      v.box(0.06, 0.55, 0.04, 0xe8f0ff, 0, 0.12, 0, g, { emissive: 0.3 });
      v.box(0.22, 0.05, 0.06, 0x8080a0, 0, -0.17, 0, g);
      v.box(0.06, 0.16, 0.06, BROWN, 0, -0.28, 0, g);
      break;
    case 'boomerang':
      v.box(0.3, 0.07, 0.07, 0xa06020, -0.05, 0.1, 0, g);
      v.box(0.07, 0.07, 0.3, 0xa06020, 0.12, 0.1, 0.12, g);
      break;
    case 'heartRefill':
      v.box(0.2, 0.26, 0.2, 0xd02060, 0, -0.05, 0, g, { emissive: 0.4 });
      v.box(0.1, 0.1, 0.1, 0xe0e0ff, 0, 0.13, 0, g);
      break;
    case 'triforce': {
      const shape = new THREE.Shape();
      shape.moveTo(-0.35, -0.3); shape.lineTo(0.35, -0.3); shape.lineTo(0, 0.32); shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
      geo.translate(0, 0, -0.05);
      const m = new THREE.Mesh(geo, v.mat(0xffd020, 0.6));
      m.castShadow = true;
      g.add(m);
      g.position.y = 0.6;
      break;
    }
    default:
      v.box(0.2, 0.2, 0.2, 0xff00ff, 0, 0, 0, g);
  }
  return v;
}

export function makeRock() {
  const v = new VoxelModel();
  v.box(0.22, 0.2, 0.22, 0x9a9a9a, 0, 0.45, 0);
  v.box(0.14, 0.26, 0.14, 0x7a7a7a, 0.02, 0.45, 0.02);
  return v;
}

export function makeArrow(color = 0x8a6a3a) {
  const v = new VoxelModel();
  v.box(0.05, 0.05, 0.7, color, 0, 0.45, 0);
  v.box(0.12, 0.12, 0.12, 0xd0d0e0, 0, 0.45, 0.36);
  return v;
}

export function makeFireball() {
  const v = new VoxelModel();
  const g = v.pivot('spin', 0, 0.55, 0);
  v.box(0.3, 0.3, 0.3, 0xff6010, 0, 0, 0, g, { emissive: 1, shadow: false });
  v.box(0.2, 0.2, 0.2, 0xffe060, 0.08, 0.08, 0.08, g, { emissive: 1, shadow: false });
  v.box(0.18, 0.18, 0.18, 0xffa020, -0.1, -0.06, 0.06, g, { emissive: 1, shadow: false });
  return v;
}

export function makeBoomerang(color = 0xa06020) {
  const v = new VoxelModel();
  const g = v.pivot('spin', 0, 0.45, 0);
  v.box(0.36, 0.06, 0.08, color, 0.1, 0, 0, g, { emissive: 0.2 });
  v.box(0.08, 0.06, 0.36, color, -0.06, 0, 0.14, g, { emissive: 0.2 });
  return v;
}

export function makeBeam() {
  const v = new VoxelModel();
  const g = v.pivot('spin', 0, 0.45, 0);
  v.box(0.07, 0.05, 0.6, 0xe0f8ff, 0, 0, 0.1, g, { emissive: 0.9, shadow: false });
  v.box(0.24, 0.05, 0.05, 0x80a0ff, 0, 0, -0.2, g, { emissive: 0.9, shadow: false });
  v.box(0.06, 0.05, 0.16, 0xa07040, 0, 0, -0.32, g, { emissive: 0.5, shadow: false });
  return v;
}

export function makeBombEntity() {
  const v = new VoxelModel();
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), v.mat(0x2040a0));
  m.position.y = 0.24;
  m.castShadow = true;
  v.group.add(m);
  v.box(0.1, 0.1, 0.1, 0xd0d0d0, 0, 0.5, 0);
  v.box(0.05, 0.12, 0.05, 0xffa020, 0, 0.6, 0, null, { emissive: 1, name: 'fuse' });
  return v;
}

// Text label as a camera-facing sprite (prices, etc.)
export function makeTextSprite(text, { color = '#ffffff', size = 48, scale = 0.5 } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${size}px "Press Start 2P", monospace`;
  const w = Math.ceil(ctx.measureText(text).width) + 16;
  canvas.width = w;
  canvas.height = size + 16;
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.fillText(text, 11, canvas.height / 2 + 3);
  ctx.fillStyle = color;
  ctx.fillText(text, 8, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set((scale * canvas.width) / canvas.height, scale, 1);
  sprite.renderOrder = 10;
  return sprite;
}
