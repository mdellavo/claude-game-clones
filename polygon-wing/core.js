'use strict';
// Polygon Wing — engine: renderer, flat-shaded models, particles, audio.
(function () {
  const SF = (window.SF = {});

  const C = (SF.C = {
    skyTop: '#0a1030', skyMid: '#23407a', horizon: '#e9a86b',
    ground: '#1f4a3c', groundLine: '#2f6b55',
    hull: 0xe3e7ef, wing: 0x2f5fe0, glass: 0x1a2440, glow: 0xffb13d,
    enemy: 0xd8433a, enemyTrim: 0xf2c14b, spinner: 0xf28a3b,
    rock: 0x6d7390, rockTop: 0x9aa0bd, tower: 0x46506f,
    laser: 0x7dffb0, eshot: 0xff6a3c, gold: 0xffd24a, silver: 0xdfe8ff,
    ally: 0x5fb0ff, boss: 0x5a5f7a, bossTrim: 0xd8433a, core: 0xff3060,
  });

  // ---------- renderer ----------
  const canvas = document.getElementById('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const RES = 0.5 * Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(Math.max(RES, 0.5));
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x23407a, 180, 520);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 1200);
  camera.position.set(0, 12, 26);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 78 : 62;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // sky gradient background
  const sky = document.createElement('canvas');
  sky.width = 4; sky.height = 256;
  const sg = sky.getContext('2d');
  const grad = sg.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, C.skyTop); grad.addColorStop(0.55, C.skyMid); grad.addColorStop(0.7, C.horizon); grad.addColorStop(1, '#23407a');
  sg.fillStyle = grad; sg.fillRect(0, 0, 4, 256);
  scene.background = new THREE.CanvasTexture(sky);

  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x203a30, 0.65));
  const sun = new THREE.DirectionalLight(0xfff2dd, 0.95);
  sun.position.set(-0.6, 1, 0.5);
  scene.add(sun);

  // ground: tiled canvas texture scrolled by distance
  const gt = document.createElement('canvas');
  gt.width = gt.height = 64;
  const gg = gt.getContext('2d');
  gg.fillStyle = C.ground; gg.fillRect(0, 0, 64, 64);
  gg.fillStyle = '#1a4033'; gg.fillRect(0, 0, 32, 32); gg.fillRect(32, 32, 32, 32);
  gg.fillStyle = C.groundLine; gg.fillRect(0, 0, 64, 2); gg.fillRect(0, 0, 2, 64);
  const groundTex = new THREE.CanvasTexture(gt);
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.magFilter = THREE.NearestFilter;
  const GROUND_DEPTH = 1000, TILE = 25;
  groundTex.repeat.set(1000 / TILE, GROUND_DEPTH / TILE);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, GROUND_DEPTH), new THREE.MeshLambertMaterial({ map: groundTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -GROUND_DEPTH / 2 + 60);
  scene.add(ground);
  SF.scrollGround = (d) => { groundTex.offset.y = d / TILE; };

  // distant mountain ridge for horizon silhouette
  (function ridge() {
    const pts = [];
    for (let i = 0; i <= 40; i++) pts.push([-900 + i * 45, 20 + Math.abs(Math.sin(i * 1.7) * 60 + Math.sin(i * 0.6) * 40)]);
    const v = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, h0] = pts[i], [x1, h1] = pts[i + 1];
      v.push(x0, 0, 0, x1, 0, 0, x0, h0, 0, x1, 0, 0, x1, h1, 0, x0, h0, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x2b3f6e, fog: false, side: THREE.DoubleSide }));
    m.position.set(0, 0, -700);
    scene.add(m);
  })();

  // ---------- geometry helpers ----------
  const matCache = {};
  function mat(color, basic) {
    const k = color + (basic ? 'b' : 'p');
    if (!matCache[k]) {
      matCache[k] = basic
        ? new THREE.MeshBasicMaterial({ color })
        : new THREE.MeshPhongMaterial({ color, flatShading: true, shininess: 10, side: THREE.DoubleSide });
    }
    return matCache[k];
  }
  function poly(verts, tris) {
    const p = [];
    for (const t of tris) for (const i of t) p.push(verts[i][0], verts[i][1], verts[i][2]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    return g;
  }
  const mirror = (vs) => vs.map(([x, y, z]) => [-x, y, z]);
  function part(group, geo, color, basic) { const m = new THREE.Mesh(geo, mat(color, basic)); group.add(m); return m; }

  const G = {}; // shared geometries
  // Lancer — player ship (nose toward -z)
  G.body = poly([[0, 0, -4.2], [0, 0.9, 0.6], [0, -0.55, 0.9], [-1.1, 0, 1.6], [1.1, 0, 1.6], [0, 0.15, 2.3]],
    [[0, 1, 3], [0, 1, 4], [0, 2, 3], [0, 2, 4], [1, 3, 5], [1, 4, 5], [2, 3, 5], [2, 4, 5]]);
  const wingL = [[-0.8, 0, -0.4], [-5.2, -0.8, 2.7], [-1, 0.05, 2.1], [-4.8, -0.7, 2.3], [-5.3, 1.3, 3.3], [-4.4, -0.6, 3.2], [-0.4, 0, -2.7], [-1.9, -0.15, -1.3], [-0.6, 0, -1.1]];
  const wingTris = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];
  G.wings = poly(wingL.concat(mirror(wingL)), wingTris.concat(wingTris.map((t) => t.map((i) => i + 9))));
  G.glass = poly([[-0.42, 0.35, -0.9], [0.42, 0.35, -0.9], [0, 0.98, 0.1], [0, 0.25, -2.1]], [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]);
  G.flame = new THREE.ConeGeometry(0.45, 1.6, 5);
  G.flame.rotateX(Math.PI / 2);

  SF.makeLancer = function (wingColor) {
    const g = new THREE.Group();
    part(g, G.body, C.hull);
    part(g, G.wings, wingColor || C.wing);
    part(g, G.glass, C.glass);
    const flame = part(g, G.flame, C.glow, true);
    flame.position.set(0, 0.15, 3.1);
    g.userData.flame = flame;
    return g;
  };

  // Dart interceptor (nose toward +z, facing the player)
  G.dart = poly([[0, 0, 3], [-2.6, 0, -1.6], [2.6, 0, -1.6], [0, 1.1, -1], [0, -0.6, -1], [0, 0, -2.2]],
    [[0, 1, 3], [0, 2, 3], [0, 1, 4], [0, 2, 4], [1, 3, 5], [2, 3, 5], [1, 4, 5], [2, 4, 5]]);
  G.dartFin = poly([[-2.6, 0, -1.6], [-3.1, 1.4, -2.4], [-2.2, 0, -2.4], [2.6, 0, -1.6], [3.1, 1.4, -2.4], [2.2, 0, -2.4]], [[0, 1, 2], [3, 4, 5]]);
  SF.makeDart = () => { const g = new THREE.Group(); part(g, G.dart, C.enemy); part(g, G.dartFin, C.enemyTrim); return g; };

  G.spin = new THREE.OctahedronGeometry(2.3, 0);
  G.spinRing = new THREE.TorusGeometry(3.1, 0.35, 3, 6);
  SF.makeSpinner = () => {
    const g = new THREE.Group();
    const a = part(g, G.spin, C.spinner);
    const r = part(g, G.spinRing, C.enemyTrim);
    g.userData.spin = [a, r];
    return g;
  };

  G.turretBase = new THREE.CylinderGeometry(2.6, 3.4, 2.4, 6);
  G.turretHead = new THREE.DodecahedronGeometry(1.8, 0);
  G.barrel = new THREE.BoxGeometry(0.5, 0.5, 3.4);
  SF.makeTurret = () => {
    const g = new THREE.Group();
    part(g, G.turretBase, C.tower).position.y = 1.2;
    const head = new THREE.Group();
    head.position.y = 3.2;
    part(head, G.turretHead, C.enemy);
    part(head, G.barrel, C.enemyTrim).position.set(0, 0.3, 1.8);
    g.add(head);
    g.userData.head = head;
    return g;
  };

  G.box = new THREE.BoxGeometry(1, 1, 1);
  G.hex = new THREE.CylinderGeometry(1, 1, 1, 6);
  SF.makePillar = (w, h, hex) => {
    const g = new THREE.Group();
    const m = part(g, hex ? G.hex : G.box, hex ? C.tower : C.rock);
    m.scale.set(w, h, w); m.position.y = h / 2;
    const cap = part(g, hex ? G.hex : G.box, C.rockTop);
    cap.scale.set(w * 1.15, 1.2, w * 1.15); cap.position.y = h;
    return g;
  };
  SF.makeArch = (span, h) => {
    const g = new THREE.Group();
    for (const s of [-1, 1]) { const p = part(g, G.box, C.rock); p.scale.set(4, h, 4); p.position.set(s * span / 2, h / 2, 0); }
    const top = part(g, G.box, C.rockTop);
    top.scale.set(span + 6, 3.5, 5); top.position.y = h + 1.5;
    return g;
  };

  G.ring = new THREE.TorusGeometry(2.8, 0.5, 4, 12);
  G.gem = new THREE.IcosahedronGeometry(1.6, 0);
  G.bombGem = new THREE.OctahedronGeometry(1.7, 0);
  SF.makeRing = (gold) => { const g = new THREE.Group(); part(g, G.ring, gold ? C.gold : C.silver); return g; };
  SF.makeGem = (kind) => {
    const g = new THREE.Group();
    part(g, kind === 'bomb' ? G.bombGem : G.gem, kind === 'bomb' ? C.enemy : C.wing);
    const r = part(g, G.ring, C.silver); r.scale.setScalar(0.8);
    return g;
  };

  // Warden carrier boss
  G.bossHull = new THREE.CylinderGeometry(9, 15, 7, 6);
  G.bossHull.rotateX(Math.PI / 2);
  G.plate = new THREE.BoxGeometry(5.2, 5.2, 1.6);
  G.core = new THREE.IcosahedronGeometry(3.4, 0);
  G.pod = new THREE.OctahedronGeometry(3.2, 0);
  G.arm = new THREE.BoxGeometry(1, 1.4, 3);
  SF.makeWarden = () => {
    const g = new THREE.Group();
    part(g, G.bossHull, C.boss);
    const core = part(g, G.core, C.core, true); core.position.z = 3;
    const plates = [];
    for (let i = 0; i < 4; i++) {
      const p = part(g, G.plate, C.bossTrim);
      p.userData.dir = [(i % 2 ? 1 : -1), (i < 2 ? 1 : -1)];
      p.position.set(p.userData.dir[0] * 2.6, p.userData.dir[1] * 2.6, 5);
      plates.push(p);
    }
    const pods = [];
    for (const [x, y] of [[-17, 6], [17, 6], [-15, -8], [15, -8]]) {
      const arm = part(g, G.arm, C.tower);
      arm.scale.x = Math.hypot(x, y) - 6;
      arm.position.set(x / 2, y / 2, 0);
      arm.rotation.z = Math.atan2(y, x);
      const pod = part(g, G.pod, C.spinner);
      pod.position.set(x, y, 1);
      pods.push(pod);
    }
    g.userData = { core, plates, pods };
    return g;
  };

  // ---------- projectiles & particles (pooled) ----------
  G.laser = new THREE.BoxGeometry(0.3, 0.3, 5);
  G.eshot = new THREE.OctahedronGeometry(0.9, 0);
  G.shard = new THREE.TetrahedronGeometry(0.8, 0);
  G.flash = new THREE.IcosahedronGeometry(1, 1);

  function pool(make) {
    const free = [];
    return {
      get() { const m = free.pop() || make(); m.visible = true; if (!m.parent) scene.add(m); return m; },
      put(m) { m.visible = false; free.push(m); },
    };
  }
  SF.laserPool = pool(() => new THREE.Mesh(G.laser, mat(C.laser, true)));
  SF.eshotPool = pool(() => new THREE.Mesh(G.eshot, mat(C.eshot, true)));
  const shardMats = [mat(0xffb13d, true), mat(0xfff0a0, true), mat(0x60667e)];
  const shardPool = pool(() => new THREE.Mesh(G.shard, shardMats[0]));
  const flashPool = pool(() => new THREE.Mesh(G.flash, new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));

  const particles = [];
  SF.explode = function (pos, size = 1, count = 14) {
    for (let i = 0; i < count; i++) {
      const s = shardPool.get();
      s.material = shardMats[i % 3];
      s.position.copy(pos);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar((12 + Math.random() * 22) * size);
      s.scale.setScalar(size * (0.6 + Math.random()));
      particles.push({ m: s, v, life: 0.7 + Math.random() * 0.5, spin: Math.random() * 10, kind: 's' });
    }
    const f = flashPool.get();
    f.position.copy(pos);
    f.material.opacity = 1;
    particles.push({ m: f, life: 0.35, max: 0.35, size: 5 * size, kind: 'f' });
  };
  SF.updateParticles = function (dt, scroll) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.kind === 's') {
        p.v.y -= 30 * dt;
        p.m.position.addScaledVector(p.v, dt);
        p.m.position.z += scroll * dt;
        p.m.rotation.x += p.spin * dt; p.m.rotation.y += p.spin * dt;
        if (p.m.position.y < 0.3) { p.m.position.y = 0.3; p.v.y *= -0.4; }
      } else {
        const k = 1 - p.life / p.max;
        p.m.scale.setScalar(p.size * (0.4 + k));
        p.m.material.opacity = Math.max(0, 1 - k);
        p.m.position.z += scroll * dt;
      }
      if (p.life <= 0) { (p.kind === 's' ? shardPool : flashPool).put(p.m); particles.splice(i, 1); }
    }
  };
  SF.clearParticles = () => { while (particles.length) { const p = particles.pop(); (p.kind === 's' ? shardPool : flashPool).put(p.m); } };

  // reticle: two square brackets ahead of the ship
  function square(size) {
    const s = size / 2;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-s, -s, 0, s, -s, 0, s, -s, 0, s, s, 0, s, s, 0, -s, s, 0, -s, s, 0, -s, -s, 0], 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: C.laser, fog: false }));
  }
  SF.reticle = [square(2.2), square(3.2)];
  SF.reticle.forEach((r) => scene.add(r));

  Object.assign(SF, { renderer, scene, camera, mat });

  // ---------- audio ----------
  const A = (SF.audio = { ctx: null, muted: false, master: null });
  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    A.ctx = new Ctx();
    A.master = A.ctx.createGain();
    A.master.gain.value = 0.5;
    A.master.connect(A.ctx.destination);
    const len = A.ctx.sampleRate;
    A.noiseBuf = A.ctx.createBuffer(1, len, len);
    const d = A.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  };
  A.setMuted = (m) => { A.muted = m; if (A.master) A.master.gain.value = m ? 0 : 0.5; };
  A.tone = function (f, dur, type = 'square', vol = 0.15, f2, when = 0) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime + when;
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(A.master);
    o.start(t); o.stop(t + dur + 0.02);
  };
  A.noise = function (dur, vol = 0.3, freq = 1200, when = 0) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime + when;
    const s = A.ctx.createBufferSource(), f = A.ctx.createBiquadFilter(), g = A.ctx.createGain();
    s.buffer = A.noiseBuf;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(80, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(A.master);
    s.start(t); s.stop(t + dur);
  };
  A.sfx = {
    laser: () => A.tone(1400, 0.08, 'square', 0.05, 500),
    boom: (big) => A.noise(big ? 1.2 : 0.45, big ? 0.6 : 0.35, big ? 900 : 1800),
    hurt: () => { A.noise(0.3, 0.4, 3000); A.tone(180, 0.25, 'sawtooth', 0.15, 60); },
    ring: () => { A.tone(880, 0.1, 'triangle', 0.15); A.tone(1320, 0.18, 'triangle', 0.15, null, 0.08); },
    power: () => [523, 659, 784, 1046].forEach((f, i) => A.tone(f, 0.12, 'square', 0.08, null, i * 0.07)),
    deflect: () => A.tone(2400, 0.06, 'triangle', 0.1, 3200),
    roll: () => A.noise(0.35, 0.12, 4000),
    radio: () => A.tone(1800, 0.03, 'square', 0.04),
    bomb: () => { A.tone(300, 0.6, 'sawtooth', 0.12, 40); A.noise(1.4, 0.6, 600); },
    ping: () => A.tone(220, 0.08, 'square', 0.04, 180),
  };

  // Original looping score: driving minor-key bass + arpeggio.
  const BPM = 138, STEP = 60 / BPM / 4;
  const bass = [45, 45, 57, 45, 45, 55, 45, 57, 43, 43, 55, 43, 41, 41, 53, 52];
  const arp = [69, 72, 76, 72, 69, 72, 76, 79, 67, 71, 74, 71, 65, 69, 72, 76];
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  let seqTimer = null, nextT = 0, step = 0;
  A.music = function (on) {
    if (!A.ctx) return;
    clearInterval(seqTimer); seqTimer = null;
    if (!on) return;
    nextT = A.ctx.currentTime + 0.05; step = 0;
    seqTimer = setInterval(() => {
      while (nextT < A.ctx.currentTime + 0.2) {
        const bar = step % 16, t = nextT - A.ctx.currentTime;
        const chord = Math.floor(step / 16) % 4;
        const shift = [0, 0, -2, 3][chord];
        if (bar % 2 === 0) A.tone(midi(bass[bar] + shift), STEP * 1.8, 'sawtooth', 0.06, null, t);
        if (step >= 64) A.tone(midi(arp[bar] + shift), STEP * 0.9, 'square', 0.025, null, t);
        if (bar % 4 === 0) A.noise(0.05, 0.06, 5000, t);
        nextT += STEP; step++;
      }
    }, 50);
  };
})();
