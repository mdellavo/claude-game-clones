import * as THREE from 'three';

const GRAVITY = 42;
const RADIUS = 0.95;

export const BASE_STATS = { maxSpeed: 29, accel: 20, grip: 7.5, turn: 2.55 };

function makeModel(color, accent = 0xffffff) {
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  const body = new THREE.Group();
  root.add(tilt);
  tilt.add(body);

  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.25 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.1, metalness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.25, metalness: 0.9 });

  const add = (parent, geo, mat, x, y, z, rx = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  add(body, new THREE.BoxGeometry(1.1, 0.22, 2.3), dark, 0, 0.42, 0);
  add(body, new THREE.BoxGeometry(1.4, 0.34, 2.0), paint, 0, 0.66, 0.05);
  // hood slope
  add(body, new THREE.BoxGeometry(1.36, 0.2, 0.8), paint, 0, 0.8, 0.62, 0.22);
  // cab
  add(body, new THREE.BoxGeometry(1.2, 0.46, 0.95), paint, 0, 1.03, -0.25);
  add(body, new THREE.BoxGeometry(1.22, 0.32, 0.12), glass, 0, 1.02, 0.24, -0.35);
  add(body, new THREE.BoxGeometry(1.25, 0.28, 0.7), glass, 0, 1.04, -0.25);
  // racing stripe
  add(body, new THREE.BoxGeometry(0.3, 0.02, 2.02), accentMat, 0, 0.84, 0.05);
  add(body, new THREE.BoxGeometry(0.3, 0.02, 0.97), accentMat, 0, 1.27, -0.25);
  // spoiler
  add(body, new THREE.BoxGeometry(1.5, 0.08, 0.4), accentMat, 0, 1.35, -1.0);
  add(body, new THREE.BoxGeometry(0.08, 0.5, 0.2), dark, -0.5, 1.07, -0.95);
  add(body, new THREE.BoxGeometry(0.08, 0.5, 0.2), dark, 0.5, 1.07, -0.95);
  // bumpers
  add(body, new THREE.BoxGeometry(1.5, 0.18, 0.18), chrome, 0, 0.45, 1.18);
  add(body, new THREE.BoxGeometry(1.5, 0.18, 0.18), chrome, 0, 0.45, -1.12);
  // lights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfffde7 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
  add(body, new THREE.BoxGeometry(0.28, 0.12, 0.05), headMat, -0.45, 0.72, 1.06);
  add(body, new THREE.BoxGeometry(0.28, 0.12, 0.05), headMat, 0.45, 0.72, 1.06);
  add(body, new THREE.BoxGeometry(0.28, 0.1, 0.05), tailMat, -0.45, 0.7, -0.96);
  add(body, new THREE.BoxGeometry(0.28, 0.1, 0.05), tailMat, 0.45, 0.7, -0.96);

  // wheels
  const tireGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.4, 16);
  tireGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.42, 8);
  hubGeo.rotateZ(Math.PI / 2);
  const treadGeo = new THREE.BoxGeometry(0.42, 0.1, 0.12);
  const wheels = [];
  for (const [x, z] of [[-0.82, 0.78], [0.82, 0.78], [-0.82, -0.75], [0.82, -0.75]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.44, z);
    const spin = new THREE.Group();
    pivot.add(spin);
    const tire = new THREE.Mesh(tireGeo, dark);
    tire.castShadow = true;
    spin.add(tire);
    spin.add(new THREE.Mesh(hubGeo, chrome));
    for (let k = 0; k < 4; k++) {
      const t = new THREE.Mesh(treadGeo, accentMat);
      const a = (k / 4) * Math.PI * 2;
      t.position.set(0, Math.cos(a) * 0.42, Math.sin(a) * 0.42);
      t.rotation.x = -a;
      spin.add(t);
    }
    tilt.add(pivot);
    wheels.push({ pivot, spin, front: z > 0 });
  }

  // antenna
  const ant = add(body, new THREE.CylinderGeometry(0.02, 0.02, 1.0, 4), dark, 0.5, 1.5, -0.6);
  const flag = add(body, new THREE.BoxGeometry(0.02, 0.18, 0.28), accentMat, 0.5, 1.92, -0.74);

  return { root, tilt, body, wheels, paint, antenna: ant, flag };
}

export class Car {
  constructor({ color, accent, name, isPlayer = false, stats = BASE_STATS }) {
    this.name = name;
    this.color = color;
    this.isPlayer = isPlayer;
    this.stats = { ...stats };
    this.model = makeModel(color, accent);
    this.mesh = this.model.root;
    this.q = { index: -1, s: 0, lat: 0 };
    this.missiles = 0;
    this.bombs = 0;
    this.reset(null);
  }

  reset(track, s = 0, lat = 0) {
    this.x = 0; this.z = 0; this.y = 0;
    this.vx = 0; this.vz = 0; this.vy = 0;
    this.heading = 0;
    this.forward = 0;
    this.onGround = true;
    this.airTime = 0;
    this.spinTime = 0; this.spinRate = 0; this.flipTime = 0;
    this.slipTime = 0;
    this.boostTime = 0;
    this.invuln = 0;
    this.inPuddle = false;
    this.oilCooldown = 0;
    this.zipCooldown = 0;
    this.steerVis = 0;
    this.wheelSpin = 0;
    this.pitch = 0; this.roll = 0;
    this.bob = 0; this.bobV = 0;
    this.finished = false;
    this.dnf = false;
    this.finishTime = 0;
    this.progress = s;
    this.throttle = 0;
    this.events = [];
    this.wallCooldown = 0;
    this.track = track;
    if (track) {
      const p = track.posAt(s, lat);
      this.x = p.x; this.z = p.z; this.y = p.y;
      this.heading = p.heading;
      this.q = track.nearest(p.x, p.z);
      this.progress = s;
      this.lastS = this.q.s;
      this.prevGround = p.y;
    }
    this.syncVisual(0);
  }

  get speed() {
    return Math.hypot(this.vx, this.vz);
  }

  get lap() {
    return Math.floor(this.progress / this.track.length);
  }

  hit() {
    if (this.invuln > 0) return false;
    this.spinTime = 1.4;
    this.flipTime = 1.0;
    this.spinRate = (Math.random() < 0.5 ? -1 : 1) * 9;
    this.vx *= 0.25;
    this.vz *= 0.25;
    this.vy = 11;
    this.onGround = false;
    this.invuln = 2.4;
    return true;
  }

  slip() {
    if (this.oilCooldown > 0 || this.spinTime > 0) return false;
    this.slipTime = 1.1;
    this.spinRate = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 3);
    this.oilCooldown = 1.6;
    return true;
  }

  boost() {
    if (this.zipCooldown > 0) return false;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const target = this.stats.maxSpeed * 1.6;
    const vf = this.vx * fx + this.vz * fz;
    if (vf < target) {
      this.vx += fx * (target - vf);
      this.vz += fz * (target - vf);
    }
    this.boostTime = 0.9;
    this.zipCooldown = 0.5;
    return true;
  }

  update(dt, input) {
    const t = this.track;
    const st = this.stats;
    this.invuln = Math.max(0, this.invuln - dt);
    this.oilCooldown = Math.max(0, this.oilCooldown - dt);
    this.zipCooldown = Math.max(0, this.zipCooldown - dt);
    this.boostTime = Math.max(0, this.boostTime - dt);
    this.wallCooldown = Math.max(0, this.wallCooldown - dt);

    let fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    let rx = -fz, rz = fx;
    let vf = this.vx * fx + this.vz * fz;
    let vl = this.vx * rx + this.vz * rz;
    const grounded = this.onGround || this.y - this.prevGround < 0.35;
    const throttle = input.throttle, steer = input.steer;
    this.throttle = throttle;

    if (this.spinTime > 0) {
      this.spinTime -= dt;
      this.heading += this.spinRate * dt;
      const k = Math.exp(-2.2 * dt);
      this.vx *= k;
      this.vz *= k;
    } else {
      if (grounded) {
        const cap = this.boostTime > 0 ? st.maxSpeed * 1.6 : st.maxSpeed;
        if (throttle > 0) {
          if (vf < 0) vf += 45 * dt * throttle;
          else if (vf < cap) vf += st.accel * throttle * dt * (1 - 0.55 * (vf / cap));
        } else if (throttle < 0) {
          if (vf > 0.5) vf -= 38 * dt * -throttle;
          else if (vf > -st.maxSpeed * 0.35) vf -= st.accel * 0.7 * dt * -throttle;
        } else {
          vf -= Math.sign(vf) * Math.min(Math.abs(vf), 7 * dt);
        }
        if (vf > cap) vf -= (vf - cap) * 1.4 * dt;
        if (this.inPuddle) vf -= vf * 2.2 * dt;

        let grip = st.grip;
        if (this.slipTime > 0) {
          grip *= 0.08;
          this.heading += this.spinRate * dt * Math.min(1, this.slipTime);
        }
        vl *= Math.exp(-grip * dt);

        const speedFactor = Math.min(1, Math.abs(vf) / 7);
        const highSpeedDamp = 1 - 0.25 * Math.min(1, Math.abs(vf) / st.maxSpeed);
        this.heading -= steer * st.turn * speedFactor * highSpeedDamp * Math.sign(vf || 1) * dt;
        this.vx = fx * vf + rx * vl;
        this.vz = fz * vf + rz * vl;
      } else {
        // a little air control
        this.heading -= steer * 0.8 * dt;
      }
    }
    this.slipTime = Math.max(0, this.slipTime - dt);
    this.inPuddle = false;

    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // track query
    const q = t.nearest(this.x, this.z, this.q.index, this.q);
    const limit = t.hw - RADIUS;
    if (Math.abs(q.lat) > limit) {
      const sgn = Math.sign(q.lat);
      const push = q.lat - sgn * limit;
      this.x -= q.rx * push;
      this.z -= q.rz * push;
      const vn = this.vx * q.rx + this.vz * q.rz;
      if (vn * sgn > 0) {
        this.vx -= q.rx * vn * 1.45;
        this.vz -= q.rz * vn * 1.45;
        this.vx *= 0.93;
        this.vz *= 0.93;
        if (Math.abs(vn) > 6 && this.wallCooldown <= 0) {
          this.events.push({ type: 'wall', power: Math.abs(vn) });
          this.wallCooldown = 0.25;
        }
      }
      q.lat = sgn * limit;
    }

    // progress
    const ds = t.deltaS(this.lastS, q.s);
    this.progress += ds;
    this.lastS = q.s;

    // vertical
    const gh = t.groundHeight(q.s);
    const groundRate = (gh - this.prevGround) / dt;
    this.prevGround = gh;
    this.vy -= GRAVITY * dt;
    this.y += this.vy * dt;
    if (this.y <= gh) {
      const impact = groundRate - this.vy;
      if (!this.onGround && this.airTime > 0.25) {
        this.events.push({ type: 'land', power: impact });
        this.bobV -= Math.min(impact, 25) * 0.08;
      }
      this.y = gh;
      this.vy = Math.max(groundRate, impact > 14 && this.airTime > 0.25 ? groundRate + impact * 0.18 : groundRate);
      this.onGround = true;
      this.airTime = 0;
    } else {
      this.onGround = this.y - gh < 0.06;
      if (!this.onGround) this.airTime += dt;
    }

    const vfNow = this.vx * Math.sin(this.heading) + this.vz * Math.cos(this.heading);
    this.forward = vfNow;
    this.steerIn = steer;
  }

  syncVisual(dt) {
    const m = this.model;
    m.root.position.set(this.x, this.y, this.z);
    m.root.rotation.y = this.heading;
    if (!this.track) return;

    // ground-aligned pitch/roll
    const t = this.track;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const along = fx * this.q.tx + fz * this.q.tz;
    const across = fx * this.q.rx + fz * this.q.rz;
    const slope = (t.groundHeight(this.q.s + 1) - t.groundHeight(this.q.s - 1)) / 2;
    let targetPitch = -Math.atan(slope * along);
    let targetRoll = Math.atan(slope * across);
    if (!this.onGround) {
      targetPitch = this.pitch + Math.min(0.9, 0.35 * dt * 3);
      targetPitch = Math.min(targetPitch, 0.5);
      targetRoll = this.roll;
    }
    const k = 1 - Math.exp(-12 * dt);
    this.pitch += (targetPitch - this.pitch) * k;
    this.roll += (targetRoll - this.roll) * k;
    m.tilt.rotation.order = 'YXZ';
    m.tilt.rotation.x = this.pitch;
    m.tilt.rotation.z = this.roll;
    if (this.flipTime > 0) {
      this.flipTime = Math.max(0, this.flipTime - dt);
      m.tilt.rotation.z = (1 - this.flipTime) * Math.PI * 2;
    }

    // suspension bob + body sway
    this.bobV += (-this.bob * 160 - this.bobV * 12) * dt;
    this.bob += this.bobV * dt;
    m.body.position.y = this.bob;
    this.steerVis += ((this.steerIn || 0) - this.steerVis) * (1 - Math.exp(-10 * dt));
    const sway = this.steerVis * Math.min(1, Math.abs(this.forward) / this.stats.maxSpeed) * 0.12;
    m.body.rotation.z = sway;
    m.body.rotation.x = -Math.max(-1, Math.min(1, this.throttle)) * 0.04 * Math.min(1, Math.abs(this.forward) / 10);

    this.wheelSpin += (this.forward * dt) / 0.44;
    for (const w of m.wheels) {
      w.spin.rotation.x = this.wheelSpin;
      if (w.front) w.pivot.rotation.y = -this.steerVis * 0.45;
    }
    m.antenna.rotation.x = -Math.min(0.5, Math.abs(this.forward) * 0.02);
    m.flag.visible = true;
    // blink while invulnerable
    m.body.visible = this.invuln > 0 && this.spinTime <= 0 ? Math.floor(this.invuln * 12) % 2 === 0 : true;
  }
}

export function collideCars(cars) {
  for (let i = 0; i < cars.length; i++)
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (Math.abs(a.y - b.y) > 1.2) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const min = RADIUS * 2;
      if (d >= min || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d;
      const push = (min - d) / 2;
      a.x -= nx * push; a.z -= nz * push;
      b.x += nx * push; b.z += nz * push;
      const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rel < 0) {
        const imp = -rel * 0.8;
        a.vx -= nx * imp; a.vz -= nz * imp;
        b.vx += nx * imp; b.vz += nz * imp;
        if (-rel > 5) {
          a.events.push({ type: 'bump', power: -rel });
          b.events.push({ type: 'bump', power: -rel });
        }
      }
    }
}
