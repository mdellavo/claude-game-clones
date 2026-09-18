import * as THREE from 'three';

export class Particles {
  constructor(scene, world, color) {
    this.world = world;
    this.t = 0;

    // Airborne spray: soft round points.
    const S = (this.maxSpray = 4000);
    this.sp = new Float32Array(S * 3);
    this.sv = new Float32Array(S * 3);
    this.sLife = new Float32Array(S);
    this.sMax = new Float32Array(S);
    this.sSize0 = new Float32Array(S);
    this.sSize = new Float32Array(S);
    this.sAlpha = new Float32Array(S);
    this.sCount = 0;
    const sg = new THREE.BufferGeometry();
    this.sPosAttr = new THREE.BufferAttribute(this.sp, 3).setUsage(THREE.DynamicDrawUsage);
    this.sSizeAttr = new THREE.BufferAttribute(this.sSize, 1).setUsage(THREE.DynamicDrawUsage);
    this.sAlphaAttr = new THREE.BufferAttribute(this.sAlpha, 1).setUsage(THREE.DynamicDrawUsage);
    sg.setAttribute('position', this.sPosAttr);
    sg.setAttribute('aSize', this.sSizeAttr);
    sg.setAttribute('aAlpha', this.sAlphaAttr);
    this.sprayUniforms = { uScale: { value: 600 }, uColor: { value: new THREE.Color(color) } };
    const sm = new THREE.ShaderMaterial({
      uniforms: this.sprayUniforms,
      vertexShader: /* glsl */ `
        attribute float aSize; attribute float aAlpha;
        uniform float uScale; varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = min(aSize * uScale / -mv.z, 256.0);
          vA = aAlpha;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vA;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d) * 2.0;
          float a = smoothstep(1.0, 0.35, r) * vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor * (0.9 + 0.2 * (1.0 - r)), a);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.sprayPoints = new THREE.Points(sg, sm);
    this.sprayPoints.frustumCulled = false;
    this.sprayPoints.renderOrder = 10;
    scene.add(this.sprayPoints);

    // Surface foam: flat quads that ride the waves.
    const F = (this.maxFoam = 3000);
    this.fx = new Float32Array(F);
    this.fz = new Float32Array(F);
    this.fvx = new Float32Array(F);
    this.fvz = new Float32Array(F);
    this.fLife = new Float32Array(F);
    this.fMax = new Float32Array(F);
    this.fSize = new Float32Array(F);
    this.fRot = new Float32Array(F);
    this.fCount = 0;
    this.fPos = new Float32Array(F * 4 * 3);
    this.fAlpha = new Float32Array(F * 4);
    const uv = new Float32Array(F * 4 * 2);
    const seed = new Float32Array(F * 4);
    const idx = new Uint32Array(F * 6);
    for (let i = 0; i < F; i++) {
      uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
      const sd = Math.random() * 100;
      seed.set([sd, sd, sd, sd], i * 4);
      const b = i * 4;
      idx.set([b, b + 2, b + 1, b, b + 3, b + 2], i * 6);
    }
    const fg = new THREE.BufferGeometry();
    this.fPosAttr = new THREE.BufferAttribute(this.fPos, 3).setUsage(THREE.DynamicDrawUsage);
    this.fAlphaAttr = new THREE.BufferAttribute(this.fAlpha, 1).setUsage(THREE.DynamicDrawUsage);
    fg.setAttribute('position', this.fPosAttr);
    fg.setAttribute('aAlpha', this.fAlphaAttr);
    fg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    fg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    fg.setIndex(new THREE.BufferAttribute(idx, 1));
    const fm = new THREE.ShaderMaterial({
      uniforms: { uColor: this.sprayUniforms.uColor },
      vertexShader: /* glsl */ `
        attribute float aAlpha; attribute float aSeed;
        varying float vA; varying vec2 vUv; varying float vSeed;
        void main() {
          vA = aAlpha; vUv = uv; vSeed = aSeed;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vA; varying vec2 vUv; varying float vSeed;
        float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main() {
          vec2 d = vUv - 0.5;
          float r = length(d) * 2.0;
          float nz = n(vUv * 7.0 + vSeed) * 0.6 + n(vUv * 15.0 - vSeed) * 0.4;
          float a = smoothstep(1.0, 0.45, r) * smoothstep(0.3, 0.6, nz) * vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor, a);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.foamMesh = new THREE.Mesh(fg, fm);
    this.foamMesh.frustumCulled = false;
    this.foamMesh.renderOrder = 5;
    scene.add(this.foamMesh);
  }

  setScale(height, fovDeg) {
    this.sprayUniforms.uScale.value = height / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  spray(x, y, z, vx, vy, vz, size, life) {
    if (this.sCount >= this.maxSpray) return;
    const i = this.sCount++;
    this.sp[i * 3] = x; this.sp[i * 3 + 1] = y; this.sp[i * 3 + 2] = z;
    this.sv[i * 3] = vx; this.sv[i * 3 + 1] = vy; this.sv[i * 3 + 2] = vz;
    this.sLife[i] = 0; this.sMax[i] = life; this.sSize0[i] = size;
  }

  foam(x, z, vx, vz, size, life) {
    if (this.fCount >= this.maxFoam) return;
    const i = this.fCount++;
    this.fx[i] = x; this.fz[i] = z; this.fvx[i] = vx; this.fvz[i] = vz;
    this.fLife[i] = 0; this.fMax[i] = life; this.fSize[i] = size; this.fRot[i] = Math.random() * 6.28;
  }

  splash(x, y, z, strength) {
    const n = Math.floor(20 + strength * 50);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = 2 + Math.random() * 5 * (0.5 + strength);
      this.spray(x, y + 0.2, z, Math.cos(a) * sp, 3 + Math.random() * 7 * (0.4 + strength), Math.sin(a) * sp, 0.7 + Math.random() * 1.2, 0.6 + Math.random() * 0.6);
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * 6.28;
      this.foam(x, z, Math.cos(a) * 3, Math.sin(a) * 3, 2.5 + strength * 2, 2.5);
    }
  }

  emitCraft(c, dt) {
    const sp = c.speed;
    if (c.frozen || !c.contact || c.airborne) return;
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), rx = -fz, rz = fx;
    const y = c.pos.y + 0.1;
    c._emit = (c._emit || 0) + dt;
    if (sp > 2.5) {
      // Rooster tail
      const rate = (c.input.throttle * 40 + sp * 1.5) * dt;
      for (let i = 0; i < rate; i++) {
        if (Math.random() > rate - i) break;
        const k = Math.random();
        this.spray(
          c.pos.x - fx * 1.5 + (Math.random() - 0.5) * 0.4, y + 0.2, c.pos.z - fz * 1.5 + (Math.random() - 0.5) * 0.4,
          c.vel.x * 0.35 - fx * (4 + k * 4) + (Math.random() - 0.5) * 2, 2.5 + sp * 0.22 * (0.6 + Math.random() * 0.6), c.vel.z * 0.35 - fz * (4 + k * 4) + (Math.random() - 0.5) * 2,
          0.5 + Math.random() * 0.9, 0.5 + Math.random() * 0.5,
        );
      }
      // Bow / carving spray
      const carve = Math.abs(c.latSpeed) + sp * 0.12;
      const side = Math.sign(c.latSpeed) || 1;
      const bRate = carve * 2.2 * dt;
      for (let i = 0; i < bRate; i++) {
        if (Math.random() > bRate - i) break;
        for (const s of Math.abs(c.latSpeed) > 3 ? [side] : [-1, 1]) {
          this.spray(
            c.pos.x + fx * 0.6 + rx * s * 0.7, y, c.pos.z + fz * 0.6 + rz * s * 0.7,
            c.vel.x * 0.6 + rx * s * (2 + carve * 0.4), 1.5 + Math.random() * (1.5 + carve * 0.2), c.vel.z * 0.6 + rz * s * (2 + carve * 0.4),
            0.35 + Math.random() * 0.5, 0.4 + Math.random() * 0.3,
          );
        }
      }
    }
    // Wake foam
    if (sp > 3 && c._emit > 0.08) {
      c._emit = 0;
      for (const s of [-1, 1]) {
        this.foam(c.pos.x - fx * 1.2 + rx * s * 0.55, c.pos.z - fz * 1.2 + rz * s * 0.55,
          rx * s * (1.4 + sp * 0.07) + fx * sp * 0.1, rz * s * (1.4 + sp * 0.07) + fz * sp * 0.1,
          0.9 + sp * 0.02, 2.8 + Math.random());
      }
      this.foam(c.pos.x - fx * 2.2, c.pos.z - fz * 2.2, 0, 0, 1.2, 1.6);
    }
  }

  update(dt, t) {
    const W = this.world;
    // Spray
    let n = this.sCount;
    for (let i = 0; i < n; i++) {
      this.sLife[i] += dt;
      const i3 = i * 3;
      this.sv[i3 + 1] -= 14 * dt;
      const drag = 1 - 1.2 * dt;
      this.sv[i3] *= drag; this.sv[i3 + 2] *= drag;
      this.sp[i3] += this.sv[i3] * dt;
      this.sp[i3 + 1] += this.sv[i3 + 1] * dt;
      this.sp[i3 + 2] += this.sv[i3 + 2] * dt;
      const dead = this.sLife[i] >= this.sMax[i] || (this.sv[i3 + 1] < 0 && this.sp[i3 + 1] < W.waterHeight(this.sp[i3], this.sp[i3 + 2], t) - 0.1);
      if (dead) {
        n--;
        if (i !== n) {
          this.sp[i3] = this.sp[n * 3]; this.sp[i3 + 1] = this.sp[n * 3 + 1]; this.sp[i3 + 2] = this.sp[n * 3 + 2];
          this.sv[i3] = this.sv[n * 3]; this.sv[i3 + 1] = this.sv[n * 3 + 1]; this.sv[i3 + 2] = this.sv[n * 3 + 2];
          this.sLife[i] = this.sLife[n]; this.sMax[i] = this.sMax[n]; this.sSize0[i] = this.sSize0[n];
        }
        i--;
        continue;
      }
      const k = this.sLife[i] / this.sMax[i];
      this.sSize[i] = this.sSize0[i] * (1 + k * 1.5);
      this.sAlpha[i] = (1 - k) * 0.6;
    }
    this.sCount = n;
    this.sprayPoints.geometry.setDrawRange(0, n);
    this.sPosAttr.needsUpdate = true;
    this.sSizeAttr.needsUpdate = true;
    this.sAlphaAttr.needsUpdate = true;

    // Foam
    n = this.fCount;
    for (let i = 0; i < n; i++) {
      this.fLife[i] += dt;
      if (this.fLife[i] >= this.fMax[i]) {
        n--;
        if (i !== n) {
          this.fx[i] = this.fx[n]; this.fz[i] = this.fz[n]; this.fvx[i] = this.fvx[n]; this.fvz[i] = this.fvz[n];
          this.fLife[i] = this.fLife[n]; this.fMax[i] = this.fMax[n]; this.fSize[i] = this.fSize[n]; this.fRot[i] = this.fRot[n];
        }
        i--;
        continue;
      }
      const damp = 1 - 0.8 * dt;
      this.fvx[i] *= damp; this.fvz[i] *= damp;
      this.fx[i] += this.fvx[i] * dt;
      this.fz[i] += this.fvz[i] * dt;
    }
    this.fCount = n;
    for (let i = 0; i < n; i++) {
      const k = this.fLife[i] / this.fMax[i];
      const s = this.fSize[i] * (1 + k * 1.6) * 0.5;
      const x = this.fx[i], z = this.fz[i];
      const y = W.waterHeight(x, z, t) + 0.05;
      const c = Math.cos(this.fRot[i]) * s, sn = Math.sin(this.fRot[i]) * s;
      const o = i * 12;
      this.fPos[o] = x - c + sn; this.fPos[o + 1] = y; this.fPos[o + 2] = z - sn - c;
      this.fPos[o + 3] = x + c + sn; this.fPos[o + 4] = y; this.fPos[o + 5] = z + sn - c;
      this.fPos[o + 6] = x + c - sn; this.fPos[o + 7] = y; this.fPos[o + 8] = z + sn + c;
      this.fPos[o + 9] = x - c - sn; this.fPos[o + 10] = y; this.fPos[o + 11] = z - sn + c;
      const a = Math.pow(1 - k, 1.8) * Math.min(1, this.fLife[i] * 10) * 0.4;
      this.fAlpha[i * 4] = this.fAlpha[i * 4 + 1] = this.fAlpha[i * 4 + 2] = this.fAlpha[i * 4 + 3] = a;
    }
    this.foamMesh.geometry.setDrawRange(0, n * 6);
    this.fPosAttr.needsUpdate = true;
    this.fAlphaAttr.needsUpdate = true;
  }

  clear() {
    this.sCount = 0;
    this.fCount = 0;
  }

  dispose(scene) {
    scene.remove(this.sprayPoints, this.foamMesh);
    this.sprayPoints.geometry.dispose();
    this.sprayPoints.material.dispose();
    this.foamMesh.geometry.dispose();
    this.foamMesh.material.dispose();
  }
}
