'use strict';
// Polygon Wing — gameplay: player, stage script, enemies, boss, HUD, input.
(function () {
  const { scene, camera, renderer, audio: A } = SF;
  const $ = (id) => document.getElementById(id);
  const V3 = THREE.Vector3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  const BOUND_X = 24, MIN_Y = 2.5, MAX_Y = 26, BASE_SPEED = 70, SPAWN_Z = -520;
  const SHOT_SPEED = 380, ROLL_TIME = 0.55;

  const ship = SF.makeLancer();
  scene.add(ship);
  const bombGeo = new THREE.OctahedronGeometry(1.2, 0);

  let mode = 'title';
  let P, dist, scroll = 0, speed = BASE_SPEED, ents = [], shots = [], eshots = [], bombs = [], timers = [];
  let evIdx, time = 0, shake = 0, stats, boss, flags, sceneryAcc = 0, overAt = 0, clearT = 0;
  const cam = { x: 0, y: 10 };
  const tmp = new V3();

  // ---------- persistence ----------
  function loadBest() { try { return +localStorage.getItem('polygonwing.best') || 0; } catch (e) { return 0; } }
  function saveBest(v) { try { localStorage.setItem('polygonwing.best', String(v)); } catch (e) { /* storage unavailable */ } }

  // ---------- comms ----------
  const pctx = $('portrait').getContext('2d');
  const px = (c, x, y, w = 1, h = 1) => { pctx.fillStyle = c; pctx.fillRect(x, y, w, h); };
  const FACES = {
    KESTREL(talk) { // falcon wing leader
      px('#123a48', 0, 0, 16, 16); px('#6a4f36', 3, 2, 10, 12); px('#8a6a4a', 4, 3, 8, 10);
      px('#e9dcc0', 5, 8, 6, 6); px('#111', 5, 6, 2, 2); px('#111', 9, 6, 2, 2); px('#fff', 5, 6); px('#fff', 9, 6);
      px('#ffc23d', 7, 8, 2, 3); px('#b07a10', 7, 11, 2, talk ? 2 : 1);
    },
    BRUNT(talk) { // helmeted boar gunner
      px('#3a2230', 0, 0, 16, 16); px('#c98a6a', 3, 5, 10, 9); px('#7b8196', 2, 1, 12, 5); px('#9ad0ff', 4, 4, 8, 1);
      px('#111', 5, 7, 2, 1); px('#111', 9, 7, 2, 1); px('#e2a48a', 6, 9, 4, 3); px('#5a2a20', 7, 10, 1, 1); px('#5a2a20', 8, 10, 1, 1);
      px('#fff', 4, 12, 1, 2); px('#fff', 11, 12, 1, 2); px('#5a2a20', 6, 13, 4, talk ? 2 : 1);
    },
    PIP(talk) { // gecko rookie
      px('#1c2a10', 0, 0, 16, 16); px('#7bd05a', 3, 5, 10, 9); px('#7bd05a', 2, 2, 5, 5); px('#7bd05a', 9, 2, 5, 5);
      px('#fff', 3, 3, 3, 3); px('#fff', 10, 3, 3, 3); px('#111', 4, 4, 2, 2); px('#111', 11, 4, 2, 2);
      px('#a8ec7a', 6, 8, 4, 2); px('#2f6a22', 5, 11, 6, talk ? 2 : 1);
    },
  };
  const comm = { queue: [], cur: null, t: 0, shown: -1 };
  const say = (who, text) => comm.queue.push({ who, text });
  function updateComm(dt) {
    if (!comm.cur && comm.queue.length) {
      comm.cur = comm.queue.shift(); comm.t = 0; comm.shown = -1;
      $('commName').textContent = comm.cur.who;
      $('comm').classList.add('on');
      A.sfx.radio();
    }
    if (!comm.cur) return;
    comm.t += dt;
    const len = comm.cur.text.length;
    const n = Math.min(len, Math.floor(comm.t * 45));
    if (n !== comm.shown) { $('commText').textContent = comm.cur.text.slice(0, n); comm.shown = n; }
    FACES[comm.cur.who](n < len && Math.floor(comm.t * 12) % 2 === 0);
    if (comm.t > len / 45 + 2.2) { comm.cur = null; $('comm').classList.remove('on'); }
  }

  // ---------- entities ----------
  function add(kind, mesh, props) {
    scene.add(mesh);
    const e = Object.assign({ kind, mesh, r: 3, hp: 0, t: 0, vx: 0, vy: 0, vz: 0, fixedZ: false, alive: true, pts: 1 }, props);
    ents.push(e);
    return e;
  }
  const after = (sec, fn) => timers.push({ t: sec, fn });

  function enemyShot(from, spd, dir) {
    const m = SF.eshotPool.get();
    m.position.copy(from);
    const v = (dir || new V3(P.x - from.x, P.y - from.y, -from.z)).clone().normalize().multiplyScalar(spd);
    eshots.push({ m, v, life: 6, deflected: false });
  }
  function maybeFire(e, dt) {
    const z = e.mesh.position.z;
    if (z > -260 && z < -50 && Math.random() < e.fireRate * dt) enemyShot(e.mesh.position, 95);
  }

  function dartAI(e, dt) {
    const p = e.mesh.position;
    p.x += (e.vx + Math.cos(e.t * 2 + e.phase) * e.weave) * dt;
    p.y = Math.max(3, p.y + e.vy * dt);
    e.mesh.rotation.z = e.weave ? Math.sin(e.t * 2 + e.phase) * 0.6 : Math.sin(e.t * 3) * 0.15;
    maybeFire(e, dt);
  }
  function dart(x, y, z, opts) {
    const m = SF.makeDart();
    m.position.set(x, y, z);
    return add('enemy', m, Object.assign({ r: 3, hp: 1, vz: 45, weave: 0, phase: rand(0, 6), fireRate: 0.35, ai: dartAI }, opts));
  }
  function spinner(x, y, z) {
    const m = SF.makeSpinner();
    m.position.set(x, y, z);
    return add('enemy', m, {
      r: 3.2, hp: 3, pts: 2, vz: 25, fireRate: 0.25,
      ai(e, dt) {
        const p = e.mesh.position;
        if (p.z < -40) { p.x += (P.x - p.x) * dt * 0.7; p.y += (P.y - p.y) * dt * 0.7; }
        const [a, r] = e.mesh.userData.spin;
        a.rotation.y += dt * 4; r.rotation.z += dt * 6; r.rotation.x = Math.PI / 2 + Math.sin(e.t * 3) * 0.4;
        maybeFire(e, dt);
      },
    });
  }
  function turret(x) {
    const m = SF.makeTurret();
    m.position.set(x, 0, SPAWN_Z);
    return add('enemy', m, {
      r: 3.4, hp: 3, pts: 2, cd: rand(0.5, 1.5), aimY: 3.2,
      ai(e, dt) {
        const p = e.mesh.position, head = e.mesh.userData.head;
        const dz = Math.max(1, -p.z);
        head.rotation.y = Math.atan2(P.x - p.x, dz);
        head.rotation.x = -Math.atan2(P.y - 3.2, dz);
        e.cd -= dt;
        if (e.cd <= 0 && p.z > -300 && p.z < -40) {
          e.cd = 1.5;
          enemyShot(tmp.set(p.x, 3.5, p.z + 2), 100);
        }
      },
    });
  }
  function pillar(x, z, w, h, hex) {
    const m = SF.makePillar(w, h, hex);
    m.position.set(x, 0, z);
    return add('obstacle', m, { shape: 'pillar', w, h });
  }
  function arch(x, z, span, h) {
    const m = SF.makeArch(span, h);
    m.position.set(x, 0, z);
    return add('obstacle', m, { shape: 'arch', span, h });
  }
  function pickup(give, x, y, z = SPAWN_Z) {
    const m = give === 'silver' || give === 'gold' ? SF.makeRing(give === 'gold') : SF.makeGem(give);
    m.position.set(x, y, z);
    return add('pickup', m, { give, r: 3.5, ai: (e, dt) => { e.mesh.rotation.y += dt * 3; } });
  }

  // ---------- wave patterns ----------
  function vWave(cx, cy) {
    [[0, 0], [-6, 1], [6, 1], [-12, 2], [12, 2]].forEach(([dx, row]) =>
      dart(cx + dx, cy + row * 1.5, SPAWN_Z + 60 - row * 14, { vx: dx * 0.08 }));
  }
  function sineWave(side) {
    for (let i = 0; i < 6; i++) dart(side * 40, 8 + i * 1.6, SPAWN_Z + 80 - i * 22, { vx: -side * 12, weave: 12, phase: i * 0.5, vz: 35 });
  }
  function spinners(n) { for (let i = 0; i < n; i++) spinner(rand(-20, 20), rand(6, 20), SPAWN_Z - i * 40); }
  function ringLine(x, y, n, gold) { for (let i = 0; i < n; i++) pickup(gold ? 'gold' : 'silver', x, y, SPAWN_Z - i * 45); }
  function archRow() {
    [-7, 7, 0].forEach((x, i) => arch(x, SPAWN_Z - i * 90, 26, 17));
    pickup('gold', 7, 9, SPAWN_Z - 90);
  }
  function allyChase() {
    say('PIP', "Two bandits on my tail! Lead, shake 'em loose!");
    const am = SF.makeLancer(SF.C.ally);
    am.position.set(-30, 14, -210);
    const ally = add('ally', am, {
      fixedZ: true,
      ai(e, dt) {
        const p = e.mesh.position;
        if (e.leaving) { p.y += 25 * dt; p.z -= 110 * dt; if (p.z < -800) e.alive = false; return; }
        p.x += (Math.sin(e.t * 0.9) * 18 - p.x) * dt * 1.5;
        p.y = 14 + Math.sin(e.t * 1.7) * 4;
        e.mesh.rotation.z = -Math.cos(e.t * 0.9) * 0.7;
      },
    });
    let left = 2;
    const chasers = [0, 1].map((i) => dart(-40 - i * 8, 14, -160 + i * 12, {
      fixedZ: true, hp: 2, pts: 3, fireRate: 0,
      ai(e, dt) {
        const p = e.mesh.position;
        e.mesh.rotation.y = Math.PI;
        if (e.leaving) { p.z -= 120 * dt; if (p.z < -800) e.alive = false; return; }
        const lag = 0.35 * (i + 1);
        p.x += (Math.sin((e.t - lag) * 0.9) * 18 + (i ? 5 : -5) - p.x) * dt * 1.8;
        p.y += (14 + Math.sin((e.t - lag) * 1.7) * 4 - p.y) * dt * 2;
      },
      onKill() { if (--left === 0 && !ally.leaving) { say('PIP', 'Whew — owe you one, Lead!'); ally.leaving = true; } },
    }));
    after(10, () => {
      if (left > 0 && ally.alive && !ally.leaving) {
        say('PIP', "Taking hits! I'm peeling off to regroup!");
        SF.explode(am.position, 0.5, 6);
        ally.leaving = true;
        chasers.forEach((c) => { c.leaving = true; });
      }
    });
  }

  const SCRIPT = [
    [60, () => say('KESTREL', 'Lancer squad, form up. The canyon lane runs straight to the Warden.')],
    [300, () => say('BRUNT', "Contacts inbound, low and fast. Don't let 'em get cute.")],
    [420, () => vWave(0, 12)],
    [820, () => ringLine(0, 12, 3, false)],
    [1000, () => { flags.canyon = true; say('PIP', 'Rock spires ahead — watch your line!'); }],
    [1250, () => { turret(-14); turret(16); }],
    [1500, () => sineWave(-1)],
    [1780, () => sineWave(1)],
    [1950, () => { flags.canyon = false; }],
    [2050, () => { say('BRUNT', 'Spinners! They home in — keep moving.'); spinners(4); }],
    [2400, () => { archRow(); say('KESTREL', 'Thread the arches. Barrel roll bats their shots away — Q or E.'); }],
    [2800, () => { pickup('twin', 0, 12); say('KESTREL', 'Supply drop dead ahead. Twin lasers — grab it.'); }],
    [3100, () => { vWave(-12, 18); vWave(12, 7); }],
    [3400, () => allyChase()],
    [3900, () => { flags.canyon = true; turret(-12); turret(0); turret(12); }],
    [4200, () => { spinners(3); sineWave(1); }],
    [4450, () => { flags.canyon = false; pickup('bomb', -10, 10); ringLine(10, 14, 2, true); }],
    [4750, () => { vWave(0, 20); sineWave(-1); spinners(2); }],
    [5150, () => say('KESTREL', "Big signature — it's the Warden. Break the four pods, then hit the core when it opens.")],
    [5450, () => spawnBoss()],
  ];

  // ---------- boss ----------
  function spawnBoss() {
    const m = SF.makeWarden();
    m.position.set(0, 16, -650);
    scene.add(m);
    const u = m.userData;
    boss = {
      m, t: 0, phase: 'enter', open: 0, cycle: 0, deathT: 0, burstCd: 1, coreHp: 45,
      pods: u.pods.map((mesh) => ({ mesh, hp: 12, cd: rand(1, 3), alive: true })),
    };
    flags.boss = true;
    $('bossWrap').hidden = false;
  }
  const bossHealth = () => (boss.pods.reduce((s, p) => s + Math.max(0, p.hp), 0) + boss.coreHp) / (48 + 45);

  function damagePod(pod, n) {
    pod.hp -= n;
    if (pod.hp > 0) return;
    pod.alive = false;
    SF.explode(pod.mesh.getWorldPosition(new V3()), 1.6, 20);
    A.sfx.boom();
    pod.mesh.visible = false;
    stats.hits += 5;
    if (boss.pods.every((p) => !p.alive)) {
      boss.phase = 'core';
      say('BRUNT', 'Pods are scrap! The core — hit it when the plates open!');
    }
  }
  function damageCore(n) {
    boss.coreHp -= n;
    if (boss.coreHp > 0) return;
    boss.coreHp = 0;
    boss.phase = 'dying';
    boss.deathT = 3;
    stats.hits += 30;
    for (const s of eshots) SF.eshotPool.put(s.m);
    eshots.length = 0;
    say('KESTREL', "The Warden's breaking up! Nice flying, Lead.");
  }
  function bossHitTest(sp, z0, z1) {
    const b = boss, m = b.m;
    if (b.phase === 'enter' || b.phase === 'dying') return false;
    if (z1 > m.position.z + 8 || z0 < m.position.z - 6) return false;
    for (const pod of b.pods) {
      if (!pod.alive) continue;
      pod.mesh.getWorldPosition(tmp);
      if (Math.abs(sp.x - tmp.x) < 4 && Math.abs(sp.y - tmp.y) < 4) {
        stats.landed++;
        SF.explode(tmp, 0.3, 4);
        A.sfx.ping();
        damagePod(pod, 1);
        return true;
      }
    }
    if (b.phase === 'core' && b.open > 0.7) {
      m.userData.core.getWorldPosition(tmp);
      if (Math.abs(sp.x - tmp.x) < 4.2 && Math.abs(sp.y - tmp.y) < 4.2) {
        stats.landed++;
        SF.explode(tmp, 0.4, 5);
        A.sfx.ping();
        damageCore(1);
        return true;
      }
    }
    if (Math.abs(sp.x - m.position.x) < 15 && Math.abs(sp.y - m.position.y) < 9) {
      SF.explode(tmp.set(sp.x, sp.y, m.position.z + 5), 0.2, 3);
      A.sfx.deflect();
      return true;
    }
    return false;
  }
  function updateBoss(dt) {
    const b = boss, m = b.m, u = m.userData;
    b.t += dt;
    if (b.phase === 'dying') {
      b.deathT -= dt;
      m.position.y -= dt * 5;
      m.rotation.z += dt * 0.7;
      if (Math.random() < dt * 10) {
        SF.explode(tmp.set(m.position.x + rand(-14, 14), m.position.y + rand(-8, 8), m.position.z + 4), rand(1, 2.5), 14);
        A.sfx.boom();
      }
      if (b.deathT <= 0) {
        SF.explode(m.position, 6, 70);
        A.sfx.boom(true);
        shake = 1;
        scene.remove(m);
        boss = null;
        $('bossWrap').hidden = true;
        clearT = 3;
      }
      return;
    }
    if (b.phase === 'enter') {
      m.position.z += (-150 - m.position.z) * Math.min(1, dt * 0.8);
      if (m.position.z > -165) b.phase = 'pods';
    }
    m.position.x += (Math.sin(b.t * 0.45) * 12 - m.position.x) * Math.min(1, dt * 2);
    m.position.y += (16 + Math.sin(b.t * 0.9) * 5 - m.position.y) * Math.min(1, dt * 2);
    m.rotation.z = Math.sin(b.t * 0.3) * 0.15;
    const active = b.phase !== 'enter' && mode === 'play' && !P.dead;

    for (const pod of b.pods) {
      if (!pod.alive) continue;
      pod.mesh.rotation.y += dt * 2;
      pod.cd -= dt;
      if (active && pod.cd <= 0) { pod.cd = rand(1.3, 2.2); enemyShot(pod.mesh.getWorldPosition(new V3()), 90); }
    }
    if (b.phase === 'core') {
      b.cycle += dt;
      const want = b.cycle % 5 > 2.2 ? 1 : 0;
      b.open += (want - b.open) * Math.min(1, dt * 5);
      u.core.rotation.y += dt * 3;
      u.core.rotation.x += dt * 2;
      for (const p of u.plates) {
        p.position.x = p.userData.dir[0] * (2.6 + b.open * 5);
        p.position.y = p.userData.dir[1] * (2.6 + b.open * 5);
      }
      b.burstCd -= dt;
      if (active && b.open > 0.5 && b.burstCd <= 0) {
        b.burstCd = 1.1;
        u.core.getWorldPosition(tmp);
        const from = tmp.clone();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 + b.t;
          enemyShot(from, 70, new V3(P.x - from.x + Math.cos(a) * 22, P.y - from.y + Math.sin(a) * 22, -from.z));
        }
      }
    }
  }

  // ---------- player actions ----------
  function fire() {
    const offs = P.twin ? [-1.7, 1.7] : [0];
    for (const o of offs) {
      const m = SF.laserPool.get();
      m.position.set(P.x + o, P.y, -3);
      shots.push({ m });
      stats.fired++;
    }
    P.fireCd = 0.13;
    A.sfx.laser();
  }
  function roll(dir) {
    if (P.rollT > 0 || P.dead) return;
    P.rollT = ROLL_TIME;
    P.rollDir = dir;
    P.vx += dir * 22;
    A.sfx.roll();
  }
  function dropBomb() {
    if (P.bombs <= 0 || bombs.length || P.dead) return;
    P.bombs--;
    const m = new THREE.Mesh(bombGeo, SF.mat(0xff5a3c, true));
    m.position.set(P.x, P.y, -4);
    scene.add(m);
    bombs.push({ m, t: 0 });
    A.tone(600, 0.3, 'square', 0.08, 1200);
  }
  function detonate(pos) {
    SF.explode(pos, 4, 40);
    A.sfx.bomb();
    shake = 0.9;
    for (const e of ents) {
      if (e.alive && e.kind === 'enemy' && e.mesh.position.distanceTo(pos) < 80) kill(e, true);
    }
    for (let i = eshots.length - 1; i >= 0; i--) {
      if (eshots[i].m.position.distanceTo(pos) < 110) { SF.eshotPool.put(eshots[i].m); eshots.splice(i, 1); }
    }
    if (boss && boss.phase !== 'enter' && boss.phase !== 'dying' && pos.distanceTo(boss.m.position) < 170) {
      boss.pods.forEach((p) => { if (p.alive) damagePod(p, 6); });
      if (boss.phase === 'core') damageCore(8);
    }
  }
  function kill(e, byPlayer) {
    if (!e.alive) return;
    e.alive = false;
    SF.explode(e.mesh.position, e.kind === 'enemy' ? 1.2 : 0.8, 16);
    A.sfx.boom();
    if (byPlayer) stats.hits += e.pts;
    if (e.onKill) e.onKill();
    if (byPlayer && Math.random() < 0.12) pickup('silver', e.mesh.position.x, Math.max(4, e.mesh.position.y), e.mesh.position.z);
  }
  function damage(n) {
    if (P.hurtT > 0 || P.dead) return;
    P.shield = Math.max(0, P.shield - n);
    P.hurtT = 0.7;
    shake = 0.5;
    A.sfx.hurt();
    if (P.shield <= 0) {
      P.dead = true;
      P.deadT = 2.4;
      ship.visible = false;
      SF.explode(ship.position, 2.5, 34);
      A.sfx.boom(true);
      A.music(false);
    } else if (P.shield < 30 && !flags.warnedLow) {
      flags.warnedLow = true;
      say('BRUNT', 'Your shield is paper-thin, Lead! Grab a ring!');
    }
  }
  function collect(e) {
    e.alive = false;
    if (e.give === 'silver') { P.shield = Math.min(100, P.shield + 20); A.sfx.ring(); }
    if (e.give === 'gold') { P.shield = Math.min(100, P.shield + 50); stats.hits += 2; A.sfx.ring(); }
    if (e.give === 'twin') { P.twin = true; A.sfx.power(); }
    if (e.give === 'bomb') { P.bombs = Math.min(9, P.bombs + 1); A.sfx.power(); }
    SF.explode(e.mesh.position, 0.4, 6);
  }

  // ---------- collisions ----------
  function collidePlayer(e) {
    const p = e.mesh.position;
    if (e.kind === 'enemy') {
      if (Math.abs(p.z) < e.r + 2 && Math.hypot(p.x - P.x, p.y - P.y) < e.r + 1.6) { damage(15); kill(e, false); }
    } else if (e.kind === 'pickup') {
      if (Math.abs(p.z) < 4 && Math.hypot(p.x - P.x, p.y - P.y) < e.r + 2) collect(e);
    } else if (e.kind === 'obstacle') {
      if (e.shape === 'pillar') {
        if (Math.abs(p.z) < e.w / 2 + 1.5 && Math.abs(p.x - P.x) < e.w / 2 + 1.8 && P.y < e.h + 1.2) {
          damage(20);
          P.vx = (P.x > p.x ? 1 : -1) * 30;
        }
      } else if (Math.abs(p.z) < 3.5) {
        const nearLeg = Math.abs(P.x - (p.x - e.span / 2)) < 3.8 || Math.abs(P.x - (p.x + e.span / 2)) < 3.8;
        const inBeam = P.y > e.h - 1.5 && Math.abs(P.x - p.x) < e.span / 2 + 3;
        if (nearLeg || inBeam) { damage(20); P.vy = -20; }
      }
    }
  }

  function shotBlocked(sp, z0, z1) {
    for (const e of ents) {
      if (e.kind !== 'obstacle' || e.shape !== 'pillar' || !e.alive) continue;
      const p = e.mesh.position;
      if (p.z - e.w / 2 > z0 || p.z + e.w / 2 < z1) continue;
      if (Math.abs(sp.x - p.x) < e.w / 2 && sp.y < e.h + 0.6) return true;
    }
    return false;
  }

  // ---------- per-frame updates ----------
  function updatePlayer(dt) {
    const ix = clamp((held('ArrowRight', 'KeyD') ? 1 : 0) - (held('ArrowLeft', 'KeyA') ? 1 : 0) + touch.ax, -1, 1);
    const iy = clamp((held('ArrowUp', 'KeyW') ? 1 : 0) - (held('ArrowDown', 'KeyS') ? 1 : 0) + touch.ay, -1, 1);
    const k = Math.min(1, dt * 5);
    P.vx += (ix * 34 - P.vx) * k;
    P.vy += (iy * 26 - P.vy) * k;
    P.x = clamp(P.x + P.vx * dt, -BOUND_X, BOUND_X);
    P.y = clamp(P.y + P.vy * dt, MIN_Y, MAX_Y);

    const wantBoost = held('ShiftLeft', 'ShiftRight', 'KeyK') || touch.boost;
    const wantBrake = held('KeyL', 'KeyC') || touch.brake;
    let target = BASE_SPEED;
    if (!P.boostLock && wantBoost) { target = 125; P.boost -= dt * 0.55; }
    else if (!P.boostLock && wantBrake) { target = 32; P.boost -= dt * 0.55; }
    else P.boost = Math.min(1, P.boost + dt * 0.3);
    if (P.boost <= 0) { P.boost = 0; P.boostLock = true; }
    if (P.boostLock && P.boost > 0.35) P.boostLock = false;
    speed += (target - speed) * Math.min(1, dt * 3);

    P.fireCd -= dt;
    if ((held('Space', 'KeyJ') || touch.active) && P.fireCd <= 0) fire();

    P.hurtT = Math.max(0, P.hurtT - dt);
    if (P.rollT > 0) P.rollT = Math.max(0, P.rollT - dt);
  }

  function attract(dt) {
    const nx = Math.sin(time * 0.5) * 10, ny = 11 + Math.sin(time * 0.8) * 4;
    P.vx = (nx - P.x) / Math.max(dt, 1e-3);
    P.vy = (ny - P.y) / Math.max(dt, 1e-3);
    P.x = nx; P.y = ny;
    speed += (BASE_SPEED - speed) * Math.min(1, dt);
  }

  function spawnScenery(dt) {
    sceneryAcc += speed * dt;
    while (sceneryAcc > 26) {
      sceneryAcc -= 26;
      const side = Math.random() < 0.5 ? -1 : 1;
      pillar(side * rand(34, 190), SPAWN_Z, rand(4, 12), rand(8, 60), Math.random() < 0.4);
      if (flags.canyon && mode === 'play' && Math.random() < 0.4) pillar(rand(-22, 22), SPAWN_Z, rand(5, 8), rand(8, 30), Math.random() < 0.5);
    }
  }

  function updateEnts(dt) {
    const live = mode === 'play' && !P.dead;
    for (let i = ents.length - 1; i >= 0; i--) {
      const e = ents[i];
      e.t += dt;
      if (e.alive) {
        if (!e.fixedZ) e.mesh.position.z += (speed + e.vz) * dt;
        if (e.ai) e.ai(e, dt);
        if (live) collidePlayer(e);
      }
      const p = e.mesh.position;
      if (!e.alive || p.z > 40 || Math.abs(p.x) > 420) { scene.remove(e.mesh); ents.splice(i, 1); }
    }
  }

  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i], sp = s.m.position;
      const z0 = sp.z;
      sp.z -= SHOT_SPEED * dt;
      const z1 = sp.z;
      let hit = false;
      for (const e of ents) {
        if (!e.alive || e.kind !== 'enemy') continue;
        const p = e.mesh.position;
        const cy = e.aimY || p.y;
        if (p.z - e.r - 2 > z0 || p.z + e.r + 2 < z1) continue;
        if (Math.abs(p.x - sp.x) < e.r + 0.6 && Math.abs(cy - sp.y) < e.r + 0.6) {
          stats.landed++;
          e.hp -= 1;
          if (e.hp <= 0) kill(e, true); else { SF.explode(sp, 0.3, 4); A.sfx.ping(); }
          hit = true;
          break;
        }
      }
      if (!hit && boss) hit = bossHitTest(sp, z0, z1);
      if (!hit && shotBlocked(sp, z0, z1)) { SF.explode(sp, 0.2, 3); hit = true; }
      if (hit || z1 < -560) { SF.laserPool.put(s.m); shots.splice(i, 1); }
    }
  }

  function updateEShots(dt) {
    const live = mode === 'play' && !P.dead;
    for (let i = eshots.length - 1; i >= 0; i--) {
      const s = eshots[i], p = s.m.position;
      p.addScaledVector(s.v, dt);
      s.m.rotation.x += dt * 8; s.m.rotation.y += dt * 6;
      s.life -= dt;
      let gone = s.life <= 0 || p.z > 40 || p.y < 0;
      if (!gone && live && !s.deflected && Math.abs(p.z) < 2.5 && Math.hypot(p.x - P.x, p.y - P.y) < 2.4) {
        if (P.rollT > 0) {
          s.deflected = true;
          s.v.set(rand(-40, 40), rand(10, 40), -160);
          A.sfx.deflect();
        } else {
          damage(9);
          gone = true;
        }
      }
      if (gone) { SF.eshotPool.put(s.m); eshots.splice(i, 1); }
    }
  }

  function updateBombs(dt) {
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i];
      b.t += dt;
      b.m.position.z -= 170 * dt;
      b.m.rotation.x += dt * 10; b.m.rotation.y += dt * 7;
      const near = ents.some((e) => e.alive && e.kind === 'enemy' && e.mesh.position.distanceTo(b.m.position) < e.r + 4);
      const nearBoss = boss && Math.abs(b.m.position.z - boss.m.position.z) < 10;
      if (b.t > 0.9 || near || nearBoss) {
        detonate(b.m.position.clone());
        scene.remove(b.m);
        bombs.splice(i, 1);
      }
    }
  }

  function updateCamera(dt) {
    const k = Math.min(1, dt * 4);
    cam.x += (P.x * 0.6 - cam.x) * k;
    cam.y += (P.y * 0.55 + 6 - cam.y) * k;
    shake = Math.max(0, shake - dt * 1.6);
    const s = shake * shake * 2.2;
    camera.position.set(cam.x + rand(-s, s), cam.y + rand(-s, s), 26 - (speed - BASE_SPEED) * 0.05);
    camera.lookAt(P.x * 0.7, P.y * 0.65 + 2, -60);
    camera.rotateZ(-P.vx * 0.004);

    let rollA = 0;
    if (P.rollT > 0) rollA = (1 - P.rollT / ROLL_TIME) * Math.PI * 2 * P.rollDir;
    ship.position.set(P.x, P.y, 0);
    ship.rotation.set(P.vy * 0.02, -P.vx * 0.012, -P.vx * 0.022 - rollA);
    if (!P.dead) ship.visible = P.hurtT <= 0 || Math.floor(time * 20) % 2 === 0;
    const flame = ship.userData.flame;
    flame.scale.set(1, 1, (speed / BASE_SPEED) * rand(0.8, 1.25));

    const showRet = mode === 'play' && !P.dead;
    SF.reticle[0].position.set(P.x, P.y, -30);
    SF.reticle[1].position.set(P.x, P.y, -60);
    SF.reticle.forEach((r) => { r.visible = showRet; });
  }

  // ---------- HUD ----------
  const hudCache = {};
  function setHud(id, prop, val) {
    const key = id + prop;
    if (hudCache[key] === val) return;
    hudCache[key] = val;
    if (prop === 'text') $(id).textContent = val;
    else $(id).style[prop] = val;
  }
  function updateHud() {
    if (mode !== 'play' && mode !== 'paused') return;
    setHud('hits', 'text', String(stats.hits).padStart(3, '0'));
    setHud('shieldFill', 'width', P.shield.toFixed(0) + '%');
    $('shieldFill').classList.toggle('low', P.shield < 30);
    setHud('boostFill', 'width', (P.boost * 100).toFixed(0) + '%');
    setHud('boostFill', 'opacity', P.boostLock ? '0.4' : '1');
    setHud('bombs', 'text', P.bombs ? '◆'.repeat(P.bombs) : '—');
    if (boss) setHud('bossFill', 'width', (bossHealth() * 100).toFixed(1) + '%');
    setHud('flash', 'opacity', P.hurtT > 0.35 ? '1' : '0');
    $('touch').hidden = !(touchUsed && mode === 'play');
  }

  // ---------- game flow ----------
  function clearWorld() {
    for (const e of ents) scene.remove(e.mesh);
    for (const s of shots) SF.laserPool.put(s.m);
    for (const s of eshots) SF.eshotPool.put(s.m);
    for (const b of bombs) scene.remove(b.m);
    if (boss) scene.remove(boss.m);
    ents = []; shots = []; eshots = []; bombs = []; timers = [];
    boss = null;
    SF.clearParticles();
  }
  function reset() {
    clearWorld();
    P = { x: 0, y: 10, vx: 0, vy: 0, shield: 100, twin: false, bombs: 3, boost: 1, boostLock: false, rollT: 0, rollDir: 1, hurtT: 0, fireCd: 0, dead: false, deadT: 0 };
    dist = 0; evIdx = 0; shake = 0; clearT = 0;
    stats = { hits: 0, fired: 0, landed: 0 };
    flags = { canyon: false, boss: false, warnedLow: false };
    comm.queue.length = 0; comm.cur = null;
    $('comm').classList.remove('on');
    $('bossWrap').hidden = true;
    ship.visible = true;
  }
  function start() {
    A.init();
    reset();
    mode = 'play';
    $('title').hidden = true; $('over').hidden = true; $('paused').hidden = true;
    $('hud').hidden = false;
    for (const k in hudCache) delete hudCache[k];
    A.music(true);
    view.focus();
  }
  function endGame(won) {
    mode = 'over';
    overAt = performance.now();
    A.music(false);
    if (won) stats.hits += Math.round(P.shield / 5);
    const best = Math.max(loadBest(), stats.hits);
    saveBest(best);
    $('overEyebrow').textContent = won ? 'SECTOR ALPHA CLEAR' : 'SIGNAL LOST';
    $('overTitle').textContent = won ? 'Warden Destroyed' : 'Lancer Down';
    $('sHits').textContent = stats.hits;
    $('sAcc').textContent = (stats.fired ? Math.round((100 * stats.landed) / stats.fired) : 0) + '%';
    $('sShield').textContent = Math.round(P.shield) + '%';
    $('sBest').textContent = best;
    $('hiScore').textContent = 'BEST ' + String(best).padStart(3, '0');
    $('hud').hidden = true; $('touch').hidden = true;
    $('over').hidden = false;
    SF.reticle.forEach((r) => { r.visible = false; });
    if (won) A.sfx.power();
    setTimeout(() => $('retryBtn').focus(), 60);
  }
  function setPause(on) {
    if (on && mode === 'play') { mode = 'paused'; $('paused').hidden = false; A.music(false); }
    else if (!on && mode === 'paused') { mode = 'play'; $('paused').hidden = true; if (!P.dead) A.music(true); last = performance.now(); }
  }

  // ---------- input ----------
  const keys = {};
  const held = (...ks) => ks.some((k) => keys[k]);
  let lastTap = { code: '', t: 0 };
  const GAME_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  addEventListener('keydown', (e) => {
    if (GAME_KEYS.includes(e.code) && mode !== 'over') e.preventDefault();
    if (e.repeat) return;
    keys[e.code] = true;
    A.init();
    if (mode === 'title') { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); start(); } return; }
    if (mode === 'over') { if (e.code === 'Enter' && performance.now() - overAt > 800) { e.preventDefault(); start(); } return; }
    if (e.code === 'KeyM') A.setMuted(!A.muted);
    if (e.code === 'KeyP' || e.code === 'Escape') { setPause(mode === 'play'); return; }
    if (mode !== 'play') return;
    if (e.code === 'KeyQ') roll(-1);
    if (e.code === 'KeyE') roll(1);
    if (e.code === 'KeyB') dropBomb();
    if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code)) {
      const now = performance.now();
      if (lastTap.code === e.code && now - lastTap.t < 250) roll(e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : 1);
      lastTap = { code: e.code, t: now };
    }
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; setPause(true); });

  const view = $('view');
  view.tabIndex = -1;
  let touchUsed = matchMedia('(pointer: coarse)').matches;
  const touch = { id: null, sx: 0, sy: 0, ax: 0, ay: 0, active: false, brake: false, boost: false };
  view.addEventListener('pointerdown', (e) => {
    if (mode !== 'play') return;
    if (e.pointerType === 'touch') touchUsed = true;
    Object.assign(touch, { id: e.pointerId, sx: e.clientX, sy: e.clientY, ax: 0, ay: 0, active: true });
    view.setPointerCapture(e.pointerId);
  });
  view.addEventListener('pointermove', (e) => {
    if (e.pointerId !== touch.id) return;
    touch.ax = clamp((e.clientX - touch.sx) / 50, -1, 1);
    touch.ay = clamp(-(e.clientY - touch.sy) / 50, -1, 1);
  });
  const endTouch = (e) => { if (e.pointerId === touch.id) Object.assign(touch, { id: null, active: false, ax: 0, ay: 0 }); };
  view.addEventListener('pointerup', endTouch);
  view.addEventListener('pointercancel', endTouch);

  const press = (id, down, up) => {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); A.init(); down(); });
    if (up) ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => el.addEventListener(t, up));
  };
  press('tBomb', () => dropBomb());
  press('tRoll', () => roll(P.vx >= 0 ? 1 : -1));
  press('tBrake', () => { touch.brake = true; }, () => { touch.brake = false; });
  press('tBoost', () => { touch.boost = true; }, () => { touch.boost = false; });
  $('startBtn').addEventListener('click', start);
  $('retryBtn').addEventListener('click', start);

  // ---------- main loop ----------
  let last = performance.now();
  function step(dt) {
    time += dt;
    const playing = mode === 'play';
    if (playing && !P.dead) updatePlayer(dt);
    else if (mode === 'title') attract(dt);
    else speed += (BASE_SPEED - speed) * Math.min(1, dt);

    scroll += speed * dt;
    SF.scrollGround(scroll);
    if (playing) {
      dist += speed * dt;
      while (evIdx < SCRIPT.length && dist >= SCRIPT[evIdx][0]) SCRIPT[evIdx++][1]();
      for (let i = timers.length - 1; i >= 0; i--) {
        if ((timers[i].t -= dt) <= 0) { const fn = timers[i].fn; timers.splice(i, 1); fn(); }
      }
    }
    spawnScenery(dt);
    updateEnts(dt);
    updateShots(dt);
    updateEShots(dt);
    updateBombs(dt);
    if (boss) updateBoss(dt);
    SF.updateParticles(dt, speed);
    updateCamera(dt);
    if (playing) updateComm(dt);
    updateHud();

    if (playing && P.dead && (P.deadT -= dt) <= 0) endGame(false);
    if (playing && clearT > 0 && (clearT -= dt) <= 0) endGame(true);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (mode !== 'paused') step(dt);
    renderer.render(scene, camera);
  }

  reset();
  $('hiScore').textContent = 'BEST ' + String(loadBest()).padStart(3, '0');
  requestAnimationFrame(frame);
})();
