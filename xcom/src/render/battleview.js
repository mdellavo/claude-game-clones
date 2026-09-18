import * as THREE from 'three';
import { buildChunk, CHUNK } from './mapmesh.js';
import { buildUnitModel, refreshWeapon, weaponMesh, mat } from './unitmodels.js';
import { Effects, Atmosphere } from './effects.js';
import { itemDef } from '../data/items.js';
import { SPECIES } from '../data/units.js';
import { sfx } from '../audio.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class BattleView {
  constructor(container, battle) {
    this.container = container;
    this.battle = battle;
    this.map = battle.map;
    this.speed = 1;
    this.listeners = {};

    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: true }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const night = this.map.night;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // lights
    const hemi = new THREE.HemisphereLight(night ? 0x4a5a8a : 0xdfe8ff, night ? 0x101418 : 0x4a4030, night ? 0.9 : 1.6);
    this.scene.add(hemi);
    const sun = (this.sun = new THREE.DirectionalLight(night ? 0x8090c0 : 0xfff2dd, night ? 0.6 : 2.2));
    sun.position.set(this.map.w * 0.2, 40, this.map.l * 0.1);
    sun.target.position.set(this.map.w / 2, 0, this.map.l / 2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const half = Math.max(this.map.w, this.map.l) * 0.75;
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 140 });
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun, sun.target);
    this.pointLights = [];
    for (let i = 0; i < 6; i++) {
      const pl = new THREE.PointLight(0xffa050, 0, 8, 1.5);
      this.scene.add(pl);
      this.pointLights.push(pl);
    }

    // fog-of-war texture: RGBA channels = levels 0..3
    this.fogData = new Uint8Array(this.map.w * this.map.l * 4);
    this.fogTex = new THREE.DataTexture(this.fogData, this.map.w, this.map.l, THREE.RGBAFormat);
    this.fogTex.magFilter = THREE.NearestFilter;
    this.fogTex.minFilter = THREE.NearestFilter;
    this.fogTex.needsUpdate = true;
    this.terrainMat = this.makeTerrainMaterial();

    // ground plane under the map edge
    const under = new THREE.Mesh(new THREE.PlaneGeometry(this.map.w + 40, this.map.l + 40), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    under.scale.set(20, 20, 1);
    under.rotation.x = -Math.PI / 2;
    under.position.set(this.map.w / 2, -0.02, this.map.l / 2);
    this.scene.add(under);

    // camera
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
    this.cam = { target: new THREE.Vector3(this.map.w / 2, 0, this.map.l / 2), yaw: Math.PI / 4, yawTarget: Math.PI / 4, pitch: 0.62, zoom: 14, zoomTarget: 14, goal: null };
    this.viewLevel = this.map.h - 1;

    this.chunks = new Map();
    for (let z = 0; z < this.map.h; z++)
      for (let cy = 0; cy < this.map.l; cy += CHUNK)
        for (let cx = 0; cx < this.map.w; cx += CHUNK) this.rebuildChunk(cx, cy, z);
    this.map.dirty.clear();

    this.effects = new Effects(this.scene);
    this.atmo = new Atmosphere(this.scene);
    this.itemsGroup = new THREE.Group();
    this.scene.add(this.itemsGroup);
    this.unitViews = new Map();
    for (const u of battle.units.values()) this.addUnitView(u);

    // cursor & overlays
    this.cursor = new THREE.Group();
    const cmat = new THREE.LineBasicMaterial({ color: 0xffff40 });
    const cbox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), cmat);
    cbox.position.y = 0.5;
    this.cursorBox = cbox;
    this.cursor.add(cbox);
    this.scene.add(this.cursor);
    this.cursor.visible = false;
    this.pathGroup = new THREE.Group();
    this.scene.add(this.pathGroup);
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 24), new THREE.MeshBasicMaterial({ color: 0xffe040, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }));
    this.selRing.rotation.x = -Math.PI / 2;
    this.scene.add(this.selRing);
    this.selRing.visible = false;
    this.aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0xff5040, dashSize: 0.2, gapSize: 0.12 }));
    this.aimLine.visible = false;
    this.scene.add(this.aimLine);

    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();
    this.fogDirty = true;
    this.itemsDirty = true;
    this.atmoDirty = true;
    this.selected = null;
    this.hidden = false;

    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      this.frame();
    };
    loop();
  }

  on(evt, fn) {
    (this.listeners[evt] ||= []).push(fn);
  }
  emit(evt, ...args) {
    for (const fn of this.listeners[evt] || []) fn(...args);
  }

  dispose() {
    this.running = false;
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }

  makeTerrainMaterial() {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const uniforms = { fogTex: { value: this.fogTex }, mapSize: { value: new THREE.Vector2(this.map.w, this.map.l) } };
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aVox;\nattribute float aGlow;\nvarying vec3 vVox;\nvarying float vGlow;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvVox = aVox;\nvGlow = aGlow;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D fogTex;\nuniform vec2 mapSize;\nvarying vec3 vVox;\nvarying float vGlow;')
        .replace(
          '#include <opaque_fragment>',
          `#include <opaque_fragment>
          vec4 fd = texture2D(fogTex, (vVox.xy + 0.5) / mapSize);
          float disc = vVox.z < 0.5 ? fd.r : vVox.z < 1.5 ? fd.g : vVox.z < 2.5 ? fd.b : fd.a;
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vColor.rgb * 1.6, vGlow);
          gl_FragColor.rgb *= disc;`,
        );
    };
    return m;
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.aspect = w / h;
  }

  // ------------------------------------------------------------------ terrain
  rebuildChunk(cx, cy, z) {
    const key = `${cx},${cy},${z}`;
    const old = this.chunks.get(key);
    if (old) {
      this.scene.remove(old);
      old.geometry.dispose();
      this.chunks.delete(key);
    }
    const geo = buildChunk(this.map, cx, cy, z);
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, this.terrainMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.z = z;
    mesh.visible = z <= this.viewLevel;
    this.scene.add(mesh);
    this.chunks.set(key, mesh);
  }

  processDirty() {
    const m = this.map;
    if (!m.dirty.size) return;
    const todo = new Set();
    for (const i of m.dirty) {
      const { x, y, z } = m.pos(i);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.l) continue;
          todo.add(`${Math.floor(nx / CHUNK) * CHUNK},${Math.floor(ny / CHUNK) * CHUNK},${z}`);
        }
    }
    m.dirty.clear();
    for (const k of todo) {
      const [cx, cy, z] = k.split(',').map(Number);
      this.rebuildChunk(cx, cy, z);
    }
    this.itemsDirty = true;
  }

  updateFog() {
    const m = this.map;
    const d = this.fogData;
    const wl = m.w * m.l;
    for (let i = 0; i < wl; i++) {
      for (let z = 0; z < 4; z++) {
        d[i * 4 + z] = z < m.h && m.discovered[i + z * wl] ? 255 : z < m.h ? 0 : 255;
      }
    }
    // reveal the top of anything discovered below: helps roofs read correctly
    this.fogTex.needsUpdate = true;
  }

  setViewLevel(z) {
    this.viewLevel = Math.max(0, Math.min(this.map.h - 1, z));
    for (const c of this.chunks.values()) c.visible = c.userData.z <= this.viewLevel;
    this.itemsDirty = true;
    this.atmoDirty = true;
    this.emit('viewLevel', this.viewLevel);
  }

  // ------------------------------------------------------------------ items
  rebuildItems() {
    const g = this.itemsGroup;
    for (const c of [...g.children]) g.remove(c);
    const m = this.map;
    for (const [i, items] of m.items) {
      if (!items.length || !m.discovered[i]) continue;
      const p = m.pos(i);
      if (p.z > this.viewLevel) continue;
      let k = 0;
      for (const it of items) {
        const d = itemDef(it.id);
        if (it.id === 'corpse') {
          const sp = Object.values(SPECIES).find((s) => s.name === it.corpseOf);
          const fake = { model: sp ? sp.model : 'soldier', color: it.color ?? (sp ? sp.color : 0x6f7f4f), skin: 0xc09070, armorMax: { front: 10 }, mainWeapon: () => null };
          const model = buildUnitModel(fake);
          model.root.position.set(p.x + 0.5, p.z + 0.05, p.y + 0.5);
          model.body.rotation.x = -Math.PI / 2;
          model.body.position.set(0, 0.12, 0.3);
          model.root.rotation.y = (i * 1.7) % 6.28;
          model.root.traverse((o) => {
            if (o.isMesh) o.material = mat(0x4a3030);
          });
          if (sp) model.root.traverse((o) => { if (o.isMesh) o.material = mat(new THREE.Color(sp.color).multiplyScalar(0.55).getHex()); });
          g.add(model.root);
          continue;
        }
        if (k > 3) continue;
        const wm = weaponMesh(it);
        if (!wm.children.length) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.14), mat(d.color ? new THREE.Color(d.color).getHex() : 0x999999));
          wm.add(b);
        }
        wm.position.set(p.x + 0.3 + (k % 2) * 0.35, p.z + 0.05, p.y + 0.35 + Math.floor(k / 2) * 0.3);
        wm.rotation.y = (k * 1.3 + i) % 6.28;
        if (it.primed) {
          const blink = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), mat(0xff2020, 1));
          blink.position.y = 0.12;
          blink.userData.blink = true;
          wm.add(blink);
        }
        g.add(wm);
        k++;
      }
    }
  }

  // ------------------------------------------------------------------ units
  addUnitView(u) {
    if (this.unitViews.has(u.id)) return this.unitViews.get(u.id);
    const model = buildUnitModel(u);
    refreshWeapon(model, u);
    model.root.traverse((o) => {
      if (o.isMesh) o.userData.unitId = u.id;
    });
    const v = { u, model, pos: new THREE.Vector3(), yaw: 0, anim: null, flash: 0, t: Math.random() * 10, fall: 0 };
    this.placeUnit(v);
    this.scene.add(model.root);
    this.unitViews.set(u.id, v);
    return v;
  }

  unitWorldPos(u) {
    const m = this.map;
    const hover = u.isFlying && u.z > 0 && !m.hasStandingFloor(u.x, u.y, u.z) ? 0.15 : 0;
    return new THREE.Vector3(u.x + 0.5, u.z + hover, u.y + 0.5);
  }

  placeUnit(v) {
    v.pos.copy(this.unitWorldPos(v.u));
    v.yaw = (-v.u.facing * Math.PI) / 4;
    v.model.root.position.copy(v.pos);
    v.model.root.rotation.y = v.yaw;
  }

  unitVisible(u) {
    if (u.status === 'dead' || u.removed) return false;
    if (u.z > this.viewLevel) return false;
    return this.battle.visibleToPlayer(u) || (u.status === 'unconscious' && this.map.discovered[this.map.idx(u.x, u.y, u.z)] > 0);
  }

  updateUnits(dt) {
    for (const v of this.unitViews.values()) {
      const u = v.u;
      const root = v.model.root;
      v.t += dt;
      if (u.removed && !v.anim) {
        root.visible = false;
        continue;
      }
      if (v.anim) {
        const a = v.anim;
        a.t += dt * this.speed;
        const k = Math.min(1, a.t / a.dur);
        if (a.type === 'move') {
          root.position.lerpVectors(a.from, a.to, k);
          root.position.y += Math.sin(k * Math.PI) * (a.from.y !== a.to.y ? 0.1 : 0.04);
          for (let li = 0; li < v.model.legs.length; li++) v.model.legs[li].rotation.x = Math.sin(k * Math.PI * 2 + li * Math.PI) * 0.5;
        } else if (a.type === 'lunge') {
          const s = Math.sin(k * Math.PI) * 0.35;
          root.position.copy(v.pos).addScaledVector(a.dir, s);
        } else if (a.type === 'fall') {
          v.model.body.rotation.x = -k * Math.PI / 2;
          v.model.body.position.y = v.model.hover * (1 - k) + 0.1 * k;
          v.model.body.position.z = 0.3 * k;
        }
        if (k >= 1) {
          v.anim = null;
          for (const l of v.model.legs) l.rotation.x = 0;
          a.resolve();
        }
      } else {
        if (u.status === 'active') {
          v.pos.copy(this.unitWorldPos(u));
          root.position.copy(v.pos);
          v.model.body.rotation.x = 0;
          v.model.body.position.set(0, v.model.hover + Math.sin(v.t * 3) * (v.model.hover ? 0.02 : 0), u.kneeling ? -0.02 : 0);
          v.model.body.scale.y = u.kneeling ? 0.72 : 1;
        } else if (u.status === 'unconscious') {
          root.position.copy(this.unitWorldPos(u));
          v.model.body.rotation.x = -Math.PI / 2;
          v.model.body.position.set(0, 0.12, 0.3);
        }
      }
      // smooth facing
      const targetYaw = (-u.facing * Math.PI) / 4;
      let dy = targetYaw - v.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      v.yaw += dy * Math.min(1, dt * 14 * this.speed);
      root.rotation.y = v.yaw;
      if (v.flash > 0) {
        v.flash -= dt;
        root.visible = Math.floor(v.flash * 20) % 2 === 0;
      } else {
        root.visible = u.status === 'active' || u.status === 'unconscious' ? this.unitVisible(u) : !!v.anim && v.anim.type === 'fall';
      }
      refreshWeapon(v.model, u);
    }
    // selection ring
    const s = this.selected;
    if (s && s.active && this.unitViews.has(s.id) && s.z <= this.viewLevel) {
      const r = this.unitViews.get(s.id).model.root.position;
      this.selRing.position.set(r.x, r.y + 0.02, r.z);
      this.selRing.visible = true;
      this.selRing.material.opacity = 0.6 + Math.sin(this.clock.elapsedTime * 5) * 0.3;
    } else this.selRing.visible = false;
  }

  animate(u, anim) {
    const v = this.unitViews.get(u.id) || this.addUnitView(u);
    if (v.anim) {
      v.anim.t = v.anim.dur;
    }
    return new Promise((resolve) => {
      v.anim = { ...anim, t: 0, resolve };
    });
  }

  // ------------------------------------------------------------------ camera
  centerOn(x, y, z, instant = false) {
    const p = new THREE.Vector3(x + 0.5, z, y + 0.5);
    if (instant) {
      this.cam.target.copy(p);
      this.cam.goal = null;
    } else this.cam.goal = p;
  }
  rotate(dir) {
    this.cam.yawTarget += (dir * Math.PI) / 2;
  }
  zoomBy(f) {
    this.cam.zoomTarget = Math.max(5, Math.min(40, this.cam.zoomTarget * f));
  }
  pan(dx, dz) {
    // screen-relative pan
    const yaw = this.cam.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const t = this.cam.target;
    t.x += rx * dx + fx * dz;
    t.z += rz * dx + fz * dz;
    t.x = Math.max(0, Math.min(this.map.w, t.x));
    t.z = Math.max(0, Math.min(this.map.l, t.z));
    this.cam.goal = null;
  }
  isOnScreen(x, y, z, margin = 0.2) {
    const v = new THREE.Vector3(x + 0.5, z, y + 0.5).project(this.camera);
    return Math.abs(v.x) < 1 - margin && Math.abs(v.y) < 1 - margin;
  }

  updateCamera(dt) {
    const c = this.cam;
    if (c.goal) {
      c.target.lerp(c.goal, Math.min(1, dt * 6));
      if (c.target.distanceTo(c.goal) < 0.02) c.goal = null;
    }
    c.yaw += (c.yawTarget - c.yaw) * Math.min(1, dt * 8);
    c.zoom += (c.zoomTarget - c.zoom) * Math.min(1, dt * 10);
    const dist = 80;
    const shake = this.effects.shake;
    const cam = this.camera;
    cam.position.set(
      c.target.x + Math.sin(c.yaw) * Math.cos(c.pitch) * dist,
      c.target.y + Math.sin(c.pitch) * dist,
      c.target.z + Math.cos(c.yaw) * Math.cos(c.pitch) * dist,
    );
    const look = c.target.clone();
    if (shake > 0) {
      look.x += (Math.random() - 0.5) * shake * 0.3;
      look.z += (Math.random() - 0.5) * shake * 0.3;
    }
    cam.lookAt(look);
    cam.left = -c.zoom * this.aspect;
    cam.right = c.zoom * this.aspect;
    cam.top = c.zoom;
    cam.bottom = -c.zoom;
    cam.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ picking
  pick(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    // units first
    const meshes = [];
    for (const v of this.unitViews.values()) {
      if (!v.model.root.visible || !v.u.active) continue;
      v.model.root.traverse((o) => o.isMesh && meshes.push(o));
    }
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length) {
      const u = this.battle.units.get(hits[0].object.userData.unitId);
      if (u) return { x: u.x, y: u.y, z: u.z, unit: u };
    }
    // walk down from the view level to find the first plane hit on a discovered, standable tile
    const ray = this.raycaster.ray;
    for (let z = this.viewLevel; z >= 0; z--) {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -z);
      const p = new THREE.Vector3();
      if (!ray.intersectPlane(plane, p)) continue;
      const x = Math.floor(p.x), y = Math.floor(p.z);
      if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.l) {
        if (z === 0) return null;
        continue;
      }
      const i = this.map.idx(x, y, z);
      if (z === 0 || (this.map.floor[i] && this.map.discovered[i])) return { x, y, z, unit: null };
    }
    return null;
  }

  setCursor(tile, color = 0xffff40) {
    if (!tile) {
      this.cursor.visible = false;
      return;
    }
    this.cursor.visible = true;
    this.cursor.position.set(tile.x + 0.5, tile.z, tile.y + 0.5);
    this.cursorBox.material.color.setHex(color);
  }

  showPath(path, colorFn) {
    const g = this.pathGroup;
    for (const c of [...g.children]) {
      g.remove(c);
    }
    if (!path) return;
    for (const p of path) {
      const m = new THREE.Mesh(this.pathGeo ||= new THREE.BoxGeometry(0.2, 0.04, 0.2), this.pathMat(colorFn(p)));
      m.position.set(p.x + 0.5, p.z + 0.05, p.y + 0.5);
      g.add(m);
    }
  }
  pathMat(hex) {
    this._pm ||= {};
    return (this._pm[hex] ||= new THREE.MeshBasicMaterial({ color: hex, depthTest: false, transparent: true, opacity: 0.9 }));
  }

  showAim(from, to) {
    if (!from || !to) {
      this.aimLine.visible = false;
      return;
    }
    const pos = this.aimLine.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.z, from.y);
    pos.setXYZ(1, to.x, to.z, to.y);
    pos.needsUpdate = true;
    this.aimLine.geometry.computeBoundingSphere();
    this.aimLine.computeLineDistances();
    this.aimLine.visible = true;
  }

  projectToScreen(x, y, z) {
    const v = new THREE.Vector3(x, z, y).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  // ------------------------------------------------------------------ frame
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.processDirty();
    if (this.fogDirty) {
      this.fogDirty = false;
      this.updateFog();
    }
    if (this.itemsDirty) {
      this.itemsDirty = false;
      this.rebuildItems();
    }
    if (this.atmoDirty) {
      this.atmoDirty = false;
      this.atmo.rebuild(this.map, this.viewLevel);
      this.updatePointLights();
    }
    this.updateUnits(dt);
    this.effects.update(dt * this.speed);
    this.atmo.update(dt);
    this.updateCamera(dt);
    const blinkOn = Math.floor(this.clock.elapsedTime * 3) % 2 === 0;
    this.itemsGroup.traverse((o) => {
      if (o.userData.blink) o.visible = blinkOn;
    });
    this.emit('frame', dt);
    this.renderer.render(this.scene, this.camera);
  }

  updatePointLights() {
    const lights = [];
    for (const f of this.battle.flares) lights.push({ x: f.x, y: f.y, z: f.z, color: 0xe0f0ff, i: 3, d: 10 });
    const m = this.map;
    const fires = this.atmo.fireList;
    for (let k = 0; k < fires.length && lights.length < this.pointLights.length; k += Math.max(1, Math.floor(fires.length / 4))) {
      lights.push({ ...fires[k], color: 0xff8030, i: 2, d: 6 });
    }
    this.pointLights.forEach((pl, i) => {
      const l = lights[i];
      if (!l) {
        pl.intensity = 0;
        return;
      }
      pl.position.set(l.x + 0.5, l.z + 0.8, l.y + 0.5);
      pl.color.setHex(l.color);
      pl.intensity = l.i * (m.night ? 2 : 0.6);
      pl.distance = l.d;
    });
  }

  // ================================================================== Battle view hooks
  async unitStep(u, from, to, visible) {
    const v = this.unitViews.get(u.id);
    if (!v) return;
    if (!visible || this.hiddenFast(u)) {
      this.placeUnit(v);
      return;
    }
    if (u.faction === 'alien' || !this.isOnScreen(u.x, u.y, u.z, 0.25)) this.centerOn(u.x, u.y, u.z);
    if (u.faction === 'xcom' && u.z !== this.viewLevel && u === this.selected && u.z > this.viewLevel) this.setViewLevel(u.z);
    sfx('step', u.model);
    const fromP = new THREE.Vector3(from.x + 0.5, from.z, from.y + 0.5);
    const hoverFrom = u.isFlying && from.z > 0 && !this.map.hasStandingFloor(from.x, from.y, from.z) ? 0.15 : 0;
    fromP.y += hoverFrom;
    const toP = this.unitWorldPos(u);
    const vertical = from.z !== to.z;
    await this.animate(u, { type: 'move', from: fromP, to: toP, dur: vertical ? 0.35 : 0.17 });
    v.pos.copy(toP);
    this.atmoDirty = true;
  }

  hiddenFast() {
    return false;
  }

  async unitTurned(u) {
    const v = this.unitViews.get(u.id);
    if (v && this.unitVisible(u)) await sleep(40 / this.speed);
  }

  async shot(u, from, to, type, trace) {
    const vis = this.unitVisible(u) || (trace.unit && this.unitVisible(trace.unit)) || this.map.discovered[this.map.idx(Math.floor(from.x), Math.floor(from.y), Math.floor(from.z))];
    if (!vis) return;
    if (u.faction === 'alien' && !this.isOnScreen(u.x, u.y, u.z, 0.15)) {
      this.centerOn(u.x, u.y, u.z);
      await sleep(250 / this.speed);
    }
    sfx(type);
    await this.effects.projectile(from, to, type);
    if (trace.hit === 'unit') sfx('hit');
    else if (trace.hit === 'obj' || trace.hit === 'floor') sfx('ricochet');
  }

  async thrown(u, path, item) {
    sfx('throw');
    const d = itemDef(item.id);
    await this.effects.arc(path, d.color ? new THREE.Color(d.color).getHex() : 0x708050);
    this.itemsDirty = true;
  }

  async explosion(p, radius, type) {
    sfx(type === 'SMOKE' ? 'smoke' : type === 'STUN' ? 'stunblast' : 'explosion', radius);
    if (!this.isOnScreen(p.x - 0.5, p.y - 0.5, p.z, 0.1)) {
      this.centerOn(p.x - 0.5, p.y - 0.5, Math.floor(p.z));
      await sleep(200 / this.speed);
    }
    await this.effects.explosion(p, radius, type);
    this.fogDirty = true;
    this.atmoDirty = true;
  }

  async melee(u, target) {
    const v = this.unitViews.get(u.id);
    if (!v || !(this.unitVisible(u) || this.unitVisible(target))) return;
    sfx('melee');
    const dir = new THREE.Vector3(target.x - u.x, 0, target.y - u.y).normalize();
    await this.animate(u, { type: 'lunge', dir, dur: 0.3 });
    await this.effects.melee({ x: target.x + 0.5, y: target.y + 0.5, z: target.z + 0.5 });
  }

  unitHit(u, dmg) {
    const v = this.unitViews.get(u.id);
    if (!v) return;
    if (dmg > 0) {
      v.flash = 0.35;
      if (this.unitVisible(u)) this.emit('damage', u, dmg);
    }
  }

  unitDown(u, state) {
    const v = this.unitViews.get(u.id);
    if (!v) return;
    const vis = this.unitVisible(u) || this.battle.visibleToPlayer(u) || this.map.discovered[this.map.idx(u.x, u.y, u.z)];
    if (vis) {
      sfx(u.faction === 'alien' ? 'aliendie' : 'humandie');
      v.flash = 0;
      this.animate(u, { type: 'fall', dur: 0.5 });
    }
    this.itemsDirty = true;
    this.emit('unitDown', u, state);
  }

  unitSpawned(u) {
    const v = this.addUnitView(u);
    this.placeUnit(v);
    this.itemsDirty = true;
  }

  spotted(target, viewer) {
    this.emit('spotted', target, viewer);
  }

  terrainChanged() {
    this.fogDirty = true;
    this.itemsDirty = true;
    this.atmoDirty = true;
  }

  visibilityChanged() {
    this.emit('visibility');
  }

  message(msg, kind) {
    this.emit('message', msg, kind);
  }

  turnStarted(side, turn) {
    this.fogDirty = true;
    this.atmoDirty = true;
    this.itemsDirty = true;
    this.emit('turn', side, turn);
  }

  async alienTurnFocus(a, target) {
    if (!this.battle.visibleToPlayer(a) && !(target && this.battle.visibleToPlayer(a))) return;
    this.emit('alienVisible', a);
    if (!this.isOnScreen(a.x, a.y, a.z, 0.25)) {
      this.centerOn(a.x, a.y, a.z);
      await sleep(350 / this.speed);
    }
  }

  async reactionFire(reactor) {
    if (!this.unitVisible(reactor)) return;
    this.emit('reaction', reactor);
    this.centerOn(reactor.x, reactor.y, reactor.z);
    await sleep(300 / this.speed);
  }
}
