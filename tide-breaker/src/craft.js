import * as THREE from 'three';
import { clamp, lerp } from './noise.js';

export const GRAVITY = 16;
const NO_INPUT = { steer: 0, throttle: 0, leanFwd: 0, leanBack: 0, stunt: 0 };
const TAU = Math.PI * 2;

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.05, ...extra });
}

function hullShape(scale = 1) {
  const s = new THREE.Shape();
  const p = (x, y) => [x * scale, y * scale];
  s.moveTo(...p(0, 1.8));
  s.bezierCurveTo(...p(0.45, 1.5), ...p(0.64, 0.8), ...p(0.64, 0.1));
  s.lineTo(...p(0.58, -1.12));
  s.quadraticCurveTo(...p(0.54, -1.3), ...p(0.32, -1.3));
  s.lineTo(...p(-0.32, -1.3));
  s.quadraticCurveTo(...p(-0.54, -1.3), ...p(-0.58, -1.12));
  s.lineTo(...p(-0.64, 0.1));
  s.bezierCurveTo(...p(-0.64, 0.8), ...p(-0.45, 1.5), ...p(0, 1.8));
  return s;
}

export function buildCraftMesh(r) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.45;
  root.add(body);

  const hullGeo = new THREE.ExtrudeGeometry(hullShape(), { depth: 0.36, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3, curveSegments: 12 });
  hullGeo.rotateX(Math.PI / 2);
  hullGeo.translate(0, 0.05, 0);
  const hull = new THREE.Mesh(hullGeo, std(r.hull, { roughness: 0.25 }));
  body.add(hull);

  const deckGeo = new THREE.ExtrudeGeometry(hullShape(0.82), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 10 });
  deckGeo.rotateX(Math.PI / 2);
  deckGeo.translate(0, 0.27, -0.05);
  body.add(new THREE.Mesh(deckGeo, std(r.trim, { roughness: 0.3 })));

  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), std(r.hull, { roughness: 0.25 }));
  hood.scale.set(0.85, 0.42, 1.25);
  hood.position.set(0, 0.28, 0.75);
  body.add(hood);

  const dark = std(0x1c1c22, { roughness: 0.7 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 1.15), dark);
  seat.position.set(0, 0.36, -0.5);
  body.add(seat);
  const column = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), dark);
  column.position.set(0, 0.52, 0.3);
  column.rotation.x = -0.45;
  body.add(column);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 8), std(0x999999, { metalness: 0.8, roughness: 0.3 }));
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.76, 0.22);
  body.add(bar);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.3, 10), dark);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, -0.18, -1.36);
  body.add(nozzle);
  for (const sx of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 1.9), std(r.trim));
    stripe.position.set(sx * 0.7, -0.1, 0.05);
    stripe.rotation.y = sx * 0.04;
    body.add(stripe);
  }

  // Rider
  const rider = new THREE.Group();
  rider.position.set(0, 0.42, -0.42);
  body.add(rider);
  const suit = std(r.suit, { roughness: 0.6 });
  for (const sx of [-1, 1]) {
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.42, 4, 8), suit);
    thigh.position.set(sx * 0.17, 0.12, 0.2);
    thigh.rotation.x = Math.PI / 2 - 0.25;
    rider.add(thigh);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.4, 4, 8), suit);
    shin.position.set(sx * 0.3, -0.1, 0.35);
    shin.rotation.x = 0.35;
    rider.add(shin);
  }
  const upper = new THREE.Group();
  upper.position.set(0, 0.15, 0);
  rider.add(upper);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 4, 10), suit);
  torso.position.y = 0.38;
  upper.add(torso);
  const vest = new THREE.Mesh(new THREE.CapsuleGeometry(0.235, 0.26, 4, 10), std(r.hull, { roughness: 0.55 }));
  vest.position.y = 0.44;
  vest.scale.set(1.05, 1, 0.9);
  upper.add(vest);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), std(r.helmet, { roughness: 0.2 }));
  helmet.position.set(0, 0.92, 0.02);
  upper.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 8, -1.1, 2.2, 1.1, 0.7), std(r.visor, { roughness: 0.05, metalness: 0.6 }));
  visor.position.set(0, 0.93, 0.07);
  visor.rotation.y = 0;
  upper.add(visor);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.24, 0.7, 0.02);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.55, 4, 8), suit);
    a.position.z = 0.32;
    a.rotation.x = Math.PI / 2;
    arm.add(a);
    arm.rotation.set(0.75, -sx * 0.22, 0);
    upper.add(arm);
  }

  root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { root, body, rider, upper };
}

export class Craft {
  constructor(world, rider) {
    this.world = world;
    this.rider = rider;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.yawRate = 0;
    this.pitch = 0;
    this.roll = 0;
    this.trickPitch = 0;
    this.trickRoll = 0;
    this.trick = null;
    this.tricksDone = [];
    this.airborne = false;
    this.airTime = 0;
    this.contact = true;
    this.power = 0;
    this.boostTime = 0;
    this.speedMul = 1;
    this.crashTime = 0;
    this.frozen = true;
    this.coast = false;
    this.input = { ...NO_INPUT };
    this.events = [];
    this.fwdSpeed = 0;
    this.latSpeed = 0;
    this.leanVis = 0;
    this.steerVis = 0;
    this.mesh = buildCraftMesh(rider);
  }

  place(x, z, yaw, t) {
    this.pos.set(x, this.world.waterHeight(x, z, t) - 0.22, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.yawRate = 0;
    this.pitch = this.roll = this.trickPitch = this.trickRoll = 0;
    this.trick = null;
    this.tricksDone = [];
    this.airborne = false;
    this.airTime = 0;
    this.crashTime = 0;
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  maxSpeed() {
    return this.rider.top * (1 + 0.05 * this.power) * (this.boostTime > 0 ? 1.14 : 1) * this.speedMul;
  }

  crash() {
    if (this.crashTime > 0) return;
    this.crashTime = 1.7;
    this.vel.x *= 0.25;
    this.vel.z *= 0.25;
    this.trick = null;
    this.tricksDone = [];
    this.trickPitch = this.trickRoll = 0;
    this.power = Math.max(0, this.power - 2);
    this.events.push({ type: 'crash' });
  }

  step(dt, t) {
    const W = this.world, r = this.rider;
    const crashed = this.crashTime > 0;
    if (crashed) this.crashTime -= dt;
    const inp = crashed ? NO_INPUT : this.coast ? { ...this.input, throttle: this.input.throttle * 0.5, stunt: 0 } : this.input;
    if (this.boostTime > 0) this.boostTime -= dt;

    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fx = sy, fz = cy, rx = -cy, rz = sy;
    const px = this.pos.x, pz = this.pos.z;
    const e = 0.9;
    const h0 = W.waterHeight(px, pz, t);
    const gx = (W.waterHeight(px + e, pz, t) - W.waterHeight(px - e, pz, t)) / (2 * e);
    const gz = (W.waterHeight(px, pz + e, t) - W.waterHeight(px, pz - e, t)) / (2 * e);
    const slopeF = gx * fx + gz * fz;
    const slopeR = gx * rx + gz * rz;

    if (this.frozen) {
      this.pos.y = lerp(this.pos.y, h0 - 0.22, Math.min(1, dt * 10));
      this.vel.set(0, 0, 0);
      this.pitch = lerp(this.pitch, Math.atan(slopeF) + inp.throttle * 0.04, Math.min(1, dt * 6));
      this.roll = lerp(this.roll, -Math.atan(slopeR), Math.min(1, dt * 6));
      this.fwdSpeed = 0;
      return;
    }

    // Jump ramps
    const ramp = W.rampAt(px, pz);
    let surf = h0, onRamp = false, surfSlopeF = slopeF;
    if (ramp) {
      if (this.pos.y > ramp.h - 1.0 && this.pos.y <= ramp.h + 0.08) {
        onRamp = true;
        surf = ramp.h;
        surfSlopeF = ramp.slope * (fx * ramp.dx + fz * ramp.dz);
      } else if (this.pos.y < ramp.h - 1.0) {
        // Hit the side of the ramp.
        const push = Math.sign(ramp.lx) * (ramp.halfW - Math.abs(ramp.lx) + 0.05);
        this.pos.x += ramp.rx * push;
        this.pos.z += ramp.rz * push;
        const into = this.vel.x * ramp.rx * Math.sign(-ramp.lx) + this.vel.z * ramp.rz * Math.sign(-ramp.lx);
        if (into > 0) {
          this.vel.x += ramp.rx * Math.sign(ramp.lx) * into * 1.3;
          this.vel.z += ramp.rz * Math.sign(ramp.lx) * into * 1.3;
        }
      }
    }

    const depth = surf - this.pos.y;
    const hs = this.vel.x * fx + this.vel.z * fz;
    const ls = this.vel.x * rx + this.vel.z * rz;
    this.fwdSpeed = hs;
    this.latSpeed = ls;
    let ax = 0, ay = -GRAVITY, az = 0;
    const contact = onRamp || depth > 0;
    const wasAir = this.airborne;

    if (contact) {
      if (onRamp) {
        this.pos.y = surf;
        const vyRamp = hs * surfSlopeF;
        if (this.vel.y < vyRamp) this.vel.y = vyRamp;
        ay = 0;
      } else {
        const sv = (W.waterHeight(px + this.vel.x * 0.05, pz + this.vel.z * 0.05, t + 0.05) - h0) / 0.05;
        const plane = clamp(Math.abs(hs) / 20, 0, 1);
        const dd = Math.min(depth, 1.4);
        ay += 70 * dd + GRAVITY * 0.3 * plane - 9 * (this.vel.y - sv);
        if (inp.leanBack && this.vel.y > 0) ay += 6;
        if (inp.leanFwd) ay -= 3;
        if (depth > 1.6) this.pos.y = surf - 1.6;
      }

      const max = this.maxSpeed();
      let aF = inp.throttle * r.accel * clamp(1 - hs / max, -1.5, 1);
      aF -= hs * (inp.throttle ? 0.02 : 0.4);
      if (inp.leanBack) aF -= hs * 0.04;
      aF -= GRAVITY * 0.45 * clamp(surfSlopeF, -0.5, 0.5);
      const grip = r.grip * (inp.leanFwd ? 1.45 : 1) * (inp.leanBack ? 0.7 : 1);
      let aL = -ls * grip;
      const th = W.terrainHeight(px, pz);
      if (th > h0 - 0.6) {
        aF -= hs * 2.5;
        aL -= ls * 2;
      }
      ax += fx * aF + rx * aL;
      az += fz * aF + rz * aL;

      const sp = Math.abs(hs);
      const sf = clamp(sp / 7, 0.3, 1) * (1 - 0.28 * clamp((sp - 18) / 12, 0, 1));
      const target = -inp.steer * r.handling * sf * (inp.leanFwd ? 1.35 : 1) * (inp.leanBack ? 0.8 : 1) * (hs < -1 ? -1 : 1);
      this.yawRate = lerp(this.yawRate, crashed ? 2.2 : target, Math.min(1, dt * 7));
      this.airborne = false;
    } else {
      ax -= this.vel.x * 0.03;
      az -= this.vel.z * 0.03;
      this.yawRate = lerp(this.yawRate, -inp.steer * 0.6, Math.min(1, dt * 1.5));
      if (depth < -0.25) this.airborne = true;
    }
    this.contact = contact;

    // Stunts
    if (this.airborne) {
      this.airTime += dt;
      if (!this.trick && inp.stunt && this.airTime > 0.08) {
        if (inp.steer < -0.5) this.trick = { type: 'roll', dir: -1, name: 'BARREL ROLL' };
        else if (inp.steer > 0.5) this.trick = { type: 'roll', dir: 1, name: 'BARREL ROLL' };
        else if (inp.leanBack) this.trick = { type: 'flip', dir: 1, name: 'BACKFLIP' };
        else if (inp.leanFwd || inp.throttle) this.trick = { type: 'flip', dir: -1, name: 'FRONT FLIP' };
        if (this.trick) this.trick.angle = 0;
      }
      if (this.trick) {
        const tr = this.trick;
        tr.angle += (tr.type === 'roll' ? TAU / 0.6 : TAU / 0.75) * dt;
        if (tr.angle >= TAU) {
          this.tricksDone.push(tr.name);
          this.trick = null;
          this.trickRoll = this.trickPitch = 0;
          this.events.push({ type: 'trickDone', name: tr.name });
        } else if (tr.type === 'roll') this.trickRoll = tr.dir * tr.angle;
        else this.trickPitch = tr.dir * tr.angle;
      }
    }

    if (wasAir && contact) {
      const impact = Math.max(0, -this.vel.y);
      this.events.push({ type: 'land', impact, air: this.airTime });
      if (this.trick) this.crash();
      else if (this.tricksDone.length) {
        this.events.push({ type: 'trick', names: [...this.tricksDone] });
        this.boostTime = 1.4 + 0.5 * this.tricksDone.length;
      }
      this.tricksDone = [];
      this.airTime = 0;
      this.trickRoll = this.trickPitch = 0;
    }

    this.vel.x += ax * dt;
    this.vel.y += ay * dt;
    this.vel.z += az * dt;
    this.pos.addScaledVector(this.vel, dt);
    this.yaw += this.yawRate * dt;

    // Terrain collision
    const thN = W.terrainHeight(this.pos.x, this.pos.z);
    if (thN > h0 - 0.15 && thN > this.pos.y - 0.4) {
      const [tgx, tgz] = W.terrainGradient(this.pos.x, this.pos.z);
      const gl = Math.hypot(tgx, tgz) || 1;
      const nx = tgx / gl, nz = tgz / gl;
      const into = this.vel.x * nx + this.vel.z * nz;
      if (into > 0) {
        this.vel.x -= nx * into * 1.35;
        this.vel.z -= nz * into * 1.35;
        if (into > 8) this.events.push({ type: 'bump', strength: into });
      }
      this.pos.x -= nx * 0.3;
      this.pos.z -= nz * 0.3;
      this.vel.x *= 0.97;
      this.vel.z *= 0.97;
      this.pos.y = Math.max(this.pos.y, Math.min(thN - 0.3, h0 + 2));
    }

    for (const c of W.colliders) {
      const dx = this.pos.x - c.x, dz = this.pos.z - c.z;
      const rr = c.r + 0.75;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && this.pos.y < 3) {
        const d = Math.sqrt(d2) || 1;
        const nx = dx / d, nz = dz / d;
        this.pos.x = c.x + nx * rr;
        this.pos.z = c.z + nz * rr;
        const into = -(this.vel.x * nx + this.vel.z * nz);
        if (into > 0) {
          this.vel.x += nx * into * 1.3;
          this.vel.z += nz * into * 1.3;
          if (into > 5) this.events.push({ type: 'bump', strength: into });
        }
      }
    }

    // Orientation
    let tp, trl, rate;
    if (!this.airborne) {
      tp = Math.atan(surfSlopeF) + (inp.leanBack ? 0.22 : 0) - (inp.leanFwd ? 0.08 : 0) + clamp(hs / 25, 0, 1) * 0.05;
      trl = -Math.atan(slopeR) + inp.steer * 0.5 * clamp(Math.abs(hs) / 12, 0, 1);
      rate = 9;
    } else {
      tp = clamp(Math.atan2(this.vel.y, Math.max(4, Math.abs(hs))), -0.7, 0.7) * 0.8 + (inp.leanBack ? 0.35 : 0) - (inp.leanFwd ? 0.35 : 0);
      trl = inp.steer * 0.3;
      rate = 3;
    }
    if (crashed) trl = Math.sin(this.crashTime * 9) * 0.45;
    this.pitch = lerp(this.pitch, tp, Math.min(1, dt * rate));
    this.roll = lerp(this.roll, trl, Math.min(1, dt * rate));
    this.leanVis = lerp(this.leanVis, inp.leanFwd - inp.leanBack, Math.min(1, dt * 8));
    this.steerVis = lerp(this.steerVis, inp.steer, Math.min(1, dt * 8));
  }

  updateMesh() {
    const m = this.mesh;
    m.root.position.copy(this.pos);
    m.root.rotation.set(0, this.yaw, 0);
    m.body.rotation.set(-(this.pitch + this.trickPitch), 0, this.roll + this.trickRoll);
    const crashed = this.crashTime > 0;
    m.upper.rotation.x = crashed ? -1.0 + Math.sin(this.crashTime * 14) * 0.3 : 0.32 + this.leanVis * 0.32;
    m.rider.rotation.z = crashed ? Math.sin(this.crashTime * 11) * 0.5 : this.steerVis * 0.28;
    m.rider.position.y = 0.42 + (crashed ? 0.25 : 0);
  }
}
