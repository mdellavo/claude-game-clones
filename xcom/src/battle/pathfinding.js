import { DIRS } from './map.js';

class Heap {
  constructor() {
    this.k = [];
    this.v = [];
  }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v;
    const top = v[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0;
      const n = k.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c];
        v[i] = v[c];
        i = c;
      }
      k[i] = lk;
      v[i] = lv;
    }
    return top;
  }
  get size() {
    return this.k.length;
  }
}

// Step cost from voxel a to neighbour (dx,dy,dz); 255+ if impossible.
export function stepCost(map, unit, x, y, z, dx, dy, dz, ignoreUnits = false) {
  const nx = x + dx, ny = y + dy, nz = z + dz;
  if (!map.inBounds(nx, ny, nz)) return Infinity;
  const flying = unit.isFlying;
  if (!ignoreUnits) {
    const occ = map.unitAt[map.idx(nx, ny, nz)];
    if (occ >= 0 && occ !== unit.id) return Infinity;
  }
  if (dz !== 0) {
    if (!map.canMoveVertical(x, y, z, dz, flying)) return Infinity;
    if (!flying && !map.hasStandingFloor(nx, ny, nz) && nz > 0) return Infinity;
    return 8;
  }
  const c = map.enterCost(nx, ny, nz, flying);
  if (c >= 255) return Infinity;
  if (dx !== 0 && dy !== 0) {
    const o1 = map.objPart(x + dx, y, z);
    const o2 = map.objPart(x, y + dy, z);
    if ((o1 && o1.blocksMove) || (o2 && o2.blocksMove)) return Infinity;
    // closed doors can't be entered diagonally
    const od = map.objPart(nx, ny, nz);
    if (od && od.door) return Infinity;
    return Math.round(c * 1.5);
  }
  return c;
}

// Dijkstra from the unit's position. Returns a reachability object.
export function computeReach(map, unit, maxCost = 255) {
  const n = map.w * map.l * map.h;
  const dist = new Float32Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const start = map.idx(unit.x, unit.y, unit.z);
  dist[start] = 0;
  const heap = new Heap();
  heap.push(0, start);
  const wl = map.w * map.l;
  while (heap.size) {
    const i = heap.pop();
    const d = dist[i];
    const z = Math.floor(i / wl);
    const r = i - z * wl;
    const y = Math.floor(r / map.w);
    const x = r - y * map.w;
    for (let k = 0; k < 10; k++) {
      let dx = 0, dy = 0, dz = 0;
      if (k < 8) [dx, dy] = DIRS[k];
      else dz = k === 8 ? 1 : -1;
      const c = stepCost(map, unit, x, y, z, dx, dy, dz);
      if (c === Infinity) continue;
      const nd = d + c;
      if (nd > maxCost) continue;
      const ni = i + dx + dy * map.w + dz * wl;
      if (nd < dist[ni]) {
        dist[ni] = nd;
        prev[ni] = i;
        heap.push(nd, ni);
      }
    }
  }
  return {
    map, start, dist, prev,
    cost(x, y, z) {
      return map.inBounds(x, y, z) ? dist[map.idx(x, y, z)] : Infinity;
    },
    path(x, y, z) {
      if (!map.inBounds(x, y, z)) return null;
      let i = map.idx(x, y, z);
      if (dist[i] === Infinity) return null;
      const out = [];
      while (i !== start) {
        const p = map.pos(i);
        p.cost = dist[i];
        out.push(p);
        i = prev[i];
      }
      return out.reverse();
    },
  };
}
