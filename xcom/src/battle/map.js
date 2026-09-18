import { PARTS, P } from '../data/terrain.js';

export const DIRS = [
  [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
];

export function dirTo(dx, dy) {
  if (dx === 0 && dy === 0) return -1;
  const a = Math.atan2(dx, -dy); // 0 = north (-y), clockwise
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}

export class BattleMap {
  constructor(w, l, h) {
    this.w = w;
    this.l = l;
    this.h = h;
    const n = w * l * h;
    this.floor = new Uint16Array(n);
    this.obj = new Uint16Array(n);
    this.floorHp = new Float32Array(n);
    this.objHp = new Float32Array(n);
    this.smoke = new Uint8Array(n);
    this.fire = new Uint8Array(n);
    this.discovered = new Uint8Array(n);
    this.light = new Uint8Array(n); // static + dynamic light level (0..)
    this.unitAt = new Int32Array(n).fill(-1);
    this.items = new Map(); // idx -> item[]
    this.dirty = new Set(); // idx of changed voxels (renderer consumes)
    this.night = false;
  }

  idx(x, y, z) {
    return x + y * this.w + z * this.w * this.l;
  }
  pos(i) {
    const wl = this.w * this.l;
    const z = Math.floor(i / wl);
    const r = i - z * wl;
    return { x: r % this.w, y: Math.floor(r / this.w), z };
  }
  inBounds(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.l && z < this.h;
  }

  floorPart(x, y, z) {
    if (!this.inBounds(x, y, z)) return null;
    return PARTS[this.floor[this.idx(x, y, z)]];
  }
  objPart(x, y, z) {
    if (!this.inBounds(x, y, z)) return null;
    return PARTS[this.obj[this.idx(x, y, z)]];
  }

  setFloor(x, y, z, key) {
    const i = this.idx(x, y, z);
    const id = key ? P[key] : 0;
    if (key && !id) throw new Error('bad part ' + key);
    this.floor[i] = id;
    this.floorHp[i] = id ? PARTS[id].armor : 0;
    this.dirty.add(i);
  }
  setObj(x, y, z, key) {
    const i = this.idx(x, y, z);
    const id = key ? P[key] : 0;
    if (key && !id) throw new Error('bad part ' + key);
    this.obj[i] = id;
    this.objHp[i] = id ? PARTS[id].armor : 0;
    this.dirty.add(i);
    if (id && PARTS[id].key === 'tree' && z + 1 < this.h && !this.obj[i + this.w * this.l] && !this.floor[i + this.w * this.l]) {
      this.setObj(x, y, z + 1, 'canopy');
    }
  }

  // Does the voxel have something to stand on?
  hasStandingFloor(x, y, z) {
    const f = this.floorPart(x, y, z);
    return !!(f && !f.noWalk);
  }

  // Can a unit occupy this voxel (ignoring other units)?
  isPassable(x, y, z, flying) {
    if (!this.inBounds(x, y, z)) return false;
    const o = this.objPart(x, y, z);
    if (o && o.blocksMove) return false;
    const f = this.floorPart(x, y, z);
    if (f && f.noWalk) return false;
    if (flying) return true;
    return this.hasStandingFloor(x, y, z);
  }

  // Movement cost to enter voxel (without diagonal multiplier). 255 = impossible.
  enterCost(x, y, z, flying) {
    if (!this.isPassable(x, y, z, flying)) return 255;
    const f = this.floorPart(x, y, z);
    const o = this.objPart(x, y, z);
    let c = f ? f.cost : 4;
    if (o) c += o.cost;
    return c;
  }

  // Is voxel z a place a walking unit can stand without falling?
  supports(x, y, z) {
    return z === 0 || this.hasStandingFloor(x, y, z);
  }

  // Vertical movement from (x,y,z) to (x,y,z+dz).
  canMoveVertical(x, y, z, dz, flying) {
    const nz = z + dz;
    if (!this.inBounds(x, y, nz)) return false;
    const upper = dz > 0 ? nz : z;
    const lower = dz > 0 ? z : nz;
    const ceil = this.floorPart(x, y, upper);
    const lowObj = this.objPart(x, y, lower);
    const upObj = this.objPart(x, y, upper);
    if (upObj && upObj.blocksMove) return false;
    if (lowObj && lowObj.blocksMove) return false;
    const viaStairs = lowObj && (lowObj.stairs || lowObj.lift) && ceil && ceil.passage;
    if (viaStairs) return true;
    if (!flying) return false;
    return !ceil || ceil.passage;
  }

  isUfoTile(x, y, z) {
    const f = this.floorPart(x, y, z);
    const o = this.objPart(x, y, z);
    return !!((f && f.isUfo && !f.r.roof) || (o && o.isUfo));
  }
  isCraftTile(x, y, z) {
    const f = this.floorPart(x, y, z);
    return !!(f && f.isCraft && !f.r.roof);
  }

  groundItems(x, y, z) {
    return this.items.get(this.idx(x, y, z)) || [];
  }
  addItem(x, y, z, item) {
    // items fall to the lowest standing surface
    while (z > 0 && !this.hasStandingFloor(x, y, z)) z--;
    const i = this.idx(x, y, z);
    if (!this.items.has(i)) this.items.set(i, []);
    this.items.get(i).push(item);
    this.dirty.add(i);
    return z;
  }
  removeItem(x, y, z, item) {
    const i = this.idx(x, y, z);
    const arr = this.items.get(i);
    if (!arr) return;
    const k = arr.indexOf(item);
    if (k >= 0) arr.splice(k, 1);
    if (!arr.length) this.items.delete(i);
    this.dirty.add(i);
  }

  // Apply damage to a voxel's parts. Returns array of {x,y,z,part} for destroyed parts.
  damageVoxel(x, y, z, power, { floor = true, obj = true, fire = false } = {}) {
    const destroyed = [];
    if (!this.inBounds(x, y, z)) return destroyed;
    const i = this.idx(x, y, z);
    if (obj && this.obj[i]) {
      const p = PARTS[this.obj[i]];
      if (power > p.armor) {
        destroyed.push({ x, y, z, part: p, kind: 'obj' });
        this.setObj(x, y, z, p.destroyTo || null);
        // a destroyed tree loses its canopy
        if ((p.key === 'tree') && z + 1 < this.h && this.obj[i + this.w * this.l] === P.canopy) {
          this.setObj(x, y, z + 1, null);
        }
      }
    }
    if (floor && this.floor[i] && z > 0) {
      const p = PARTS[this.floor[i]];
      if (power > p.armor) {
        destroyed.push({ x, y, z, part: p, kind: 'floor' });
        this.setFloor(x, y, z, p.destroyTo || null);
      }
    } else if (floor && z === 0 && power > 40) {
      const p = PARTS[this.floor[i]];
      if (p && !p.noWalk && !p.isCraft && p.key !== 'scorched' && !p.isUfo && power > 60) this.setFloor(x, y, z, 'scorched');
    }
    return destroyed;
  }
}
