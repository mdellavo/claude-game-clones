import * as THREE from 'three';
import { Track } from './track.js';
import { Waves } from './waves.js';
import { buildHeightfield, buildTerrainMesh, buildProps } from './terrain.js';
import { makeSkyUniforms, createSky } from './sky.js';
import { createWater } from './water.js';
import { clamp } from './noise.js';

const RAMP_L = 12, RAMP_HALF_W = 3.6, RAMP_H = 2.9, RAMP_BASE = -0.45;

export class World {
  constructor(scene, course) {
    this.scene = scene;
    this.course = course;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.track = new Track(course);
    this.waves = new Waves(course.waves, course.seed);
    this.hf = buildHeightfield(course, this.track);
    this.timeU = { value: 0 };
    this.ampU = { value: 1 };

    const fogDensity = course.id === 'storm' ? 0.0017 : 0.00105;
    scene.fog = new THREE.FogExp2(new THREE.Color(course.sky.horizon), fogDensity);

    const skyUniforms = makeSkyUniforms(course);
    this.sky = createSky(skyUniforms, course, this.timeU);
    this.group.add(this.sky);

    this.heightTex = this.hf.texture();
    this.water = createWater({
      waves: this.waves, heightTex: this.heightTex, hBounds: this.hf.boundsVec(), skyUniforms, course,
      timeUniform: this.timeU, ampUniform: this.ampU, fogDensity,
    });
    this.group.add(this.water);

    this.terrain = buildTerrainMesh(this.hf, course);
    this.group.add(this.terrain);

    const props = buildProps(this.hf, course, this.track);
    this.group.add(props.group);
    this.colliders = props.colliders;

    const L = course.light;
    this.group.add(new THREE.HemisphereLight(L.hemiSky, L.hemiGround, L.hemi));
    const sun = new THREE.DirectionalLight(course.sky.sun, L.sun);
    sun.position.copy(skyUniforms.uSunDir.value).multiplyScalar(200);
    this.group.add(sun);

    this.buildRamps();
    this.buildBuoys();
    this.buildGate();
    this.buildArrow();
  }

  waterHeight(x, z, t) {
    const th = this.hf.sample(x, z);
    return this.waves.height(x, z, t) * clamp(-th / 7, 0.15, 1);
  }

  terrainHeight(x, z) {
    return this.hf.sample(x, z);
  }

  terrainGradient(x, z) {
    return this.hf.gradient(x, z);
  }

  buildRamps() {
    this.ramps = [];
    const shape = new THREE.Shape();
    shape.moveTo(0, -1.6);
    shape.lineTo(RAMP_L, -1.6);
    shape.lineTo(RAMP_L, RAMP_BASE + RAMP_H);
    shape.lineTo(0, RAMP_BASE);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: RAMP_HALF_W * 2, bevelEnabled: false });
    geo.rotateY(-Math.PI / 2);
    geo.translate(RAMP_HALF_W, 0, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.5 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xffd21f, roughness: 0.4 });
    const slopeAng = Math.atan2(RAMP_H, RAMP_L);
    for (const r of this.track.ramps) {
      const c = this.track.sample(r.s - RAMP_L / 2);
      const ox = c.x + c.rx * r.off, oz = c.z + c.rz * r.off;
      const g = new THREE.Group();
      g.position.set(ox, 0, oz);
      g.rotation.y = c.yaw;
      g.add(new THREE.Mesh(geo, mat));
      for (let i = 0; i < 4; i++) {
        const z = 1.5 + i * 3;
        const s = new THREE.Mesh(new THREE.BoxGeometry(RAMP_HALF_W * 2 - 0.4, 0.06, 0.9), stripeMat);
        s.position.set(0, RAMP_BASE + (z / RAMP_L) * RAMP_H + 0.04, z);
        s.rotation.x = -slopeAng;
        g.add(s);
      }
      for (const sx of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, Math.hypot(RAMP_L, RAMP_H)), railMat);
        rail.position.set(sx * (RAMP_HALF_W - 0.1), RAMP_BASE + RAMP_H / 2 + 0.15, RAMP_L / 2);
        rail.rotation.x = -slopeAng;
        g.add(rail);
      }
      this.group.add(g);
      this.ramps.push({ ox, oz, dx: c.tx, dz: c.tz, rx: c.rx, rz: c.rz, s: r.s });
    }
  }

  rampAt(x, z) {
    for (const r of this.ramps) {
      const dx = x - r.ox, dz = z - r.oz;
      const lz = dx * r.dx + dz * r.dz;
      if (lz < 0 || lz > RAMP_L) continue;
      const lx = dx * r.rx + dz * r.rz;
      if (Math.abs(lx) > RAMP_HALF_W) continue;
      return { h: RAMP_BASE + (lz / RAMP_L) * RAMP_H, slope: RAMP_H / RAMP_L, dx: r.dx, dz: r.dz, rx: r.rx, rz: r.rz, lx, halfW: RAMP_HALF_W };
    }
    return null;
  }

  buildBuoys() {
    const bodyGeo = new THREE.CylinderGeometry(0.5, 0.72, 1.9, 16);
    const bandGeo = new THREE.CylinderGeometry(0.66, 0.66, 0.3, 16);
    const capGeo = new THREE.ConeGeometry(0.5, 0.6, 16);
    const red = new THREE.MeshStandardMaterial({ color: 0xe0282e, roughness: 0.35, emissive: 0x400000, emissiveIntensity: 0.6 });
    const yel = new THREE.MeshStandardMaterial({ color: 0xffd21f, roughness: 0.35, emissive: 0x403000, emissiveIntensity: 0.6 });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    this.buoyMeshes = this.track.buoys.map((b) => {
      const p = this.track.pointAt(b.s, b.off);
      const g = new THREE.Group();
      const m = b.color === 'r' ? red : yel;
      const body = new THREE.Mesh(bodyGeo, m);
      body.position.y = 0.95;
      const band = new THREE.Mesh(bandGeo, white);
      band.position.y = 1.1;
      const cap = new THREE.Mesh(capGeo, m);
      cap.position.y = 2.2;
      g.add(body, band, cap);
      g.position.set(p.x, 0, p.z);
      this.group.add(g);
      this.colliders.push({ x: p.x, z: p.z, r: 0.65 });
      return { g, x: p.x, z: p.z, pulse: 0 };
    });
  }

  buildGate() {
    const tr = this.track;
    const c = tr.sample(0);
    const half = tr.width * 0.92;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0c4b8c';
    ctx.fillRect(0, 0, 1024, 160);
    for (let i = 0; i < 64; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#fff' : '#111';
        ctx.fillRect(i * 16, j * 16, 16, 16);
        ctx.fillRect(i * 16, 128 + j * 16, 16, 16);
      }
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'italic 900 80px Arial Black, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('START  ◆  FINISH', 512, 82);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const g = new THREE.Group();
    g.position.set(c.x, 0, c.z);
    g.rotation.y = c.yaw;
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, (half * 2) / 6.4), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    banner.position.y = 9;
    g.add(banner);
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0xff3c6e, roughness: 0.4 });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    for (const sx of [-1, 1]) {
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 12, 16), pylonMat);
      pylon.position.set(sx * half, 5, 0);
      g.add(pylon);
      for (let k = 0; k < 3; k++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25 - k * 0.12, 0.18, 8, 20), ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(sx * half, 1.5 + k * 3.5, 0);
        g.add(ring);
      }
      this.colliders.push({ x: c.x - c.rx * sx * half, z: c.z - c.rz * sx * half, r: 1.3 });
    }
    this.group.add(g);
  }

  buildArrow() {
    const s = new THREE.Shape();
    s.moveTo(-1.3, 0.38);
    s.lineTo(0.2, 0.38);
    s.lineTo(0.2, 1.0);
    s.lineTo(1.5, 0);
    s.lineTo(0.2, -1.0);
    s.lineTo(0.2, -0.38);
    s.lineTo(-1.3, -0.38);
    s.closePath();
    const geo = new THREE.ShapeGeometry(s);
    this.arrowMat = new THREE.MeshBasicMaterial({ color: 0xff3030, side: THREE.DoubleSide, transparent: true, opacity: 0.92, depthWrite: false });
    this.arrow = new THREE.Mesh(geo, this.arrowMat);
    this.arrow.scale.setScalar(1.1);
    this.arrow.renderOrder = 20;
    this.arrow.visible = false;
    this.group.add(this.arrow);
  }

  showArrow(buoyIndex, t) {
    if (buoyIndex < 0) {
      this.arrow.visible = false;
      return;
    }
    const b = this.track.buoys[buoyIndex];
    const bm = this.buoyMeshes[buoyIndex];
    const side = b.color === 'r' ? 1 : -1;
    const c = this.track.sample(b.s);
    const dx = c.rx * side, dz = c.rz * side;
    const bob = Math.sin(t * 5) * 0.3;
    this.arrow.visible = true;
    this.arrow.position.set(bm.x + dx * (2.0 + bob * 0.5), bm.g.position.y + 3.6, bm.z + dz * (2.0 + bob * 0.5));
    this.arrow.rotation.set(0, Math.atan2(-dz, dx), 0);
    this.arrowMat.color.set(b.color === 'r' ? 0xff3030 : 0xffd21f);
  }

  pulseBuoy(i) {
    this.buoyMeshes[i].pulse = 1;
  }

  update(t, camera, dt) {
    this.timeU.value = t;
    this.ampU.value = this.waves.ampScale(t);
    this.sky.position.copy(camera.position);
    this.water.update(camera);
    for (const b of this.buoyMeshes) {
      const h = this.waterHeight(b.x, b.z, t);
      const hx = this.waterHeight(b.x + 1, b.z, t) - h;
      const hz = this.waterHeight(b.x, b.z + 1, t) - h;
      b.g.position.y = h - 0.55;
      b.g.rotation.set(hz * 0.8, 0, -hx * 0.8);
      if (b.pulse > 0) {
        b.pulse = Math.max(0, b.pulse - dt * 2.5);
        b.g.scale.setScalar(1 + Math.sin(b.pulse * Math.PI) * 0.35);
        b.g.rotation.y += b.pulse * 6;
      }
    }
  }

  startSlot(i, n, back = 16) {
    const lat = (i - (n - 1) / 2) * 7;
    const p = this.track.pointAt(this.track.length - back, lat);
    return p;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
    this.heightTex.dispose();
    this.scene.fog = null;
  }
}
