import { Entity } from './base.js';
import * as M from '../render/models.js';
import { DIR_LIST, pick, rand, yawFor } from '../engine/util.js';
import { sfx } from '../engine/audio.js';
import { EnemyShot, Boomerang } from './projectiles.js';
import { deathBurst, puff } from './effects.js';

export class Enemy extends Entity {
  constructor(game, x, z, { hp = 1, damage = 1, half = 0.34 } = {}) {
    super(game, x, z);
    this.hp = hp;
    this.damage = damage;
    this.half = half;
    this.invuln = 0;
    this.stun = 0;
    this.knockT = 0;
    this.knockDir = null;
    this.facing = pick(DIR_LIST);
    this.spawnT = 0.35; // appears after puff
    this.boss = false;
  }

  overlaps(x, z, half) {
    return Math.abs(this.x - x) < this.half + half && Math.abs(this.z - z) < this.half + half;
  }

  hittable() { return this.spawnT <= 0; }
  touchesPlayer() { return this.spawnT <= 0; }
  bounds() { return this.game.enemyBounds(); }

  hurt(amount, dir) {
    if (this.invuln > 0 || this.dead) return;
    this.hp -= amount;
    this.invuln = 0.35;
    if (this.hp <= 0) { this.die(); return; }
    sfx.hit();
    if (dir && !this.boss) {
      this.knockDir = dir;
      this.knockT = 0.15;
    }
  }

  boomerangHit() {
    sfx.stun();
    this.stun = 2.5;
  }

  die() {
    sfx.kill();
    deathBurst(this.game, this.x, this.z);
    this.game.onEnemyKilled(this);
    this.remove();
  }

  update(dt) {
    this.age += dt;
    if (this.spawnT > 0) {
      this.spawnT -= dt;
      this.model.group.visible = this.spawnT <= 0;
      this.syncModel();
      return;
    }
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.knockT > 0) {
      this.knockT -= dt;
      this.move(this.knockDir.x * 12 * dt, this.knockDir.z * 12 * dt, { bounds: this.bounds(), ...this.moveOpts() });
    } else if (this.stun > 0) {
      this.stun -= dt;
    } else {
      this.think(dt);
    }
    this.model.flash(this.invuln > 0, this.invuln);
    this.animate(dt);
    this.syncModel();
  }

  moveOpts() { return {}; }
  think() {}
  animate() {}
}

// Grid walker: moves between tile centres, turning randomly. Base for most ground enemies.
class Walker extends Enemy {
  constructor(game, x, z, opts) {
    super(game, x, z, opts);
    this.speed = opts.speed || 2.2;
    this.target = null;
    this.pause = rand(0, 0.6);
    this.walkT = 0;
  }

  canStep(dir) {
    const nx = Math.floor(this.x) + 0.5 + dir.x;
    const nz = Math.floor(this.z) + 0.5 + dir.z;
    return !this.game.boxBlocked(nx, nz, this.half, { bounds: this.bounds(), ...this.moveOpts() });
  }

  chooseDir() {
    const p = this.game.player;
    const options = DIR_LIST.filter((d) => this.canStep(d));
    if (!options.length) return null;
    if (options.includes(this.facing) && Math.random() < 0.55) return this.facing;
    // Some bias towards the player's row/column
    if (Math.random() < 0.3) {
      const toward = Math.abs(p.x - this.x) > Math.abs(p.z - this.z)
        ? { x: Math.sign(p.x - this.x), z: 0 } : { x: 0, z: Math.sign(p.z - this.z) };
      const match = options.find((d) => d.x === toward.x && d.z === toward.z);
      if (match) return match;
    }
    return pick(options);
  }

  think(dt) {
    if (this.pause > 0) { this.pause -= dt; this.walkT = 0; return; }
    if (!this.target) {
      const d = this.chooseDir();
      if (!d) { this.pause = 0.5; return; }
      this.facing = d;
      this.target = { x: Math.floor(this.x) + 0.5 + d.x, z: Math.floor(this.z) + 0.5 + d.z };
      // snap onto the grid line we travel along
      if (d.x) this.z = Math.floor(this.z) + 0.5; else this.x = Math.floor(this.x) + 0.5;
    }
    const dx = this.target.x - this.x, dz = this.target.z - this.z;
    const dist = Math.hypot(dx, dz);
    const step = this.speed * dt;
    this.walkT += dt;
    if (dist <= step) {
      this.x = this.target.x;
      this.z = this.target.z;
      this.target = null;
      this.atTile();
    } else {
      const r = this.move((dx / dist) * step, (dz / dist) * step, { bounds: this.bounds(), ...this.moveOpts() });
      if (r.hitX || r.hitZ) this.target = null;
    }
  }

  atTile() {}

  animate() {
    const p = this.model.parts;
    this.model.group.rotation.y = yawFor(this.facing);
    const s = Math.sin(this.walkT * 14);
    if (p.legL) { p.legL.position.z = s * 0.06; p.legR.position.z = -s * 0.06; }
    if (p.armL && p.armL.isMesh) { p.armL.rotation.x = s * 0.4; p.armR.rotation.x = -s * 0.4; }
    if (p.legs) p.legs.forEach((l, i) => { l.position.y = 0.08 + Math.max(0, Math.sin(this.walkT * 16 + i * 1.6)) * 0.05; });
    if (p.body) p.body.position.y = Math.abs(s) * 0.03;
  }
}

class Shooter extends Walker {
  constructor(game, x, z, opts, shotKind, fireChance) {
    super(game, x, z, opts);
    this.shotKind = shotKind;
    this.fireChance = fireChance;
  }

  atTile() {
    if (Math.random() < this.fireChance && this.game.enemyShotsAllowed()) {
      this.pause = 0.55;
      this.fireAt = 0.25;
    }
  }

  think(dt) {
    if (this.fireAt !== undefined) {
      this.fireAt -= dt;
      if (this.fireAt <= 0) {
        this.fireAt = undefined;
        this.fire();
      }
    }
    super.think(dt);
  }

  fire() {
    const d = this.facing;
    const speed = this.shotKind === 'spear' ? 8 : 7;
    this.game.addProjectile(new EnemyShot(this.game, this.x + d.x * 0.5, this.z + d.z * 0.5, d.x * speed, d.z * speed, this.shotKind));
  }
}

export class Octorok extends Shooter {
  constructor(game, x, z, blue = false) {
    super(game, x, z, { hp: blue ? 2 : 1, damage: 1, speed: blue ? 2.8 : 2.2 }, 'rock', 0.2);
    this.attach(M.makeOctorok(blue ? 0x3060e0 : 0xd83020));
  }
  animate(dt) {
    super.animate(dt);
    const sq = this.fireAt !== undefined ? 1 + Math.sin(this.fireAt * 40) * 0.08 : 1;
    this.model.parts.body.scale.set(sq, 1 / sq, sq);
  }
}

export class Moblin extends Shooter {
  constructor(game, x, z, blue = false) {
    super(game, x, z, { hp: blue ? 3 : 2, damage: 1, speed: 2.0 }, 'spear', 0.18);
    this.attach(M.makeMoblin(blue ? 0x4060c0 : 0xd06020));
  }
}

export class Stalfos extends Walker {
  constructor(game, x, z) {
    super(game, x, z, { hp: 2, damage: 1, speed: 2.1 });
    this.attach(M.makeStalfos());
  }
}

export class Goriya extends Walker {
  constructor(game, x, z) {
    super(game, x, z, { hp: 3, damage: 1, speed: 2.2 });
    this.attach(M.makeGoriya());
    this.rang = null;
  }
  atTile() {
    if (!this.rang && Math.random() < 0.25 && this.game.enemyShotsAllowed()) {
      this.pause = 10; // wait for it to come back
      this.rang = new Boomerang(this.game, this, this.facing, { range: 4.5, speed: 8 });
      this.game.addProjectile(this.rang);
    }
  }
  onBoomerangBack() { this.rang = null; this.pause = 0.3; }
}

export class Gel extends Walker {
  constructor(game, x, z) {
    super(game, x, z, { hp: 1, damage: 1, speed: 4, half: 0.22 });
    this.attach(M.makeGel());
  }
  atTile() { this.pause = rand(0.2, 0.9); }
  boomerangHit() { this.die(); }
  animate() {
    const moving = !!this.target && this.pause <= 0;
    const s = moving ? 1 + Math.sin(this.age * 30) * 0.15 : 1 + Math.sin(this.age * 6) * 0.05;
    this.model.parts.body.scale.set(1 / s, s, 1 / s);
  }
}

export class Tektite extends Enemy {
  constructor(game, x, z, blue = false) {
    super(game, x, z, { hp: 1, damage: 1 });
    this.attach(M.makeTektite(blue ? 0x3060e0 : 0xd83020));
    this.idle = rand(0.3, 1.2);
    this.jump = null;
  }
  think(dt) {
    if (this.jump) {
      const j = this.jump;
      j.t += dt;
      const k = Math.min(1, j.t / j.dur);
      this.x = j.fx + (j.tx - j.fx) * k;
      this.z = j.fz + (j.tz - j.fz) * k;
      this.y = Math.sin(k * Math.PI) * j.h;
      if (k >= 1) { this.jump = null; this.y = 0; this.idle = rand(0.3, 1.4); }
      return;
    }
    this.idle -= dt;
    if (this.idle > 0) return;
    const b = this.bounds();
    const p = this.game.player;
    for (let i = 0; i < 8; i++) {
      const toward = Math.random() < 0.4;
      const tx = toward ? this.x + Math.sign(p.x - this.x) * rand(1, 3) : this.x + rand(-3, 3);
      const tz = toward ? this.z + Math.sign(p.z - this.z) * rand(1, 2.5) : this.z + rand(-2.5, 2.5);
      if (tx < b.minX + this.half || tx > b.maxX - this.half || tz < b.minZ + this.half || tz > b.maxZ - this.half) continue;
      if (this.game.boxBlocked(tx, tz, this.half, { bounds: b })) continue;
      this.jump = { fx: this.x, fz: this.z, tx, tz, t: 0, dur: rand(0.45, 0.7), h: rand(0.8, 1.6) };
      this.facing = Math.abs(tx - this.x) > Math.abs(tz - this.z) ? { x: Math.sign(tx - this.x), z: 0 } : { x: 0, z: Math.sign(tz - this.z) };
      return;
    }
    this.idle = 0.3;
  }
  animate() {
    const crouch = !this.jump && this.idle < 0.25 ? 0.7 : 1;
    this.model.parts.body.position.y = 0.35 * crouch;
    this.model.parts.legs.forEach((l) => { l.rotation.z = this.jump ? 0.4 * Math.sign(l.position.x) : 0; });
  }
}

export class Leever extends Enemy {
  constructor(game, x, z) {
    super(game, x, z, { hp: 2, damage: 2 });
    this.attach(M.makeLeever());
    this.phase = 'under';
    this.phaseT = rand(0.5, 2.5);
    this.facing = pick(DIR_LIST);
    this.model.group.visible = false;
    this.spawnT = 0;
  }
  hittable() { return this.phase === 'up'; }
  touchesPlayer() { return this.phase === 'up'; }
  update(dt) {
    super.update(dt);
    this.model.group.visible = this.phase !== 'under';
  }
  think(dt) {
    this.phaseT -= dt;
    const b = this.bounds();
    if (this.phase === 'under' && this.phaseT <= 0) {
      // surface near the player's path
      const p = this.game.player;
      for (let i = 0; i < 10; i++) {
        const nx = Math.floor(p.x + p.facing.x * rand(2, 4) + rand(-2, 2)) + 0.5;
        const nz = Math.floor(p.z + p.facing.z * rand(2, 4) + rand(-2, 2)) + 0.5;
        if (nx < b.minX + 0.5 || nx > b.maxX - 0.5 || nz < b.minZ + 0.5 || nz > b.maxZ - 0.5) continue;
        if (this.game.boxBlocked(nx, nz, this.half, { bounds: b })) continue;
        if (Math.hypot(nx - p.x, nz - p.z) < 1.5) continue;
        this.x = nx; this.z = nz;
        this.phase = 'rising'; this.phaseT = 0.6;
        return;
      }
      this.phaseT = 0.5;
    } else if (this.phase === 'rising' && this.phaseT <= 0) {
      this.phase = 'up'; this.phaseT = rand(2.5, 4);
      const p = this.game.player;
      this.facing = Math.abs(p.x - this.x) > Math.abs(p.z - this.z) ? { x: Math.sign(p.x - this.x), z: 0 } : { x: 0, z: Math.sign(p.z - this.z) };
    } else if (this.phase === 'up') {
      const r = this.move(this.facing.x * 2.2 * dt, this.facing.z * 2.2 * dt, { bounds: b });
      if (r.hitX || r.hitZ) this.facing = pick(DIR_LIST);
      if (this.phaseT <= 0) { this.phase = 'sinking'; this.phaseT = 0.6; }
    } else if (this.phase === 'sinking' && this.phaseT <= 0) {
      this.phase = 'under'; this.phaseT = rand(1, 2.5);
    }
  }
  animate() {
    const body = this.model.parts.body;
    let s = 1;
    if (this.phase === 'rising') s = 1 - this.phaseT / 0.6;
    if (this.phase === 'sinking') s = this.phaseT / 0.6;
    body.scale.set(1, Math.max(0.05, s), 1);
    body.rotation.y += 0.25;
  }
}

export class Keese extends Enemy {
  constructor(game, x, z) {
    super(game, x, z, { hp: 1, damage: 1, half: 0.22 });
    this.attach(M.makeKeese());
    this.vx = 0; this.vz = 0;
    this.rest = rand(0, 1);
    this.flyT = 0;
  }
  boomerangHit() { this.die(); }
  think(dt) {
    const b = this.bounds();
    if (this.rest > 0) {
      this.rest -= dt;
      if (this.rest <= 0) this.flyT = rand(2, 4);
      return;
    }
    this.flyT -= dt;
    if (Math.random() < dt * 2.5) {
      const a = rand(0, Math.PI * 2);
      this.vx = Math.cos(a) * 3.8;
      this.vz = Math.sin(a) * 3.8;
    }
    const speedK = Math.min(1, this.flyT);
    this.x += this.vx * dt * speedK;
    this.z += this.vz * dt * speedK;
    if (this.x < b.minX + 0.3 || this.x > b.maxX - 0.3) { this.vx *= -1; this.x = Math.min(Math.max(this.x, b.minX + 0.3), b.maxX - 0.3); }
    if (this.z < b.minZ + 0.3 || this.z > b.maxZ - 0.3) { this.vz *= -1; this.z = Math.min(Math.max(this.z, b.minZ + 0.3), b.maxZ - 0.3); }
    if (this.flyT <= 0) this.rest = rand(0.5, 1.5);
  }
  animate() {
    const p = this.model.parts;
    const flying = this.rest <= 0;
    const f = flying ? Math.sin(this.age * 30) * 0.8 : 0.2;
    p.wingL.rotation.z = f;
    p.wingR.rotation.z = -f;
    p.body.position.y = flying ? 0.9 + Math.sin(this.age * 5) * 0.15 : 0.3;
    this.model.group.rotation.y = Math.atan2(this.vx, this.vz);
  }
}

export class Aquamentus extends Enemy {
  constructor(game, x, z) {
    super(game, x, z, { hp: 6, damage: 2, half: 0.75 });
    this.boss = true;
    this.attach(M.makeAquamentus());
    this.homeX = x;
    this.dir = -1;
    this.fireT = 1.5;
    this.roared = false;
  }
  boomerangHit() { sfx.shield(); }
  think(dt) {
    if (!this.roared) { this.roared = true; sfx.bossRoar(); }
    this.x += this.dir * 0.9 * dt;
    if (this.x < this.homeX - 2) this.dir = 1;
    if (this.x > this.homeX) this.dir = -1;
    this.fireT -= dt;
    if (this.fireT <= 0) {
      this.fireT = rand(1.8, 2.6);
      const p = this.game.player;
      const ox = this.x - 0.6, oz = this.z + 0.1;
      const base = Math.atan2(p.z - oz, p.x - ox);
      sfx.fireball();
      for (const off of [-0.3, 0, 0.3]) {
        const a = base + off;
        this.game.addProjectile(new EnemyShot(this.game, ox, oz, Math.cos(a) * 4.5, Math.sin(a) * 4.5, 'fireball'));
      }
      this.mouthT = 0.3;
    }
    this.mouthT = Math.max(0, (this.mouthT || 0) - dt);
  }
  die() {
    super.die();
    for (let i = 0; i < 4; i++) setTimeout(() => puff(this.game, this.x + rand(-0.8, 0.8), this.z + rand(-0.8, 0.8)), i * 120);
  }
  animate() {
    const p = this.model.parts;
    this.model.group.rotation.y = -Math.PI / 2;
    p.neck.rotation.x = Math.sin(this.age * 2) * 0.1 - (this.mouthT > 0 ? 0.3 : 0);
    p.tail.rotation.y = Math.sin(this.age * 3) * 0.3;
    p.body.position.y = Math.abs(Math.sin(this.age * 3)) * 0.04;
  }
}

export function createEnemy(game, type, x, z) {
  switch (type) {
    case 'octorok': return new Octorok(game, x, z);
    case 'octorokBlue': return new Octorok(game, x, z, true);
    case 'moblin': return new Moblin(game, x, z);
    case 'moblinBlue': return new Moblin(game, x, z, true);
    case 'tektite': return new Tektite(game, x, z);
    case 'leever': return new Leever(game, x, z);
    case 'keese': return new Keese(game, x, z);
    case 'gel': return new Gel(game, x, z);
    case 'stalfos': return new Stalfos(game, x, z);
    case 'goriya': return new Goriya(game, x, z);
    case 'aquamentus': return new Aquamentus(game, x, z);
    default: throw new Error(`unknown enemy ${type}`);
  }
}
