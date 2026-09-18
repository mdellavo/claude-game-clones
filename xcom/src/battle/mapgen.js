import { BattleMap } from './map.js';
import { UFOS } from '../data/ufos.js';
import { SPECIES, DIFFICULTY } from '../data/units.js';
import { PARTS, P } from '../data/terrain.js';

const BLOCK = 10;
const LEVELS = 4;

const GROUND = {
  farm: ['grass', 'grass_dark'],
  forest: ['forest_floor', 'grass_dark'],
  desert: ['sand', 'sand_dark'],
  arctic: ['snow', 'snow', 'ice'],
};

export function generateMission(opts, rng) {
  const ufo = UFOS[opts.ufo];
  const blocksW = ufo.size === 1 ? 4 : 5;
  const size = blocksW * BLOCK;
  const map = new BattleMap(size, size, LEVELS);
  map.night = !!opts.night;
  const terrain = opts.terrain;
  const g = new Gen(map, rng, terrain);

  g.fillGround(0, 0, size, size);

  // choose ufo block & craft block
  const s = ufo.size;
  const ubx = rng.int(1, blocksW - s - 1 >= 1 ? blocksW - s - 1 : 0);
  const uby = rng.int(0, blocksW - s);
  // craft goes in the block furthest from the UFO
  let best = null;
  for (let by = 0; by < blocksW; by++) {
    for (let bx = 0; bx < blocksW; bx++) {
      if (bx >= ubx - 1 && bx < ubx + s + 1 && by >= uby - 1 && by < uby + s + 1) continue;
      const d = Math.abs(bx - (ubx + s / 2)) + Math.abs(by - (uby + s / 2)) + rng.next();
      if (!best || d > best.d) best = { bx, by, d };
    }
  }
  const used = new Set();
  for (let by = uby; by < uby + s; by++) for (let bx = ubx; bx < ubx + s; bx++) used.add(bx + ',' + by);
  used.add(best.bx + ',' + best.by);

  // ramp faces the UFO; keep the block in front of it open
  const ddx = ubx + s / 2 - (best.bx + 0.5), ddy = uby + s / 2 - (best.by + 0.5);
  const rampDir = Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? 'E' : 'W') : ddy > 0 ? 'S' : 'N';
  const [fx, fy] = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[rampDir];
  const frontKey = best.bx + fx + ',' + (best.by + fy);
  for (let by = 0; by < blocksW; by++) {
    for (let bx = 0; bx < blocksW; bx++) {
      if (used.has(bx + ',' + by)) continue;
      if (bx + ',' + by === frontKey) g.scatter(bx * BLOCK, by * BLOCK, BLOCK, BLOCK, 0.05);
      else g.terrainBlock(bx * BLOCK, by * BLOCK);
    }
  }
  const craftSpawns = g.craft(best.bx * BLOCK, best.by * BLOCK, rampDir);

  // light scatter around UFO block
  g.scatter(ubx * BLOCK, uby * BLOCK, s * BLOCK, s * BLOCK, 0.04);
  const ufoInfo = g.ufo(ufo, ubx * BLOCK, uby * BLOCK, s * BLOCK);
  g.crashDamage(ufoInfo);

  // --- aliens
  const diff = DIFFICULTY[opts.difficulty ?? 2];
  const race = opts.race;
  const aliens = [];
  for (const [rank, count, prob = 1] of ufo.crew) {
    for (let i = 0; i < count; i++) {
      if (!rng.chance(prob)) continue;
      const species = rank === 'terrorist' ? SPECIES[race].terror : race;
      aliens.push({ species, rank });
    }
  }
  // difficulty scaling: add or remove soldiers
  const target = Math.max(1, Math.round(aliens.length * diff.countMult));
  while (aliens.length < target) aliens.push({ species: race, rank: 'soldier' });
  while (aliens.length > target) {
    const k = aliens.findIndex((a) => a.rank === 'soldier');
    if (k < 0) break;
    aliens.splice(k, 1);
  }
  // crash casualties
  for (let i = aliens.length - 1; i >= 0 && aliens.length > 1; i--) {
    if (rng.chance(0.12)) aliens.splice(i, 1);
  }

  const taken = new Set();
  const interior = rng.shuffle(ufoInfo.interior.slice());
  const outside = rng.shuffle(g.openTilesNear(ufoInfo.cx, ufoInfo.cy, ufoInfo.radius + 1, ufoInfo.radius + 9));
  for (const a of aliens) {
    const sp = SPECIES[a.species];
    const goOutside = sp.isTerror || rng.chance(0.3);
    let list = goOutside ? outside : interior;
    let spot = list.find((t) => !taken.has(t.x + ',' + t.y + ',' + t.z));
    if (!spot) spot = (list === outside ? interior : outside).find((t) => !taken.has(t.x + ',' + t.y + ',' + t.z));
    if (!spot) continue;
    taken.add(spot.x + ',' + spot.y + ',' + spot.z);
    a.x = spot.x;
    a.y = spot.y;
    a.z = spot.z;
    a.guard = !goOutside;
  }

  return {
    map,
    craftSpawns,
    aliens: aliens.filter((a) => a.x != null),
    ufo: ufoInfo,
  };
}

class Gen {
  constructor(map, rng, terrain) {
    this.m = map;
    this.rng = rng;
    this.t = terrain;
  }

  groundKey() {
    const opts = GROUND[this.t];
    return this.rng.chance(0.8) ? opts[0] : this.rng.pick(opts);
  }

  fillGround(x0, y0, w, l) {
    for (let y = y0; y < y0 + l; y++) for (let x = x0; x < x0 + w; x++) this.m.setFloor(x, y, 0, this.groundKey());
  }

  clearObj(x0, y0, w, l) {
    for (let z = 0; z < this.m.h; z++)
      for (let y = y0; y < y0 + l; y++)
        for (let x = x0; x < x0 + w; x++) {
          if (!this.m.inBounds(x, y, z)) continue;
          this.m.setObj(x, y, z, null);
          if (z > 0) this.m.setFloor(x, y, z, null);
        }
  }

  put(x, y, key, z = 0) {
    if (!this.m.inBounds(x, y, z)) return;
    this.m.setObj(x, y, z, key);
  }

  scatter(x0, y0, w, l, density) {
    const r = this.rng;
    for (let y = y0; y < y0 + l; y++)
      for (let x = x0; x < x0 + w; x++) {
        if (this.m.obj[this.m.idx(x, y, 0)] || !r.chance(density)) continue;
        this.put(x, y, this.natural());
      }
  }

  natural() {
    const r = this.rng;
    switch (this.t) {
      case 'farm':
        return r.pick(['bush', 'bush', 'tree', 'rock_small', 'hay_bale']);
      case 'forest':
        return r.pick(['tree', 'tree', 'pine', 'bush', 'rock_small', 'bush']);
      case 'desert':
        return r.pick(['rock_small', 'rock_small', 'cactus', 'rock_big', 'bush']);
      case 'arctic':
        return r.pick(['pine_snow', 'rock_small', 'ice_block', 'pine_snow', 'rock_big']);
    }
  }

  terrainBlock(ox, oy) {
    const r = this.rng;
    const t = this.t;
    const kinds = {
      farm: ['field', 'field', 'pasture', 'farmhouse', 'barn', 'orchard', 'open', 'open'],
      forest: ['woods', 'woods', 'woods', 'clearing', 'rocks', 'cabin', 'pond'],
      desert: ['open', 'open', 'rocks', 'rocks', 'adobe', 'mesa', 'cacti'],
      arctic: ['open', 'woods', 'woods', 'rocks', 'cabin', 'ice'],
    }[t];
    const kind = r.pick(kinds);
    switch (kind) {
      case 'field': {
        const crop = r.chance(0.5) ? 'wheat' : 'corn';
        const vertical = r.chance(0.5);
        for (let y = 1; y < 9; y++)
          for (let x = 1; x < 9; x++) {
            this.m.setFloor(ox + x, oy + y, 0, 'field');
            if ((vertical ? x : y) % 2 === 1 && r.chance(0.9)) this.put(ox + x, oy + y, crop);
          }
        break;
      }
      case 'pasture': {
        const x0 = ox + 1, y0 = oy + 1, w = 8;
        for (let i = 0; i < w; i++) {
          for (const [x, y] of [[x0 + i, y0], [x0 + i, y0 + w - 1], [x0, y0 + i], [x0 + w - 1, y0 + i]]) {
            if (r.chance(0.85)) this.put(x, y, r.chance(0.2) ? 'hedge' : 'fence');
          }
        }
        for (let i = 0; i < 4; i++) this.put(ox + r.int(2, 7), oy + r.int(2, 7), 'hay_bale');
        if (r.chance(0.4)) this.put(ox + r.int(2, 7), oy + r.int(2, 7), 'tractor');
        break;
      }
      case 'orchard':
        for (let y = 1; y < 10; y += 3) for (let x = 1; x < 10; x += 3) if (r.chance(0.85)) this.put(ox + x, oy + y, 'tree');
        this.scatter(ox, oy, 10, 10, 0.03);
        break;
      case 'farmhouse':
        this.house(ox + r.int(0, 2), oy + r.int(0, 2), 8, 7, { wall: 'brick_wall', storeys: 2, roof: 'roof_tiles' });
        break;
      case 'barn':
        this.barn(ox + r.int(0, 1), oy + r.int(0, 1));
        break;
      case 'cabin':
        this.house(ox + r.int(1, 3), oy + r.int(1, 3), 6, 6, { wall: 'wood_wall', storeys: 1, roof: this.t === 'arctic' ? 'roof_tin' : 'roof_tiles' });
        this.scatter(ox, oy, 10, 10, 0.1);
        break;
      case 'adobe':
        this.house(ox + r.int(1, 3), oy + r.int(1, 3), 7, 6, { wall: 'adobe_wall', storeys: r.chance(0.4) ? 2 : 1, roof: 'roof_tin' });
        break;
      case 'woods':
        this.scatter(ox, oy, 10, 10, t === 'arctic' ? 0.22 : 0.3);
        break;
      case 'clearing':
        this.scatter(ox, oy, 10, 10, 0.08);
        break;
      case 'rocks':
        for (let i = 0; i < 6; i++) {
          const x = ox + r.int(0, 9), y = oy + r.int(0, 9);
          this.put(x, y, r.chance(0.5) ? 'rock_big' : 'rock_small');
          if (r.chance(0.5)) this.put(x + 1, y, 'rock_small');
        }
        this.scatter(ox, oy, 10, 10, 0.04);
        break;
      case 'mesa': {
        const cx = ox + r.int(3, 6), cy = oy + r.int(3, 6), rad = r.int(2, 3);
        for (let y = -rad; y <= rad; y++)
          for (let x = -rad; x <= rad; x++) {
            const d = Math.hypot(x, y);
            if (d <= rad) this.put(cx + x, cy + y, d > rad - 1 && r.chance(0.3) ? 'rock_small' : 'rock_big');
          }
        break;
      }
      case 'cacti':
        for (let i = 0; i < 8; i++) this.put(ox + r.int(0, 9), oy + r.int(0, 9), 'cactus');
        this.scatter(ox, oy, 10, 10, 0.05);
        break;
      case 'ice':
        for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if (r.chance(0.3)) this.m.setFloor(ox + x, oy + y, 0, 'ice');
        for (let i = 0; i < 4; i++) this.put(ox + r.int(0, 9), oy + r.int(0, 9), 'ice_block');
        break;
      case 'pond': {
        const cx = ox + 5, cy = oy + 5;
        for (let y = 0; y < 10; y++)
          for (let x = 0; x < 10; x++) {
            const d = Math.hypot(ox + x - cx, oy + y - cy) + r.range(-0.6, 0.6);
            if (d < 2.8) this.m.setFloor(ox + x, oy + y, 0, 'water');
            else if (d < 4.2 && r.chance(0.25)) this.put(ox + x, oy + y, r.chance(0.5) ? 'bush' : 'rock_small');
          }
        break;
      }
      default:
        this.scatter(ox, oy, 10, 10, 0.05);
    }
  }

  house(x0, y0, w, l, { wall, storeys, roof }) {
    const r = this.rng;
    const m = this.m;
    this.clearObj(x0, y0, w, l);
    const inner = r.chance(0.6);
    const splitX = x0 + Math.floor(w / 2);
    for (let z = 0; z < storeys; z++) {
      for (let y = y0; y < y0 + l; y++)
        for (let x = x0; x < x0 + w; x++) {
          const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + l - 1;
          if (z === 0) m.setFloor(x, y, 0, 'tile_floor');
          else m.setFloor(x, y, z, 'wood_floor');
          if (edge) {
            const corner = (x === x0 || x === x0 + w - 1) && (y === y0 || y === y0 + l - 1);
            this.put(x, y, !corner && r.chance(0.22) ? 'window' : wall, z);
          } else if (inner && x === splitX && y !== y0 + 2) {
            this.put(x, y, wall === 'adobe_wall' ? 'adobe_wall' : 'wood_wall', z);
          }
        }
    }
    // doors on ground floor (front and back)
    const doors = [
      [x0 + r.int(1, Math.floor(w / 2) - 1), y0 + l - 1],
      [x0 + w - 1, y0 + r.int(1, l - 2)],
    ];
    if (r.chance(0.5)) doors.push([x0 + r.int(Math.floor(w / 2) + 1, w - 2), y0]);
    for (const [x, y] of doors) this.put(x, y, 'door');
    if (inner) this.put(splitX, y0 + 2, 'door');
    for (let z = 1; z < storeys; z++) if (inner) this.put(splitX, y0 + 2, 'door', z);
    // stairs
    if (storeys > 1) {
      const sx = x0 + 1, sy = y0 + l - 2;
      this.put(sx, sy, 'stairs', 0);
      m.setFloor(sx, sy, 1, 'stair_top');
      if (inner && sx === splitX) this.put(sx, sy, null, 1);
    }
    // furniture
    const furn = ['table', 'bed', 'cabinet', 'crate', null, null];
    for (let z = 0; z < storeys; z++)
      for (let i = 0; i < 3; i++) {
        const x = x0 + r.int(1, w - 2), y = y0 + r.int(1, l - 3);
        const i0 = m.idx(x, y, z);
        const f = r.pick(furn);
        if (f && !m.obj[i0] && !(z === 1 && m.floor[i0] === P.stair_top)) this.put(x, y, f, z);
      }
    // roof
    for (let y = y0; y < y0 + l; y++) for (let x = x0; x < x0 + w; x++) m.setFloor(x, y, storeys, roof);
    // unblock doorways outside
    for (const [x, y] of doors) {
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (m.inBounds(nx, ny, 0) && (nx < x0 || ny < y0 || nx >= x0 + w || ny >= y0 + l)) this.put(nx, ny, null);
      }
    }
  }

  barn(x0, y0) {
    const m = this.m;
    const r = this.rng;
    const w = 9, l = 8;
    this.clearObj(x0, y0, w, l);
    for (let y = y0; y < y0 + l; y++)
      for (let x = x0; x < x0 + w; x++) {
        m.setFloor(x, y, 0, 'dirt');
        const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + l - 1;
        if (edge) this.put(x, y, 'barn_wall');
        m.setFloor(x, y, 1, 'roof_tin');
      }
    const mid = x0 + 4;
    for (let x = mid - 1; x <= mid + 1; x++) this.put(x, y0 + l - 1, null);
    this.put(x0, y0 + 3, 'door');
    for (let i = 0; i < 6; i++) {
      const x = x0 + r.int(1, w - 2), y = y0 + r.int(1, l - 3);
      this.put(x, y, r.chance(0.7) ? 'hay_bale' : 'crate');
    }
    if (r.chance(0.5)) this.put(x0 + w - 2, y0 + 1, 'fuel_tank');
  }

  craft(ox, oy, rampDir = 'S') {
    const m = this.m;
    const layout = [
      '  ###  ',
      ' ##.## ',
      ' #...# ',
      '##...##',
      '#.....#',
      '#.....#',
      '#.....#',
      '#.....#',
      '#.....#',
      ' ,,,,, ',
    ];
    this.clearObj(ox, oy, 10, 10);
    const spawns = [];
    // layout is authored with the ramp at the bottom (south); transform for other headings
    const place = (x, y) => {
      switch (rampDir) {
        case 'N': return [ox + 1 + x, oy + 9 - y];
        case 'E': return [ox + y, oy + 1 + x];
        case 'W': return [ox + 9 - y, oy + 1 + x];
        default: return [ox + 1 + x, oy + y];
      }
    };
    layout.forEach((row, y) => {
      [...row].forEach((c, x) => {
        const [X, Y] = place(x, y);
        if (c === ' ') return;
        m.setFloor(X, Y, 0, 'craft_floor');
        if (c === '#') this.put(X, Y, 'craft_hull');
        if (c !== ',') m.setFloor(X, Y, 1, 'craft_roof');
        if (c === '.' || c === ',') spawns.push({ x: X, y: Y, z: 0 });
        m.light[m.idx(X, Y, 0)] = 1;
        m.discovered[m.idx(X, Y, 0)] = 1;
        m.discovered[m.idx(X, Y, 1)] = 1;
      });
    });
    // spawn order: nearest the ramp first so soldiers file out
    const key = { S: (p) => -p.y, N: (p) => p.y, E: (p) => -p.x, W: (p) => p.x }[rampDir];
    spawns.sort((a, b) => key(a) - key(b));
    spawns.facing = { N: 0, E: 2, S: 4, W: 6 }[rampDir];
    return spawns;
  }

  ufo(def, ox, oy, span) {
    const m = this.m;
    const r = this.rng;
    const W = def.levels[0][0].length;
    const L = def.levels[0].length;
    const x0 = ox + Math.floor((span - W) / 2);
    const y0 = oy + Math.floor((span - L) / 2);
    this.clearObj(x0 - 1, y0 - 1, W + 2, L + 2);
    const interior = [];
    const guardSpots = [];
    const footprint = [];
    const map = {
      '#': 'ufo_hull', '=': 'ufo_wall', D: 'ufo_door', P: 'power_source', N: 'navigation', C: 'alien_chair',
      L: 'ufo_lift', F: 'food_vat', S: 'surgery', X: 'exam_table', R: 'repro_pod', T: 'entertainment',
    };
    def.levels.forEach((rows, z) => {
      rows.forEach((row, y) => {
        [...row].forEach((c, x) => {
          if (c === ' ') return;
          const X = x0 + x, Y = y0 + y;
          m.setFloor(X, Y, z, c === 'l' ? 'ufo_lift_top' : 'ufo_floor');
          if (map[c]) this.put(X, Y, map[c], z);
          m.light[m.idx(X, Y, z)] = 1;
          if (c === '.' || c === 'l' || c === 'L') interior.push({ x: X, y: Y, z });
          footprint.push({ x: X, y: Y, z });
        });
      });
    });
    // roof: over every footprint voxel that has nothing above
    for (const f of footprint) {
      const above = f.z + 1;
      if (above >= m.h) continue;
      if (!m.floor[m.idx(f.x, f.y, above)]) m.setFloor(f.x, f.y, above, 'ufo_roof');
    }
    return {
      def, x0, y0, w: W, l: L, interior, footprint,
      cx: x0 + W / 2, cy: y0 + L / 2, radius: Math.max(W, L) / 2,
    };
  }

  crashDamage(u) {
    const m = this.m;
    const r = this.rng;
    // scorched furrow leading into the UFO
    const ang = r.range(0, Math.PI * 2);
    const len = u.radius + r.int(6, 12);
    for (let d = u.radius - 1; d < len; d += 0.5) {
      const cx = u.cx + Math.cos(ang) * d, cy = u.cy + Math.sin(ang) * d;
      for (let o = -1; o <= 1; o++) {
        const x = Math.floor(cx - Math.sin(ang) * o), y = Math.floor(cy + Math.cos(ang) * o);
        if (!m.inBounds(x, y, 0)) continue;
        const i = m.idx(x, y, 0);
        const f = PARTS[m.floor[i]];
        if (f.isUfo || f.isCraft) continue;
        if (f.noWalk) continue;
        m.setFloor(x, y, 0, r.chance(0.7) ? 'scorched' : 'dirt');
        const o0 = PARTS[m.obj[i]];
        if (o0 && !o0.isCraft) m.setObj(x, y, 0, r.chance(0.25) ? 'rubble' : null);
        for (let z = 1; z < m.h; z++) {
          const oz = PARTS[m.obj[m.idx(x, y, z)]];
          if (oz && oz.key === 'canopy') m.setObj(x, y, z, null);
        }
      }
    }
    // hull breaches
    const hull = u.footprint.filter((f) => PARTS[m.obj[m.idx(f.x, f.y, f.z)]]?.key === 'ufo_hull' && f.z === 0);
    const breaches = r.int(2, 4);
    for (let i = 0; i < breaches && hull.length; i++) {
      const h = hull.splice(r.int(0, hull.length - 1), 1)[0];
      m.setObj(h.x, h.y, 0, 'ufo_rubble');
      m.setFloor(h.x, h.y, 1, null);
      u.interior.push({ x: h.x, y: h.y, z: 0 });
    }
    // sometimes a power source ruptured in the crash
    const ps = u.footprint.filter((f) => PARTS[m.obj[m.idx(f.x, f.y, f.z)]]?.key === 'power_source');
    for (const p of ps) {
      if (r.chance(0.25)) {
        m.setObj(p.x, p.y, p.z, 'ufo_rubble');
        u.interior.push(p);
      }
    }
    // debris
    for (const f of u.footprint) {
      if (f.z !== 0) continue;
      const o = PARTS[m.obj[m.idx(f.x, f.y, 0)]];
      if (!o && r.chance(0.06)) m.setObj(f.x, f.y, 0, 'ufo_rubble');
    }
  }

  openTilesNear(cx, cy, rmin, rmax) {
    const m = this.m;
    const out = [];
    for (let y = Math.floor(cy - rmax); y <= cy + rmax; y++)
      for (let x = Math.floor(cx - rmax); x <= cx + rmax; x++) {
        if (!m.inBounds(x, y, 0)) continue;
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d < rmin || d > rmax) continue;
        if (!m.isPassable(x, y, 0, false)) continue;
        if (m.isCraftTile(x, y, 0) || m.isUfoTile(x, y, 0)) continue;
        out.push({ x, y, z: 0 });
      }
    return out;
  }
}
