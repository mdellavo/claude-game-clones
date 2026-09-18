import * as THREE from 'three';

const W = (p) => new THREE.Vector3(p.x, p.z, p.y); // map coords -> world

const PROJ = {
  bullet: { color: 0xffe080, speed: 45, size: 0.035, len: 0.35 },
  shell: { color: 0xffc060, speed: 35, size: 0.06, len: 0.3 },
  laser: { color: 0xff3030, speed: 90, size: 0.03, len: 1.6, beam: true },
  plasma: { color: 0x60ff60, speed: 22, size: 0.09, len: 0.25, glow: true },
  rocket: { color: 0xc0c0b0, speed: 16, size: 0.06, len: 0.3, trail: true },
  stun: { color: 0x80a0ff, speed: 18, size: 0.08, len: 0.1, glow: true },
};

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.sphere = new THREE.SphereGeometry(1, 10, 8);
    this.cube = new THREE.BoxGeometry(1, 1, 1);
    this.shake = 0;
  }

  add(obj, update, duration) {
    return new Promise((resolve) => {
      this.group.add(obj);
      this.active.push({ obj, update, t: 0, duration, resolve });
    });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.duration);
      const done = a.update(k, dt, a) === true || k >= 1;
      if (done) {
        this.group.remove(a.obj);
        a.obj.traverse((o) => {
          if (o.material && o.material.userData.disposable) o.material.dispose();
        });
        this.active.splice(i, 1);
        a.resolve();
      }
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }

  basic(color, opacity = 1, additive = false) {
    const m = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    m.userData.disposable = true;
    return m;
  }

  flash(p, color, size = 0.25, duration = 0.12) {
    const m = new THREE.Mesh(this.sphere, this.basic(color, 1, true));
    m.position.copy(W(p));
    m.scale.setScalar(size);
    return this.add(m, (k) => {
      m.material.opacity = 1 - k;
      m.scale.setScalar(size * (1 + k));
    }, duration);
  }

  sparks(p, color, count = 8, speed = 2, life = 0.4, size = 0.04) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.cube, this.basic(color, 1, true));
      m.position.copy(W(p));
      m.scale.setScalar(size);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random()));
      this.add(m, (k, dt) => {
        v.y -= 6 * dt;
        m.position.addScaledVector(v, dt);
        m.material.opacity = 1 - k;
      }, life * (0.6 + Math.random() * 0.6));
    }
  }

  async projectile(from, to, type = 'bullet') {
    const P = PROJ[type] || PROJ.bullet;
    const a = W(from), b = W(to);
    const dist = a.distanceTo(b);
    const dir = b.clone().sub(a).normalize();
    this.flash(from, P.color, 0.12, 0.08);
    if (P.beam) {
      const geo = new THREE.CylinderGeometry(P.size, P.size, dist, 6);
      geo.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(geo, this.basic(P.color, 1, true));
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.lookAt(b);
      await this.add(m, (k) => {
        m.material.opacity = 1 - k;
      }, 0.18);
      geo.dispose();
      this.sparks(to, P.color, 6, 1.5, 0.3);
      return;
    }
    const duration = Math.max(0.06, dist / P.speed);
    const geo = new THREE.CylinderGeometry(P.size, P.size, P.len, 6);
    geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(P.glow ? this.sphere : geo, this.basic(P.color, 1, true));
    if (P.glow) m.scale.setScalar(P.size * 1.6);
    const trailEvery = 0.03;
    let trailT = 0;
    await this.add(m, (k, dt) => {
      m.position.copy(a).lerp(b, k);
      if (!P.glow) m.lookAt(b.clone().add(dir));
      if (P.trail) {
        trailT += dt;
        if (trailT > trailEvery) {
          trailT = 0;
          const s = new THREE.Mesh(this.sphere, this.basic(0xbbbbbb, 0.5));
          s.position.copy(m.position);
          s.scale.setScalar(0.06);
          this.add(s, (kk) => {
            s.scale.setScalar(0.06 + kk * 0.2);
            s.material.opacity = 0.5 * (1 - kk);
          }, 0.8);
        }
      }
    }, duration);
    geo.dispose();
    this.sparks(to, P.color, 5, 1.5, 0.3);
  }

  async arc(points, color = 0x708050) {
    const pts = points.map(W);
    const m = new THREE.Mesh(this.cube, this.basic(color, 1));
    m.scale.setScalar(0.1);
    const n = pts.length - 1;
    await this.add(m, (k) => {
      const f = k * n;
      const i = Math.min(n - 1, Math.floor(f));
      m.position.copy(pts[i]).lerp(pts[i + 1], f - i);
      m.rotation.x += 0.3;
      m.rotation.y += 0.2;
    }, Math.max(0.25, n * 0.045));
  }

  async explosion(p, radius, type) {
    const color = type === 'SMOKE' ? 0x9aa0a8 : type === 'STUN' ? 0x7090ff : type === 'IN' ? 0xff7020 : 0xffa030;
    const size = Math.max(0.6, radius * 0.9);
    if (type !== 'SMOKE') this.shake = Math.min(1, 0.25 + radius * 0.1);
    const core = new THREE.Mesh(this.sphere, this.basic(type === 'SMOKE' ? 0xb0b4b8 : 0xfff0c0, 1, type !== 'SMOKE'));
    core.position.copy(W(p));
    const ring = new THREE.Mesh(this.sphere, this.basic(color, 0.8, type !== 'SMOKE'));
    ring.position.copy(W(p));
    this.add(ring, (k) => {
      ring.scale.setScalar(size * (0.3 + k));
      ring.material.opacity = 0.8 * (1 - k) ** 1.5;
    }, 0.6);
    if (type !== 'SMOKE') this.sparks({ x: p.x, y: p.y, z: p.z + 0.2 }, color, 14 + radius * 4, 3 + radius, 0.7, 0.07);
    // smoke puffs
    for (let i = 0; i < 6 + radius * 2; i++) {
      const s = new THREE.Mesh(this.sphere, this.basic(type === 'STUN' ? 0x8090c0 : 0x555555, 0.6));
      const off = new THREE.Vector3((Math.random() - 0.5) * size, Math.random() * size * 0.5, (Math.random() - 0.5) * size);
      s.position.copy(W(p)).add(off);
      const base = 0.2 + Math.random() * 0.3;
      this.add(s, (k, dt) => {
        s.position.y += dt * 0.6;
        s.scale.setScalar(base * (1 + k * 2.5));
        s.material.opacity = 0.55 * (1 - k);
      }, 1.2 + Math.random() * 0.8);
    }
    await this.add(core, (k) => {
      core.scale.setScalar(size * 0.7 * (0.2 + k));
      core.material.opacity = 1 - k;
    }, 0.35);
  }

  async melee(p, color = 0xffffff) {
    this.sparks(p, color, 8, 1.8, 0.3);
    await this.flash(p, color, 0.2, 0.15);
  }
}

// Smoke & fire volumes
export class Atmosphere {
  constructor(scene) {
    this.scene = scene;
    const max = 4000;
    this.smoke = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.5, 1),
      new THREE.MeshLambertMaterial({ color: 0x8a8e94, transparent: true, opacity: 0.42, depthWrite: false }),
      max,
    );
    this.smoke.count = 0;
    this.smoke.frustumCulled = false;
    this.fire = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.28, 0.8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff7a20, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
      2000,
    );
    this.fire.count = 0;
    this.fire.frustumCulled = false;
    scene.add(this.smoke, this.fire);
    this.fireList = [];
    this.smokeList = [];
    this.tmp = new THREE.Object3D();
    this.time = 0;
  }

  rebuild(map, viewLevel) {
    this.fireList = [];
    this.smokeList = [];
    for (let i = 0; i < map.smoke.length; i++) {
      if (!map.smoke[i] && !map.fire[i]) continue;
      const p = map.pos(i);
      if (p.z > viewLevel || !map.discovered[i]) continue;
      if (map.smoke[i]) this.smokeList.push({ ...p, d: map.smoke[i], r: Math.random() * 6 });
      if (map.fire[i]) this.fireList.push({ ...p, r: Math.random() * 6 });
    }
  }

  update(dt) {
    this.time += dt;
    const t = this.tmp;
    let n = 0;
    for (const s of this.smokeList) {
      if (n >= 4000) break;
      const sc = Math.min(1.3, 0.45 + s.d * 0.06);
      t.position.set(s.x + 0.5 + Math.sin(this.time * 0.3 + s.r) * 0.1, s.z + 0.45 + Math.sin(this.time * 0.5 + s.r) * 0.05, s.y + 0.5);
      t.scale.set(sc, sc * 0.8, sc);
      t.rotation.set(0, s.r + this.time * 0.1, 0);
      t.updateMatrix();
      this.smoke.setMatrixAt(n++, t.matrix);
    }
    this.smoke.count = n;
    this.smoke.instanceMatrix.needsUpdate = true;
    n = 0;
    for (const f of this.fireList) {
      for (let k = 0; k < 2; k++) {
        const fl = 0.7 + 0.3 * Math.sin(this.time * 12 + f.r * 3 + k * 2);
        t.position.set(f.x + 0.35 + k * 0.3, f.z + 0.35 * fl, f.y + 0.4 + k * 0.2);
        t.scale.set(1 - k * 0.3, fl * (1 - k * 0.3), 1 - k * 0.3);
        t.rotation.set(0, f.r, 0);
        t.updateMatrix();
        this.fire.setMatrixAt(n++, t.matrix);
      }
    }
    this.fire.count = n;
    this.fire.instanceMatrix.needsUpdate = true;
  }
}
