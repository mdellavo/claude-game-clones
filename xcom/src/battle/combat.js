import { itemDef, makeItem, weaponDamage, itemWeight } from '../data/items.js';
import { PARTS } from '../data/terrain.js';
import { SPECIES } from '../data/units.js';
import { dirTo } from './map.js';
import { traceRay, eyePos, unitPoint } from './los.js';

// ------------------------------------------------------------------ helpers
export function builtinWeapon(u) {
  if (!u.builtin) return null;
  if (!u._builtinItem) u._builtinItem = makeItem(u.builtin);
  return u._builtinItem;
}

export function unitWeapon(u) {
  return u.mainWeapon() || builtinWeapon(u);
}

export function modeCost(battle, u, weapon, mode) {
  const d = itemDef(weapon.id);
  if (d.kind === 'melee') return battle.tuCostPct(u, d.tu);
  const m = d.modes?.[mode];
  return m ? battle.tuCostPct(u, m.tu) : Infinity;
}

export function hasAmmo(weapon) {
  const d = itemDef(weapon.id);
  if (!d.ammo) return true;
  return !!(weapon.loaded && weapon.loaded.rounds > 0);
}

export function accuracy(battle, u, weapon, mode) {
  const d = itemDef(weapon.id);
  if (d.kind === 'melee') return Math.min(1, ((u.stats.melee || 50) / 100) * (d.acc / 100) + 0.25);
  const m = d.modes[mode];
  let acc = (u.stats.firing * m.acc) / 10000;
  if (u.kneeling) acc *= 1.15;
  if (d.twoHanded) {
    const other = u.hand('rhand') === weapon ? u.hand('lhand') : u.hand('rhand');
    if (other) acc *= 0.8;
  }
  acc *= 0.6 + (0.4 * Math.max(0, u.health)) / u.stats.health;
  return acc;
}

export function throwRange(u, item) {
  const w = itemWeight(item);
  return Math.max(3, Math.min(20, Math.floor(u.stats.strength * 0.33 + 8 - w * 0.6)));
}

export function aimPoint(battle, t) {
  const m = battle.map;
  const unit = battle.unitAtPos(t.x, t.y, t.z);
  if (unit) return unitPoint(m, unit, 0.55);
  const o = m.objPart(t.x, t.y, t.z);
  if (o && o.height > 0) return { x: t.x + 0.5, y: t.y + 0.5, z: t.z + Math.min(0.5, o.height / 2) };
  return { x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.05 };
}

function muzzleFrom(battle, u, aim) {
  const e = eyePos(battle.map, u);
  const dx = aim.x - e.x, dy = aim.y - e.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: e.x + (dx / l) * 0.25, y: e.y + (dy / l) * 0.25, z: e.z - 0.1 };
}

// ------------------------------------------------------------------ shooting
export async function shoot(battle, u, weapon, mode, target, { reaction = false } = {}) {
  const d = itemDef(weapon.id);
  const m = d.modes?.[mode];
  if (!m) return { ok: false, reason: 'Invalid fire mode' };
  const dmg = weaponDamage(weapon);
  if (!dmg || !hasAmmo(weapon)) return { ok: false, reason: 'No ammunition' };
  if (target.x === u.x && target.y === u.y && target.z === u.z) return { ok: false, reason: 'Invalid target' };
  const cost = battle.tuCostPct(u, m.tu);
  const dir = dirTo(target.x - u.x, target.y - u.y);
  let turn = 0;
  if (dir >= 0 && dir !== u.facing) {
    turn = Math.abs(dir - u.facing);
    if (turn > 4) turn = 8 - turn;
  }
  if (u.tu < cost + turn) return { ok: false, reason: 'Not enough time units' };
  if (dir >= 0) await battle.turnUnit(u, dir);
  u.tu -= cost;
  u.shotsFired++;
  const shots = m.shots || 1;
  const acc = accuracy(battle, u, weapon, mode);
  const map = battle.map;
  for (let s = 0; s < shots; s++) {
    if (!u.active || battle.over) break;
    if (d.ammo) {
      if (!weapon.loaded || weapon.loaded.rounds <= 0) break;
      weapon.loaded.rounds--;
    }
    const aim = aimPoint(battle, target);
    const muzzle = muzzleFrom(battle, u, aim);
    const dist = Math.hypot(aim.x - muzzle.x, aim.y - muzzle.y, aim.z - muzzle.z);
    const r = battle.rng;
    let end;
    if (r.next() < acc) {
      end = { x: aim.x + r.range(-0.08, 0.08), y: aim.y + r.range(-0.08, 0.08), z: aim.z + r.range(-0.1, 0.1) };
    } else {
      const spread = 0.45 + dist * Math.max(0.05, 1.15 - Math.min(acc, 1.1)) * 0.11;
      let ox = r.range(-1, 1), oy = r.range(-1, 1), oz = r.range(-0.6, 0.6);
      const ol = Math.hypot(ox, oy, oz) || 1;
      const mag = Math.max(0.45, spread * r.range(0.4, 1));
      end = { x: aim.x + (ox / ol) * mag, y: aim.y + (oy / ol) * mag, z: aim.z + (oz / ol) * mag };
    }
    const trace = traceRay(map, muzzle, end, { mode: 'projectile', units: battle.units, ignore: u.id, extend: true, maxDist: 60 });
    await battle.view.shot(u, muzzle, trace.point, d.projectile || 'bullet', trace, dmg);
    await resolveImpact(battle, u, dmg, trace, muzzle, end);
    if (d.ammo && weapon.loaded && weapon.loaded.rounds <= 0) weapon.loaded = null;
  }
  if (u.faction === 'xcom') alertAliens(battle, u);
  battle.reportSpotted(battle.updateVisibility());
  battle.checkEnd();
  if (!reaction && u.active && !battle.over) await checkReactions(battle, u);
  return { ok: true };
}

function alertAliens(battle, u) {
  for (const a of battle.activeUnits('alien')) {
    if (Math.hypot(a.x - u.x, a.y - u.y) < 14) {
      battle.alienIntel.set(u.id, { x: u.x, y: u.y, z: u.z, turn: battle.turn });
      return;
    }
  }
}

async function resolveImpact(battle, shooter, dmg, trace, muzzle, end) {
  if (trace.hit === 'bounds' || trace.hit === 'none') return;
  const map = battle.map;
  const dx = end.x - muzzle.x, dy = end.y - muzzle.y, dz = end.z - muzzle.z;
  const l = Math.hypot(dx, dy, dz) || 1;
  const bx = trace.point.x - (dx / l) * 0.06, by = trace.point.y - (dy / l) * 0.06, bz = trace.point.z - (dz / l) * 0.06;
  let vx = Math.floor(bx), vy = Math.floor(by), vz = Math.floor(bz);
  vx = Math.max(0, Math.min(map.w - 1, vx));
  vy = Math.max(0, Math.min(map.l - 1, vy));
  vz = Math.max(0, Math.min(map.h - 1, vz));
  if (dmg.radius > 0) {
    await explode(battle, vx, vy, vz, dmg.damage, dmg.radius, dmg.dmgType, shooter);
    return;
  }
  const power = dmg.damage * battle.rng.range(0.5, 1.5);
  if (trace.hit === 'unit') {
    applyDamage(battle, trace.unit, dmg.damage, dmg.dmgType, shooter, muzzle);
  } else if (trace.hit === 'obj') {
    const destroyed = map.damageVoxel(trace.x, trace.y, trace.z, power, { floor: false });
    handleDestroyed(battle, destroyed);
  } else if (trace.hit === 'floor' && trace.z > 0) {
    const destroyed = map.damageVoxel(trace.x, trace.y, trace.z, power, { obj: false });
    handleDestroyed(battle, destroyed);
  }
  await flushPending(battle);
}

function handleDestroyed(battle, destroyed) {
  if (!destroyed.length) return;
  for (const d of destroyed) {
    if (d.part.explosive) {
      battle.pending = battle.pending || [];
      battle.pending.push({ x: d.x, y: d.y, z: d.z, ...d.part.explosive, type: d.part.explosive.fire ? 'IN' : 'HE' });
      battle.log(`The ${d.part.key === 'power_source' ? 'UFO power source' : 'fuel tank'} explodes!`, 'warn');
    }
    if (d.kind === 'floor') {
      // units and items above fall
      for (const u of battle.unitList()) {
        if (u.x === d.x && u.y === d.y && u.z === d.z) battle.checkFall(u);
      }
      const items = battle.map.groundItems(d.x, d.y, d.z).slice();
      for (const it of items) {
        battle.map.removeItem(d.x, d.y, d.z, it);
        battle.map.addItem(d.x, d.y, d.z, it);
      }
    }
  }
  battle.view.terrainChanged();
}

export async function flushPending(battle) {
  while (battle.pending && battle.pending.length && !battle.over) {
    const e = battle.pending.shift();
    await explode(battle, e.x, e.y, e.z, e.damage, e.radius, e.type || 'HE', null);
  }
}

// ------------------------------------------------------------------ melee
export async function melee(battle, u, weapon, target) {
  const d = itemDef(weapon.id);
  if (!target || !target.active && target.status !== 'unconscious') return { ok: false, reason: 'No target' };
  if (Math.max(Math.abs(target.x - u.x), Math.abs(target.y - u.y)) > 1 || Math.abs(target.z - u.z) > 0) {
    return { ok: false, reason: 'Target out of reach' };
  }
  const cost = battle.tuCostPct(u, d.tu);
  if (u.tu < cost) return { ok: false, reason: 'Not enough time units' };
  await battle.turnUnit(u, dirTo(target.x - u.x, target.y - u.y), { free: true });
  u.tu -= cost;
  await battle.view.melee(u, target, weapon);
  const acc = accuracy(battle, u, weapon, 'melee');
  if (battle.rng.next() < acc) {
    const wasHuman = target.species === 'human';
    const from = { x: u.x + 0.5, y: u.y + 0.5, z: u.z + 0.5 };
    applyDamage(battle, target, d.damage, d.dmgType, u, from, { zombify: d.zombify && wasHuman });
  } else {
    battle.log(`${u.name} misses!`);
  }
  await flushPending(battle);
  battle.reportSpotted(battle.updateVisibility());
  battle.checkEnd();
  return { ok: true };
}

// ------------------------------------------------------------------ throwing
export async function throwItem(battle, u, item, target) {
  const map = battle.map;
  const d = itemDef(item.id);
  const range = throwRange(u, item);
  const dist = Math.hypot(target.x - u.x, target.y - u.y);
  if (dist > range) return { ok: false, reason: 'Out of range' };
  const cost = battle.tuCostPct(u, 25);
  if (u.tu < cost + 2) return { ok: false, reason: 'Not enough time units' };
  await battle.faceTowards(u, target.x, target.y);
  u.tu -= cost;
  if (u.entryOf(item)) u.removeItem(item);
  else map.removeItem(u.x, u.y, u.z, item);
  item.owner = u.id;

  const r = battle.rng;
  let tx = target.x, ty = target.y, tz = target.z;
  const acc = u.stats.throwing / 100;
  if (r.next() > acc) {
    const k = Math.max(1, Math.round(dist * 0.12));
    tx = Math.max(0, Math.min(map.w - 1, tx + r.int(-k, k)));
    ty = Math.max(0, Math.min(map.l - 1, ty + r.int(-k, k)));
  }
  const start = eyePos(map, u);
  const endP = { x: tx + 0.5, y: ty + 0.5, z: tz + 0.1 };
  const peak = Math.max(start.z, endP.z) + 0.6 + Math.hypot(tx - u.x, ty - u.y) * 0.08;
  const pts = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const zLin = start.z + (endP.z - start.z) * t;
    const arc = 4 * t * (1 - t) * (peak - Math.max(start.z, endP.z));
    pts.push({ x: start.x + (endP.x - start.x) * t, y: start.y + (endP.y - start.y) * t, z: zLin + arc });
  }
  let land = { x: tx, y: ty, z: tz };
  const path = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const res = traceRay(map, pts[i - 1], pts[i], { mode: 'projectile' });
    if (res.hit !== 'none') {
      const p = res.point;
      const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y, dz = pts[i].z - pts[i - 1].z;
      const l = Math.hypot(dx, dy, dz) || 1;
      const bp = { x: p.x - (dx / l) * 0.1, y: p.y - (dy / l) * 0.1, z: p.z - (dz / l) * 0.1 };
      land = {
        x: Math.max(0, Math.min(map.w - 1, Math.floor(bp.x))),
        y: Math.max(0, Math.min(map.l - 1, Math.floor(bp.y))),
        z: Math.max(0, Math.min(map.h - 1, Math.floor(bp.z))),
      };
      path.push(bp);
      break;
    }
    path.push(pts[i]);
  }
  // blocked voxel? drop back toward thrower
  if (!map.isPassable(land.x, land.y, land.z, true)) {
    land = { x: u.x, y: u.y, z: u.z };
  }
  await battle.view.thrown(u, path, item);
  const z = map.addItem(land.x, land.y, land.z, item);
  battle.view.terrainChanged();
  if (d.kind === 'flare') {
    map.removeItem(land.x, land.y, z, item);
    battle.flares.push({ x: land.x, y: land.y, z, turns: 4 });
    battle.invalidateLight();
  }
  battle.reportSpotted(battle.updateVisibility());
  if (u.faction === 'xcom') alertAliens(battle, u);
  await checkReactions(battle, u);
  return { ok: true, land: { ...land, z } };
}

// ------------------------------------------------------------------ damage
export function applyDamage(battle, u, power, type, attacker, from, opts = {}) {
  if (u.status === 'dead') return 0;
  const r = battle.rng;
  const roll = opts.noRoll ? power : power * r.range(0.5, 1.5);
  let side = 'under';
  if (from && from !== 'under') {
    const dir = dirTo(from.x - (u.x + 0.5), from.y - (u.y + 0.5));
    if (dir >= 0) {
      const rel = (dir - u.facing + 8) % 8;
      side = rel === 0 || rel === 1 || rel === 7 ? 'front' : rel >= 3 && rel <= 5 ? 'rear' : 'side';
    }
  }
  if (type === 'SMOKE') return 0;
  const armor = u.armor[side];
  if (type === 'STUN') {
    const dmg = Math.max(0, Math.round(roll - armor * 0.5));
    u.stun += dmg;
    battle.view.unitHit(u, dmg, 'STUN');
    if (u.active && u.stun >= u.health) knockOut(battle, u);
    return dmg;
  }
  if (type === 'IN' && u.species !== 'silacoid') u.burning = Math.max(u.burning, r.int(1, 3));
  const pen = roll - armor;
  if (!opts.noRoll) u.armor[side] = Math.max(0, armor - Math.ceil(roll / 10));
  if (pen <= 0) {
    battle.view.unitHit(u, 0, type);
    return 0;
  }
  const dmg = Math.round(pen);
  u.health -= dmg;
  u.hitsTaken++;
  if (dmg >= 10 && !u.isTerror && u.species !== 'zombie') u.wounds += r.int(0, Math.floor(dmg / 10));
  if (u.faction === 'xcom' || !u.isTerror) u.morale = Math.max(0, u.morale - Math.round(dmg / 2));
  if (u.active && type !== 'IN') u.stun += Math.round(dmg / 5);
  battle.view.unitHit(u, dmg, type);
  if (u.health <= 0) kill(battle, u, attacker, opts.zombify ? 'zombify' : type);
  else if (u.active && u.stun >= u.health) knockOut(battle, u);
  return dmg;
}

function dropAll(battle, u) {
  for (const e of u.inventory) {
    battle.map.addItem(u.x, u.y, u.z, e.item);
  }
  u.inventory = [];
}

export function kill(battle, u, attacker, cause) {
  if (u.status === 'dead') return;
  const map = battle.map;
  const i = map.idx(u.x, u.y, u.z);
  if (map.unitAt[i] === u.id) map.unitAt[i] = -1;
  u.status = 'dead';
  u.kneeling = false;
  dropAll(battle, u);
  if (attacker && attacker.faction !== u.faction) attacker.kills++;

  const sp = SPECIES[u.species];
  const zombified = cause === 'zombify';
  const leavesCorpse = !zombified && !u.explodeOnDeath && !u.hatchOnDeath;
  if (leavesCorpse) {
    map.addItem(u.x, u.y, u.z, makeItem('corpse', { corpseOf: u.species === 'human' ? 'X-COM' : sp.name, color: u.color }));
  }
  if (u.faction === 'alien') {
    battle.stats.aliensKilled++;
    battle.log(`${u.name} killed${attacker ? ' by ' + attacker.name : ''}.`, 'good');
  } else {
    battle.stats.soldiersKilled++;
    battle.log(`${u.name} has been killed.`, 'bad');
  }
  battle.view.unitDown(u, 'dead');

  // morale
  const loss = Math.max(3, Math.round((110 - (u.stats.bravery || 50)) / 5)) * (u.rank === 'leader' || u.rank === 'commander' ? 2 : 1);
  for (const a of battle.activeUnits(u.faction)) {
    if (a.isTerror) continue;
    const allyLoss = Math.round(((110 - a.stats.bravery) / 100) * loss * 1.5);
    a.morale = Math.max(0, a.morale - allyLoss);
  }
  for (const e of battle.activeUnits(battle.enemyOf(u.faction))) e.morale = Math.min(100, e.morale + 5);

  if (u.explodeOnDeath) {
    battle.pending = battle.pending || [];
    battle.pending.push({ x: u.x, y: u.y, z: u.z, damage: u.explodeOnDeath.damage, radius: u.explodeOnDeath.radius, type: 'HE' });
    u.removed = true;
    battle.log(`The ${u.name} explodes!`, 'warn');
  }
  if (zombified) {
    u.removed = true;
    const z = battle.spawnAlien('zombie', u.x, u.y, u.z);
    battle.log(`${u.name} has been turned into a Zombie!`, 'bad');
    battle.updateVisibility();
    return z;
  }
  if (u.hatchOnDeath) {
    u.removed = true;
    battle.spawnAlien(u.hatchOnDeath, u.x, u.y, u.z);
    battle.log('A Chryssalid bursts out of the Zombie!', 'bad');
  }
  battle.checkEnd();
}

export function knockOut(battle, u) {
  if (!u.active) return;
  const map = battle.map;
  const i = map.idx(u.x, u.y, u.z);
  if (map.unitAt[i] === u.id) map.unitAt[i] = -1;
  u.status = 'unconscious';
  u.kneeling = false;
  dropAll(battle, u);
  battle.log(`${u.name} has been knocked unconscious.`, u.faction === 'alien' ? 'good' : 'bad');
  battle.view.unitDown(u, 'unconscious');
  // falling to ground if flying
  if (u.z > 0 && !map.hasStandingFloor(u.x, u.y, u.z)) {
    while (u.z > 0 && !map.hasStandingFloor(u.x, u.y, u.z)) u.z--;
  }
  battle.checkEnd();
}

export function panic(battle, u) {
  const r = battle.rng.next();
  if (r < 0.5) {
    u.panic = 'panicked';
    for (const slot of ['rhand', 'lhand']) {
      const it = u.hand(slot);
      if (it) {
        u.removeItem(it);
        battle.map.addItem(u.x, u.y, u.z, it);
      }
    }
    battle.log(`${u.name} has panicked!`, u.faction === 'xcom' ? 'bad' : 'good');
  } else {
    u.panic = 'frozen';
    battle.log(`${u.name} is frozen with fear!`, u.faction === 'xcom' ? 'bad' : 'good');
  }
  u.tu = 0;
  u.morale = Math.min(100, u.morale + 20);
  battle.view.terrainChanged();
}

// ------------------------------------------------------------------ explosions
export async function explode(battle, cx, cy, cz, power, radius, type, attacker) {
  const map = battle.map;
  const r = battle.rng;
  await battle.view.explosion({ x: cx + 0.5, y: cy + 0.5, z: cz + 0.3 }, radius, type);
  const seen = new Map(); // idx -> power
  const queue = [[cx, cy, cz]];
  seen.set(map.idx(cx, cy, cz), power);
  const destroyed = [];
  const nbrs = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0], [0, 0, 1], [0, 0, -1],
  ];
  while (queue.length) {
    const [x, y, z] = queue.shift();
    const i = map.idx(x, y, z);
    const p = seen.get(i);
    for (const [dx, dy, dz] of nbrs) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (!map.inBounds(nx, ny, nz)) continue;
      const ni = map.idx(nx, ny, nz);
      if (seen.has(ni)) continue;
      const dist = Math.hypot(nx - cx, ny - cy, (nz - cz) * 1.2);
      if (dist > radius + 0.5) continue;
      const lp = power * (1 - dist / (radius + 1));
      if (lp <= 1) continue;
      // floors block vertical spread
      if (dz !== 0) {
        const fz = dz > 0 ? nz : z;
        const fi = map.idx(nx, ny, fz);
        const f = PARTS[map.floor[fi]];
        if (f && !f.passage) {
          if (type === 'HE' && fz > 0) destroyed.push(...map.damageVoxel(nx, ny, fz, lp, { obj: false }));
          if (map.floor[fi] && !PARTS[map.floor[fi]].passage) continue;
        }
      }
      // diagonal: blocked if both orthogonal neighbours are solid
      if (dx && dy) {
        const o1 = map.objPart(x + dx, y, z), o2 = map.objPart(x, y + dy, z);
        if (o1 && o1.height >= 1 && o2 && o2.height >= 1) continue;
      }
      seen.set(ni, lp);
      const o = map.objPart(nx, ny, nz);
      if (o && o.height >= 0.9 && !o.seeThrough) {
        if (type === 'HE' || type === 'IN') {
          const d = map.damageVoxel(nx, ny, nz, type === 'IN' ? lp * 0.5 : lp, { floor: false });
          destroyed.push(...d);
          if (!d.length) continue; // wall held: stop propagation
        } else if (type !== 'SMOKE') {
          continue;
        }
      }
      queue.push([nx, ny, nz]);
    }
  }
  // center voxel terrain
  if (type === 'HE') destroyed.push(...map.damageVoxel(cx, cy, cz, power, { floor: cz > 0 ? false : true }));

  const hitUnits = new Set();
  for (const [i, lp] of seen) {
    const { x, y, z } = map.pos(i);
    if (type === 'HE' && (x !== cx || y !== cy || z !== cz)) {
      const o = map.objPart(x, y, z);
      if (o && o.height < 0.9) destroyed.push(...map.damageVoxel(x, y, z, lp, { floor: false }));
      else if (z === 0) map.damageVoxel(x, y, z, lp, { obj: false });
    }
    if (type === 'IN') {
      const o = map.objPart(x, y, z);
      const f = map.floorPart(x, y, z);
      if ((o && o.flammable) || (f && (f.flammableFloor || f.flammable))) map.fire[i] = Math.max(map.fire[i], r.int(2, 4));
      else if (map.hasStandingFloor(x, y, z) && r.chance(0.5)) map.fire[i] = Math.max(map.fire[i], 1);
      map.smoke[i] = Math.max(map.smoke[i], 4);
    }
    if (type === 'SMOKE') {
      map.smoke[i] = Math.min(20, Math.max(map.smoke[i], Math.round(8 + (lp / power) * 8)));
    }
    if (type === 'HE' && lp > power * 0.3) map.smoke[i] = Math.max(map.smoke[i], 3);
    for (const u of battle.unitList()) {
      if (u.status === 'dead' || u.removed || hitUnits.has(u)) continue;
      if (u.x === x && u.y === y && u.z === z) {
        hitUnits.add(u);
        if (type === 'SMOKE') continue;
        const dmgType = type === 'STUN' ? 'STUN' : type === 'IN' ? 'IN' : 'HE';
        applyDamage(battle, u, lp, dmgType, attacker, 'under');
      }
    }
    // explosions destroy loose items (not corpses of aliens: keep artifacts intact)
    if (type === 'HE' && lp > 40) {
      const items = map.groundItems(x, y, z);
      for (const it of items.slice()) {
        if (itemDef(it.id).kind === 'grenade' && !it.primed && r.chance(0.3)) map.removeItem(x, y, z, it);
      }
    }
  }
  handleDestroyed(battle, destroyed);
  battle.invalidateLight();
  battle.view.terrainChanged();
  await flushPending(battle);
  battle.reportSpotted(battle.updateVisibility());
  battle.checkEnd();
}

// ------------------------------------------------------------------ fire & smoke
export function fireTick(battle) {
  const map = battle.map;
  const r = battle.rng;
  const n = map.fire.length;
  const newFire = [];
  for (let i = 0; i < n; i++) {
    if (!map.fire[i]) continue;
    const { x, y, z } = map.pos(i);
    map.fire[i]--;
    map.smoke[i] = Math.max(map.smoke[i], 6);
    if (z + 1 < map.h) map.smoke[i + map.w * map.l] = Math.max(map.smoke[i + map.w * map.l], 4);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!map.inBounds(nx, ny, z)) continue;
      const ni = map.idx(nx, ny, z);
      if (map.fire[ni]) continue;
      const o = map.objPart(nx, ny, z);
      const f = map.floorPart(nx, ny, z);
      if (o && o.flammable && r.chance(0.12 * o.flammable)) newFire.push([ni, o.flammable]);
      else if (f && f.flammableFloor && r.chance(0.08)) newFire.push([ni, 1]);
    }
    if (!map.fire[i]) {
      const o = map.objPart(x, y, z);
      if (o && o.flammable) map.setObj(x, y, z, o.destroyTo || null);
      const f = map.floorPart(x, y, z);
      if (z === 0 && f && f.flammableFloor) map.setFloor(x, y, z, 'scorched');
      else if (z > 0 && f && f.flammable && r.chance(0.5)) {
        map.setFloor(x, y, z, null);
        for (const u of battle.unitList()) if (u.x === x && u.y === y && u.z === z) battle.checkFall(u);
      }
    }
  }
  for (const [i, v] of newFire) map.fire[i] = Math.max(map.fire[i], v);
  // smoke drift & decay
  const next = new Uint8Array(map.smoke);
  for (let i = 0; i < n; i++) {
    const s = map.smoke[i];
    if (!s) continue;
    next[i] = Math.max(0, s - r.int(1, 3));
    if (s >= 8) {
      const { x, y, z } = map.pos(i);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!map.inBounds(x + dx, y + dy, z) || !r.chance(0.3)) continue;
        const o = map.objPart(x + dx, y + dy, z);
        if (o && o.height >= 1 && !o.seeThrough) continue;
        const ni = map.idx(x + dx, y + dy, z);
        next[ni] = Math.max(next[ni], s - 5);
      }
    }
  }
  map.smoke.set(next);
  battle.view.terrainChanged();
}

// ------------------------------------------------------------------ reaction fire
function reactionOption(battle, e, target) {
  const w = unitWeapon(e);
  if (!w) return null;
  const d = itemDef(w.id);
  if (d.kind === 'melee') {
    const adj = Math.max(Math.abs(target.x - e.x), Math.abs(target.y - e.y)) <= 1 && target.z === e.z;
    if (!adj) return null;
    const c = battle.tuCostPct(e, d.tu);
    return e.tu >= c ? { type: 'melee', weapon: w } : null;
  }
  if (d.kind !== 'weapon' || !hasAmmo(w)) return null;
  for (const mode of ['snap', 'auto', 'aimed']) {
    if (!d.modes[mode]) continue;
    const c = battle.tuCostPct(e, d.modes[mode].tu);
    if (e.tu >= c + 2) return { type: 'shoot', weapon: w, mode };
    break;
  }
  return null;
}

export async function checkReactions(battle, mover) {
  for (let iter = 0; iter < 8; iter++) {
    if (!mover.active || battle.over) return;
    const moverScore = (mover.stats.reactions * mover.tu) / mover.stats.tu;
    let best = null, bestScore = moverScore, bestOpt = null;
    for (const e of battle.activeUnits(battle.enemyOf(mover.faction))) {
      if (e.panic || !e.visible.has(mover.id)) continue;
      const score = (e.stats.reactions * e.tu) / e.stats.tu;
      if (score <= bestScore) continue;
      const opt = reactionOption(battle, e, mover);
      if (!opt) continue;
      best = e;
      bestScore = score;
      bestOpt = opt;
    }
    if (!best) return;
    battle.log(`${best.name} reacts!`, best.faction === 'xcom' ? 'info' : 'warn');
    if (battle.view.reactionFire) await battle.view.reactionFire(best, mover);
    const target = { x: mover.x, y: mover.y, z: mover.z };
    if (bestOpt.type === 'melee') await melee(battle, best, bestOpt.weapon, mover);
    else await shoot(battle, best, bestOpt.weapon, bestOpt.mode, target, { reaction: true });
  }
}
