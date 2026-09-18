import { Entity } from './base.js';
import { makeRock, makeArrow, makeFireball, makeBoomerang, makeBeam, makeBombEntity } from '../render/models.js';
import { yawFor } from '../engine/util.js';
import { sfx } from '../engine/audio.js';
import { explosion, sparkle, Particles } from './effects.js';

// Enemy projectile (rock, spear, fireball)
export class EnemyShot extends Entity {
  constructor(game, x, z, vx, vz, kind) {
    super(game, x, z);
    this.vx = vx;
    this.vz = vz;
    this.kind = kind;
    this.half = kind === 'fireball' ? 0.2 : 0.15;
    this.damage = kind === 'fireball' ? 2 : 1;
    this.blockable = kind !== 'fireball';
    this.hostile = true;
    this.attach(kind === 'rock' ? makeRock() : kind === 'spear' ? makeArrow() : makeFireball());
    this.model.group.rotation.y = Math.atan2(vx, vz);
  }

  update(dt) {
    this.age += dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    const g = this.game;
    if (this.model.parts.spin) this.model.parts.spin.rotation.set(this.age * 9, this.age * 7, 0);
    if (!g.inScreen(this.x, this.z, -0.3) || (this.kind !== 'fireball' && g.pointSolid(this.x, this.z, true))) {
      this.remove();
      return;
    }
    const p = g.player;
    if (p.overlaps(this.x, this.z, this.half)) {
      if (this.blockable && p.shieldBlocks(this.vx, this.vz)) {
        sfx.shield();
        sparkle(g, this.x, this.z);
        this.remove();
        return;
      }
      g.hurtPlayer(this.damage, this.x - this.vx, this.z - this.vz);
      this.remove();
      return;
    }
    this.syncModel();
  }
}

// Boomerang (player or goriya)
export class Boomerang extends Entity {
  constructor(game, owner, dir, { range = 5, speed = 11, player = false } = {}) {
    super(game, owner.x + dir.x * 0.5, owner.z + dir.z * 0.5);
    this.owner = owner;
    this.dir = dir;
    this.range = range;
    this.speed = speed;
    this.traveled = 0;
    this.returning = false;
    this.fromPlayer = player;
    this.hostile = !player;
    this.half = 0.22;
    this.carrying = [];
    this.hitSet = new Set();
    this.attach(makeBoomerang(player ? 0xa06020 : 0xd04020));
  }

  update(dt) {
    this.age += dt;
    const g = this.game;
    this.model.parts.spin.rotation.y += dt * 22;
    if (this.fromPlayer && Math.floor(this.age * 8) !== Math.floor((this.age - dt) * 8)) sfx.boomerang();
    if (!this.returning) {
      const step = this.speed * dt;
      this.x += this.dir.x * step;
      this.z += this.dir.z * step;
      this.traveled += step;
      if (this.traveled >= this.range || g.pointSolid(this.x, this.z, true) || !g.inScreen(this.x, this.z, 0)) {
        if (g.pointSolid(this.x, this.z, true)) sparkle(g, this.x, this.z);
        this.returning = true;
      }
    } else {
      if (this.owner.dead) { this.remove(); return; }
      const dx = this.owner.x - this.x, dz = this.owner.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.35) {
        for (const item of this.carrying) if (!item.dead) item.collect();
        this.remove();
        if (this.owner.onBoomerangBack) this.owner.onBoomerangBack();
        return;
      }
      const step = Math.min(d, this.speed * dt);
      this.x += (dx / d) * step;
      this.z += (dz / d) * step;
    }
    if (this.fromPlayer) {
      for (const e of g.enemies) {
        if (e.dead || this.hitSet.has(e) || !e.hittable()) continue;
        if (e.overlaps(this.x, this.z, this.half)) {
          this.hitSet.add(e);
          e.boomerangHit(this.dir);
          this.returning = true;
        }
      }
      for (const item of g.pickups) {
        if (item.dead || item.price || this.carrying.includes(item)) continue;
        if (Math.abs(item.x - this.x) < 0.45 && Math.abs(item.z - this.z) < 0.45) this.carrying.push(item);
      }
      for (const item of this.carrying) { if (!item.dead) { item.x = this.x; item.z = this.z; } }
    } else {
      const p = g.player;
      if (p.overlaps(this.x, this.z, this.half)) {
        const vx = this.returning ? this.owner.x - this.x : this.dir.x;
        const vz = this.returning ? this.owner.z - this.z : this.dir.z;
        if (p.shieldBlocks(vx, vz)) { sfx.shield(); this.returning = true; }
        else { g.hurtPlayer(1, this.x - vx, this.z - vz); this.returning = true; }
      }
    }
    this.syncModel();
  }
}

export class SwordBeam extends Entity {
  constructor(game, x, z, dir) {
    super(game, x + dir.x * 0.8, z + dir.z * 0.8);
    this.dir = dir;
    this.half = 0.25;
    this.attach(makeBeam());
    this.model.group.rotation.y = yawFor(dir);
    sfx.beam();
  }

  update(dt) {
    this.age += dt;
    const g = this.game;
    this.x += this.dir.x * 13 * dt;
    this.z += this.dir.z * 13 * dt;
    this.model.flash(true, this.age);
    if (!g.inScreen(this.x, this.z, 0.2) || g.pointSolid(this.x, this.z, true)) { this.burst(); return; }
    for (const e of g.enemies) {
      if (e.dead || !e.hittable()) continue;
      if (e.overlaps(this.x, this.z, this.half)) { e.hurt(1, this.dir); this.burst(); return; }
    }
    this.syncModel();
  }

  burst() {
    this.game.addEffect(new Particles(this.game, this.x, this.z, { count: 8, colors: [0xffffff, 0x80c0ff, 0xff80ff], speed: 3, life: 0.35, size: 0.1 }));
    this.remove();
  }
}

export class Bomb extends Entity {
  constructor(game, x, z) {
    super(game, x, z);
    this.fuse = 1.2;
    this.attach(makeBombEntity());
    sfx.bombPlace();
  }

  update(dt) {
    this.age += dt;
    const fuse = this.model.parts.fuse;
    if (fuse) fuse.visible = Math.floor(this.age * 12) % 2 === 0;
    const s = 1 + Math.max(0, this.age - this.fuse + 0.4) * 0.6;
    this.model.group.scale.setScalar(s);
    if (this.age >= this.fuse) {
      const g = this.game;
      sfx.explode();
      explosion(g, this.x, this.z);
      g.shake(0.3);
      for (const e of g.enemies) {
        if (!e.dead && e.hittable() && Math.hypot(e.x - this.x, e.z - this.z) < 1.7) {
          const dx = e.x - this.x, dz = e.z - this.z;
          const dir = Math.abs(dx) > Math.abs(dz) ? { x: Math.sign(dx) || 1, z: 0 } : { x: 0, z: Math.sign(dz) || 1 };
          e.hurt(4, dir, 'bomb');
        }
      }
      g.bombBlast(this.x, this.z);
      this.remove();
      return;
    }
    this.syncModel();
  }
}
