import * as THREE from 'three';

const MAX = 1500;

export class Particles {
  constructor(scene) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.color = new THREE.Color();
    for (let i = 0; i < MAX; i++) this.mesh.setColorAt(i, this.color.set(0xffffff));
    scene.add(this.mesh);
    this.p = [];
    this.mtx = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3();
  }

  clear() {
    this.p.length = 0;
    this.mesh.count = 0;
  }

  emit(x, y, z, o) {
    if (this.p.length >= MAX) this.p.shift();
    this.p.push({
      x, y, z,
      vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0,
      life: o.life ?? 1, max: o.life ?? 1,
      size: o.size ?? 0.4, grow: o.grow ?? 0,
      g: o.g ?? 0, drag: o.drag ?? 1,
      color: o.color ?? 0xffffff,
      rot: Math.random() * 6, spin: (Math.random() - 0.5) * 8,
    });
  }

  dust(x, y, z, color = 0xc8b89a, n = 1) {
    for (let i = 0; i < n; i++)
      this.emit(x + (Math.random() - 0.5), y + 0.2, z + (Math.random() - 0.5), {
        vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 2,
        life: 0.45 + Math.random() * 0.35, size: 0.26, grow: 1.1, drag: 3, color,
      });
  }

  splash(x, y, z, n = 6) {
    for (let i = 0; i < n; i++)
      this.emit(x, y + 0.2, z, {
        vx: (Math.random() - 0.5) * 7, vy: 3 + Math.random() * 5, vz: (Math.random() - 0.5) * 7,
        life: 0.6, size: 0.25, g: 20, color: Math.random() < 0.5 ? 0x81d4fa : 0xe1f5fe,
      });
  }

  sparks(x, y, z, n = 10) {
    for (let i = 0; i < n; i++)
      this.emit(x, y + 0.5, z, {
        vx: (Math.random() - 0.5) * 14, vy: 2 + Math.random() * 6, vz: (Math.random() - 0.5) * 14,
        life: 0.35 + Math.random() * 0.2, size: 0.15, g: 25, color: Math.random() < 0.5 ? 0xffeb3b : 0xff9800,
      });
  }

  explosion(x, y, z) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 10;
      this.emit(x, y + 0.6, z, {
        vx: Math.cos(a) * sp, vy: 2 + Math.random() * 10, vz: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.5, size: 0.5 + Math.random() * 0.6, grow: -0.4, g: 8, drag: 2,
        color: [0xfff176, 0xffb300, 0xff5722, 0xd84315][i % 4],
      });
    }
    for (let i = 0; i < 16; i++)
      this.emit(x + (Math.random() - 0.5) * 2, y + 1, z + (Math.random() - 0.5) * 2, {
        vx: (Math.random() - 0.5) * 3, vy: 3 + Math.random() * 3, vz: (Math.random() - 0.5) * 3,
        life: 1.2 + Math.random() * 0.6, size: 0.8, grow: 1.6, drag: 1.5, color: 0x555555,
      });
    for (let i = 0; i < 12; i++)
      this.emit(x, y + 0.5, z, {
        vx: (Math.random() - 0.5) * 16, vy: 6 + Math.random() * 10, vz: (Math.random() - 0.5) * 16,
        life: 1.2, size: 0.22, g: 30, color: 0x333333,
      });
  }

  smoke(x, y, z, color = 0xdddddd) {
    this.emit(x, y, z, {
      vx: (Math.random() - 0.5) * 0.8, vy: 0.8, vz: (Math.random() - 0.5) * 0.8,
      life: 0.5, size: 0.3, grow: 1.5, drag: 2, color,
    });
  }

  confetti(x, y, z, n = 60) {
    for (let i = 0; i < n; i++)
      this.emit(x + (Math.random() - 0.5) * 10, y + 7, z + (Math.random() - 0.5) * 10, {
        vx: (Math.random() - 0.5) * 6, vy: Math.random() * 6, vz: (Math.random() - 0.5) * 6,
        life: 2.5, size: 0.25, g: 6, drag: 1.2, color: new THREE.Color().setHSL(Math.random(), 0.9, 0.6).getHex(),
      });
  }

  update(dt) {
    const { p, mtx, q, e, v, s } = this;
    let n = 0;
    for (let i = p.length - 1; i >= 0; i--) {
      const a = p[i];
      a.life -= dt;
      if (a.life <= 0) {
        p[i] = p[p.length - 1];
        p.pop();
      }
    }
    for (const a of p) {
      const d = Math.exp(-a.drag * dt);
      a.vx *= d; a.vy = a.vy * d - a.g * dt; a.vz *= d;
      a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt;
      if (a.y < 0) { a.y = 0; a.vy *= -0.3; }
      a.rot += a.spin * dt;
      const t = a.life / a.max;
      const size = Math.max(0.001, a.size * (1 + a.grow * (1 - t)) * Math.min(1, t * 3));
      q.setFromEuler(e.set(a.rot, a.rot * 0.7, 0));
      mtx.compose(v.set(a.x, a.y, a.z), q, s.set(size, size, size));
      this.mesh.setMatrixAt(n, mtx);
      this.mesh.setColorAt(n, this.color.set(a.color));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
