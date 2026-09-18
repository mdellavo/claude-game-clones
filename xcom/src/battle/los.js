import { PARTS } from '../data/terrain.js';
import { DIRS } from './map.js';

const SMOKE_LIMIT = 12;

// Voxel traversal (Amanatides & Woo). Coordinates are continuous map units
// where one level is one unit high.
//   mode 'vision'     : windows are transparent, smoke accumulates, units ignored
//   mode 'projectile' : units block (except opts.ignore), everything with height blocks
// opts.extend: continue past `to` up to opts.maxDist
// opts.visit(i): called for each voxel entered
export function traceRay(map, from, to, opts = {}) {
  const mode = opts.mode || 'vision';
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz) || 1e-6;
  const tEnd = opts.extend ? (opts.maxDist || 60) / len : 1;
  let ix = Math.floor(from.x), iy = Math.floor(from.y), iz = Math.floor(from.z);
  const sx = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const sy = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const sz = dz > 0 ? 1 : dz < 0 ? -1 : 0;
  const tdx = sx ? Math.abs(1 / dx) : Infinity;
  const tdy = sy ? Math.abs(1 / dy) : Infinity;
  const tdz = sz ? Math.abs(1 / dz) : Infinity;
  let tmx = sx > 0 ? (ix + 1 - from.x) * tdx : sx < 0 ? (from.x - ix) * tdx : Infinity;
  let tmy = sy > 0 ? (iy + 1 - from.y) * tdy : sy < 0 ? (from.y - iy) * tdy : Infinity;
  let tmz = sz > 0 ? (iz + 1 - from.z) * tdz : sz < 0 ? (from.z - iz) * tdz : Infinity;
  let tEnter = 0;
  let smoke = 0;
  const wl = map.w * map.l;
  const startVoxel = true;
  let first = startVoxel;
  const pointAt = (t) => ({ x: from.x + dx * t, y: from.y + dy * t, z: from.z + dz * t });

  for (let guard = 0; guard < 400; guard++) {
    if (ix < 0 || iy < 0 || ix >= map.w || iy >= map.l || iz >= map.h) {
      return { hit: 'bounds', t: tEnter, point: pointAt(tEnter), smoke };
    }
    if (iz < 0) return { hit: 'floor', x: ix, y: iy, z: 0, t: tEnter, point: pointAt(tEnter), smoke };
    const i = ix + iy * map.w + iz * wl;
    const tExit = Math.min(tmx, tmy, tmz, tEnd);
    if (opts.visit) opts.visit(i);

    // object in voxel
    const oid = map.obj[i];
    if (oid && !first) {
      const p = PARTS[oid];
      let blocks = p.height > 0;
      if (mode === 'vision' && p.seeThrough) blocks = false;
      if (mode === 'projectile' && p.passThrough) blocks = false;
      if (blocks) {
        const z0 = from.z + dz * tEnter - iz;
        const z1 = from.z + dz * tExit - iz;
        const lo = Math.min(z0, z1);
        if (lo < p.height - 1e-6) {
          let t = tEnter;
          if (z0 >= p.height && dz < 0) t = tEnter + (z0 - p.height) / (z0 - z1) * (tExit - tEnter);
          return { hit: 'obj', x: ix, y: iy, z: iz, part: p, t, point: pointAt(t), smoke };
        }
      }
    }
    // smoke
    if (mode === 'vision' && map.smoke[i]) {
      smoke += map.smoke[i] * (tExit - tEnter) * len;
      if (smoke > SMOKE_LIMIT) return { hit: 'smoke', x: ix, y: iy, z: iz, t: tEnter, point: pointAt(tEnter), smoke };
    }
    // units
    if (mode === 'projectile' && opts.units) {
      const uid = map.unitAt[i];
      if (uid >= 0 && uid !== opts.ignore) {
        const u = opts.units.get(uid);
        if (u && u.active) {
          const bh = u.bodyHeight();
          const hover = u.isFlying && !map.hasStandingFloor(ix, iy, iz) ? 0.15 : 0;
          for (let s = 0; s <= 6; s++) {
            const t = tEnter + ((tExit - tEnter) * s) / 6;
            const px = from.x + dx * t - (ix + 0.5);
            const py = from.y + dy * t - (iy + 0.5);
            const pz = from.z + dz * t - iz;
            if (px * px + py * py < 0.34 * 0.34 && pz >= hover && pz <= hover + bh) {
              return { hit: 'unit', unit: u, x: ix, y: iy, z: iz, t, point: pointAt(t), smoke };
            }
          }
        }
      }
    }
    first = false;
    if (tExit >= tEnd) return { hit: 'none', x: ix, y: iy, z: iz, t: tEnd, point: pointAt(tEnd), smoke };

    // advance
    if (tmx <= tmy && tmx <= tmz) {
      ix += sx;
      tEnter = tmx;
      tmx += tdx;
    } else if (tmy <= tmz) {
      iy += sy;
      tEnter = tmy;
      tmy += tdy;
    } else {
      // crossing a floor boundary
      const floorZ = sz > 0 ? iz + 1 : iz;
      if (floorZ === 0) return { hit: 'floor', x: ix, y: iy, z: 0, t: tmz, point: pointAt(tmz), smoke };
      if (floorZ < map.h) {
        const f = map.floor[ix + iy * map.w + floorZ * wl];
        if (f && !PARTS[f].passage) {
          return { hit: 'floor', x: ix, y: iy, z: floorZ, part: PARTS[f], t: tmz, point: pointAt(tmz), smoke };
        }
      }
      iz += sz;
      tEnter = tmz;
      tmz += tdz;
    }
  }
  return { hit: 'none', t: tEnd, point: pointAt(tEnd), smoke };
}

export function unitHover(map, u) {
  return u.isFlying && u.z > 0 && !map.hasStandingFloor(u.x, u.y, u.z) ? 0.15 : 0;
}

export function eyePos(map, u) {
  return { x: u.x + 0.5, y: u.y + 0.5, z: u.z + unitHover(map, u) + u.eyeHeight() };
}

export function unitPoint(map, u, frac = 0.5) {
  return { x: u.x + 0.5, y: u.y + 0.5, z: u.z + unitHover(map, u) + u.bodyHeight() * frac };
}

export function inFov(u, tx, ty) {
  const dx = tx - u.x, dy = ty - u.y;
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) return true;
  const [fx, fy] = DIRS[u.facing];
  const fl = Math.hypot(fx, fy);
  const dl = Math.hypot(dx, dy);
  const cos = (dx * fx + dy * fy) / (fl * dl);
  return cos >= Math.cos((50 * Math.PI) / 180);
}

export function isLit(battle, x, y, z) {
  const m = battle.map;
  if (!m.night) return true;
  return m.light[m.idx(x, y, z)] > 0 || battle.dynLight(x, y, z);
}

export function visionRange(battle, viewer, target) {
  if (viewer.faction === 'alien') return 20;
  if (!battle.map.night) return 20;
  return isLit(battle, target.x, target.y, target.z) ? 20 : 9;
}

export function canSeeUnit(battle, viewer, target) {
  if (!viewer.active || target.status === 'dead') return false;
  const dist = Math.hypot(target.x - viewer.x, target.y - viewer.y, target.z - viewer.z);
  if (dist > visionRange(battle, viewer, target)) return false;
  if (!inFov(viewer, target.x, target.y)) return false;
  const map = battle.map;
  const eye = eyePos(map, viewer);
  for (const frac of [0.85, 0.5, 0.2]) {
    const p = unitPoint(map, target, target.active ? frac : 0.1);
    const r = traceRay(map, eye, p, { mode: 'vision' });
    if (r.hit === 'none') return true;
    if (r.x === target.x && r.y === target.y && r.z === target.z && r.hit === 'obj' && r.part.height < 1) return true;
  }
  return false;
}

// Reveal terrain seen by an xcom unit. Returns true if anything new was discovered.
export function discoverFrom(battle, u) {
  const map = battle.map;
  const eye = eyePos(map, u);
  const range = map.night ? 12 : 20;
  let changed = false;
  const visit = (i) => {
    if (!map.discovered[i]) {
      map.discovered[i] = 1;
      changed = true;
    }
  };
  const r2 = range * range;
  for (let z = 0; z < map.h; z++) {
    for (let y = Math.max(0, u.y - range); y <= Math.min(map.l - 1, u.y + range); y++) {
      for (let x = Math.max(0, u.x - range); x <= Math.min(map.w - 1, u.x + range); x++) {
        const i = map.idx(x, y, z);
        if (map.discovered[i]) continue;
        const ddx = x - u.x, ddy = y - u.y;
        if (ddx * ddx + ddy * ddy > r2) continue;
        if (!inFov(u, x, y)) continue;
        const res = traceRay(map, eye, { x: x + 0.5, y: y + 0.5, z: z + 0.3 }, { mode: 'vision', visit });
        if (res.hit === 'floor' && res.z > 0) {
          const fi = map.idx(res.x, res.y, res.z);
          visit(fi);
        }
      }
    }
  }
  visit(map.idx(u.x, u.y, u.z));
  return changed;
}
