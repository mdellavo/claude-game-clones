// Item definitions, loosely following the values of the 1994 original.
// Fire mode tu values are percentages of the unit's maximum TUs.

export const DMG = {
  AP: 'AP',
  HE: 'HE',
  IN: 'IN',
  LASER: 'LASER',
  PLASMA: 'PLASMA',
  STUN: 'STUN',
  MELEE: 'MELEE',
  SMOKE: 'SMOKE',
  ACID: 'ACID',
};

const I = {};
function def(id, props) {
  I[id] = { id, w: 1, h: 1, weight: 3, ...props };
}

// ---------------------------------------------------------------- conventional
def('pistol', {
  name: 'Pistol', kind: 'weapon', w: 1, h: 1, weight: 5, ammo: ['pistol_clip'],
  modes: { snap: { tu: 18, acc: 60 }, aimed: { tu: 30, acc: 78 } },
  color: '#8a8f99', shape: 'pistol', projectile: 'bullet',
});
def('pistol_clip', { name: 'Pistol Clip', kind: 'ammo', damage: 26, dmgType: DMG.AP, clip: 12, weight: 1, color: '#b0a060' });

def('rifle', {
  name: 'Rifle', kind: 'weapon', w: 1, h: 3, weight: 8, ammo: ['rifle_clip'],
  modes: { auto: { tu: 35, acc: 35, shots: 3 }, snap: { tu: 25, acc: 60 }, aimed: { tu: 80, acc: 110 } },
  color: '#6e7480', shape: 'rifle', projectile: 'bullet',
});
def('rifle_clip', { name: 'Rifle Clip', kind: 'ammo', damage: 30, dmgType: DMG.AP, clip: 20, weight: 3, color: '#b0a060' });

def('heavy_cannon', {
  name: 'Heavy Cannon', kind: 'weapon', w: 2, h: 3, weight: 18, twoHanded: true,
  ammo: ['hc_ap', 'hc_he', 'hc_in'],
  modes: { snap: { tu: 33, acc: 60 }, aimed: { tu: 80, acc: 90 } },
  color: '#5a6070', shape: 'cannon', projectile: 'shell',
});
def('hc_ap', { name: 'HC-AP Ammo', kind: 'ammo', damage: 56, dmgType: DMG.AP, clip: 6, weight: 6, color: '#a05a5a' });
def('hc_he', { name: 'HC-HE Ammo', kind: 'ammo', damage: 52, dmgType: DMG.HE, radius: 2, clip: 6, weight: 6, color: '#c08040' });
def('hc_in', { name: 'HC-I Ammo', kind: 'ammo', damage: 60, dmgType: DMG.IN, radius: 2, clip: 6, weight: 6, color: '#d0a030' });

def('auto_cannon', {
  name: 'Auto-Cannon', kind: 'weapon', w: 2, h: 3, weight: 19, twoHanded: true,
  ammo: ['ac_ap', 'ac_he', 'ac_in'],
  modes: { auto: { tu: 40, acc: 32, shots: 3 }, snap: { tu: 33, acc: 56 }, aimed: { tu: 80, acc: 82 } },
  color: '#56606a', shape: 'cannon', projectile: 'shell',
});
def('ac_ap', { name: 'AC-AP Ammo', kind: 'ammo', damage: 42, dmgType: DMG.AP, clip: 14, weight: 5, color: '#a05a5a' });
def('ac_he', { name: 'AC-HE Ammo', kind: 'ammo', damage: 44, dmgType: DMG.HE, radius: 1, clip: 14, weight: 5, color: '#c08040' });
def('ac_in', { name: 'AC-I Ammo', kind: 'ammo', damage: 48, dmgType: DMG.IN, radius: 1, clip: 14, weight: 5, color: '#d0a030' });

def('rocket_launcher', {
  name: 'Rocket Launcher', kind: 'weapon', w: 2, h: 3, weight: 10, twoHanded: true,
  ammo: ['small_rocket', 'large_rocket', 'inc_rocket'],
  modes: { snap: { tu: 45, acc: 55 }, aimed: { tu: 75, acc: 115 } },
  color: '#4c5a4c', shape: 'launcher', projectile: 'rocket',
});
def('small_rocket', { name: 'Small Rocket', kind: 'ammo', w: 1, h: 3, damage: 75, dmgType: DMG.HE, radius: 3, clip: 1, weight: 6, color: '#909050' });
def('large_rocket', { name: 'Large Rocket', kind: 'ammo', w: 1, h: 3, damage: 100, dmgType: DMG.HE, radius: 4, clip: 1, weight: 8, color: '#a0a050' });
def('inc_rocket', { name: 'Incendiary Rocket', kind: 'ammo', w: 1, h: 3, damage: 90, dmgType: DMG.IN, radius: 3, clip: 1, weight: 8, color: '#d08030' });

def('grenade', { name: 'Grenade', kind: 'grenade', damage: 50, dmgType: DMG.HE, radius: 3, weight: 3, color: '#607040' });
def('smoke_grenade', { name: 'Smoke Grenade', kind: 'grenade', damage: 60, dmgType: DMG.SMOKE, radius: 3, weight: 3, color: '#8090a0' });
def('high_explosive', { name: 'High Explosive', kind: 'grenade', w: 2, h: 2, damage: 110, dmgType: DMG.HE, radius: 5, weight: 6, color: '#906030' });
def('flare', { name: 'Electro-flare', kind: 'flare', weight: 3, color: '#e0e060', lightRadius: 7 });
def('medikit', { name: 'Medi-Kit', kind: 'medikit', w: 2, h: 1, weight: 5, color: '#e0e0e0', uses: 6, tu: 10 });
def('stun_rod', { name: 'Stun Rod', kind: 'melee', w: 1, h: 3, weight: 6, damage: 65, dmgType: DMG.STUN, tu: 30, acc: 100, color: '#3060c0' });
def('small_launcher', {
  name: 'Small Launcher', kind: 'weapon', w: 2, h: 3, weight: 10, twoHanded: true, ammo: ['stun_bomb'],
  modes: { snap: { tu: 40, acc: 65 }, aimed: { tu: 75, acc: 110 } },
  color: '#405070', shape: 'launcher', projectile: 'stun',
});
def('stun_bomb', { name: 'Stun Bomb', kind: 'ammo', damage: 90, dmgType: DMG.STUN, radius: 3, clip: 1, weight: 3, color: '#6090e0' });

// ---------------------------------------------------------------- laser (no ammo)
def('laser_pistol', {
  name: 'Laser Pistol', kind: 'weapon', w: 1, h: 2, weight: 7, damage: 46, dmgType: DMG.LASER,
  modes: { auto: { tu: 28, acc: 28, shots: 3 }, snap: { tu: 20, acc: 40 }, aimed: { tu: 55, acc: 68 } },
  color: '#c04040', shape: 'pistol', projectile: 'laser',
});
def('laser_rifle', {
  name: 'Laser Rifle', kind: 'weapon', w: 1, h: 3, weight: 8, damage: 60, dmgType: DMG.LASER,
  modes: { auto: { tu: 34, acc: 46, shots: 3 }, snap: { tu: 25, acc: 65 }, aimed: { tu: 50, acc: 100 } },
  color: '#c04848', shape: 'rifle', projectile: 'laser',
});
def('heavy_laser', {
  name: 'Heavy Laser', kind: 'weapon', w: 2, h: 3, weight: 18, twoHanded: true, damage: 85, dmgType: DMG.LASER,
  modes: { snap: { tu: 33, acc: 50 }, aimed: { tu: 60, acc: 84 } },
  color: '#b03838', shape: 'cannon', projectile: 'laser',
});

// ---------------------------------------------------------------- alien
def('plasma_pistol', {
  name: 'Plasma Pistol', kind: 'weapon', w: 1, h: 2, weight: 3, alien: true, score: 5, ammo: ['plasma_pistol_clip'],
  modes: { auto: { tu: 30, acc: 50, shots: 3 }, snap: { tu: 30, acc: 65 }, aimed: { tu: 60, acc: 85 } },
  color: '#5ab04a', shape: 'pistol', projectile: 'plasma',
});
def('plasma_pistol_clip', { name: 'Plasma Pistol Clip', kind: 'ammo', damage: 52, dmgType: DMG.PLASMA, clip: 26, weight: 1, alien: true, score: 1, color: '#80e070' });
def('plasma_rifle', {
  name: 'Plasma Rifle', kind: 'weapon', w: 1, h: 3, weight: 5, alien: true, score: 8, ammo: ['plasma_rifle_clip'],
  modes: { auto: { tu: 36, acc: 55, shots: 3 }, snap: { tu: 30, acc: 86 }, aimed: { tu: 60, acc: 100 } },
  color: '#4aa04a', shape: 'rifle', projectile: 'plasma',
});
def('plasma_rifle_clip', { name: 'Plasma Rifle Clip', kind: 'ammo', damage: 80, dmgType: DMG.PLASMA, clip: 28, weight: 3, alien: true, score: 1, color: '#80e070' });
def('heavy_plasma', {
  name: 'Heavy Plasma', kind: 'weapon', w: 2, h: 3, weight: 8, alien: true, score: 12, ammo: ['heavy_plasma_clip'],
  modes: { auto: { tu: 35, acc: 50, shots: 3 }, snap: { tu: 30, acc: 75 }, aimed: { tu: 60, acc: 110 } },
  color: '#3a903a', shape: 'cannon', projectile: 'plasma',
});
def('heavy_plasma_clip', { name: 'Heavy Plasma Clip', kind: 'ammo', damage: 115, dmgType: DMG.PLASMA, clip: 35, weight: 3, alien: true, score: 1, color: '#80e070' });
def('alien_grenade', { name: 'Alien Grenade', kind: 'grenade', damage: 90, dmgType: DMG.HE, radius: 4, weight: 3, alien: true, score: 3, color: '#70a0a0' });

// Built-in natural weapons for terror units (never dropped).
def('disc_plasma', {
  name: 'Cyberdisc Plasma', kind: 'weapon', builtin: true, damage: 110, dmgType: DMG.PLASMA,
  modes: { snap: { tu: 30, acc: 80 }, aimed: { tu: 60, acc: 100 } }, projectile: 'plasma',
});
def('chryssalid_claw', { name: 'Claws', kind: 'melee', builtin: true, damage: 110, dmgType: DMG.MELEE, tu: 18, acc: 100, zombify: true });
def('reaper_jaws', { name: 'Jaws', kind: 'melee', builtin: true, damage: 65, dmgType: DMG.MELEE, tu: 20, acc: 100 });
def('silacoid_touch', { name: 'Molten Touch', kind: 'melee', builtin: true, damage: 60, dmgType: DMG.IN, tu: 25, acc: 100 });
def('zombie_claw', { name: 'Claws', kind: 'melee', builtin: true, damage: 40, dmgType: DMG.MELEE, tu: 20, acc: 90 });

// Corpses (w2 h3 like the original) - created at runtime per unit.
def('corpse', { name: 'Corpse', kind: 'corpse', w: 2, h: 3, weight: 22, color: '#704040' });

// ---------------------------------------------------------------- UFO loot (recovered only, never in inventory)
export const UFO_LOOT = {
  power_source: { name: 'UFO Power Source', score: 25 },
  navigation: { name: 'UFO Navigation', score: 5 },
  elerium: { name: 'Elerium-115', score: 5 },
  alloys: { name: 'Alien Alloys', score: 1 },
  food: { name: 'Alien Food', score: 2 },
  surgery: { name: 'Alien Surgery', score: 3 },
  entertainment: { name: 'Alien Entertainment', score: 2 },
  examination: { name: 'Examination Room', score: 3 },
  reproduction: { name: 'Alien Reproduction', score: 3 },
};

export const ITEMS = I;

export function itemDef(id) {
  const d = I[id];
  if (!d) throw new Error('unknown item ' + id);
  return d;
}

let nextItemUid = 1;
export function makeItem(id, extra = {}) {
  const d = itemDef(id);
  const it = { uid: nextItemUid++, id, ...extra };
  if (d.kind === 'ammo') it.rounds = d.clip;
  if (d.kind === 'medikit') it.uses = d.uses;
  return it;
}

// Returns a loaded weapon item.
export function makeWeapon(id, ammoId) {
  const w = makeItem(id);
  const d = itemDef(id);
  if (d.ammo) w.loaded = makeItem(ammoId || d.ammo[0]);
  return w;
}

export function weaponDamage(weapon) {
  const d = itemDef(weapon.id);
  if (d.ammo) {
    if (!weapon.loaded) return null;
    const a = itemDef(weapon.loaded.id);
    return { damage: a.damage, dmgType: a.dmgType, radius: a.radius || 0, ammo: a };
  }
  return { damage: d.damage, dmgType: d.dmgType, radius: d.radius || 0, ammo: null };
}

export function itemName(it) {
  if (it.id === 'corpse') return it.corpseOf ? `${it.corpseOf} Corpse` : 'Corpse';
  if (it.unconscious) return `${it.unconsciousName} (unconscious)`;
  return itemDef(it.id).name;
}

export function itemWeight(it) {
  let w = itemDef(it.id).weight || 0;
  if (it.loaded) w += itemDef(it.loaded.id).weight || 0;
  return w;
}
