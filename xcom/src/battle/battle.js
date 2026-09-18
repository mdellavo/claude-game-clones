import { DIRS, dirTo } from './map.js';
import { computeReach } from './pathfinding.js';
import { canSeeUnit, discoverFrom } from './los.js';
import { itemDef, makeItem, itemWeight } from '../data/items.js';
import { PARTS, P } from '../data/terrain.js';
import { SLOTS, moveCost, makeAlienUnit } from './unit.js';
import * as combat from './combat.js';
import { runAlienTurn } from './ai.js';

// View hooks; the renderer implements the same interface.
export class NullView {
  async unitStep() {}
  async unitTurned() {}
  async shot() {}
  async thrown() {}
  async explosion() {}
  async melee() {}
  unitHit() {}
  unitDown() {}
  unitSpawned() {}
  spotted() {}
  terrainChanged() {}
  visibilityChanged() {}
  message() {}
  turnStarted() {}
  async alienTurnFocus() {}
}

export class Battle {
  constructor({ map, rng, mission, view, difficulty }) {
    this.map = map;
    this.rng = rng;
    this.mission = mission;
    this.difficulty = difficulty;
    this.view = view || new NullView();
    this.units = new Map();
    this.turn = 1;
    this.side = 'xcom';
    this.over = null;
    this.flares = []; // {x,y,z,turns}
    this.dynLightCache = null;
    this.alienIntel = new Map(); // xcom unit id -> {x,y,z,turn}
    this.messages = [];
    this.stats = { aliensKilled: 0, aliensCaptured: 0, soldiersKilled: 0, xcomKills: [] };
    this.reserve = 'none'; // player TU reserve mode
    this.silent = false;
  }

  // ---------------------------------------------------------------- units
  addUnit(u) {
    this.units.set(u.id, u);
    if (u.active) this.map.unitAt[this.map.idx(u.x, u.y, u.z)] = u.id;
    return u;
  }
  unitList(faction) {
    const out = [];
    for (const u of this.units.values()) if (!faction || u.faction === faction) out.push(u);
    return out;
  }
  activeUnits(faction) {
    return this.unitList(faction).filter((u) => u.active);
  }
  unitAtPos(x, y, z) {
    const id = this.map.inBounds(x, y, z) ? this.map.unitAt[this.map.idx(x, y, z)] : -1;
    return id >= 0 ? this.units.get(id) : null;
  }
  // any unit (including unconscious / dead bodies) on voxel
  bodiesAt(x, y, z) {
    return this.unitList().filter((u) => u.status !== 'active' && !u.removed && u.x === x && u.y === y && u.z === z);
  }
  enemyOf(f) {
    return f === 'xcom' ? 'alien' : 'xcom';
  }

  log(msg, kind = 'info') {
    this.messages.push({ msg, kind, turn: this.turn });
    this.view.message(msg, kind);
  }

  // Is the unit visible to the human player?
  visibleToPlayer(u) {
    if (u.faction === 'xcom') return true;
    if (u.status === 'dead') return this.map.discovered[this.map.idx(u.x, u.y, u.z)] > 0;
    for (const s of this.activeUnits('xcom')) if (s.visible.has(u.id)) return true;
    return false;
  }

  // ---------------------------------------------------------------- lighting
  dynLight(x, y, z) {
    if (!this.dynLightCache) this.rebuildLight();
    return this.dynLightCache[this.map.idx(x, y, z)] > 0;
  }
  rebuildLight() {
    const m = this.map;
    const L = (this.dynLightCache = new Uint8Array(m.w * m.l * m.h));
    const light = (cx, cy, cz, r) => {
      for (let z = Math.max(0, cz - 1); z <= Math.min(m.h - 1, cz + 1); z++)
        for (let y = Math.max(0, cy - r); y <= Math.min(m.l - 1, cy + r); y++)
          for (let x = Math.max(0, cx - r); x <= Math.min(m.w - 1, cx + r); x++)
            if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) L[m.idx(x, y, z)] = 1;
    };
    for (const f of this.flares) light(f.x, f.y, f.z, 7);
    for (let i = 0; i < m.fire.length; i++) {
      if (m.fire[i]) {
        const p = m.pos(i);
        light(p.x, p.y, p.z, 4);
      }
    }
  }
  invalidateLight() {
    this.dynLightCache = null;
  }

  // ---------------------------------------------------------------- visibility
  // Recomputes what every active unit can see. Returns list of {viewer, target} newly spotted.
  updateVisibility(onlyFaction = null) {
    const newly = [];
    const all = this.unitList();
    for (const v of all) {
      if (onlyFaction && v.faction !== onlyFaction) continue;
      if (!v.active) {
        v.visible.clear();
        continue;
      }
      const next = new Set();
      for (const t of all) {
        if (t.faction === v.faction || t.status === 'dead' || t.removed) continue;
        if (canSeeUnit(this, v, t)) {
          next.add(t.id);
          if (!v.visible.has(t.id) && t.active) newly.push({ viewer: v, target: t });
        }
      }
      v.visible = next;
    }
    // alien intel
    for (const a of this.activeUnits('alien')) {
      for (const id of a.visible) {
        const t = this.units.get(id);
        if (t && t.active) this.alienIntel.set(id, { x: t.x, y: t.y, z: t.z, turn: this.turn });
      }
    }
    this.view.visibilityChanged();
    return newly;
  }

  discover(u) {
    if (u.faction !== 'xcom' || !u.active) return;
    if (discoverFrom(this, u)) this.view.terrainChanged();
  }

  // ---------------------------------------------------------------- setup
  start() {
    for (const u of this.activeUnits('xcom')) this.discover(u);
    this.updateVisibility();
    this.startSideTurn('xcom');
    this.view.turnStarted(this.side, this.turn);
  }

  // ---------------------------------------------------------------- helpers
  tuCostPct(u, pct) {
    return Math.max(1, Math.round((u.stats.tu * pct) / 100));
  }

  reserveCost(u) {
    if (u.faction !== 'xcom' || this.reserve === 'none') return 0;
    const w = u.mainWeapon();
    if (!w) return 0;
    const d = itemDef(w.id);
    const m = d.modes && d.modes[this.reserve];
    if (!m) return 0;
    return this.tuCostPct(u, m.tu);
  }

  reach(u) {
    return computeReach(this.map, u, Math.max(u.tu, 0));
  }

  spend(u, tu, energy = 0) {
    if (u.tu < tu) return false;
    u.tu -= tu;
    u.energy = Math.max(0, u.energy - energy);
    return true;
  }

  // ---------------------------------------------------------------- actions
  async turnUnit(u, dir, { free = false } = {}) {
    if (dir < 0 || dir === u.facing) return true;
    let steps = Math.abs(dir - u.facing);
    if (steps > 4) steps = 8 - steps;
    const cost = free ? 0 : steps;
    if (u.tu < cost) return false;
    u.tu -= cost;
    u.facing = dir;
    this.discover(u);
    const newly = this.updateVisibility();
    this.reportSpotted(newly);
    await this.view.unitTurned(u);
    return true;
  }

  async faceTowards(u, x, y) {
    const dir = dirTo(x - u.x, y - u.y);
    return this.turnUnit(u, dir);
  }

  kneel(u) {
    if (u.model !== 'soldier') return { ok: false, reason: 'Cannot kneel' };
    const cost = u.kneeling ? 8 : 4;
    if (!this.spend(u, cost)) return { ok: false, reason: 'Not enough time units' };
    u.kneeling = !u.kneeling;
    this.updateVisibility();
    return { ok: true };
  }

  reportSpotted(newly) {
    for (const { viewer, target } of newly) {
      if (viewer.faction === 'xcom') this.view.spotted(target, viewer);
    }
  }

  // Walk along a path (from computeReach().path). Returns {ok, stopped, reason}.
  async move(u, path, { player = false } = {}) {
    if (!path || !path.length) return { ok: false, reason: 'No path' };
    const map = this.map;
    let prevCost = 0;
    let stopped = null;
    if (u.kneeling) {
      if (u.tu < 8) return { ok: false, reason: 'Not enough time units' };
      u.tu -= 8;
      u.kneeling = false;
    }
    const knownBefore = new Set();
    if (u.faction === 'xcom') for (const s of this.activeUnits('xcom')) for (const id of s.visible) knownBefore.add(id);

    for (const step of path) {
      if (!u.active || this.over) break;
      const c = step.cost - prevCost;
      prevCost = step.cost;
      const reserve = player ? this.reserveCost(u) : 0;
      if (u.tu - c < reserve && player) {
        stopped = 'reserve';
        break;
      }
      const energyCost = u.isFlying ? 0 : Math.floor(c / 2);
      if (u.tu < c || u.energy < energyCost) {
        stopped = 'tu';
        break;
      }
      // blocked by a unit that became visible / moved there
      const occ = map.unitAt[map.idx(step.x, step.y, step.z)];
      if (occ >= 0 && occ !== u.id) {
        stopped = 'blocked';
        break;
      }
      const dx = step.x - u.x, dy = step.y - u.y;
      if (dx || dy) u.facing = dirTo(dx, dy);
      // open doors
      const o = map.objPart(step.x, step.y, step.z);
      if (o && o.openTo) {
        map.setObj(step.x, step.y, step.z, o.openTo);
        this.view.terrainChanged();
      }
      u.tu -= c;
      u.energy -= energyCost;
      const from = { x: u.x, y: u.y, z: u.z };
      map.unitAt[map.idx(u.x, u.y, u.z)] = -1;
      u.x = step.x;
      u.y = step.y;
      u.z = step.z;
      map.unitAt[map.idx(u.x, u.y, u.z)] = u.id;
      this.closeUfoDoors(from);
      const visibleNow = this.visibleToPlayer(u);
      this.discover(u);
      const newly = this.updateVisibility();
      await this.view.unitStep(u, from, step, visibleNow || this.visibleToPlayer(u));
      this.reportSpotted(newly);
      // hostile activity noticed?
      if (u.faction === 'xcom') {
        const spottedNew = newly.some((n) => n.viewer.faction === 'xcom' && !knownBefore.has(n.target.id));
        if (spottedNew && player) stopped = 'spotted';
      } else {
        if (newly.some((n) => n.viewer === u) && !player && u.ai?.stopOnSpot) stopped = 'spotted';
      }
      await combat.checkReactions(this, u);
      if (stopped) break;
    }
    this.checkFall(u);
    this.checkEnd();
    return { ok: true, stopped };
  }

  closeUfoDoors(from) {
    const m = this.map;
    for (let z = Math.max(0, from.z - 1); z <= Math.min(m.h - 1, from.z + 1); z++) {
      for (let y = from.y - 1; y <= from.y + 1; y++)
        for (let x = from.x - 1; x <= from.x + 1; x++) {
          const p = m.objPart(x, y, z);
          if (!p || !p.closeTo) continue;
          if (m.unitAt[m.idx(x, y, z)] >= 0) continue;
          if (this.bodiesAt(x, y, z).length || m.groundItems(x, y, z).length) continue;
          m.setObj(x, y, z, p.closeTo);
          this.view.terrainChanged();
        }
    }
  }

  checkFall(u) {
    if (!u.active || u.isFlying) return;
    const m = this.map;
    if (u.z === 0 || m.hasStandingFloor(u.x, u.y, u.z)) return;
    let z = u.z;
    while (z > 0 && !m.hasStandingFloor(u.x, u.y, z)) z--;
    if (m.unitAt[m.idx(u.x, u.y, z)] >= 0) return; // landed on someone; stay (rare)
    const levels = u.z - z;
    m.unitAt[m.idx(u.x, u.y, u.z)] = -1;
    u.z = z;
    m.unitAt[m.idx(u.x, u.y, u.z)] = u.id;
    this.log(`${u.name} fell ${levels} level${levels > 1 ? 's' : ''}!`, 'warn');
    combat.applyDamage(this, u, 8 * levels, 'MELEE', null, 'under', { noRoll: true });
    this.view.unitStep(u, { x: u.x, y: u.y, z: u.z + levels }, u, true);
  }

  // ------------------------------------------------------------ inventory actions
  // from: 'ground' or slot name. Returns {ok, reason}
  moveItem(u, item, toSlot, x = 0, y = 0, { free = false } = {}) {
    const entry = u.entryOf(item);
    const from = entry ? entry.slot : 'ground';
    const cost = free ? 0 : moveCost(from, toSlot);
    if (toSlot !== 'ground') {
      if (!u.canPlace(item, toSlot, x, y, item)) return { ok: false, reason: 'No room' };
    }
    if (u.tu < cost) return { ok: false, reason: 'Not enough time units' };
    u.tu -= cost;
    if (entry) u.removeItem(item);
    else this.map.removeItem(u.x, u.y, u.z, item);
    if (toSlot === 'ground') this.map.addItem(u.x, u.y, u.z, item);
    else u.place(item, toSlot, x, y);
    this.view.terrainChanged();
    return { ok: true, cost };
  }

  reload(u, weapon) {
    const d = itemDef(weapon.id);
    if (!d.ammo) return { ok: false, reason: 'No ammo required' };
    if (weapon.loaded && weapon.loaded.rounds > 0) return { ok: false, reason: 'Weapon already loaded' };
    const ammo = u.findAmmoFor(weapon);
    if (!ammo) return { ok: false, reason: 'No ammunition' };
    if (u.tu < 15) return { ok: false, reason: 'Not enough time units' };
    u.tu -= 15;
    u.removeItem(ammo.item);
    weapon.loaded = ammo.item;
    this.log(`${u.name} reloads ${d.name}.`);
    return { ok: true };
  }

  loadWith(u, weapon, ammoItem) {
    const d = itemDef(weapon.id);
    if (!d.ammo || !d.ammo.includes(ammoItem.id)) return { ok: false, reason: 'Wrong ammunition' };
    if (weapon.loaded && weapon.loaded.rounds > 0) return { ok: false, reason: 'Weapon already loaded' };
    if (u.tu < 15) return { ok: false, reason: 'Not enough time units' };
    u.tu -= 15;
    const entry = u.entryOf(ammoItem);
    if (entry) u.removeItem(ammoItem);
    else this.map.removeItem(u.x, u.y, u.z, ammoItem);
    weapon.loaded = ammoItem;
    return { ok: true };
  }

  unload(u, weapon) {
    if (!weapon.loaded) return { ok: false, reason: 'Not loaded' };
    if (u.tu < 8) return { ok: false, reason: 'Not enough time units' };
    const clip = weapon.loaded;
    weapon.loaded = null;
    u.tu -= 8;
    if (!u.autoPlace(clip, ['belt', 'backpack', 'rshoulder', 'lshoulder', 'rleg', 'lleg'])) this.map.addItem(u.x, u.y, u.z, clip);
    return { ok: true };
  }

  prime(u, item) {
    const d = itemDef(item.id);
    if (d.kind !== 'grenade') return { ok: false, reason: 'Cannot prime' };
    if (item.primed) return { ok: false, reason: 'Already primed' };
    const cost = this.tuCostPct(u, 50);
    if (!this.spend(u, cost)) return { ok: false, reason: 'Not enough time units' };
    item.primed = true;
    this.log(`${u.name} primes ${d.name}.`);
    return { ok: true };
  }

  medikit(u, kit, target, action) {
    if (!target) return { ok: false, reason: 'No patient' };
    if (Math.max(Math.abs(target.x - u.x), Math.abs(target.y - u.y)) > 1 || target.z !== u.z) return { ok: false, reason: 'Patient out of reach' };
    if (u.tu < 10) return { ok: false, reason: 'Not enough time units' };
    if (kit.uses <= 0) return { ok: false, reason: 'Medi-kit empty' };
    u.tu -= 10;
    kit.uses--;
    if (action === 'heal') {
      if (target.wounds > 0) target.wounds--;
      target.health = Math.min(target.stats.health, target.health + 5);
      this.log(`${u.name} treats ${target.name}'s wounds.`);
    } else if (action === 'stim') {
      target.stun = Math.max(0, target.stun - 20);
      target.energy = target.stats.stamina;
      if (target.status === 'unconscious' && target.stun < target.health) this.wakeUp(target);
      this.log(`${u.name} gives ${target.name} a stimulant.`);
    } else {
      target.morale = Math.min(100, target.morale + 30);
      this.log(`${u.name} gives ${target.name} a painkiller.`);
    }
    return { ok: true };
  }

  wakeUp(u) {
    const m = this.map;
    const i = m.idx(u.x, u.y, u.z);
    if (m.unitAt[i] >= 0) return false;
    u.status = 'active';
    u.tu = 0;
    m.unitAt[i] = u.id;
    this.log(`${u.name} regains consciousness.`, u.faction === 'xcom' ? 'good' : 'warn');
    this.view.unitSpawned(u);
    return true;
  }

  // ---------------------------------------------------------------- turn flow
  startSideTurn(faction) {
    this.side = faction;
    for (const u of this.unitList(faction)) {
      if (u.status === 'dead' || u.removed) continue;
      if (u.status === 'unconscious') {
        u.stun = Math.max(0, u.stun - 3);
        if (u.wounds) {
          u.health -= u.wounds;
          if (u.health <= 0) combat.kill(this, u, null, 'bleeding');
        }
        if (u.status === 'unconscious' && u.stun < u.health && u.health > 0) this.wakeUp(u);
        continue;
      }
      u.tu = u.turnTu();
      u.energy = Math.min(u.stats.stamina, u.energy + Math.round(u.stats.stamina / 3));
      u.stun = Math.max(0, u.stun - 3);
      u.panic = null;
      if (u.wounds) {
        u.health -= u.wounds;
        if (u.health <= 0) {
          this.log(`${u.name} has bled to death.`, u.faction === 'xcom' ? 'bad' : 'good');
          combat.kill(this, u, null, 'bleeding');
          continue;
        }
      }
      if (u.burning > 0) {
        u.burning--;
        combat.applyDamage(this, u, this.rng.int(5, 12), 'IN', null, 'under', { noRoll: true });
        if (!u.active) continue;
      }
      const m = this.map;
      if (m.fire[m.idx(u.x, u.y, u.z)]) {
        combat.applyDamage(this, u, this.rng.int(5, 10), 'IN', null, 'under', { noRoll: true });
        if (!u.active) continue;
      }
      if (u.stun >= u.health) {
        combat.knockOut(this, u);
        continue;
      }
      u.morale = Math.min(100, u.morale + 5);
      if (u.morale < 50 && faction === 'xcom') {
        if (this.rng.next() * 100 > u.morale * 2) combat.panic(this, u);
      }
      if (u.morale < 30 && faction === 'alien' && !u.isTerror) {
        if (this.rng.next() * 100 > u.morale * 3) combat.panic(this, u);
      }
    }
    this.checkEnd();
  }

  environmentTick() {
    combat.fireTick(this);
    for (const f of this.flares) f.turns--;
    this.flares = this.flares.filter((f) => f.turns > 0);
    this.invalidateLight();
  }

  // Primed grenades explode at the end of the turn in which they were primed.
  async detonatePrimed() {
    const bombs = [];
    for (const [i, items] of this.map.items) {
      for (const it of items) if (it.primed) bombs.push({ it, pos: this.map.pos(i), carrier: null });
    }
    for (const u of this.unitList()) {
      if (u.status === 'dead' || u.removed) continue;
      for (const e of u.inventory) if (e.item.primed) bombs.push({ it: e.item, pos: { x: u.x, y: u.y, z: u.z }, carrier: u });
    }
    for (const b of bombs) {
      if (this.over) break;
      if (b.carrier) b.carrier.removeItem(b.it);
      else this.map.removeItem(b.pos.x, b.pos.y, b.pos.z, b.it);
      const d = itemDef(b.it.id);
      await combat.explode(this, b.pos.x, b.pos.y, b.pos.z, d.damage, d.radius, d.dmgType, b.it.owner ? this.units.get(b.it.owner) : null);
    }
  }

  async endPlayerTurn() {
    if (this.side !== 'xcom' || this.over) return;
    await this.detonatePrimed();
    if (this.over) return;
    this.startSideTurn('alien');
    this.updateVisibility();
    this.view.turnStarted('alien', this.turn);
    if (!this.over) await runAlienTurn(this);
    if (this.over) return;
    await this.detonatePrimed();
    if (this.over) return;
    this.turn++;
    this.environmentTick();
    this.startSideTurn('xcom');
    for (const u of this.activeUnits('xcom')) this.discover(u);
    this.reportSpotted(this.updateVisibility());
    this.checkEnd();
    this.view.turnStarted('xcom', this.turn);
  }

  checkEnd() {
    if (this.over) return this.over;
    const aliens = this.activeUnits('alien');
    const xcom = this.activeUnits('xcom');
    if (!aliens.length) this.over = { result: 'victory' };
    else if (!xcom.length) this.over = { result: 'defeat' };
    return this.over;
  }

  abort() {
    if (this.over) return this.over;
    this.over = { result: 'aborted' };
    return this.over;
  }

  // ---------------------------------------------------------------- results
  results() {
    const m = this.map;
    const res = this.over?.result || 'aborted';
    const lines = [];
    let score = 0;
    const add = (label, count, pts) => {
      if (!count) return;
      lines.push({ label, count, score: pts });
      score += pts;
    };
    const soldiers = this.unitList('xcom').filter((u) => u.soldier);
    const onCraft = (u) => m.isCraftTile(u.x, u.y, u.z);
    const recoverAll = res === 'victory';
    const soldierFate = new Map();
    for (const u of soldiers) {
      let fate;
      if (u.status === 'dead') fate = 'KIA';
      else if (res === 'defeat') fate = 'MIA';
      else if (res === 'aborted' && !(u.active && onCraft(u))) fate = 'MIA';
      else fate = u.status === 'unconscious' ? 'wounded' : 'ok';
      soldierFate.set(u, fate);
    }

    // aliens
    const aliens = this.unitList('alien');
    let killed = 0, killScore = 0, captured = 0, capScore = 0;
    for (const a of aliens) {
      if (a.status === 'dead' && !a.removed) {
        killed++;
        killScore += a.score;
      } else if (a.status === 'unconscious' && recoverAll && !a.noCapture) {
        captured++;
        capScore += a.score * 3;
      }
    }
    add('Aliens killed', killed, Math.round(killScore));
    add('Live aliens captured', captured, Math.round(capScore));

    const lost = [...soldierFate.values()].filter((f) => f === 'KIA' || f === 'MIA').length;
    add('X-COM operatives killed / missing', lost, -20 * lost);

    const loot = {};
    const artifacts = {};
    const addArtifact = (it) => {
      const d = itemDef(it.id);
      if (it.id === 'corpse') {
        const k = `${it.corpseOf} Corpse`;
        artifacts[k] = (artifacts[k] || { count: 0, score: 0 });
        artifacts[k].count++;
        return;
      }
      if (d.alien) {
        artifacts[d.name] = artifacts[d.name] || { count: 0, score: 0 };
        artifacts[d.name].count++;
        artifacts[d.name].score += d.score || 0;
      }
      if (it.loaded) addArtifact(it.loaded);
    };
    if (recoverAll) {
      for (let i = 0; i < m.obj.length; i++) {
        const p = PARTS[m.obj[i]];
        if (p && p.loot) for (const [k, v] of Object.entries(p.loot)) loot[k] = (loot[k] || 0) + v;
      }
      for (const items of m.items.values()) for (const it of items) addArtifact(it);
    } else {
      for (const [i, items] of m.items) {
        const p = m.pos(i);
        if (m.isCraftTile(p.x, p.y, p.z)) for (const it of items) addArtifact(it);
      }
    }
    for (const u of soldiers) {
      const f = soldierFate.get(u);
      if (f === 'ok' || f === 'wounded') for (const e of u.inventory) addArtifact(e.item);
    }
    const LOOT = {
      power_source: ['UFO Power Source', 25], navigation: ['UFO Navigation', 5], elerium: ['Elerium-115', 0.2],
      alloys: ['Alien Alloys', 0.34], food: ['Alien Food', 2], surgery: ['Alien Surgery', 3], examination: ['Examination Room', 3],
      reproduction: ['Alien Reproduction', 3], entertainment: ['Alien Entertainment', 2],
    };
    const recovered = [];
    for (const [k, v] of Object.entries(loot)) {
      const [name, pts] = LOOT[k];
      let count = v;
      if (k === 'alloys') count = Math.ceil(v / 3);
      recovered.push({ name, count });
      add(name, count, Math.round(count * pts * (k === 'alloys' ? 3 : 1)));
    }
    for (const [name, a] of Object.entries(artifacts)) {
      recovered.push({ name, count: a.count });
      if (a.score) add(name, a.count, a.score);
    }
    if (res === 'victory') add('Crash site secured', 1, 20);

    let rating = 'TERRIBLE';
    if (score > 0) rating = 'POOR';
    if (score > 50) rating = 'OK';
    if (score > 125) rating = 'GOOD';
    if (score > 250) rating = 'EXCELLENT';

    return {
      result: res,
      turns: this.turn,
      lines,
      score,
      rating,
      recovered,
      soldiers: soldiers.map((u) => ({ unit: u, fate: soldierFate.get(u) })),
    };
  }

  // spawn an alien unit mid-battle (zombies, hatching chryssalids)
  spawnAlien(species, x, y, z) {
    const u = makeAlienUnit(species, 'terrorist', this.difficulty);
    u.x = x;
    u.y = y;
    u.z = z;
    u.tu = 0;
    this.addUnit(u);
    this.view.unitSpawned(u);
    return u;
  }
}

export { DIRS, SLOTS, makeItem, itemWeight, P };
