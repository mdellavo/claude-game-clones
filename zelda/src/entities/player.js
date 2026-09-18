import { Entity } from './base.js';
import { makeLink, makeItem } from '../render/models.js';
import { DIRS, yawFor, clamp } from '../engine/util.js';
import { sfx } from '../engine/audio.js';
import { SwordBeam, Boomerang, Bomb } from './projectiles.js';

const SPEED = 5.2;
const ATTACK_TIME = 0.28;

export class Player extends Entity {
  constructor(game, x, z) {
    super(game, x, z);
    this.half = 0.34;
    this.facing = DIRS.up;
    this.maxHp = 6; // half-hearts
    this.hp = 6;
    this.rupees = 0;
    this.keys = 0;
    this.bombs = 0;
    this.maxBombs = 8;
    this.hasSword = false;
    this.hasBoomerang = false;
    this.triforce = 0;
    this.bItem = null;
    this.reset();
    this.attach(makeLink());
  }

  reset() {
    this.state = 'normal';
    this.attackT = 0;
    this.iframes = 0;
    this.knockT = 0;
    this.knockDir = null;
    this.walkT = 0;
    this.moving = false;
    this.holdT = 0;
    this.dieT = 0;
    this.beam = null;
    this.boomerang = null;
    this.autoWalk = null;
    this.clearHeld();
  }

  addRupees(n) { this.rupees = clamp(this.rupees + n, 0, 255); }
  addBombs(n) {
    this.bombs = clamp(this.bombs + n, 0, this.maxBombs);
    if (!this.bItem) this.bItem = 'bomb';
  }
  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  overlaps(x, z, half) {
    return Math.abs(this.x - x) < this.half + half && Math.abs(this.z - z) < this.half + half;
  }

  // Shield blocks shots coming at Link's face while he isn't swinging.
  shieldBlocks(vx, vz) {
    if (this.state !== 'normal') return false;
    const len = Math.hypot(vx, vz) || 1;
    return (vx / len) * this.facing.x + (vz / len) * this.facing.z < -0.7;
  }

  holdItem(kind, duration) {
    this.clearHeld();
    this.state = 'hold';
    this.holdT = duration;
    this.held = makeItem(kind);
    this.model.parts.holdAnchor.add(this.held.group);
    this.game.freeze(duration);
  }

  clearHeld() {
    if (this.held && this.model) {
      this.model.parts.holdAnchor.remove(this.held.group);
      this.held.dispose();
    }
    this.held = null;
  }

  startKnockback(fromX, fromZ) {
    const dx = this.x - fromX, dz = this.z - fromZ;
    this.knockDir = Math.abs(dx) > Math.abs(dz) ? { x: Math.sign(dx) || 1, z: 0 } : { x: 0, z: Math.sign(dz) || 1 };
    this.knockT = 0.18;
    this.iframes = 1.1;
    if (this.state === 'attack') this.endAttack();
  }

  endAttack() {
    this.state = 'normal';
    this.model.parts.sword.visible = false;
  }

  update(dt, input) {
    const g = this.game;
    const parts = this.model.parts;
    this.iframes = Math.max(0, this.iframes - dt);

    if (this.state === 'dying') {
      this.dieT += dt;
      this.model.group.rotation.y += dt * (6 + this.dieT * 10);
      this.model.flash(this.dieT < 1.2, this.dieT);
      if (this.dieT > 1.4) this.model.group.scale.setScalar(Math.max(0.01, 1 - (this.dieT - 1.4) * 2));
      this.syncModel();
      return;
    }

    if (this.state === 'hold') {
      this.holdT -= dt;
      parts.armL.rotation.x = Math.PI;
      parts.armR.rotation.x = Math.PI;
      this.model.group.rotation.y = 0;
      if (this.held) this.held.parts.spin && (this.held.parts.spin.rotation.y += dt * 2);
      if (this.holdT <= 0) {
        this.clearHeld();
        this.state = 'normal';
        parts.armL.rotation.x = 0;
        parts.armR.rotation.x = 0;
      }
      this.syncModel();
      return;
    }

    if (this.knockT > 0) {
      this.knockT -= dt;
      this.move(this.knockDir.x * 13 * dt, this.knockDir.z * 13 * dt, { player: true });
    }

    let moveDir = null;
    if (this.autoWalk) {
      moveDir = this.autoWalk.dir;
      this.autoWalk.dist -= SPEED * dt;
      if (this.autoWalk.dist <= 0) this.autoWalk = null;
    } else if (this.state === 'normal' && this.knockT <= 0) {
      const d = g.inputDirection(input);
      if (d) moveDir = d;

      if (input.pressed('a') && this.hasSword) this.startAttack();
      else if (input.pressed('b')) this.useItem();
    }

    this.moving = false;
    if (moveDir && this.state === 'normal') {
      this.facing = moveDir;
      const step = SPEED * dt;
      const dx = moveDir.x * step, dz = moveDir.z * step;
      // Align to the half-tile grid on the perpendicular axis (NES-style)
      if (dx && !this.autoWalk) this.alignAxis('z', step);
      if (dz && !this.autoWalk) this.alignAxis('x', step);
      if (this.autoWalk) {
        this.x += dx;
        this.z += dz;
      } else {
        const r = this.move(dx, dz, { player: true });
        if (r.hitX || r.hitZ) {
          g.tryOpenDoor(this.x + moveDir.x * (this.half + 0.2), this.z + moveDir.z * (this.half + 0.2));
          this.cornerSlide(moveDir, step);
        }
      }
      this.moving = true;
      this.walkT += dt;
    }

    if (this.state === 'attack') {
      this.attackT += dt;
      const k = this.attackT / ATTACK_TIME;
      parts.sword.visible = true;
      parts.sword.rotation.y = k < 0.35 ? -1.6 + (k / 0.35) * 1.6 : 0;
      parts.sword.position.z = 0.05 + (k < 0.6 ? Math.min(1, k * 3) * 0.2 : 0.2 * (1 - (k - 0.6) / 0.4));
      parts.armR.rotation.x = -1.4;
      parts.body.position.z = 0.08 * Math.sin(Math.min(1, k) * Math.PI);
      if (k > 0.1 && k < 0.8) g.swordHitCheck(this.swordBox());
      if (this.attackT >= ATTACK_TIME) {
        this.endAttack();
        parts.armR.rotation.x = 0;
        parts.body.position.z = 0;
      }
    }

    // Walk animation
    const swing = this.moving ? Math.sin(this.walkT * 16) : 0;
    parts.legL.position.y = 0.11 + Math.max(0, swing) * 0.06;
    parts.legR.position.y = 0.11 + Math.max(0, -swing) * 0.06;
    parts.legL.position.z = swing * 0.06;
    parts.legR.position.z = -swing * 0.06;
    if (this.state !== 'attack') parts.armR.rotation.x = -swing * 0.5;
    parts.armL.rotation.x = swing * 0.3;
    parts.body.position.y = this.moving ? Math.abs(swing) * 0.03 : 0;
    parts.capTail.rotation.x = 0.25 + (this.moving ? Math.abs(swing) * 0.25 : 0);
    parts.shield.position.x = this.state === 'attack' ? -0.3 : -0.2;
    parts.shield.rotation.y = this.state === 'attack' ? -1.2 : 0;

    this.model.group.rotation.y = yawFor(this.facing);
    this.model.flash(this.iframes > 0 && this.iframes > 0.1, this.iframes);
    this.model.group.visible = true;
    this.syncModel();
  }

  alignAxis(axis, step) {
    const v = this[axis];
    const target = Math.round(v * 2) / 2;
    const diff = target - v;
    if (Math.abs(diff) < 1e-4) return;
    const s = Math.sign(diff) * Math.min(Math.abs(diff), step * 0.6);
    const nx = axis === 'x' ? this.x + s : this.x;
    const nz = axis === 'z' ? this.z + s : this.z;
    if (!this.game.boxBlocked(nx, nz, this.half, { player: true })) {
      this.x = nx;
      this.z = nz;
    }
  }

  // If only a corner catches, slide around it
  cornerSlide(dir, step) {
    const g = this.game;
    const perp = dir.x ? 'z' : 'x';
    for (let s = 0.05; s <= 0.5; s += 0.05) {
      for (const sign of [1, -1]) {
        const off = s * sign;
        const px = perp === 'x' ? this.x + off : this.x;
        const pz = perp === 'z' ? this.z + off : this.z;
        if (!g.boxBlocked(px + dir.x * step, pz + dir.z * step, this.half, { player: true }) &&
            !g.boxBlocked(px, pz, this.half, { player: true })) {
          const m = Math.min(s, step) * sign;
          this.move(perp === 'x' ? m : 0, perp === 'z' ? m : 0, { player: true });
          return;
        }
      }
    }
  }

  startAttack() {
    this.state = 'attack';
    this.attackT = 0;
    sfx.sword();
    if (this.hp >= this.maxHp && (!this.beam || this.beam.dead)) {
      this.beam = new SwordBeam(this.game, this.x, this.z, this.facing);
      this.game.addProjectile(this.beam);
    }
  }

  swordBox() {
    const f = this.facing;
    const reach = 0.95;
    return {
      x: this.x + f.x * reach,
      z: this.z + f.z * reach,
      hx: f.x ? 0.5 : 0.2,
      hz: f.z ? 0.5 : 0.2,
      dir: f,
    };
  }

  useItem() {
    const g = this.game;
    if (this.bItem === 'boomerang' && this.hasBoomerang) {
      if (this.boomerang && !this.boomerang.dead) return;
      this.boomerang = new Boomerang(g, this, this.facing, { player: true, range: 5, speed: 12 });
      g.addProjectile(this.boomerang);
    } else if (this.bItem === 'bomb' && this.bombs > 0) {
      if (g.projectiles.some((p) => p instanceof Bomb && !p.dead)) return;
      const bx = this.x + this.facing.x * 0.9, bz = this.z + this.facing.z * 0.9;
      this.bombs--;
      g.addProjectile(new Bomb(g, bx, bz));
    }
  }
}
