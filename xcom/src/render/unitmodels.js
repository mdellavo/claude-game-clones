import * as THREE from 'three';
import { itemDef } from '../data/items.js';

const matCache = new Map();
export function mat(hex, emissive = 0) {
  const k = hex + ':' + emissive;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: hex, emissive: emissive ? hex : 0x000000, emissiveIntensity: emissive });
    matCache.set(k, m);
  }
  return m;
}

const geoCache = new Map();
function boxG(sx, sy, sz) {
  const k = `b${sx},${sy},${sz}`;
  let g = geoCache.get(k);
  if (!g) geoCache.set(k, (g = new THREE.BoxGeometry(sx, sy, sz)));
  return g;
}
function sphG(r, w = 10, h = 8) {
  const k = `s${r},${w},${h}`;
  let g = geoCache.get(k);
  if (!g) geoCache.set(k, (g = new THREE.SphereGeometry(r, w, h)));
  return g;
}
function cylG(r0, r1, h, n = 10) {
  const k = `c${r0},${r1},${h},${n}`;
  let g = geoCache.get(k);
  if (!g) geoCache.set(k, (g = new THREE.CylinderGeometry(r1, r0, h, n)));
  return g;
}

function mesh(geo, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}
const box = (parent, sx, sy, sz, color, x, y, z, em = 0) => {
  const o = mesh(boxG(sx, sy, sz), mat(color, em), x, y + sy / 2, z);
  parent.add(o);
  return o;
};
const sph = (parent, r, color, x, y, z, em = 0) => {
  const o = mesh(sphG(r), mat(color, em), x, y, z);
  parent.add(o);
  return o;
};
const cyl = (parent, r0, r1, h, color, x, y, z, n = 10, em = 0) => {
  const o = mesh(cylG(r0, r1, h, n), mat(color, em), x, y + h / 2, z);
  parent.add(o);
  return o;
};

// Weapon mesh held in hands: points along -z (forward)
export function weaponMesh(item) {
  const g = new THREE.Group();
  if (!item) return g;
  const d = itemDef(item.id);
  const color = d.color ? new THREE.Color(d.color).getHex() : 0x555555;
  const shape = d.shape || (d.kind === 'melee' ? 'rod' : d.kind === 'grenade' ? 'grenade' : 'box');
  switch (shape) {
    case 'pistol':
      box(g, 0.05, 0.08, 0.2, color, 0, -0.04, -0.1);
      break;
    case 'rifle':
      box(g, 0.05, 0.07, 0.5, color, 0, -0.035, -0.2);
      box(g, 0.04, 0.1, 0.06, 0x333333, 0, -0.1, -0.05);
      break;
    case 'cannon':
      box(g, 0.1, 0.12, 0.55, color, 0, -0.06, -0.2);
      cyl(g, 0.04, 0.04, 0.2, 0x333333, 0, 0, -0.5).rotation.x = Math.PI / 2;
      break;
    case 'launcher':
      cyl(g, 0.07, 0.07, 0.65, color, 0, -0.05, -0.15, 8).rotation.x = Math.PI / 2;
      break;
    case 'rod':
      box(g, 0.04, 0.04, 0.45, color, 0, -0.02, -0.2, 0.3);
      break;
    default:
      box(g, 0.08, 0.08, 0.12, color, 0, -0.04, -0.06);
  }
  return g;
}

// Returns {root, body, weaponSlot, parts}
export function buildUnitModel(u) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const s = { root, body, weaponSlot: null, legs: [], hover: 0 };
  const color = u.color ?? 0x888888;
  switch (u.model) {
    case 'soldier': {
      const armor = color;
      const bulky = u.armorMax.front >= 100;
      const w = bulky ? 1.15 : 1;
      const legL = box(body, 0.1 * w, 0.34, 0.12 * w, 0x3a3f35, -0.07, 0, 0);
      const legR = box(body, 0.1 * w, 0.34, 0.12 * w, 0x3a3f35, 0.07, 0, 0);
      s.legs = [legL, legR];
      box(body, 0.3 * w, 0.28, 0.18 * w, armor, 0, 0.33, 0);
      box(body, 0.2, 0.2, 0.08, 0x3a3a30, 0, 0.36, 0.12); // backpack
      box(body, 0.08, 0.24, 0.09, armor, -0.2 * w, 0.36, -0.03);
      box(body, 0.08, 0.24, 0.09, armor, 0.2 * w, 0.36, -0.03);
      sph(body, 0.09, u.skin ?? 0xd0a080, 0, 0.7, 0);
      if (bulky) sph(body, 0.12, armor, 0, 0.71, 0.01);
      else box(body, 0.2, 0.07, 0.2, 0x4a5540, 0, 0.73, 0.01);
      const ws = new THREE.Group();
      ws.position.set(0.12, 0.5, -0.12);
      body.add(ws);
      s.weaponSlot = ws;
      if (u.flyingCapable) {
        box(body, 0.06, 0.12, 0.06, 0x303030, -0.06, 0.3, 0.18);
        box(body, 0.06, 0.12, 0.06, 0x303030, 0.06, 0.3, 0.18);
      }
      break;
    }
    case 'sectoid': {
      s.legs = [box(body, 0.06, 0.28, 0.06, color, -0.05, 0, 0), box(body, 0.06, 0.28, 0.06, color, 0.05, 0, 0)];
      box(body, 0.16, 0.22, 0.1, 0x8a8f9a, 0, 0.27, 0);
      box(body, 0.04, 0.22, 0.04, color, -0.11, 0.28, -0.02);
      box(body, 0.04, 0.22, 0.04, color, 0.11, 0.28, -0.02);
      const head = sph(body, 0.15, color, 0, 0.6, 0);
      head.scale.set(1, 1.15, 1);
      const eye = mat(0x050505);
      const e1 = mesh(sphG(0.045), eye, -0.06, 0.6, -0.12);
      e1.scale.set(1, 1.5, 0.5);
      const e2 = mesh(sphG(0.045), eye, 0.06, 0.6, -0.12);
      e2.scale.set(1, 1.5, 0.5);
      body.add(e1, e2);
      const ws = new THREE.Group();
      ws.position.set(0.1, 0.36, -0.1);
      body.add(ws);
      s.weaponSlot = ws;
      break;
    }
    case 'floater': {
      s.hover = 0.1;
      cyl(body, 0.08, 0.2, 0.25, 0x5a4a50, 0, 0.1, 0, 8);
      const jet = cyl(body, 0.07, 0.05, 0.06, 0xff9040, 0, 0.05, 0, 8, 1);
      jet.castShadow = false;
      box(body, 0.32, 0.3, 0.22, color, 0, 0.33, 0);
      const cape = box(body, 0.36, 0.34, 0.04, 0x5a2a50, 0, 0.26, 0.12);
      cape.rotation.x = 0.15;
      const head = sph(body, 0.13, 0xa07a70, 0, 0.73, -0.02);
      head.scale.set(1, 0.9, 1.1);
      box(body, 0.2, 0.05, 0.06, 0x303030, 0, 0.72, -0.12);
      const ws = new THREE.Group();
      ws.position.set(0.15, 0.45, -0.12);
      body.add(ws);
      s.weaponSlot = ws;
      break;
    }
    case 'snakeman': {
      const tail1 = cyl(body, 0.22, 0.18, 0.12, 0x8a7a2a, 0, 0, 0.05, 10);
      tail1.scale.z = 1.4;
      cyl(body, 0.15, 0.12, 0.25, color, 0, 0.12, 0, 10);
      box(body, 0.26, 0.26, 0.16, color, 0, 0.35, 0);
      box(body, 0.07, 0.22, 0.07, color, -0.17, 0.38, -0.03);
      box(body, 0.07, 0.22, 0.07, color, 0.17, 0.38, -0.03);
      const head = sph(body, 0.12, 0xc8a84a, 0, 0.72, -0.04);
      head.scale.set(0.9, 1, 1.4);
      const crest = box(body, 0.04, 0.12, 0.2, 0x7a5a1a, 0, 0.76, 0.04);
      crest.rotation.x = 0.3;
      const ws = new THREE.Group();
      ws.position.set(0.12, 0.48, -0.12);
      body.add(ws);
      s.weaponSlot = ws;
      break;
    }
    case 'muton': {
      s.legs = [box(body, 0.13, 0.34, 0.14, 0x3a5a2a, -0.09, 0, 0), box(body, 0.13, 0.34, 0.14, 0x3a5a2a, 0.09, 0, 0)];
      box(body, 0.42, 0.34, 0.26, 0x5a6a4a, 0, 0.32, 0);
      box(body, 0.16, 0.12, 0.2, 0x4a5a3a, -0.26, 0.56, 0);
      box(body, 0.16, 0.12, 0.2, 0x4a5a3a, 0.26, 0.56, 0);
      box(body, 0.1, 0.3, 0.12, color, -0.27, 0.3, -0.04);
      box(body, 0.1, 0.3, 0.12, color, 0.27, 0.3, -0.04);
      sph(body, 0.11, color, 0, 0.74, -0.02);
      box(body, 0.2, 0.06, 0.05, 0xffd040, 0, 0.74, -0.11, 0.5);
      const ws = new THREE.Group();
      ws.position.set(0.14, 0.45, -0.16);
      body.add(ws);
      s.weaponSlot = ws;
      break;
    }
    case 'cyberdisc': {
      s.hover = 0.15;
      cyl(body, 0.1, 0.42, 0.14, color, 0, 0.1, 0, 16);
      cyl(body, 0.42, 0.15, 0.12, 0xa0a0a8, 0, 0.24, 0, 16);
      const ring = cyl(body, 0.44, 0.44, 0.03, 0x60c0ff, 0, 0.225, 0, 16, 0.9);
      ring.castShadow = false;
      box(body, 0.12, 0.06, 0.2, 0x404048, 0, 0.18, -0.38);
      break;
    }
    case 'reaper': {
      s.legs = [box(body, 0.1, 0.4, 0.12, 0x8a5a2a, -0.12, 0, 0.05), box(body, 0.1, 0.4, 0.12, 0x8a5a2a, 0.12, 0, 0.05)];
      const b = box(body, 0.36, 0.3, 0.5, color, 0, 0.38, 0);
      b.rotation.x = -0.15;
      const head = box(body, 0.26, 0.24, 0.3, 0xd08040, 0, 0.62, -0.3);
      head.rotation.x = 0.2;
      box(body, 0.22, 0.05, 0.15, 0xf0e0c0, 0, 0.6, -0.42);
      break;
    }
    case 'chryssalid': {
      box(body, 0.34, 0.26, 0.42, color, 0, 0.26, 0.05);
      sph(body, 0.13, 0x3a3a5a, 0, 0.55, -0.15);
      for (const sx of [-1, 1]) {
        for (const zz of [-0.1, 0.1]) {
          const l = box(body, 0.05, 0.32, 0.05, 0x1a1a2a, sx * 0.22, 0, zz);
          l.rotation.z = sx * 0.4;
          s.legs.push(l);
        }
        const claw = box(body, 0.05, 0.05, 0.35, 0x5a3a6a, sx * 0.16, 0.45, -0.35);
        claw.rotation.x = 0.3;
      }
      break;
    }
    case 'silacoid': {
      const b = sph(body, 0.3, color, 0, 0.18, 0, 0.35);
      b.scale.set(1.1, 0.55, 1.1);
      break;
    }
    case 'zombie': {
      s.legs = [box(body, 0.1, 0.34, 0.12, 0x4a4a3a, -0.07, 0, 0), box(body, 0.1, 0.34, 0.12, 0x4a4a3a, 0.07, 0, 0)];
      box(body, 0.3, 0.28, 0.18, color, 0, 0.33, 0);
      const a1 = box(body, 0.08, 0.08, 0.3, color, -0.18, 0.52, -0.15);
      const a2 = box(body, 0.08, 0.08, 0.3, color, 0.18, 0.52, -0.15);
      a1.rotation.x = a2.rotation.x = 0.1;
      sph(body, 0.1, 0x8aaa8a, 0, 0.7, -0.03);
      break;
    }
    default:
      box(body, 0.3, 0.7, 0.3, color, 0, 0, 0);
  }
  body.position.y = s.hover;
  return s;
}

export function refreshWeapon(model, u) {
  if (!model.weaponSlot) return;
  const w = u.mainWeapon ? u.mainWeapon() : null;
  const key = w ? w.uid : 0;
  if (model.weaponKey === key) return;
  model.weaponKey = key;
  model.weaponSlot.clear();
  if (w) model.weaponSlot.add(weaponMesh(w));
}
