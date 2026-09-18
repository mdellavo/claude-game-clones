import * as THREE from 'three';
import { Entity } from './base.js';
import { rand } from '../engine/util.js';

const cube = new THREE.BoxGeometry(1, 1, 1);

// Burst of voxel particles. Used for spawn puffs, deaths, explosions, sparkles.
export class Particles extends Entity {
  constructor(game, x, z, { count = 10, colors = [0xffffff], speed = 3, life = 0.5, size = 0.12, y = 0.4, gravity = 0, up = 1 } = {}) {
    super(game, x, z);
    this.life = life;
    this.gravity = gravity;
    this.group = new THREE.Group();
    this.parts = [];
    this.mats = [];
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true });
      this.mats.push(mat);
      const m = new THREE.Mesh(cube, mat);
      const s = size * rand(0.6, 1.4);
      m.scale.set(s, s, s);
      m.position.set(x, y, z);
      const a = rand(0, Math.PI * 2);
      const sp = speed * rand(0.4, 1);
      m.userData.v = new THREE.Vector3(Math.cos(a) * sp, rand(0.2, 1) * speed * up, Math.sin(a) * sp);
      this.parts.push(m);
      this.group.add(m);
    }
    game.scene.add(this.group);
  }

  update(dt) {
    this.age += dt;
    const k = this.age / this.life;
    for (const m of this.parts) {
      m.userData.v.y -= this.gravity * dt;
      m.position.addScaledVector(m.userData.v, dt);
      m.rotation.x += dt * 5;
      m.rotation.y += dt * 4;
    }
    for (const mat of this.mats) mat.opacity = Math.max(0, 1 - k * k);
    if (k >= 1) this.remove();
  }

  remove() {
    this.dead = true;
    this.game.scene.remove(this.group);
    for (const mat of this.mats) mat.dispose();
  }
}

export function puff(game, x, z) {
  game.addEffect(new Particles(game, x, z, { count: 12, colors: [0xffffff, 0xd0d0ff, 0xa0a0c0], speed: 2.2, life: 0.45, size: 0.16 }));
}

export function deathBurst(game, x, z) {
  game.addEffect(new Particles(game, x, z, { count: 16, colors: [0xffffff, 0xff4040, 0x4080ff, 0xffe040], speed: 4, life: 0.5, size: 0.12 }));
}

export function explosion(game, x, z) {
  game.addEffect(new Particles(game, x, z, { count: 30, colors: [0xffffff, 0xffe060, 0xff8020, 0x606060], speed: 5, life: 0.7, size: 0.22, gravity: 4 }));
  const light = new THREE.PointLight(0xffa040, 12, 8, 1.5);
  light.position.set(x, 1, z);
  game.scene.add(light);
  game.addEffect({ dead: false, t: 0, update(dt) { this.t += dt; light.intensity = 12 * (1 - this.t / 0.4); if (this.t > 0.4) this.remove(); }, remove() { this.dead = true; game.scene.remove(light); } });
}

export function sparkle(game, x, z, color = 0xffffff) {
  game.addEffect(new Particles(game, x, z, { count: 6, colors: [color, 0xffffff], speed: 1.5, life: 0.3, size: 0.08, y: 0.5 }));
}
