import { generateMission } from './mapgen.js';
import { Battle } from './battle.js';
import { makeSoldierUnit, makeAlienUnit } from './unit.js';
import { makeItem, makeWeapon, itemDef } from '../data/items.js';
import { alienLoadout, DIFFICULTY } from '../data/units.js';

export const TIERS = {
  conventional: { name: 'Conventional', armor: 'none' },
  laser: { name: 'Laser weapons + Personal Armour', armor: 'personal' },
  plasma: { name: 'Plasma weapons + Power Suits', armor: 'power' },
};

// Equipment available in the Skyranger stores for a tier.
export function storesFor(tier) {
  const base = ['grenade', 'smoke_grenade', 'high_explosive', 'medikit', 'stun_rod', 'flare', 'pistol', 'pistol_clip',
    'rifle', 'rifle_clip', 'heavy_cannon', 'hc_ap', 'hc_he', 'hc_in', 'auto_cannon', 'ac_ap', 'ac_he', 'ac_in',
    'rocket_launcher', 'small_rocket', 'large_rocket', 'inc_rocket'];
  if (tier === 'laser' || tier === 'plasma') base.push('laser_pistol', 'laser_rifle', 'heavy_laser', 'small_launcher', 'stun_bomb');
  if (tier === 'plasma') base.push('plasma_pistol', 'plasma_pistol_clip', 'plasma_rifle', 'plasma_rifle_clip', 'heavy_plasma', 'heavy_plasma_clip', 'alien_grenade');
  return base;
}

// Default kit by squad position.
export function defaultLoadout(tier, index) {
  const primary = tier === 'plasma' ? ['plasma_rifle', 'plasma_rifle_clip'] : tier === 'laser' ? ['laser_rifle', null] : ['rifle', 'rifle_clip'];
  const L = [];
  const role = index % 8;
  if (role === 2) {
    L.push({ id: tier === 'conventional' ? 'heavy_cannon' : tier === 'laser' ? 'heavy_laser' : 'heavy_plasma', ammo: tier === 'conventional' ? 'hc_he' : tier === 'plasma' ? 'heavy_plasma_clip' : null, slot: 'rhand' });
    if (tier === 'conventional') L.push({ id: 'hc_ap', slot: 'belt', x: 0, y: 0 }, { id: 'hc_he', slot: 'backpack', x: 0, y: 0 });
    if (tier === 'plasma') L.push({ id: 'heavy_plasma_clip', slot: 'belt', x: 0, y: 0 });
  } else if (role === 5) {
    L.push({ id: 'rocket_launcher', ammo: 'small_rocket', slot: 'rhand' });
    L.push({ id: 'small_rocket', slot: 'backpack', x: 0, y: 0 }, { id: 'large_rocket', slot: 'backpack', x: 1, y: 0 });
  } else if (role === 6 && tier === 'conventional') {
    L.push({ id: 'auto_cannon', ammo: 'ac_ap', slot: 'rhand' });
    L.push({ id: 'ac_he', slot: 'belt', x: 0, y: 0 }, { id: 'ac_ap', slot: 'belt', x: 1, y: 0 });
  } else {
    L.push({ id: primary[0], ammo: primary[1], slot: 'rhand' });
    if (primary[1]) L.push({ id: primary[1], slot: 'belt', x: 0, y: 0 }, { id: primary[1], slot: 'belt', x: 1, y: 0 });
  }
  L.push({ id: 'grenade', slot: 'belt', x: 2, y: 0 });
  if (role === 1 || role === 4) L.push({ id: 'smoke_grenade', slot: 'belt', x: 3, y: 0 });
  if (role === 3) L.push({ id: 'medikit', slot: 'rleg', x: 0, y: 0 });
  if (role === 0 || role === 7) L.push({ id: 'stun_rod', slot: 'lhand' });
  if (role === 4 || role === 1) L.push({ id: 'flare', slot: 'lshoulder', x: 0, y: 0 });
  return L;
}

export function createBattle({ opts, soldiers, rng, view }) {
  const difficulty = DIFFICULTY[opts.difficulty ?? 2];
  const gen = generateMission(opts, rng);
  const battle = new Battle({ map: gen.map, rng, mission: { ...opts, ufo: gen.ufo }, view, difficulty });

  const spawns = gen.craftSpawns.slice();
  soldiers.forEach((s, i) => {
    const u = makeSoldierUnit(s);
    const sp = spawns[i % spawns.length];
    u.x = sp.x;
    u.y = sp.y;
    u.z = sp.z;
    u.facing = gen.craftSpawns.facing ?? 4;
    for (const e of s.loadout || defaultLoadout(opts.tier || 'conventional', i)) {
      const d = itemDef(e.id);
      const it = d.kind === 'weapon' ? makeWeapon(e.id, e.ammo || undefined) : makeItem(e.id);
      if (d.kind === 'weapon' && d.ammo && e.ammo === null) it.loaded = null;
      if (u.canPlace(it, e.slot, e.x || 0, e.y || 0)) u.place(it, e.slot, e.x || 0, e.y || 0);
      else if (!u.autoPlace(it)) battle.map.addItem(u.x, u.y, u.z, it);
    }
    battle.addUnit(u);
  });

  for (const a of gen.aliens) {
    const u = makeAlienUnit(a.species, a.rank, difficulty);
    u.x = a.x;
    u.y = a.y;
    u.z = a.z;
    u.facing = rng.int(0, 7);
    u.ai.mode = a.guard ? 'guard' : 'patrol';
    u.ai.home = { x: a.x, y: a.y, z: a.z };
    for (const e of alienLoadout(a.species, a.rank, rng)) {
      if (!u.autoPlace(e.item, [e.slot, 'belt', 'backpack'])) battle.map.addItem(u.x, u.y, u.z, e.item);
    }
    battle.addUnit(u);
  }
  return battle;
}
