import * as THREE from 'three';
import { Input } from './engine/input.js';
import { sfx, unlockAudio, toggleMute } from './engine/audio.js';
import { DIRS, clamp, rand } from './engine/util.js';
import { buildOverworld, buildDungeon, buildCave, W, H } from './world/area.js';
import { START_POS, OW_ENEMIES, CAVES } from './maps/overworld.js';
import { ROOMS, ENTRANCE_ROOM } from './maps/dungeon1.js';
import { buildAreaMesh } from './render/tiles.js';
import { worldUniforms } from './render/materials.js';
import { makeNpc, makeFire } from './render/models.js';
import { Player } from './entities/player.js';
import { createEnemy } from './entities/enemies.js';
import { Pickup, rollDrop } from './entities/pickups.js';
import { puff } from './entities/effects.js';
import { UI } from './ui/ui.js';

const VIEWS = {
  iso: { yaw: Math.PI / 4, pitch: Math.atan(1 / Math.SQRT2) },
  classic: { yaw: 0, pitch: THREE.MathUtils.degToRad(58) },
};

const smooth = (t) => t * t * (3 - 2 * t);

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 200);
    this.camTarget = new THREE.Vector3();
    this.viewMode = 'iso';

    this.hemi = new THREE.HemisphereLight(0xfff4e0, 0x7a6040, 1.3);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.9);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80 });
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.input = new Input();
    this.ui = new UI();

    this.overworld = buildOverworld();
    this.dungeon = buildDungeon();
    this.cave = buildCave();
    this.meshes = new Map();
    for (const a of [this.overworld, this.dungeon, this.cave]) this.buildMesh(a);

    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.effects = [];
    this.decor = [];
    this.blockers = [];

    this.flags = new Set();
    this.unlocked = new Set();
    this.bombedDoors = new Set();
    this.roomState = new Map();
    this.visitedRooms = new Set();
    this.caveReturn = null;
    this.dungeonReturn = null;

    this.freezeT = 0;
    this.shakeT = 0;
    this.lowHpT = 0;
    this.pauseCursor = 0;
    this.pendingWin = 0;
    this.time = 0;

    this.doorBlocks = (door) => this.isDoorClosed(door);

    this.player = new Player(this, START_POS.x, START_POS.z);
    this.setArea(this.overworld, START_POS.x, START_POS.z, DIRS.up, { spawn: false });

    this.mode = 'title';
    this.ui.showTitle();

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ---------------------------------------------------------------- world helpers

  buildMesh(area) {
    const old = this.meshes.get(area.id);
    if (old) this.scene.remove(old.group);
    const built = buildAreaMesh(area);
    built.version = area.version;
    built.group.visible = this.area === area;
    this.scene.add(built.group);
    this.meshes.set(area.id, built);
  }

  screenRect(col = this.screen.col, row = this.screen.row) {
    return { minX: col * W, minZ: row * H, maxX: (col + 1) * W, maxZ: (row + 1) * H };
  }

  roomKey() { return `${this.screen.col},${this.screen.row}`; }

  enemyBounds() {
    const r = this.screenRect();
    const inset = this.area.kind === 'overworld' ? 0.5 : 2;
    return { minX: r.minX + inset, minZ: r.minZ + inset, maxX: r.maxX - inset, maxZ: r.maxZ - inset };
  }

  inScreen(x, z, margin = 0) {
    const r = this.screenRect();
    return x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin;
  }

  isDoorClosed(door) {
    if (!door) return false;
    switch (door.type) {
      case 'locked': return !this.unlocked.has(door.id);
      case 'bomb': return !this.bombedDoors.has(door.id);
      case 'shut':
        return this.area === this.dungeon && door.rooms.includes(this.roomKey()) &&
          this.enemies.some((e) => !e.dead) && !this.player.autoWalk && this.mode !== 'scroll';
      default: return false;
    }
  }

  boxBlocked(x, z, half, opts = {}) {
    const a = this.area;
    const b = opts.bounds || { minX: 0, minZ: 0, maxX: a.width, maxZ: a.height };
    if (x - half < b.minX || x + half > b.maxX || z - half < b.minZ || z + half > b.maxZ) return true;
    const x0 = Math.floor(x - half), x1 = Math.floor(x + half - 1e-6);
    const z0 = Math.floor(z - half), z1 = Math.floor(z + half - 1e-6);
    for (let tz = z0; tz <= z1; tz++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (a.isSolid(tx, tz, this.doorBlocks)) return true;
      }
    }
    if (opts.player) {
      for (const r of this.blockers) {
        if (x + half > r.minX && x - half < r.maxX && z + half > r.minZ && z - half < r.maxZ) return true;
      }
    }
    return false;
  }

  pointSolid(x, z, forProjectile = false) {
    return this.area.isSolid(Math.floor(x), Math.floor(z), this.doorBlocks, forProjectile);
  }

  inputDirection(input) {
    const name = input.direction();
    if (!name) return null;
    const yaw = VIEWS[this.viewMode].yaw - 0.01;
    const fwd = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    const v = name === 'up' ? fwd : name === 'down' ? { x: -fwd.x, z: -fwd.z } : name === 'right' ? right : { x: -right.x, z: -right.z };
    if (Math.abs(v.x) > Math.abs(v.z)) return v.x > 0 ? DIRS.right : DIRS.left;
    return v.z > 0 ? DIRS.down : DIRS.up;
  }

  addProjectile(p) { this.projectiles.push(p); }
  addEffect(e) { this.effects.push(e); }
  freeze(t) { this.freezeT = Math.max(this.freezeT, t); }
  shake(t) { this.shakeT = Math.max(this.shakeT, t); }

  enemyShotsAllowed() {
    return this.projectiles.filter((p) => !p.dead && p.hostile).length < 4;
  }

  bItems() {
    const p = this.player;
    const list = [];
    if (p.hasBoomerang) list.push('boomerang');
    if (p.bombs > 0) list.push('bomb');
    return list;
  }

  // ---------------------------------------------------------------- area / screen management

  clearEntities({ keepEffects = true } = {}) {
    for (const list of [this.enemies, this.projectiles, this.pickups]) {
      for (const e of list) if (!e.dead) e.remove();
      list.length = 0;
    }
    if (!keepEffects) {
      for (const e of this.effects) if (!e.dead) e.remove();
      this.effects.length = 0;
    }
  }

  clearDecor() {
    for (const d of this.decor) {
      this.scene.remove(d.model.group);
      d.model.dispose();
    }
    this.decor = [];
    this.blockers = [];
  }

  setArea(area, x, z, facing, { spawn = true } = {}) {
    this.clearEntities({ keepEffects: false });
    this.clearDecor();
    this.ui.clearDialog();
    this.area = area;
    for (const [id, m] of this.meshes) m.group.visible = id === area.id;
    const p = this.player;
    p.x = x;
    p.z = z;
    p.facing = facing;
    p.autoWalk = null;
    p.knockT = 0;
    this.screen = { col: Math.floor(x / W), row: Math.floor(z / H) };
    const r = this.screenRect();
    this.camTarget.set((r.minX + r.maxX) / 2, 0, (r.minZ + r.maxZ) / 2);
    worldUniforms.uBounds.value.set(r.minX, r.minZ, r.maxX, r.maxZ);

    const outdoors = area.kind === 'overworld';
    this.hemi.intensity = outdoors ? 1.3 : area.kind === 'dungeon' ? 1.5 : 0.9;
    this.hemi.color.setHex(outdoors ? 0xfff4e0 : area.kind === 'dungeon' ? 0xc0d8ff : 0xffc080);
    this.sun.intensity = outdoors ? 1.9 : area.kind === 'dungeon' ? 1.3 : 0.6;
    worldUniforms.uDim.value = outdoors ? 0.3 : 0.12;

    if (spawn) this.enterScreen();
  }

  enterScreen() {
    const key = this.roomKey();
    if (this.area.kind === 'overworld') {
      const spawns = OW_ENEMIES[key] || [];
      for (const [type, count] of spawns) for (let i = 0; i < count; i++) this.spawnEnemyRandom(type, 4);
    } else if (this.area.kind === 'dungeon') {
      this.visitedRooms.add(key);
      const room = ROOMS[key];
      const st = this.getRoomState(key);
      if (!st.cleared) {
        for (const [type, count] of room.enemies) {
          for (let i = 0; i < count; i++) {
            if (type === 'aquamentus') {
              const r = this.screenRect();
              const e = createEnemy(this, type, r.minX + 12, r.minZ + 5.5);
              e.spawnT = 0.6;
              this.enemies.push(e);
            } else this.spawnEnemyRandom(type, 3.5);
          }
        }
        st.hadEnemies = room.enemies.length > 0;
        if (!st.hadEnemies) st.cleared = true;
      }
      if (st.cleared && room.reward && !st.rewardTaken) this.spawnReward(key);
      if (room.item && !st.itemTaken) {
        const r = this.screenRect();
        this.pickups.push(new Pickup(this, r.minX + 2 + room.item.lx + 0.5, r.minZ + 2 + room.item.lz + 0.5, room.item, {
          onTaken: () => { st.itemTaken = true; if (room.item.kind === 'triforce') this.pendingWin = 4.6; },
        }));
      }
      if (room.boss && !st.cleared) this.ui.flashToast('AQUAMENTUS');
    }
  }

  getRoomState(key) {
    if (!this.roomState.has(key)) this.roomState.set(key, { cleared: false, hadEnemies: false, rewardTaken: false, itemTaken: false });
    return this.roomState.get(key);
  }

  spawnReward(key, at = null) {
    const room = ROOMS[key];
    const st = this.getRoomState(key);
    const r = this.screenRect();
    const x = at ? clamp(at.x, r.minX + 2.5, r.maxX - 2.5) : r.minX + 8;
    const z = at ? clamp(at.z, r.minZ + 2.5, r.maxZ - 2.5) : r.minZ + 5.5;
    this.pickups.push(new Pickup(this, x, z, room.reward, { onTaken: () => { st.rewardTaken = true; } }));
  }

  spawnEnemyRandom(type, minDist) {
    const b = this.enemyBounds();
    const p = this.player;
    for (let tries = 0; tries < 60; tries++) {
      const x = Math.floor(rand(b.minX + 1, b.maxX - 1)) + 0.5;
      const z = Math.floor(rand(b.minZ + 1, b.maxZ - 1)) + 0.5;
      if (Math.hypot(x - p.x, z - p.z) < minDist) continue;
      if (this.boxBlocked(x, z, 0.4, { bounds: b })) continue;
      const e = createEnemy(this, type, x, z);
      e.spawnT = rand(0.3, 0.9);
      setTimeout(() => { if (!e.dead && this.enemies.includes(e)) puff(this, e.x, e.z); }, (e.spawnT - 0.3) * 1000);
      this.enemies.push(e);
      return e;
    }
    return null;
  }

  setupCave(caveId) {
    const def = CAVES[caveId];
    const npc = makeNpc(def.npc);
    npc.group.position.set(8, 0, 4.5);
    this.scene.add(npc.group);
    this.decor.push({ model: npc, update: (dt, t) => { if (npc.parts.body) npc.parts.body.position.y = Math.abs(Math.sin(t * 2)) * 0.02; } });
    this.blockers.push({ minX: 7.6, maxX: 8.4, minZ: 4.1, maxZ: 4.9 });
    for (const fx of [4.5, 11.5]) {
      const fire = makeFire();
      fire.group.position.set(fx, 0, 4.5);
      this.scene.add(fire.group);
      this.decor.push({
        model: fire,
        update: (dt, t) => {
          const s = 1 + Math.sin(t * 17 + fx) * 0.12;
          fire.parts.body.scale.set(1 / s, s, 1 / s);
          fire.parts.f2.rotation.y = t * 3;
          fire.parts.light.intensity = 3 + Math.sin(t * 23 + fx) * 0.6;
        },
      });
      this.blockers.push({ minX: fx - 0.3, maxX: fx + 0.3, minZ: 4.2, maxZ: 4.8 });
    }
    const taken = this.flags.has(`cave:${caveId}`);
    const n = def.items.length;
    const isShop = def.items.some((it) => it.price);
    if (!taken || isShop) {
      const spawned = [];
      def.items.forEach((it, i) => {
        const x = 8 + (i - (n - 1) / 2) * 2.5;
        const pk = new Pickup(this, x, 6.8, it, {
          price: it.price || 0,
          onTaken: () => {
            if (!it.price) {
              this.flags.add(`cave:${caveId}`);
              for (const other of spawned) if (other !== pk && !other.dead) { puff(this, other.x, other.z); other.remove(); }
              this.ui.clearDialog();
            }
          },
        });
        spawned.push(pk);
        this.pickups.push(pk);
      });
    }
    setTimeout(() => { if (this.area === this.cave) this.ui.say(taken && !isShop ? 'GOOD LUCK, HERO.' : def.text); }, 400);
  }

  // ---------------------------------------------------------------- transitions

  async transition(fn) {
    this.mode = 'transition';
    sfx.stairs();
    await this.ui.fade(1, 0.35);
    fn();
    this.snapCamera();
    await this.ui.fade(0, 0.35);
    if (this.mode === 'transition') this.mode = 'play';
  }

  enterCave(tx, tz) {
    const caveId = `${Math.floor(tx / W)},${Math.floor(tz / H)}`;
    this.caveReturn = { screen: { ...this.screen }, x: tx + 0.5, z: tz + 1.4 };
    this.transition(() => {
      this.setArea(this.cave, 8, 9.2, DIRS.up, { spawn: false });
      this.setupCave(caveId);
    });
  }

  exitCave() {
    const r = this.caveReturn;
    this.transition(() => this.setArea(this.overworld, r.x, r.z, DIRS.down));
  }

  enterDungeon(tx, tz) {
    this.dungeonReturn = { x: tx + 0.5, z: tz + 1.4 };
    this.transition(() => {
      const rx = ENTRANCE_ROOM.col * W, rz = ENTRANCE_ROOM.row * H;
      this.setArea(this.dungeon, rx + 8, rz + 8.4, DIRS.up);
      this.ui.flashToast('LEVEL-1');
    });
  }

  exitDungeon() {
    const r = this.dungeonReturn || { x: 2 * W + 7.5, z: 1.4 };
    this.transition(() => this.setArea(this.overworld, r.x, r.z, DIRS.down));
  }

  startScroll(dir) {
    const p = this.player;
    const from = this.screenRect();
    const next = { col: this.screen.col + dir.x, row: this.screen.row + dir.z };
    const to = this.screenRect(next.col, next.row);
    this.clearEntities();
    this.ui.clearDialog();
    const edgeX = dir.x > 0 ? from.maxX : dir.x < 0 ? from.minX : p.x;
    const edgeZ = dir.z > 0 ? from.maxZ : dir.z < 0 ? from.minZ : p.z;
    this.scroll = {
      t: 0,
      dur: this.area.kind === 'dungeon' ? 0.75 : 0.95,
      dir,
      next,
      from, to,
      pFrom: { x: p.x, z: p.z },
      pTo: { x: edgeX + dir.x * 0.5, z: edgeZ + dir.z * 0.5 },
    };
    p.facing = dir;
    this.mode = 'scroll';
  }

  updateScroll(dt) {
    const s = this.scroll;
    s.t += dt;
    const k = smooth(Math.min(1, s.t / s.dur));
    const lerp = (a, b) => a + (b - a) * k;
    const b = worldUniforms.uBounds.value;
    b.set(lerp(s.from.minX, s.to.minX), lerp(s.from.minZ, s.to.minZ), lerp(s.from.maxX, s.to.maxX), lerp(s.from.maxZ, s.to.maxZ));
    this.camTarget.set((b.x + b.z) / 2, 0, (b.y + b.w) / 2);
    const p = this.player;
    p.x = lerp(s.pFrom.x, s.pTo.x);
    p.z = lerp(s.pFrom.z, s.pTo.z);
    p.moving = true;
    p.walkT += dt;
    p.update(0, { pressed: () => false, held: () => false, direction: () => null });
    if (s.t >= s.dur) {
      this.screen = s.next;
      this.scroll = null;
      this.mode = 'play';
      if (this.area.kind === 'dungeon') p.autoWalk = { dir: s.dir, dist: 1.9 };
      this.enterScreen();
    }
  }

  // ---------------------------------------------------------------- combat & events

  hurtPlayer(amount, fromX, fromZ) {
    const p = this.player;
    if (p.iframes > 0 || p.state === 'dying' || p.state === 'hold' || this.mode !== 'play') return;
    p.hp = Math.max(0, p.hp - amount);
    sfx.hurt();
    this.shake(0.15);
    p.startKnockback(fromX, fromZ);
    if (p.hp <= 0) this.killPlayer();
  }

  killPlayer() {
    const p = this.player;
    p.state = 'dying';
    p.dieT = 0;
    p.model.parts.sword.visible = false;
    this.mode = 'dying';
    this.ui.clearDialog();
    sfx.die();
    setTimeout(() => {
      this.mode = 'gameover';
      this.ui.showGameOver();
    }, 2400);
  }

  continueGame() {
    const p = this.player;
    this.ui.hideOverlay();
    p.reset();
    p.hp = Math.min(p.maxHp, 6);
    p.model.group.scale.setScalar(1);
    p.model.flash(false);
    this.setArea(this.overworld, START_POS.x, START_POS.z, DIRS.up);
    this.snapCamera();
    this.mode = 'play';
  }

  swordHitCheck(box) {
    for (const e of this.enemies) {
      if (e.dead || !e.hittable()) continue;
      if (Math.abs(e.x - box.x) < box.hx + e.half && Math.abs(e.z - box.z) < box.hz + e.half) e.hurt(1, box.dir);
    }
    for (const it of this.pickups) {
      if (it.dead || it.price || it.kind === 'triforce' || this.area.kind === 'cave') continue;
      if (Math.abs(it.x - box.x) < box.hx + it.half && Math.abs(it.z - box.z) < box.hz + it.half) it.collect();
    }
  }

  onEnemyKilled(e) {
    if (e.boss) {
      this.bossDeathAt = { x: e.x - 1.5, z: e.z };
      this.shake(0.5);
      return;
    }
    const drop = rollDrop();
    if (drop) this.pickups.push(new Pickup(this, e.x, e.z, { kind: drop }, { life: 9 }));
  }

  bombBlast(x, z) {
    if (this.area.kind === 'overworld') {
      let found = false;
      for (let tz = Math.floor(z - 2); tz <= Math.floor(z + 2); tz++) {
        for (let tx = Math.floor(x - 2); tx <= Math.floor(x + 2); tx++) {
          if (this.area.get(tx, tz) === 'x' && Math.hypot(tx + 0.5 - x, tz + 0.5 - z) < 1.7) {
            this.area.set(tx, tz, 'C');
            found = true;
          }
        }
      }
      if (found) { this.buildMesh(this.area); setTimeout(() => sfx.secret(), 300); }
    } else if (this.area.kind === 'dungeon') {
      for (const door of this.dungeon.doors) {
        if (door.type !== 'bomb' || this.bombedDoors.has(door.id)) continue;
        if (door.tiles.some((t) => Math.hypot(t.tx + 0.5 - x, t.tz + 0.5 - z) < 2.2)) {
          this.bombedDoors.add(door.id);
          setTimeout(() => sfx.secret(), 300);
        }
      }
    }
  }

  tryOpenDoor(x, z) {
    if (this.area.kind !== 'dungeon') return;
    const tx = Math.floor(x), tz = Math.floor(z);
    if (this.area.get(tx, tz) !== 'd') return;
    const door = this.area.doorAt.get(tz * this.area.width + tx);
    if (door.type === 'locked' && !this.unlocked.has(door.id) && this.player.keys > 0) {
      this.player.keys--;
      this.unlocked.add(door.id);
      sfx.unlock();
    }
  }

  // ---------------------------------------------------------------- main update

  updatePlay(dt) {
    const input = this.input;
    const p = this.player;

    if (input.pressed('start') && p.state !== 'hold') {
      this.mode = 'pause';
      sfx.pause();
      const items = this.bItems();
      this.pauseCursor = Math.max(0, items.indexOf(p.bItem));
      this.ui.showPause(this, this.pauseCursor);
      return;
    }
    if (input.pressed('select')) {
      const items = this.bItems();
      if (items.length) {
        const i = items.indexOf(p.bItem);
        p.bItem = items[(i + 1) % items.length];
        sfx.menu();
      }
    }
    if (p.bItem === 'bomb' && p.bombs <= 0) p.bItem = p.hasBoomerang ? 'boomerang' : null;

    const frozen = this.freezeT > 0;
    this.freezeT = Math.max(0, this.freezeT - dt);

    p.update(dt, input);

    if (!frozen) {
      for (const e of this.enemies) if (!e.dead) e.update(dt);
      for (const pr of this.projectiles) if (!pr.dead) pr.update(dt);
      for (const it of this.pickups) if (!it.dead) it.update(dt);
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.projectiles = this.projectiles.filter((e) => !e.dead);
    this.pickups = this.pickups.filter((e) => !e.dead);

    // contact damage
    if (!frozen) {
      for (const e of this.enemies) {
        if (e.touchesPlayer() && p.overlaps(e.x, e.z, e.half * 0.9) && e.y < 0.9) this.hurtPlayer(e.damage, e.x, e.z);
      }
    }

    // pickups
    if (p.state !== 'hold' && p.state !== 'dying') {
      for (const it of this.pickups) {
        if (it.dead) continue;
        it.denyT = Math.max(0, (it.denyT || 0) - dt);
        if (p.overlaps(it.x, it.z, it.half) && !it.denyT) {
          if (!it.collect()) it.denyT = 1.5;
        }
      }
    }

    // dungeon room clear
    if (this.area.kind === 'dungeon') {
      const key = this.roomKey();
      const st = this.getRoomState(key);
      if (!st.cleared && st.hadEnemies && this.enemies.length === 0) {
        st.cleared = true;
        const room = ROOMS[key];
        const hasShut = this.dungeon.doors.some((d) => d.type === 'shut' && d.rooms.includes(key));
        if (hasShut) sfx.door();
        if (room.reward && !st.rewardTaken) {
          setTimeout(() => {
            if (this.area === this.dungeon && this.roomKey() === key) { this.spawnReward(key, this.bossDeathAt); sfx.secret(); }
            this.bossDeathAt = null;
          }, room.boss ? 900 : 200);
        }
      }
      for (const dm of this.meshes.get(this.dungeon.id).doorMeshes) {
        dm.mesh.visible = this.isDoorClosed(dm.door) && (dm.door.type !== 'shut' || dm.room === key);
      }
    }

    for (const d of this.decor) d.update(dt, this.time);

    if (p.state === 'dying') return;

    // low health beeping
    if (p.hp <= 2) {
      this.lowHpT -= dt;
      if (this.lowHpT <= 0) { sfx.lowHealth(); this.lowHpT = 0.35; }
    }

    if (this.pendingWin > 0) {
      this.pendingWin -= dt;
      if (this.pendingWin <= 0) {
        this.mode = 'win';
        this.ui.showWin();
      }
      return;
    }

    this.checkExits();
  }

  checkExits() {
    const p = this.player;
    const a = this.area;
    if (p.state === 'hold') return;
    const tx = Math.floor(p.x), tz = Math.floor(p.z);
    if (a.kind === 'overworld') {
      const c = a.get(tx, tz);
      if ((c === 'C' || c === 'D') && p.facing === DIRS.up && p.z - tz < 0.62 && Math.abs(p.x - (tx + 0.5)) < 0.3) {
        if (c === 'C') this.enterCave(tx, tz);
        else this.enterDungeon(tx, tz);
        return;
      }
    } else if (a.kind === 'cave') {
      if (p.z > 10.3) { this.exitCave(); return; }
    } else if (a.kind === 'dungeon') {
      if (a.get(tx, tz) === 'E' && p.z - this.screenRect().minZ > 10.3) { this.exitDungeon(); return; }
    }
    if (a.kind === 'cave') return;
    const r = this.screenRect();
    let dir = null;
    if (p.x < r.minX) dir = DIRS.left;
    else if (p.x > r.maxX) dir = DIRS.right;
    else if (p.z < r.minZ) dir = DIRS.up;
    else if (p.z > r.maxZ) dir = DIRS.down;
    if (dir && a.screenExists(this.screen.col + dir.x, this.screen.row + dir.z)) this.startScroll(dir);
  }

  updatePause() {
    const input = this.input;
    const items = this.bItems();
    if (items.length && (input.pressed('left') || input.pressed('right'))) {
      this.pauseCursor = (this.pauseCursor + (input.pressed('left') ? items.length - 1 : 1)) % items.length;
      sfx.menu();
      this.ui.showPause(this, this.pauseCursor);
    }
    if (input.pressed('start') || input.pressed('a')) {
      if (items.length) this.player.bItem = items[this.pauseCursor];
      this.ui.hideOverlay();
      this.mode = 'play';
    }
  }

  // ---------------------------------------------------------------- camera & render

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.fitCamera();
  }

  fitCamera() {
    const v = VIEWS[this.viewMode];
    const off = new THREE.Vector3(Math.sin(v.yaw) * Math.cos(v.pitch), Math.sin(v.pitch), Math.cos(v.yaw) * Math.cos(v.pitch));
    const cam = new THREE.OrthographicCamera();
    cam.position.copy(off).multiplyScalar(50);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    const inv = cam.matrixWorldInverse;
    let mx = 0, my = 0;
    for (const x of [-W / 2, W / 2]) for (const z of [-H / 2, H / 2]) for (const y of [-0.2, 1.3]) {
      const p = new THREE.Vector3(x, y, z).applyMatrix4(inv);
      mx = Math.max(mx, Math.abs(p.x));
      my = Math.max(my, Math.abs(p.y));
    }
    const aspect = (this.canvas.clientWidth || 1) / (this.canvas.clientHeight || 1);
    let hw = mx * 1.02, hh = my * 1.04;
    if (hw / hh > aspect) hh = hw / aspect; else hw = hh * aspect;
    Object.assign(this.camera, { left: -hw, right: hw, top: hh, bottom: -hh });
    this.camera.updateProjectionMatrix();
    this.camOffset = off.multiplyScalar(60);
  }

  snapCamera() { this.updateCamera(0); }

  updateCamera(dt) {
    const t = this.camTarget;
    let sx = 0, sz = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      sx = rand(-0.12, 0.12);
      sz = rand(-0.12, 0.12);
    }
    this.camera.position.set(t.x + this.camOffset.x + sx, this.camOffset.y, t.z + this.camOffset.z + sz);
    this.camera.lookAt(t.x + sx, 0, t.z + sz);
    this.sun.position.set(t.x - 9, 18, t.z + 7);
    this.sun.target.position.set(t.x, 0, t.z);
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    worldUniforms.uTime.value = this.time;
    const input = this.input;
    input.update();

    if (input.pressed('view')) {
      this.viewMode = this.viewMode === 'iso' ? 'classic' : 'iso';
      this.fitCamera();
      this.ui.flashToast(this.viewMode === 'iso' ? 'ISOMETRIC VIEW' : 'CLASSIC VIEW');
    }
    if (input.pressed('mute')) this.ui.flashToast(toggleMute() ? 'SOUND OFF' : 'SOUND ON');

    const overworldMesh = this.meshes.get(this.overworld.id);
    if (overworldMesh.version !== this.overworld.version) this.buildMesh(this.overworld);

    switch (this.mode) {
      case 'title':
        if (input.pressed('start') || input.pressed('a')) {
          unlockAudio();
          sfx.item();
          this.ui.hideOverlay();
          this.mode = 'play';
        }
        this.player.update(dt, { pressed: () => false, held: () => false, direction: () => null });
        break;
      case 'play':
        this.updatePlay(dt);
        break;
      case 'scroll':
        this.updateScroll(dt);
        break;
      case 'pause':
        this.updatePause();
        break;
      case 'dying':
        this.player.update(dt, input);
        break;
      case 'gameover':
        if (input.pressed('start') || input.pressed('a')) this.continueGame();
        break;
      case 'win':
        if (input.pressed('start') || input.pressed('a')) {
          this.ui.hideOverlay();
          this.exitDungeon();
        }
        break;
      default:
        for (const d of this.decor) d.update(dt, this.time);
    }

    for (const e of this.effects) if (!e.dead) e.update(dt);
    this.effects = this.effects.filter((e) => !e.dead);

    this.updateCamera(dt);
    this.ui.updateHud(this);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  }
}

