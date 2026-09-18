import { itemDef, itemWeight } from '../data/items.js';
import { ARMORS, SPECIES, ALIEN_RANKS, RANKS } from '../data/units.js';

// Inventory sections; positions are in grid cells for the inventory screen.
export const SLOTS = {
  rshoulder: { name: 'Right Shoulder', px: 0, py: 1, w: 2, h: 1 },
  lshoulder: { name: 'Left Shoulder', px: 11, py: 1, w: 2, h: 1 },
  rhand: { name: 'Right Hand', px: 0, py: 3, w: 2, h: 3, single: true },
  lhand: { name: 'Left Hand', px: 11, py: 3, w: 2, h: 3, single: true },
  belt: { name: 'Belt', px: 4, py: 5, w: 5, h: 2, cells: ['11111', '10001'] },
  rleg: { name: 'Right Leg', px: 0, py: 7, w: 2, h: 1 },
  lleg: { name: 'Left Leg', px: 11, py: 7, w: 2, h: 1 },
  backpack: { name: 'Backpack', px: 4, py: 1, w: 3, h: 3 },
};

// TU cost to move an item out of / into a section.
const OUT_COST = { rhand: 0, lhand: 0, belt: 2, rshoulder: 2, lshoulder: 2, rleg: 2, lleg: 2, backpack: 6, ground: 4 };
const IN_COST = { rhand: 4, lhand: 4, belt: 2, rshoulder: 2, lshoulder: 2, rleg: 2, lleg: 2, backpack: 8, ground: 2 };
export function moveCost(from, to) {
  if (from === to) return from === 'ground' ? 0 : 2;
  return OUT_COST[from] + IN_COST[to];
}

let nextUnitId = 1;

export class Unit {
  constructor(o) {
    this.id = nextUnitId++;
    this.faction = o.faction; // 'xcom' | 'alien'
    this.name = o.name;
    this.species = o.species || 'human';
    this.rank = o.rank;
    this.stats = { ...o.stats };
    this.armorMax = { ...o.armor };
    this.armor = { ...o.armor };
    this.flyingCapable = !!o.flying;
    this.height = o.height || 0.8;
    this.model = o.model || 'soldier';
    this.color = o.color;
    this.skin = o.skin;
    this.builtin = o.builtin || null;
    this.soldier = o.soldier || null; // persistent soldier record
    this.explodeOnDeath = o.explodeOnDeath || null;
    this.noCapture = !!o.noCapture;
    this.isTerror = !!o.isTerror;
    this.hatchOnDeath = o.hatchOnDeath || null;
    this.score = o.score || 0;

    this.x = o.x || 0;
    this.y = o.y || 0;
    this.z = o.z || 0;
    this.facing = o.facing ?? 4;
    this.kneeling = false;

    this.tu = this.stats.tu;
    this.energy = this.stats.stamina;
    this.health = this.stats.health;
    this.stun = 0;
    this.morale = 100;
    this.wounds = 0;
    this.burning = 0;
    this.status = 'active'; // active | dead | unconscious
    this.panic = null; // 'panicked' | 'berserk' this turn
    this.inventory = [];
    this.kills = 0;
    this.shotsFired = 0;
    this.hitsTaken = 0;
    this.visible = new Set(); // ids of enemy units this unit currently sees
    this.seenByEnemy = false;
    this.ai = { mode: o.guard ? 'guard' : 'patrol', home: { x: this.x, y: this.y, z: this.z }, target: null };
  }

  get active() {
    return this.status === 'active';
  }
  get isFlying() {
    return this.flyingCapable;
  }
  get rankName() {
    if (this.faction === 'xcom') return RANKS[this.rank] || 'Rookie';
    return ALIEN_RANKS[this.rank]?.name || '';
  }

  // ---------------------------------------------------------------- inventory
  hand(slot) {
    const e = this.inventory.find((e) => e.slot === slot);
    return e ? e.item : null;
  }
  entryOf(item) {
    return this.inventory.find((e) => e.item === item);
  }
  // the weapon used by default: right hand, then left hand, then builtin
  mainWeapon() {
    const r = this.hand('rhand');
    if (r && isUsable(r)) return r;
    const l = this.hand('lhand');
    if (l && isUsable(l)) return l;
    return null;
  }

  cellsOf(slot) {
    const s = SLOTS[slot];
    const cells = [];
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) if (!s.cells || s.cells[y][x] === '1') cells.push([x, y]);
    return cells;
  }

  canPlace(item, slot, x, y, ignore = null) {
    const s = SLOTS[slot];
    if (!s) return false;
    const d = itemDef(item.id);
    if (s.single) {
      return !this.inventory.some((e) => e.slot === slot && e.item !== ignore);
    }
    const w = d.w || 1, h = d.h || 1;
    if (x < 0 || y < 0 || x + w > s.w || y + h > s.h) return false;
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        if (s.cells && s.cells[yy][xx] !== '1') return false;
        for (const e of this.inventory) {
          if (e.slot !== slot || e.item === ignore) continue;
          const ed = itemDef(e.item.id);
          if (xx >= e.x && xx < e.x + (ed.w || 1) && yy >= e.y && yy < e.y + (ed.h || 1)) return false;
        }
      }
    return true;
  }

  place(item, slot, x = 0, y = 0) {
    this.inventory.push({ item, slot, x, y });
  }

  // Put item in the first free spot among slots. Returns true on success.
  autoPlace(item, slots = ['rhand', 'lhand', 'belt', 'rshoulder', 'lshoulder', 'rleg', 'lleg', 'backpack']) {
    for (const slot of slots) {
      const s = SLOTS[slot];
      if (s.single) {
        if (this.canPlace(item, slot, 0, 0)) {
          this.place(item, slot, 0, 0);
          return true;
        }
        continue;
      }
      for (let y = 0; y < s.h; y++)
        for (let x = 0; x < s.w; x++) {
          if (this.canPlace(item, slot, x, y)) {
            this.place(item, slot, x, y);
            return true;
          }
        }
    }
    return false;
  }

  removeItem(item) {
    const k = this.inventory.findIndex((e) => e.item === item);
    if (k >= 0) this.inventory.splice(k, 1);
  }

  findAmmoFor(weapon) {
    const d = itemDef(weapon.id);
    if (!d.ammo) return null;
    const order = ['belt', 'rshoulder', 'lshoulder', 'rleg', 'lleg', 'backpack', 'lhand', 'rhand'];
    const cands = this.inventory.filter((e) => d.ammo.includes(e.item.id));
    cands.sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
    return cands[0] || null;
  }

  carriedWeight() {
    return this.inventory.reduce((s, e) => s + itemWeight(e.item), 0);
  }

  // Max TUs this turn considering overload.
  turnTu() {
    let tu = this.stats.tu;
    const over = this.carriedWeight() - this.stats.strength;
    if (this.faction === 'xcom' && over > 0) tu = Math.max(10, tu - over);
    if (this.wounds > 0) tu = Math.max(10, tu - this.wounds * 2);
    return Math.floor(tu);
  }

  eyeHeight() {
    return this.kneeling ? this.height * 0.62 : this.height * 0.9;
  }
  bodyHeight() {
    return this.kneeling ? this.height * 0.7 : this.height;
  }
}

export function isUsable(item) {
  const d = itemDef(item.id);
  return d.kind === 'weapon' || d.kind === 'melee' || d.kind === 'grenade' || d.kind === 'medikit' || d.kind === 'flare';
}

export function makeSoldierUnit(soldier) {
  const armor = ARMORS[soldier.armor || 'none'];
  return new Unit({
    faction: 'xcom',
    name: soldier.name,
    rank: soldier.rank,
    stats: soldier.stats,
    armor: { front: armor.front, side: armor.side, rear: armor.rear, under: armor.under },
    flying: armor.flying,
    color: armor.color,
    skin: soldier.skin,
    soldier,
    height: 0.8,
    model: 'soldier',
  });
}

export function makeAlienUnit(species, rank, difficulty) {
  const sp = SPECIES[species];
  const rk = ALIEN_RANKS[rank] || ALIEN_RANKS.soldier;
  const mult = rk.mult * difficulty.statMult;
  const st = (v) => Math.round(v * mult);
  return new Unit({
    faction: 'alien',
    name: sp.isTerror ? sp.name : `${sp.name} ${rk.name}`,
    species,
    rank,
    stats: {
      tu: st(sp.tu), stamina: sp.stamina, health: st(sp.health), bravery: sp.bravery, reactions: st(sp.reactions),
      firing: st(sp.firing), throwing: sp.throwing, strength: sp.strength, melee: sp.melee,
    },
    armor: { ...sp.armor },
    flying: sp.flying,
    height: sp.height,
    model: sp.model,
    color: sp.color,
    builtin: sp.builtin,
    explodeOnDeath: sp.explodeOnDeath,
    noCapture: sp.noCapture,
    isTerror: sp.isTerror,
    hatchOnDeath: sp.hatchOnDeath,
    score: sp.score * (rank === 'commander' ? 2 : rank === 'leader' ? 1.5 : 1),
  });
}
