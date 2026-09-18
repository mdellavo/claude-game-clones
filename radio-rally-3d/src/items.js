import * as THREE from 'three';
import { trackQuad } from './trackmesh.js';
import { iconTexture, zipperTexture, blobTexture } from './textures.js';

const PICKUP_TABLE = [
  ['missile', 38],
  ['bomb', 20],
  ['engine', 14],
  ['tires', 14],
  ['battery', 14],
];

function randomKind() {
  const total = PICKUP_TABLE.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of PICKUP_TABLE) if ((r -= w) < 0) return k;
  return 'missile';
}

export class Items {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.zipTex = zipperTexture();
    this.missileGeo = this.buildMissileGeo();
    this.missileMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4, metalness: 0.4 });
    this.missileTip = new THREE.MeshBasicMaterial({ color: 0xff3d00 });
    this.bombGeo = new THREE.SphereGeometry(0.55, 12, 8);
    this.bombMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.3, metalness: 0.5 });
    this.lightOn = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    this.lightOff = new THREE.MeshBasicMaterial({ color: 0x440000 });
    this.boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  }

  buildMissileGeo() {
    const g = new THREE.CylinderGeometry(0.16, 0.16, 1.2, 8);
    g.rotateX(Math.PI / 2);
    return g;
  }

  build(track, letters) {
    this.clear();
    this.track = track;
    this.hazards = [];
    this.zippers = [];
    this.pickups = [];
    this.missiles = [];
    this.bombs = [];
    const puddleMat = new THREE.MeshLambertMaterial({ map: blobTexture('rgba(66,165,245,0.75)', 'rgba(21,101,192,0.9)'), transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const oilMat = new THREE.MeshLambertMaterial({ map: blobTexture('rgba(15,15,20,0.92)', 'rgba(80,60,120,0.9)'), transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const zipMat = new THREE.MeshBasicMaterial({ map: this.zipTex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.zipTex.wrapT = THREE.RepeatWrapping;

    for (const f of track.features) {
      if (f.type === 'puddle' || f.type === 'oil') {
        const m = trackQuad(track, f.s - f.r, f.s + f.r, f.lat - f.r, f.lat + f.r, f.type === 'oil' ? oilMat : puddleMat, 0.07);
        this.group.add(m);
        this.hazards.push(f);
      } else if (f.type === 'zipper') {
        const m = trackQuad(track, f.s - 2.5, f.s + 2.5, f.lat - 2, f.lat + 2, zipMat, 0.08);
        this.group.add(m);
        this.zippers.push(f);
      }
    }
    const spawns = track.features.filter((f) => f.type === 'pickup');
    const letterSlots = new Map();
    const order = spawns.map((_, i) => i).sort(() => Math.random() - 0.5);
    letters.forEach((L, i) => {
      if (i < order.length) letterSlots.set(order[i], L);
    });
    spawns.forEach((f, i) => {
      const letter = letterSlots.get(i);
      const p = { s: f.s, lat: f.lat, kind: null, mesh: null, timer: letter ? 0 : Math.random() * 2, letter: letter || null, gone: false, phase: Math.random() * 6 };
      this.pickups.push(p);
    });
  }

  clear() {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      if (c.geometry && c.geometry !== this.missileGeo && c.geometry !== this.bombGeo && c.geometry !== this.boxGeo) c.geometry.dispose();
    }
  }

  spawnPickup(p) {
    p.kind = p.letter ?? randomKind();
    const mat = new THREE.MeshLambertMaterial({ map: iconTexture(p.kind), emissive: 0x222222 });
    p.mesh = new THREE.Mesh(this.boxGeo, mat);
    p.mesh.castShadow = true;
    p.mesh.scale.setScalar(0.01);
    this.group.add(p.mesh);
    const pos = this.track.posAt(p.s, p.lat);
    p.pos = pos;
    p.age = 0;
  }

  // Called per fixed physics step for each car.
  applyHazards(car) {
    const t = this.track;
    const q = car.q;
    if (!car.onGround) return;
    for (const h of this.hazards) {
      const ds = t.deltaS(h.s, q.s), dl = q.lat - h.lat;
      if (ds * ds + dl * dl > h.r * h.r) continue;
      if (h.type === 'puddle') {
        car.inPuddle = true;
        if (Math.abs(car.forward) > 6 && Math.random() < 0.3) this.game.fx.splash(car.x, car.y, car.z, 2);
        if (car.isPlayer && !car._splashed) {
          this.game.audio.splash();
          car._splashed = 0.6;
        }
      } else if (car.slip()) {
        if (car.isPlayer) this.game.audio.skid();
      }
    }
    if (car._splashed) car._splashed = Math.max(0, car._splashed - 1 / 120) || 0;
    for (const z of this.zippers) {
      const ds = t.deltaS(z.s, q.s), dl = q.lat - z.lat;
      if (Math.abs(ds) < 2.5 && Math.abs(dl) < 2.2 && car.boost()) {
        if (car.isPlayer) this.game.audio.zipper();
      }
    }
  }

  fireMissile(car) {
    if (car.missiles <= 0 || car.spinTime > 0) return false;
    car.missiles--;
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(this.missileGeo, this.missileMat);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 8).rotateX(Math.PI / 2), this.missileTip);
    tip.position.z = 0.8;
    mesh.add(body, tip);
    body.castShadow = true;
    this.group.add(mesh);
    const speed = Math.max(car.forward, 0) + 55;
    this.missiles.push({ owner: car, s: car.q.s + 1.8, lat: car.q.lat, speed, life: 2.6, mesh, y: car.y + 0.7 });
    this.game.audio.missile(car.isPlayer);
    return true;
  }

  dropBomb(car) {
    if (car.bombs <= 0 || car.spinTime > 0) return false;
    car.bombs--;
    const mesh = new THREE.Group();
    const ball = new THREE.Mesh(this.bombGeo, this.bombMat);
    ball.castShadow = true;
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), this.lightOn);
    light.position.y = 0.6;
    mesh.add(ball, light);
    const s = car.q.s - 2.2, lat = car.q.lat;
    const p = this.track.posAt(s, lat);
    mesh.position.set(p.x, p.y + 0.5, p.z);
    this.group.add(mesh);
    this.bombs.push({ owner: car, s, lat, x: p.x, z: p.z, y: p.y, arm: 0.8, life: 16, mesh, light });
    this.game.audio.bombDrop();
    return true;
  }

  explode(x, y, z) {
    this.game.fx.explosion(x, y, z);
    this.game.audio.explosion();
    const pl = this.game.player;
    const d = Math.hypot(pl.x - x, pl.z - z);
    this.game.shake = Math.max(this.game.shake, Math.max(0, 1 - d / 40) * 1.2);
  }

  update(dt, cars) {
    const t = this.track;
    const time = performance.now() / 1000;
    this.zipTex.offset.y = (time * 1.5) % 1;

    // pickups
    for (const p of this.pickups) {
      if (p.gone) continue;
      if (!p.mesh) {
        p.timer -= dt;
        if (p.timer <= 0) this.spawnPickup(p);
        continue;
      }
      p.age += dt;
      const sc = Math.min(1, p.age * 3);
      p.mesh.scale.setScalar(sc * (p.letter ? 1.15 : 1));
      p.mesh.position.set(p.pos.x, p.pos.y + 1.3 + Math.sin(time * 3 + p.phase) * 0.25, p.pos.z);
      p.mesh.rotation.y = time * 2 + p.phase;
      p.mesh.rotation.x = Math.sin(time + p.phase) * 0.3;
      for (const c of cars) {
        if (c.spinTime > 0) continue;
        if (p.letter && !c.isPlayer) continue;
        const dx = c.x - p.mesh.position.x, dz = c.z - p.mesh.position.z;
        if (dx * dx + dz * dz < 3.2 && Math.abs(c.y + 0.6 - p.mesh.position.y) < 2.5) {
          this.game.collect(c, p.kind);
          this.game.fx.sparks(p.mesh.position.x, p.mesh.position.y - 0.5, p.mesh.position.z, 12);
          this.group.remove(p.mesh);
          p.mesh.material.dispose();
          p.mesh = null;
          if (p.letter) p.gone = true;
          else p.timer = 6 + Math.random() * 5;
          break;
        }
      }
    }

    // missiles
    const pos = {};
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.life -= dt;
      m.s += m.speed * dt;
      // home laterally on the nearest car ahead
      let target = null, best = 60;
      for (const c of cars) {
        if (c === m.owner) continue;
        const ds = t.deltaS(m.s, c.q.s);
        if (ds > -1 && ds < best) { best = ds; target = c; }
      }
      if (target) {
        const dl = target.q.lat - m.lat;
        m.lat += Math.sign(dl) * Math.min(Math.abs(dl), 9 * dt);
      }
      t.posAt(m.s, m.lat, pos);
      const gy = pos.y + 0.7;
      m.y += (gy - m.y) * Math.min(1, dt * 10);
      m.mesh.position.set(pos.x, m.y, pos.z);
      m.mesh.rotation.y = pos.heading;
      if (Math.random() < 0.9) this.game.fx.smoke(pos.x - pos.tx * 0.8, m.y, pos.z - pos.tz * 0.8, 0xbdbdbd);
      let dead = m.life <= 0;
      for (const c of cars) {
        if (c === m.owner) continue;
        const ds = t.deltaS(m.s, c.q.s), dl = c.q.lat - m.lat;
        if (Math.abs(ds) < 1.6 && Math.abs(dl) < 1.4 && Math.abs(c.y + 0.6 - m.y) < 1.8) {
          const didHit = c.hit();
          this.game.onHit(c, m.owner, didHit);
          dead = true;
          break;
        }
      }
      if (dead) {
        this.explode(pos.x, m.y - 0.5, pos.z);
        this.group.remove(m.mesh);
        this.missiles.splice(i, 1);
      }
    }

    // bombs
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.arm -= dt;
      b.life -= dt;
      b.light.material = Math.floor(time * (b.life < 3 ? 12 : 4)) % 2 ? this.lightOn : this.lightOff;
      let dead = b.life <= 0;
      for (const c of cars) {
        if (c === b.owner && b.arm > 0) continue;
        const dx = c.x - b.x, dz = c.z - b.z;
        if (dx * dx + dz * dz < 2.4 && c.y - b.y < 1.2) {
          const didHit = c.hit();
          this.game.onHit(c, b.owner, didHit);
          dead = true;
          break;
        }
      }
      if (dead) {
        this.explode(b.x, b.y, b.z);
        this.group.remove(b.mesh);
        this.bombs.splice(i, 1);
      }
    }
  }
}
