import { PARTS } from '../data/terrain.js';
import { GeoBuilder, col, shade, mix, hashRand } from './geom.js';

export const CHUNK = 10;
const WALLISH = new Set(['wall', 'window', 'door']);

const colorCache = new Map();
function C(hex) {
  let c = colorCache.get(hex);
  if (!c) colorCache.set(hex, (c = col(hex)));
  return c;
}

// Oriented prism from (ax,az) to (bx,bz), thickness t, from y0 to y0+h.
function seg(g, ax, az, bx, bz, y0, h, t, color, topColor) {
  const dx = bx - ax, dz = bz - az;
  const l = Math.hypot(dx, dz) || 1;
  const nx = (-dz / l) * (t / 2), nz = (dx / l) * (t / 2);
  const y1 = y0 + h;
  const p = [
    [ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz], [ax - nx, az - nz],
  ];
  const top = topColor || shade(color, 1.15);
  g.quad([p[0][0], y1, p[0][1]], [p[3][0], y1, p[3][1]], [p[2][0], y1, p[2][1]], [p[1][0], y1, p[1][1]], top);
  const sides = [[0, 1], [1, 2], [2, 3], [3, 0]];
  for (const [i, j] of sides) {
    const a = p[i], b = p[j];
    const ex = b[0] - a[0], ez = b[1] - a[1];
    const lit = 0.72 + 0.2 * Math.abs(ez / (Math.hypot(ex, ez) || 1));
    g.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], shade(color, lit));
  }
}

function connects(map, x, y, z, part, dx, dy) {
  const o = map.objPart(x + dx, y + dy, z);
  if (!o) return false;
  if (part.r.type === 'fence') return o.r.type === 'fence' || (WALLISH.has(o.r.type) && !!o.r.group);
  if (!WALLISH.has(o.r.type)) return false;
  return o.r.group === part.r.group || (part.r.group === 'house' && o.r.group === 'house');
}

function neighbours(map, x, y, z, part) {
  const n = {
    N: connects(map, x, y, z, part, 0, -1),
    E: connects(map, x, y, z, part, 1, 0),
    S: connects(map, x, y, z, part, 0, 1),
    W: connects(map, x, y, z, part, -1, 0),
  };
  n.NE = !n.N && !n.E && connects(map, x, y, z, part, 1, -1);
  n.SE = !n.S && !n.E && connects(map, x, y, z, part, 1, 1);
  n.SW = !n.S && !n.W && connects(map, x, y, z, part, -1, 1);
  n.NW = !n.N && !n.W && connects(map, x, y, z, part, -1, -1);
  return n;
}

const ARM = {
  N: [0, -0.5], E: [0.5, 0], S: [0, 0.5], W: [-0.5, 0], NE: [0.5, -0.5], SE: [0.5, 0.5], SW: [-0.5, 0.5], NW: [-0.5, -0.5],
};

function wallArms(g, map, x, y, z, part, y0, h, t, color, top) {
  const n = neighbours(map, x, y, z, part);
  const cx = x + 0.5, cz = y + 0.5;
  let any = false;
  for (const k of Object.keys(ARM)) {
    if (!n[k]) continue;
    any = true;
    const [ax, az] = ARM[k];
    seg(g, cx, cz, cx + ax, cz + az, y0, h, t, color, top);
  }
  g.cbox(cx, y0, cz, t * 1.02, h + 0.002, t * 1.02, color, { top });
  return { n, any };
}

export function buildChunk(map, cx0, cy0, z, opts = {}) {
  const g = new GeoBuilder();
  const Y = z; // world height of this level
  for (let y = cy0; y < Math.min(cy0 + CHUNK, map.l); y++) {
    for (let x = cx0; x < Math.min(cx0 + CHUNK, map.w); x++) {
      const i = map.idx(x, y, z);
      const f = PARTS[map.floor[i]];
      const o = PARTS[map.obj[i]];
      if (!f && !o) continue;
      g.setVoxel(x, y, z);
      const rnd = hashRand(x, y, z);
      if (f) floorGeo(g, map, x, y, z, Y, f, rnd);
      if (o) objGeo(g, map, x, y, z, Y, o, rnd);
    }
  }
  return g.empty ? null : g.build();
}

function floorGeo(g, map, x, y, z, Y, f, rnd) {
  const r = f.r;
  if (r.type === 'none') return;
  let c = C(r.color);
  c = shade(c, 1 + (rnd() - 0.5) * 2 * (r.vary || 0));
  if (r.grid && (x + y) % 2) c = shade(c, 0.93);
  if (r.type === 'passage') {
    const t = 0.06;
    const y0 = Y - t;
    const e = 0.2;
    g.box(x, y0, y, 1, t, e, c);
    g.box(x, y0, y + 1 - e, 1, t, e, c);
    g.box(x, y0, y + e, e, t, 1 - 2 * e, c);
    g.box(x + 1 - e, y0, y + e, e, t, 1 - 2 * e, c);
    if (r.lift) {
      g.g = 0.8;
      g.cyl(x + 0.5, Y - 0.02, y + 0.5, 0.28, 0.28, 0.01, C(0x6a9ac8), 10);
      g.g = 0;
    }
    return;
  }
  if (z === 0) {
    let yy = Y;
    if (r.water) {
      yy = Y - 0.12;
      g.g = 0.15;
    }
    if (r.rows) c = (x % 2 === 0) !== (y % 2 === 0) ? shade(c, 0.95) : c;
    g.quad([x, yy, y], [x, yy, y + 1], [x + 1, yy, y + 1], [x + 1, yy, y], c);
    g.g = 0;
    // subtle edge darkening for crafted floors
    if (r.grid) {
      const d = shade(c, 0.82);
      g.quad([x, yy + 0.002, y], [x, yy + 0.002, y + 0.04], [x + 1, yy + 0.002, y + 0.04], [x + 1, yy + 0.002, y], d);
      g.quad([x, yy + 0.002, y], [x, yy + 0.002, y + 1], [x + 0.04, yy + 0.002, y + 1], [x + 0.04, yy + 0.002, y], d);
    }
    return;
  }
  const t = r.roof ? 0.1 : 0.06;
  g.box(x, Y - t, y, 1, t, 1, c, { bottom: true });
  if (r.planks) {
    const d = shade(c, 0.85);
    for (let k = 1; k < 4; k++) g.box(x, Y + 0.001, y + k * 0.25 - 0.01, 1, 0.002, 0.02, d, { sides: false });
  }
}

function objGeo(g, map, x, y, z, Y, o, rnd) {
  const r = o.r;
  const c = C(r.color);
  const cx = x + 0.5, cz = y + 0.5;
  switch (r.type) {
    case 'wall': {
      const t = r.group === 'ufo' ? 0.3 : r.group === 'craft' ? 0.36 : 0.2;
      const top = r.ufo ? shade(c, 1.3) : r.group === 'craft' ? shade(c, 1.2) : shade(c, 0.8);
      const { any } = wallArms(g, map, x, y, z, o, Y, 1, t, c, top);
      if (!any) g.cbox(cx, Y, cz, 0.6, 1, 0.6, c, { top });
      if (r.ufo) {
        g.g = 0.6;
        const n = neighbours(map, x, y, z, o);
        for (const k of Object.keys(ARM)) {
          if (!n[k]) continue;
          const [ax, az] = ARM[k];
          seg(g, cx, cz, cx + ax, cz + az, Y + 0.72, 0.05, t + 0.02, C(0x8080ff));
        }
        g.g = 0;
      }
      break;
    }
    case 'window': {
      const t = 0.2;
      const n = neighbours(map, x, y, z, o);
      wallArms(g, map, x, y, z, o, Y, 0.38, t, c, shade(c, 0.9));
      if (!r.broken) {
        wallArms(g, map, x, y, z, o, Y + 0.82, 0.18, t, c, shade(c, 0.8));
        g.g = 0.25;
        for (const k of ['N', 'E', 'S', 'W']) {
          if (!n[k]) continue;
          const [ax, az] = ARM[k];
          seg(g, cx, cz, cx + ax, cz + az, Y + 0.38, 0.44, 0.04, C(0x9ac0d8));
        }
        g.g = 0;
      }
      break;
    }
    case 'door': {
      const n = neighbours(map, x, y, z, o);
      const alongX = n.E || n.W || !(n.N || n.S);
      const t = r.group === 'ufo' ? 0.3 : 0.2;
      const frame = r.group === 'ufo' ? C(0x6c6c7c) : C(0xa0624a);
      const [ax, az] = alongX ? [0.5, 0] : [0, 0.5];
      // lintel
      seg(g, cx - ax, cz - az, cx + ax, cz + az, Y + 0.85, 0.15, t, frame);
      if (r.open) {
        if (r.group === 'ufo') {
          seg(g, cx - ax, cz - az, cx - ax * 0.8, cz - az * 0.8, Y, 0.85, t, frame);
          seg(g, cx + ax * 0.8, cz + az * 0.8, cx + ax, cz + az, Y, 0.85, t, frame);
        } else {
          // swung-open leaf
          const px = cx - ax * 0.9, pz = cz - az * 0.9;
          seg(g, px, pz, px + (alongX ? 0 : 0.7), pz + (alongX ? 0.7 : 0), Y, 0.84, 0.05, c);
        }
      } else {
        seg(g, cx - ax, cz - az, cx + ax, cz + az, Y, 0.85, r.group === 'ufo' ? t * 0.6 : 0.08, c);
        if (r.group === 'ufo') {
          g.g = 0.7;
          seg(g, cx - ax * 0.05, cz - az * 0.05, cx + ax * 0.05, cz + az * 0.05, Y + 0.05, 0.75, t * 0.65, C(0x9090ff));
          g.g = 0;
        }
      }
      break;
    }
    case 'fence': {
      const n = neighbours(map, x, y, z, o);
      const h = o.height;
      if (r.thick) {
        wallArms(g, map, x, y, z, o, Y, h, 0.34, c, shade(c, 1.1));
        if (r.group === 'hedge') g.blob(cx, Y + h * 0.6, cz, 0.3, 0.3, 0.3, shade(c, 1.05), rnd);
      } else {
        g.cbox(cx, Y, cz, 0.09, h + 0.08, 0.09, shade(c, 0.9));
        for (const k of ['N', 'E', 'S', 'W']) {
          if (!n[k]) continue;
          const [ax, az] = ARM[k];
          seg(g, cx, cz, cx + ax, cz + az, Y + h * 0.35, 0.06, 0.05, c);
          seg(g, cx, cz, cx + ax, cz + az, Y + h * 0.85, 0.06, 0.05, c);
        }
      }
      break;
    }
    case 'tree': {
      const trunk = C(r.trunk);
      const ox = (rnd() - 0.5) * 0.2, oz = (rnd() - 0.5) * 0.2;
      g.cyl(cx + ox, Y, cz + oz, 0.12, 0.08, 1.0, trunk, 6);
      const leaf = shade(c, 0.85 + rnd() * 0.3);
      g.blob(cx + ox, Y + 0.9, cz + oz, 0.5, 0.42, 0.5, leaf, rnd);
      break;
    }
    case 'canopy': {
      const leaf = shade(c, 0.85 + rnd() * 0.3);
      g.blob(cx, Y + 0.25, cz, 0.62, 0.45, 0.62, leaf, rnd);
      g.blob(cx + (rnd() - 0.5) * 0.3, Y + 0.6, cz + (rnd() - 0.5) * 0.3, 0.35, 0.3, 0.35, shade(leaf, 1.1), rnd);
      break;
    }
    case 'pine': {
      const trunk = C(r.trunk);
      g.cyl(cx, Y, cz, 0.08, 0.06, 0.4, trunk, 6);
      const leaf = shade(c, 0.85 + rnd() * 0.3);
      const s = 0.9 + rnd() * 0.25;
      g.cyl(cx, Y + 0.25, cz, 0.48 * s, 0, 0.7 * s, leaf, 7);
      g.cyl(cx, Y + 0.6 * s, cz, 0.38 * s, 0, 0.65 * s, shade(leaf, 1.08), 7);
      g.cyl(cx, Y + 0.95 * s, cz, 0.26 * s, 0, 0.55 * s, shade(leaf, 1.15), 7);
      if (r.snow) g.cyl(cx, Y + 1.25 * s, cz, 0.14 * s, 0, 0.25 * s, C(0xf0f4f8), 7);
      break;
    }
    case 'stump':
      g.cyl(cx, Y, cz, 0.16, 0.14, 0.18, c, 6);
      break;
    case 'bush':
      g.blob(cx + (rnd() - 0.5) * 0.2, Y + 0.22, cz + (rnd() - 0.5) * 0.2, 0.38, 0.28, 0.38, shade(c, 0.9 + rnd() * 0.2), rnd);
      g.blob(cx + (rnd() - 0.5) * 0.3, Y + 0.3, cz + (rnd() - 0.5) * 0.3, 0.22, 0.2, 0.22, shade(c, 1.1), rnd);
      break;
    case 'rock': {
      const s = r.s || 0.5;
      g.blob(cx, Y + s * 0.35, cz, 0.45 * s + 0.1, s * 0.5, 0.42 * s + 0.1, shade(c, 0.9 + rnd() * 0.2), rnd);
      if (s > 0.8) g.blob(cx + 0.15, Y + s * 0.8, cz - 0.1, 0.3, 0.25, 0.3, shade(c, 1.05), rnd);
      break;
    }
    case 'cactus':
      g.cyl(cx, Y, cz, 0.1, 0.09, 0.8, c, 6);
      g.box(cx + 0.08, Y + 0.35, cz - 0.04, 0.15, 0.07, 0.08, c);
      g.box(cx + 0.18, Y + 0.35, cz - 0.04, 0.07, 0.25, 0.08, c);
      g.box(cx - 0.22, Y + 0.45, cz - 0.04, 0.14, 0.07, 0.08, c);
      g.box(cx - 0.22, Y + 0.45, cz - 0.04, 0.07, 0.2, 0.08, c);
      break;
    case 'wheat': {
      const h = o.height;
      for (let k = 0; k < 7; k++) {
        const px = x + 0.1 + rnd() * 0.8, pz = y + 0.1 + rnd() * 0.8;
        const hh = h * (0.7 + rnd() * 0.4);
        g.cbox(px, Y, pz, 0.05, hh, 0.05, shade(c, 0.8 + rnd() * 0.3));
        if (r.tall) g.cbox(px, Y + hh * 0.6, pz, 0.14, 0.03, 0.05, shade(c, 1.1));
        else g.cbox(px, Y + hh, pz, 0.08, 0.1, 0.08, shade(c, 1.15));
      }
      break;
    }
    case 'hay':
      g.cyl(cx, Y, cz, 0.4, 0.4, 0.6, c, 10);
      g.cyl(cx, Y + 0.6, cz, 0.4, 0.3, 0.02, shade(c, 1.1), 10);
      break;
    case 'crate': {
      const w = r.w || 0.7, h = r.h || 0.6;
      g.cbox(cx, Y, cz, w, h, w, c, { top: shade(c, 1.1) });
      g.cbox(cx, Y + h * 0.45, cz, w + 0.02, 0.06, w + 0.02, shade(c, 0.7));
      break;
    }
    case 'table':
      g.cbox(cx, Y + 0.38, cz, 0.8, 0.07, 0.6, c);
      for (const [lx, lz] of [[-0.35, -0.25], [0.35, -0.25], [-0.35, 0.25], [0.35, 0.25]]) g.cbox(cx + lx, Y, cz + lz, 0.06, 0.38, 0.06, shade(c, 0.8));
      break;
    case 'bed': {
      if (r.glow) {
        g.cbox(cx, Y, cz, 0.35, 0.3, 0.35, C(0x404050));
        g.cbox(cx, Y + 0.3, cz, 0.85, 0.12, 0.55, c);
        g.g = 0.8;
        g.cbox(cx, Y + 0.42, cz, 0.6, 0.02, 0.3, C(r.glow));
        g.g = 0;
      } else {
        g.cbox(cx, Y, cz, 0.85, 0.3, 0.6, C(0x6a4a30));
        g.cbox(cx, Y + 0.3, cz, 0.8, 0.06, 0.55, c);
        g.cbox(cx - 0.28, Y + 0.36, cz, 0.18, 0.06, 0.4, C(0xe8e8e8));
      }
      break;
    }
    case 'stairs': {
      // rise toward a neighbouring wall if any
      let dir = [0, -1];
      for (const d of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const n = map.objPart(x + d[0], y + d[1], z);
        if (n && n.blocksMove) {
          dir = d;
          break;
        }
      }
      for (let k = 0; k < 5; k++) {
        const t0 = -0.5 + k * 0.2;
        const px = cx + dir[0] * (t0 + 0.1), pz = cz + dir[1] * (t0 + 0.1);
        const sx = dir[0] ? 0.2 : 0.8, sz = dir[1] ? 0.2 : 0.8;
        g.cbox(px, Y, pz, sx, (k + 1) * 0.2, sz, shade(c, 0.9 + k * 0.04));
      }
      break;
    }
    case 'tank':
      g.cyl(cx, Y, cz, 0.38, 0.38, 0.7, c, 10);
      g.cyl(cx, Y + 0.7, cz, 0.38, 0.1, 0.12, shade(c, 1.1), 10);
      g.cbox(cx, Y + 0.3, cz - 0.4, 0.12, 0.1, 0.1, C(0xb03030));
      break;
    case 'lift':
      g.g = 0.9;
      g.cyl(cx, Y, cz, 0.45, 0.45, 0.04, c, 12);
      g.g = 0.5;
      g.cyl(cx, Y + 0.04, cz, 0.3, 0.3, 0.02, C(0xa0d0ff), 12);
      g.g = 0;
      break;
    case 'power':
      g.cyl(cx, Y, cz, 0.45, 0.4, 0.2, C(0x505060), 10);
      g.g = 1;
      g.cyl(cx, Y + 0.2, cz, 0.22, 0.22, 0.5, c, 10);
      g.g = 0;
      g.cyl(cx, Y + 0.7, cz, 0.4, 0.3, 0.1, C(0x606070), 10);
      break;
    case 'console':
      g.cbox(cx, Y, cz, 0.75, 0.45, 0.45, c, { top: shade(c, 1.2) });
      g.g = 1;
      g.cbox(cx, Y + 0.45, cz, 0.6, 0.05, 0.3, C(r.glow));
      g.g = 0;
      g.cbox(cx, Y + 0.45, cz + 0.12, 0.7, 0.15, 0.08, shade(c, 0.9));
      break;
    case 'chair':
      g.cyl(cx, Y, cz, 0.1, 0.1, 0.25, C(0x404048), 6);
      g.cbox(cx, Y + 0.25, cz, 0.45, 0.08, 0.45, c);
      g.cbox(cx, Y + 0.25, cz - 0.2, 0.45, 0.35, 0.07, shade(c, 0.9));
      break;
    case 'pod':
      g.cyl(cx, Y, cz, 0.35, 0.35, 0.12, c, 10);
      g.g = 0.8;
      g.cyl(cx, Y + 0.12, cz, 0.25, 0.25, o.height - 0.25, C(r.glow), 10);
      g.g = 0;
      g.cyl(cx, Y + o.height - 0.13, cz, 0.35, 0.2, 0.13, c, 10);
      break;
    case 'rubble': {
      for (let k = 0; k < 5; k++) {
        const px = x + 0.15 + rnd() * 0.7, pz = y + 0.15 + rnd() * 0.7;
        const s = 0.12 + rnd() * 0.18;
        g.cbox(px, Y, pz, s, s * (0.5 + rnd()), s * (0.6 + rnd() * 0.8), shade(c, 0.8 + rnd() * 0.4));
      }
      break;
    }
    default:
      g.cbox(cx, Y, cz, 0.6, Math.max(0.1, o.height), 0.6, c);
  }
}

// Colour helper for items on the ground
export function itemColor(hex) {
  return C(hex || 0x999999);
}
export { mix };
