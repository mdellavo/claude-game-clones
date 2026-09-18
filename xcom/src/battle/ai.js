import { itemDef } from '../data/items.js';
import { computeReach } from './pathfinding.js';
import { traceRay, unitPoint } from './los.js';
import * as combat from './combat.js';

export async function runAlienTurn(battle) {
  const aliens = battle.activeUnits('alien');
  // units that currently see enemies act first
  aliens.sort((a, b) => b.visible.size - a.visible.size);
  for (const a of aliens) {
    if (battle.over) return;
    if (!a.active || a.panic) continue;
    try {
      await actUnit(battle, a);
    } catch (err) {
      console.error('AI error', err);
    }
  }
}

async function actUnit(battle, a) {
  let failSafe = 0;
  let lastTu = -1;
  while (a.active && !battle.over && failSafe++ < 8) {
    if (a.tu === lastTu) break;
    lastTu = a.tu;
    const cont = await decide(battle, a);
    if (!cont) break;
  }
}

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 1.5);

function knownEnemies(battle, a) {
  const out = [];
  for (const id of a.visible) {
    const t = battle.units.get(id);
    if (t && t.active) out.push({ unit: t, x: t.x, y: t.y, z: t.z, seen: true });
  }
  for (const [id, info] of battle.alienIntel) {
    if (a.visible.has(id)) continue;
    const t = battle.units.get(id);
    if (!t || !t.active) continue;
    if (battle.turn - info.turn > 3) continue;
    out.push({ unit: t, x: info.x, y: info.y, z: info.z, seen: false });
  }
  return out;
}

async function move(battle, a, reach, x, y, z, maxCost = a.tu) {
  let path = reach.path(x, y, z);
  if (!path) return false;
  path = path.filter((p) => p.cost <= maxCost);
  if (!path.length) return false;
  a.ai.stopOnSpot = a.visible.size === 0;
  if (battle.view.alienTurnFocus) await battle.view.alienTurnFocus(a);
  const res = await battle.move(a, path);
  return res.ok;
}

function canSeeFrom(battle, a, x, y, z, target) {
  const map = battle.map;
  const eye = { x: x + 0.5, y: y + 0.5, z: z + a.eyeHeight() };
  const tp = target.unit && target.seen !== false
    ? unitPoint(map, target.unit, 0.6)
    : { x: target.x + 0.5, y: target.y + 0.5, z: target.z + 0.6 };
  const d = Math.hypot(tp.x - eye.x, tp.y - eye.y);
  if (d > 18) return false;
  const r = traceRay(map, eye, tp, { mode: 'vision' });
  return r.hit === 'none';
}

async function decide(battle, a) {
  const weapon = combat.unitWeapon(a);
  if (!weapon) return patrol(battle, a);
  const wd = itemDef(weapon.id);
  const enemies = knownEnemies(battle, a);

  // reload empty weapon
  if (wd.kind === 'weapon' && wd.ammo && !combat.hasAmmo(weapon)) {
    const res = battle.reload(a, weapon);
    return res.ok;
  }

  if (wd.kind === 'melee') return meleeBrain(battle, a, weapon, enemies);

  const seen = enemies.filter((e) => e.seen);
  if (seen.length) {
    // grenade?
    if (await tryGrenade(battle, a, seen)) return true;
    // choose target
    let best = null;
    for (const e of seen) {
      const d = dist(a, e);
      const score = 30 / (d + 2) + (1 - e.unit.health / e.unit.stats.health) * 3 + (e.unit.kneeling ? -0.5 : 0) + battle.rng.next();
      if (!best || score > best.score) best = { e, d, score };
    }
    const d = best.d;
    const modes = [];
    const cost = (m) => (wd.modes[m] ? combat.modeCost(battle, a, weapon, m) : Infinity);
    if (d <= 6 && wd.modes.auto) modes.push('auto');
    if (d > 7 && wd.modes.aimed) modes.push('aimed');
    if (wd.modes.snap) modes.push('snap');
    if (wd.modes.aimed) modes.push('aimed');
    if (wd.modes.auto) modes.push('auto');
    const mode = modes.find((m) => a.tu >= cost(m) + 4);
    if (mode) {
      if (battle.view.alienTurnFocus) await battle.view.alienTurnFocus(a, best.e.unit);
      const res = await combat.shoot(battle, a, weapon, mode, { x: best.e.x, y: best.e.y, z: best.e.z });
      return res.ok;
    }
    // can't shoot any more: duck out of sight
    await takeCover(battle, a, seen);
    return false;
  }

  if (enemies.length) {
    const nearest = enemies.reduce((m, e) => (!m || dist(a, e) < dist(a, m) ? e : m), null);
    if (a.ai.mode === 'guard' && dist(a, nearest) > 12 && battle.rng.chance(0.7)) {
      await battle.faceTowards(a, nearest.x, nearest.y);
      return false;
    }
    const reach = computeReach(battle.map, a, a.tu);
    const snap = wd.modes.snap ? combat.modeCost(battle, a, weapon, 'snap') : combat.modeCost(battle, a, weapon, 'aimed');
    // look for a firing position
    let bestPos = null;
    const r = 10;
    for (let z = 0; z < battle.map.h; z++)
      for (let y = a.y - r; y <= a.y + r; y++)
        for (let x = a.x - r; x <= a.x + r; x++) {
          const c = reach.cost(x, y, z);
          if (c === Infinity || c > a.tu - snap - 2 || c === 0) continue;
          if (!battle.map.supports(x, y, z) && !a.isFlying) continue;
          if (!canSeeFrom(battle, a, x, y, z, nearest)) continue;
          const score = c + dist({ x, y, z }, nearest) * 0.5 + battle.rng.next() * 4;
          if (!bestPos || score < bestPos.score) bestPos = { x, y, z, score };
        }
    if (bestPos) {
      await move(battle, a, reach, bestPos.x, bestPos.y, bestPos.z);
      if (a.active && !a.visible.size) await battle.faceTowards(a, nearest.x, nearest.y);
      return true;
    }
    // advance toward the enemy keeping some TUs for reaction fire
    await approach(battle, a, reach, nearest, Math.floor(a.tu * 0.65));
    if (a.active) await battle.faceTowards(a, nearest.x, nearest.y);
    return a.visible.size > 0;
  }
  return patrol(battle, a);
}

async function approach(battle, a, reach, target, budget) {
  let best = null;
  const r = 14;
  for (let z = 0; z < battle.map.h; z++)
    for (let y = a.y - r; y <= a.y + r; y++)
      for (let x = a.x - r; x <= a.x + r; x++) {
        const c = reach.cost(x, y, z);
        if (c === Infinity || c > budget) continue;
        if (!battle.map.supports(x, y, z) && !a.isFlying) continue;
        const d = dist({ x, y, z }, target) + battle.rng.next() * 1.5;
        if (!best || d < best.d) best = { x, y, z, d };
      }
  if (best && (best.x !== a.x || best.y !== a.y || best.z !== a.z)) {
    return move(battle, a, reach, best.x, best.y, best.z, budget);
  }
  return false;
}

async function meleeBrain(battle, a, weapon, enemies) {
  if (!enemies.length) return patrol(battle, a);
  const wd = itemDef(weapon.id);
  const cost = battle.tuCostPct(a, wd.tu);
  const target = enemies.reduce((m, e) => (!m || dist(a, e) < dist(a, m) ? e : m), null);
  if (target.seen && cheb(a, target) <= 1 && a.z === target.z) {
    if (a.tu < cost) return false;
    if (battle.view.alienTurnFocus) await battle.view.alienTurnFocus(a, target.unit);
    const res = await combat.melee(battle, a, weapon, target.unit);
    return res.ok;
  }
  const reach = computeReach(battle.map, a, a.tu);
  let best = null;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const c = reach.cost(target.x + dx, target.y + dy, target.z);
      if (c === Infinity) continue;
      if (!best || c < best.c) best = { x: target.x + dx, y: target.y + dy, z: target.z, c };
    }
  if (best && best.c <= a.tu - cost) {
    await move(battle, a, reach, best.x, best.y, best.z);
    return true;
  }
  await approach(battle, a, reach, target, a.tu);
  return a.tu >= cost && enemies.some((e) => cheb(a, e) <= 1);
}

async function tryGrenade(battle, a, seen) {
  const entry = a.inventory.find((e) => itemDef(e.item.id).kind === 'grenade');
  if (!entry) return false;
  const primeCost = entry.item.primed ? 0 : battle.tuCostPct(a, 50);
  const throwCost = battle.tuCostPct(a, 25);
  if (a.tu < primeCost + throwCost + 4) return false;
  const d = itemDef(entry.item.id);
  const range = combat.throwRange(a, entry.item);
  let best = null;
  for (const e of seen) {
    const dd = Math.hypot(e.x - a.x, e.y - a.y);
    if (dd > range || dd < d.radius + 1.5) continue;
    let count = 0;
    for (const o of battle.activeUnits('xcom')) if (Math.hypot(o.x - e.x, o.y - e.y) <= d.radius - 0.5) count++;
    let friendly = false;
    for (const o of battle.activeUnits('alien')) if (Math.hypot(o.x - e.x, o.y - e.y) <= d.radius + 1) friendly = true;
    if (friendly) continue;
    if (count >= 2 || (count === 1 && battle.rng.chance(0.15))) {
      if (!best || count > best.count) best = { e, count };
    }
  }
  if (!best) return false;
  if (!entry.item.primed) battle.prime(a, entry.item);
  if (battle.view.alienTurnFocus) await battle.view.alienTurnFocus(a, best.e.unit);
  const res = await combat.throwItem(battle, a, entry.item, { x: best.e.x, y: best.e.y, z: best.e.z });
  return res.ok;
}

async function takeCover(battle, a, seen) {
  if (a.tu < 6) return;
  const reach = computeReach(battle.map, a, a.tu);
  let best = null;
  const r = 6;
  for (let y = a.y - r; y <= a.y + r; y++)
    for (let x = a.x - r; x <= a.x + r; x++) {
      const z = a.z;
      const c = reach.cost(x, y, z);
      if (c === Infinity || c === 0) continue;
      if (!battle.map.supports(x, y, z) && !a.isFlying) continue;
      let exposed = 0;
      for (const e of seen) {
        const eye = { x: e.unit.x + 0.5, y: e.unit.y + 0.5, z: e.unit.z + e.unit.eyeHeight() };
        const res = traceRay(battle.map, eye, { x: x + 0.5, y: y + 0.5, z: z + a.height * 0.5 }, { mode: 'vision' });
        if (res.hit === 'none') exposed++;
      }
      const score = exposed * 20 + c;
      if (!best || score < best.score) best = { x, y, z, score };
    }
  if (best && best.score < 20) await move(battle, a, reach, best.x, best.y, best.z);
}

async function patrol(battle, a) {
  const r = battle.rng;
  if (a.ai.mode === 'guard') {
    if (r.chance(0.4)) {
      const reach = computeReach(battle.map, a, Math.floor(a.tu * 0.4));
      const opts = [];
      for (let y = a.y - 3; y <= a.y + 3; y++)
        for (let x = a.x - 3; x <= a.x + 3; x++)
          if (reach.cost(x, y, a.z) < Infinity && battle.map.isUfoTile(x, y, a.z)) opts.push({ x, y, z: a.z });
      if (opts.length) {
        const o = r.pick(opts);
        await move(battle, a, reach, o.x, o.y, o.z);
      }
    }
    if (a.active) await battle.turnUnit(a, r.int(0, 7));
    return false;
  }
  const budget = Math.floor(a.tu * 0.5);
  const reach = computeReach(battle.map, a, budget);
  const home = a.ai.home;
  const opts = [];
  for (let y = a.y - 8; y <= a.y + 8; y++)
    for (let x = a.x - 8; x <= a.x + 8; x++) {
      const c = reach.cost(x, y, a.z);
      if (c === Infinity || c === 0) continue;
      if (Math.hypot(x - home.x, y - home.y) > 10) continue;
      opts.push({ x, y, z: a.z });
    }
  if (opts.length && r.chance(0.75)) {
    const o = r.pick(opts);
    await move(battle, a, reach, o.x, o.y, o.z);
  }
  return false;
}
