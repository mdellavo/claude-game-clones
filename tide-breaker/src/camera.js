import * as THREE from 'three';
import { clamp, lerp, wrapAngle } from './noise.js';

const MODES = [
  { dist: 7.5, height: 2.7, look: 1.2 },
  { dist: 11.5, height: 4.0, look: 1.4 },
  { dist: 4.6, height: 1.8, look: 1.0 },
];

export class ChaseCamera {
  constructor(camera) {
    this.cam = camera;
    this.mode = 0;
    this.hdg = 0;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.baseFov = 64;
    this.orbitA = 0;
  }

  cycle() {
    this.mode = (this.mode + 1) % MODES.length;
  }

  snap(craft) {
    this.hdg = craft.yaw;
    const m = MODES[this.mode];
    this.pos.set(craft.pos.x - Math.sin(craft.yaw) * m.dist, craft.pos.y + m.height, craft.pos.z - Math.cos(craft.yaw) * m.dist);
    this.look.copy(craft.pos);
  }

  setFov(f) {
    if (Math.abs(this.cam.fov - f) > 0.05) {
      this.cam.fov = f;
      this.cam.updateProjectionMatrix();
    }
  }

  follow(craft, dt, world, t) {
    const m = MODES[this.mode];
    const k = Math.min(1, dt * (craft.airborne ? 2.2 : 3.6));
    let target = craft.yaw;
    if (craft.crashTime > 0) target = this.hdg;
    this.hdg += wrapAngle(target - this.hdg) * k;
    const fx = Math.sin(this.hdg), fz = Math.cos(this.hdg);
    const dx = craft.pos.x - fx * m.dist, dz = craft.pos.z - fz * m.dist;
    const dy = craft.pos.y + m.height;
    const kp = Math.min(1, dt * 12);
    this.pos.x = lerp(this.pos.x, dx, kp);
    this.pos.z = lerp(this.pos.z, dz, kp);
    this.pos.y = lerp(this.pos.y, dy, Math.min(1, dt * 5));
    this.pos.y = Math.max(this.pos.y, world.waterHeight(this.pos.x, this.pos.z, t) + 0.8, world.terrainHeight(this.pos.x, this.pos.z) + 1.0);
    const lx = craft.pos.x + fx * 3, lz = craft.pos.z + fz * 3, ly = craft.pos.y + m.look;
    const kl = Math.min(1, dt * 14);
    this.look.set(lerp(this.look.x, lx, kl), lerp(this.look.y, ly, Math.min(1, dt * 7)), lerp(this.look.z, lz, kl));
    this.cam.position.copy(this.pos);
    this.cam.lookAt(this.look);
    this.setFov(this.baseFov + clamp(craft.speed / 30, 0, 1) * 10 + (craft.boostTime > 0 ? 4 : 0));
  }

  orbit(craft, dt, world, t, radius = 13) {
    this.orbitA += dt * 0.25;
    const x = craft.pos.x + Math.cos(this.orbitA) * radius;
    const z = craft.pos.z + Math.sin(this.orbitA) * radius;
    const y = Math.max(craft.pos.y + 3.5 + Math.sin(t * 0.3) * 1.5, world.waterHeight(x, z, t) + 1);
    this.pos.set(x, y, z);
    this.look.set(craft.pos.x, craft.pos.y + 1, craft.pos.z);
    this.cam.position.copy(this.pos);
    this.cam.lookAt(this.look);
    this.setFov(this.baseFov);
  }
}
