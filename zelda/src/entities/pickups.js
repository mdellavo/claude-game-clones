import { Entity } from './base.js';
import { makeItem, makeTextSprite } from '../render/models.js';
import { sfx } from '../engine/audio.js';
import { sparkle } from './effects.js';

// Items the player holds overhead when collected.
const HOLD = new Set(['sword', 'boomerang', 'heartContainer', 'triforce', 'rupeeGift']);

export class Pickup extends Entity {
  constructor(game, x, z, spec, { life = 0, price = 0, onTaken = null } = {}) {
    super(game, x, z);
    this.kind = spec.kind;
    this.spec = spec;
    this.half = 0.3;
    this.life = life; // 0 = permanent
    this.price = price;
    this.onTaken = onTaken;
    this.carried = false; // boomerang fetch
    this.attach(makeItem(this.kind));
    if (price) {
      this.label = makeTextSprite(String(price), { scale: 0.32 });
      this.label.position.set(0, -0.05, 0.55);
      this.model.group.add(this.label);
    }
    if (spec.kind === 'rupeeGift' && spec.amount && !price) {
      this.label = makeTextSprite(String(spec.amount), { scale: 0.32, color: '#ffe060' });
      this.label.position.set(0, -0.05, 0.55);
      this.model.group.add(this.label);
    }
  }

  update(dt) {
    this.age += dt;
    const spin = this.model.parts.spin;
    if (spin) {
      spin.rotation.y += dt * 2.2;
      spin.position.y = (this.kind === 'triforce' ? 0.6 : 0.35) + Math.sin(this.age * 3) * 0.06;
    }
    if (this.life) {
      const left = this.life - this.age;
      this.model.group.visible = left > 2 || Math.floor(left * 10) % 2 === 0;
      if (left <= 0) { this.remove(); return; }
    }
    this.syncModel();
  }

  collect() {
    const g = this.game;
    const p = g.player;
    if (this.price) {
      if (p.rupees < this.price) { sfx.hurt(); g.ui.say('NOT ENOUGH RUPEES!'); return false; }
      p.rupees -= this.price;
    }
    switch (this.kind) {
      case 'rupee': p.addRupees(1); sfx.rupee(); break;
      case 'rupee5': p.addRupees(5); sfx.rupee(); break;
      case 'rupeeGift': p.addRupees(this.spec.amount || 20); break;
      case 'heart': p.heal(2); sfx.heart(); break;
      case 'heartRefill': p.heal(99); sfx.heart(); break;
      case 'key': p.keys++; sfx.item(); break;
      case 'bomb': p.addBombs(4); sfx.heart(); break;
      case 'bombs': p.addBombs(4); sfx.item(); break;
      case 'sword': p.hasSword = true; break;
      case 'boomerang': p.hasBoomerang = true; if (!p.bItem) p.bItem = 'boomerang'; break;
      case 'heartContainer': p.maxHp += 2; p.hp = p.maxHp; break;
      case 'triforce': p.triforce++; break;
    }
    if (HOLD.has(this.kind)) {
      p.holdItem(this.kind, this.kind === 'triforce' ? 4.5 : 1.3);
      if (this.kind === 'triforce') sfx.fanfare();
      else sfx.item();
    }
    sparkle(g, this.x, this.z, 0xffff80);
    if (this.onTaken) this.onTaken(this);
    this.remove();
    return true;
  }
}

// Random enemy drop table
export function rollDrop() {
  const r = Math.random();
  if (r < 0.25) return 'rupee';
  if (r < 0.32) return 'rupee5';
  if (r < 0.5) return 'heart';
  if (r < 0.56) return 'bomb';
  return null;
}
