import * as THREE from 'three';
import { Track } from './trackgen.js';
import { TRACKS } from './tracks.js';
import { buildWorld } from './trackmesh.js';
import { Car, BASE_STATS, collideCars } from './car.js';
import { AIDriver } from './ai.js';
import { Items } from './items.js';
import { Particles } from './fx.js';
import { Audio } from './audio.js';
import { Input } from './input.js';

const STEP = 1 / 120;
const WORD = 'NINTENDO';
const MAX_LEVEL = 6;
const PLACE_POINTS = [1000, 600, 300, 0];
const UPGRADE_NAMES = { engine: 'SUPER ENGINE', tires: 'HI-TRACTION TIRES', battery: 'TURBO BATTERY' };
const CAMERA_MODES = ['dynamic', 'classic', 'chase'];

const $ = (id) => document.getElementById(id);
const ordinal = (n) => ['ST', 'ND', 'RD', 'TH'][Math.min(n, 4) - 1];
const fmtTime = (t) => {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
};

class Game {
  constructor() {
    const canvas = $('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.5, 2000);
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445544, 1.2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.near = 1; sc.far = 250;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog(0xbfe6ff, 160, 520);

    this.input = new Input();
    this.audio = new Audio();
    this.fx = new Particles(this.scene);
    this.items = new Items(this);

    this.player = new Car({ color: 0xe53935, accent: 0xffffff, name: 'YOU', isPlayer: true });
    this.rivals = [
      new Car({ color: 0x1e88e5, accent: 0xffeb3b, name: 'BLUE' }),
      new Car({ color: 0xfdd835, accent: 0x212121, name: 'YELLOW' }),
      new Car({ color: 0x43a047, accent: 0xffffff, name: 'GREEN' }),
    ];
    this.cars = [this.player, ...this.rivals];
    for (const c of this.cars) this.scene.add(c.mesh);

    this.cameraMode = 0;
    this.camPos = new THREE.Vector3(0, 30, 30);
    this.camLook = new THREE.Vector3();
    this.camYaw = 0;
    this.shake = 0;
    this.state = 'title';
    this.stateTime = 0;
    this.world = null;
    this.hudCache = {};

    this.buildHudStatic();
    this.loadTrack(0, true);
    this.state = 'title';
    $('loading').classList.add('hidden');
    $('title').classList.remove('hidden');

    this.last = performance.now();
    this.acc = 0;
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- session
  newGame() {
    this.trackIndex = 0;
    this.round = 0;
    this.lives = 3;
    this.score = 0;
    this.letters = new Array(WORD.length).fill(false);
    this.upgrades = { engine: 0, tires: 0, battery: 0 };
    this.superTruck = 0;
    this.player.missiles = 3;
    this.player.bombs = 1;
    this.loadTrack(0);
  }

  get raceNumber() {
    return this.round * TRACKS.length + this.trackIndex;
  }

  playerStats() {
    const u = this.upgrades || { engine: 0, tires: 0, battery: 0 };
    const sup = this.superTruck || 0;
    return {
      maxSpeed: BASE_STATS.maxSpeed + u.engine * 1.6 + sup * 3,
      accel: BASE_STATS.accel + u.battery * 3 + sup * 3,
      grip: BASE_STATS.grip + u.tires * 0.9 + sup * 0.8,
      turn: BASE_STATS.turn + u.tires * 0.08 + sup * 0.1,
    };
  }

  loadTrack(index, preview = false) {
    this.trackIndex = index;
    const def = TRACKS[index];
    this.track = new Track(def);
    const theme = def.theme;

    if (this.world) {
      this.scene.remove(this.world);
      this.world.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
    this.world = buildWorld(this.track, theme);
    this.scene.add(this.world);
    this.scene.fog.color.set(theme.fog);
    this.hemi.color.set(theme.night ? 0x8f86c9 : 0xffffff);
    this.hemi.groundColor.set(theme.night ? 0x1a1030 : 0x445544);
    this.hemi.intensity = theme.night ? 1.0 : 1.25;
    this.sun.color.set(theme.sun);
    this.sun.intensity = theme.night ? 1.1 : 2.3;

    // letters still needed: up to 2 per race
    const needed = [];
    if (!preview) this.letters.forEach((got, i) => { if (!got && needed.length < 2) needed.push(WORD[i]); });
    this.items.build(this.track, needed);
    this.fx.clear();

    const n = this.raceNumber || 0;
    const aiBase = {
      maxSpeed: Math.min(44, BASE_STATS.maxSpeed * 0.93 + n * 1.35),
      accel: BASE_STATS.accel + n * 1.2,
      grip: BASE_STATS.grip + n * 0.35,
      turn: BASE_STATS.turn + n * 0.05,
    };
    const hw = this.track.hw;
    const grid = [
      [-6, -hw * 0.4], [-6, hw * 0.4],
      [-13, -hw * 0.4], [-13, hw * 0.4],
    ];
    const order = [this.rivals[0], this.rivals[1], this.rivals[2], this.player];
    this.drivers = new Map();
    const skills = [0.97, 0.93, 0.9];
    order.forEach((car, i) => {
      if (car.isPlayer) {
        car.stats = this.playerStats();
      } else {
        car.stats = { ...aiBase };
        const ri = this.rivals.indexOf(car);
        car.missiles = n >= 1 ? Math.min(4, 1 + Math.floor(n / 2)) : 0;
        car.bombs = n >= 2 ? Math.min(3, Math.floor(n / 2)) : 0;
        this.drivers.set(car, new AIDriver(car, skills[ri] + Math.min(0.03, n * 0.004), Math.min(0.6, 0.12 + n * 0.06)));
      }
      car.reset(this.track, grid[i][0], grid[i][1]);
    });
    this.raceTime = 0;
    this.wrongWay = 0;
    this.lastLap = 0;
    this.finishOrder = [];
    this.camYaw = this.player.heading;
    this.setState(preview ? 'title' : 'intro');
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
    this.msgTimer = 0;
    this.lightsTimer = 0;
    $('title').classList.toggle('hidden', s !== 'title');
    $('intro').classList.toggle('hidden', s !== 'intro');
    $('results').classList.toggle('hidden', s !== 'results');
    $('hud').classList.toggle('hidden', !['countdown', 'race', 'finished'].includes(s));
    $('lights').classList.toggle('hidden', s !== 'countdown');
    if (s === 'intro') {
      const def = TRACKS[this.trackIndex];
      $('intro-round').textContent = `${this.round ? `ROUND ${this.round + 1} · ` : ''}RACE ${this.trackIndex + 1} OF ${TRACKS.length}`;
      $('intro-name').textContent = def.name;
      $('intro-laps').textContent = `${def.laps} LAPS · LIVES ${'♥'.repeat(this.lives)}`;
    }
    if (s === 'countdown') {
      this.countBeep = -1;
      $('msg').textContent = '';
      $('submsg').textContent = '';
    }
  }

  // ---------------------------------------------------------------- events
  // Big centre message that clears itself after `dur` seconds of game time.
  flash(text, dur) {
    $('msg').textContent = text;
    this.msgTimer = dur;
  }

  toast(text, color = '#fff') {
    const d = document.createElement('div');
    d.className = 'toast shadow';
    d.style.color = color;
    d.textContent = text;
    $('toasts').appendChild(d);
    setTimeout(() => d.remove(), 1700);
  }

  collect(car, kind) {
    if (kind.length === 1) {
      const idx = this.letters.findIndex((got, i) => !got && WORD[i] === kind);
      if (idx >= 0) this.letters[idx] = true;
      this.score += 200;
      this.audio.letter();
      this.toast(`LETTER ${kind}!`, '#ffd600');
      if (this.letters.every(Boolean)) {
        this.superTruck++;
        this.letters.fill(false);
        this.player.stats = this.playerStats();
        this.player.model.paint.color.set(0xffab00);
        this.toast('NINTENDO! SUPER TRUCK!', '#ff9800');
        this.audio.fanfare();
      }
      return;
    }
    if (kind === 'missile') {
      car.missiles = Math.min(9, car.missiles + 2);
      if (car.isPlayer) { this.audio.pickup(); this.toast('+2 MISSILES', '#ff8a80'); }
    } else if (kind === 'bomb') {
      car.bombs = Math.min(9, car.bombs + 1);
      if (car.isPlayer) { this.audio.pickup(); this.toast('+1 BOMB', '#cfd8dc'); }
    } else if (car.isPlayer) {
      if (this.upgrades[kind] < MAX_LEVEL) {
        this.upgrades[kind]++;
        car.stats = this.playerStats();
        this.toast(UPGRADE_NAMES[kind], '#69f0ae');
      } else {
        this.toast('MAXED! +250', '#69f0ae');
        this.score += 150;
      }
      this.audio.upgrade();
    }
    if (car.isPlayer) this.score += 50;
  }

  onHit(victim, attacker, didHit) {
    if (!didHit) return;
    if (attacker.isPlayer && !victim.isPlayer) {
      this.score += 100;
      this.toast(`HIT ${victim.name}! +100`, '#ffd600');
    }
    if (victim.isPlayer) this.shake = 1.4;
  }

  // ---------------------------------------------------------------- loop
  frame(now) {
    const dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000));
    this.last = now;
    const inp = this.input;
    if (inp.anyKey || inp.hit('confirm')) this.audio.init();
    if (inp.hit('mute')) this.toast(this.audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON');
    if (inp.hit('camera')) {
      this.cameraMode = (this.cameraMode + 1) % CAMERA_MODES.length;
      if (this.state !== 'title') this.toast(`CAMERA: ${CAMERA_MODES[this.cameraMode].toUpperCase()}`);
    }
    if (inp.hit('pause') && ['countdown', 'race', 'finished'].includes(this.state)) {
      this.paused = !this.paused;
      $('pause').classList.toggle('hidden', !this.paused);
    }

    if (!this.paused) {
      this.stateTime += dt;
      if (this.msgTimer > 0 && (this.msgTimer -= dt) <= 0) $('msg').textContent = '';
      if (this.lightsTimer > 0 && (this.lightsTimer -= dt) <= 0) $('lights').classList.add('hidden');
      this.handleState(dt);
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 20) {
        this.step(STEP);
        this.acc -= STEP;
        steps++;
      }
      this.items.update(dt, this.cars);
      this.fx.update(dt);
      for (const c of this.cars) c.syncVisual(dt);
      this.emitCarFx(dt);
      this.updateCamera(dt);
      this.updateHud();
      this.audio.setEngine(this.player.forward, this.player.throttle, this.state !== 'title' && this.state !== 'results');
    }
    inp.endFrame();
    this.renderer.render(this.scene, this.camera);
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  handleState(dt) {
    const inp = this.input;
    switch (this.state) {
      case 'title':
        if (inp.hit('confirm')) {
          this.audio.init();
          this.audio.blip();
          this.newGame();
        }
        break;
      case 'intro':
        if (this.stateTime > 3.2 || inp.hit('confirm')) this.setState('countdown');
        break;
      case 'countdown': {
        const k = Math.floor(this.stateTime / 0.9);
        if (k !== this.countBeep) {
          this.countBeep = k;
          const lights = $('lights').children;
          for (let i = 0; i < 3; i++) lights[i].className = i < k + 1 && k < 3 ? 'red' : k >= 3 ? 'green' : '';
          if (k < 3) this.audio.countdown(false);
          else {
            this.audio.countdown(true);
            this.setState('race');
            this.flash('GO!', 0.9);
            $('lights').classList.remove('hidden');
            this.lightsTimer = 0.9;
          }
        }
        break;
      }
      case 'race':
        this.raceTime += dt;
        if (inp.hit('fire')) this.items.fireMissile(this.player);
        if (inp.hit('bomb')) this.items.dropBomb(this.player);
        break;
      case 'finished':
        this.raceTime += dt;
        if (this.stateTime > 6 || (this.stateTime > 1.5 && inp.hit('confirm')) || (this.stateTime > 3 && this.cars.every((c) => c.finished))) {
          this.showResults();
        }
        break;
      case 'results':
        if (this.stateTime > 0.6 && inp.hit('confirm')) this.afterResults();
        break;
    }
  }

  step(dt) {
    const racing = this.state === 'race' || this.state === 'finished';
    for (const car of this.cars) {
      let input = { throttle: 0, steer: 0 };
      if (racing) {
        if (car.isPlayer && !car.finished) {
          input = this.input.axis();
        } else {
          const d = this.drivers.get(car) || this.autopilot(car);
          const o = d.think(dt, this);
          input = o;
          if (this.state === 'race' || !car.isPlayer) {
            if (o.fire) this.items.fireMissile(car);
            if (o.bomb) this.items.dropBomb(car);
          }
        }
      } else if (this.state === 'countdown' && car.isPlayer) {
        input = { throttle: 0, steer: 0 };
      }
      car.update(dt, input);
      if (racing) this.items.applyHazards(car);
    }
    collideCars(this.cars);

    if (!racing) return;
    const L = this.track.length, laps = TRACKS[this.trackIndex].laps;
    for (const car of this.cars) {
      if (!car.finished && car.progress >= laps * L) {
        car.finished = true;
        car.finishTime = this.raceTime;
        this.finishOrder.push(car);
        if (car.isPlayer) this.playerFinished();
      }
    }
    if (this.state === 'race' && this.rivals.every((c) => c.finished)) {
      // everyone else is home: player takes last place
      this.finishOrder.push(this.player);
      this.player.finished = true;
      this.player.finishTime = this.raceTime;
      this.player.dnf = true;
      this.playerFinished();
    }
    const lap = Math.floor(this.player.progress / L);
    if (lap > this.lastLap && !this.player.finished) {
      this.lastLap = lap;
      if (lap < laps) {
        this.audio.lap();
        this.flash(lap === laps - 1 ? 'FINAL LAP' : `LAP ${lap + 1}`, 1.3);
      }
    }
  }

  autopilot(car) {
    const d = new AIDriver(car, 0.85, 0);
    this.drivers.set(car, d);
    return d;
  }

  standings() {
    return [...this.cars].sort((a, b) => {
      if (a.finished && b.finished) return a.dnf - b.dnf || a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
  }

  playerFinished() {
    const place = this.finishOrder.indexOf(this.player) + 1;
    this.setState('finished');
    $('msg').textContent = `${place}${ordinal(place)}`;
    $('submsg').textContent = place <= 3 ? 'QUALIFIED!' : 'DID NOT QUALIFY';
    if (place <= 3) {
      this.audio.fanfare();
      this.fx.confetti(this.player.x, this.player.y, this.player.z, 120);
    } else this.audio.sad();
  }

  showResults() {
    const order = this.standings();
    const place = order.indexOf(this.player) + 1;
    this.lastPlace = place;
    this.score += PLACE_POINTS[place - 1];
    const L = this.track.length, laps = TRACKS[this.trackIndex].laps;
    $('res-title').textContent = place <= 3 ? 'QUALIFIED!' : 'RACE OVER';
    $('res-track').textContent = `RACE ${this.trackIndex + 1} · ${TRACKS[this.trackIndex].name}`;
    $('res-table').innerHTML = order
      .map((c, i) => {
        const time = c.finished && !c.dnf ? fmtTime(c.finishTime) : `${Math.round((c.progress / (laps * L)) * 100)}%`;
        return `<tr class="${c.isPlayer ? 'me' : ''}"><td>${i + 1}${ordinal(i + 1)}</td><td class="sw"><b style="background:#${c.model.paint.color.getHexString()}"></b></td><td>${c.name}</td><td style="text-align:right">${time}</td></tr>`;
      })
      .join('');
    let verdict;
    if (place <= 3) {
      verdict = `<span class="good">+${PLACE_POINTS[place - 1]} POINTS</span>`;
    } else {
      this.lives--;
      verdict = this.lives > 0 ? `<span class="bad">LIFE LOST · ${this.lives} LEFT</span>` : `<span class="bad">GAME OVER</span>`;
    }
    $('res-verdict').innerHTML = verdict;
    const u = this.upgrades;
    $('res-stats').innerHTML = `SCORE ${this.score}<br>ENGINE ${u.engine} · TIRES ${u.tires} · BATTERY ${u.battery}<br>LETTERS ${WORD.split('').map((ch, i) => (this.letters[i] ? ch : '_')).join(' ')}`;
    $('msg').textContent = '';
    $('submsg').textContent = '';
    this.setState('results');
  }

  afterResults() {
    if (this.lastPlace <= 3) {
      let next = this.trackIndex + 1;
      if (next >= TRACKS.length) {
        next = 0;
        this.round++;
        this.toast(`ROUND ${this.round + 1}!`, '#ffd600');
      }
      this.loadTrack(next);
    } else if (this.lives > 0) {
      this.loadTrack(this.trackIndex);
    } else {
      this.loadTrack(0, true);
      this.setState('title');
    }
  }

  // ---------------------------------------------------------------- visuals
  emitCarFx(dt) {
    const fx = this.fx;
    const dustColor = TRACKS[this.trackIndex].theme.snowy ? 0xffffff : 0xc9b79c;
    for (const c of this.cars) {
      for (const e of c.events) {
        const near = Math.hypot(c.x - this.player.x, c.z - this.player.z) < 40;
        if (e.type === 'wall') {
          fx.sparks(c.x, c.y, c.z, 8);
          if (c.isPlayer) { this.audio.wall(e.power); this.shake = Math.max(this.shake, Math.min(0.6, e.power * 0.03)); }
        } else if (e.type === 'land') {
          fx.dust(c.x, c.y, c.z, dustColor, 10);
          if (c.isPlayer || near) this.audio.land();
          if (c.isPlayer) this.shake = Math.max(this.shake, Math.min(0.5, e.power * 0.02));
        } else if (e.type === 'bump' && (c.isPlayer || near)) {
          if (c.isPlayer) this.audio.bump();
          fx.sparks(c.x, c.y, c.z, 4);
        }
      }
      c.events.length = 0;
      if (!c.onGround) continue;
      const fx_ = Math.sin(c.heading), fz = Math.cos(c.heading);
      const rx = -fz, rz = fx_;
      const vl = c.vx * rx + c.vz * rz;
      const drifting = Math.abs(vl) > 3.5 || c.slipTime > 0;
      const accelerating = c.throttle > 0 && c.forward < c.stats.maxSpeed * 0.5 && c.forward > 1;
      if ((drifting || accelerating || c.spinTime > 0) && Math.random() < 50 * dt) {
        const side = Math.random() < 0.5 ? -1 : 1;
        fx.dust(c.x - fx_ * 1.0 + rx * side * 0.8, c.y, c.z - fz * 1.0 + rz * side * 0.8, dustColor, 1);
      }
      if (c.boostTime > 0 && Math.random() < 60 * dt) {
        fx.emit(c.x - fx_ * 1.3, c.y + 0.6, c.z - fz * 1.3, {
          vx: -fx_ * 4, vy: 0.5, vz: -fz * 4, life: 0.3, size: 0.35, grow: -0.5,
          color: Math.random() < 0.5 ? 0xffab00 : 0xff3d00,
        });
      }
    }
  }

  updateCamera(dt) {
    const cam = this.camera;
    const p = this.player;
    const mode = this.state === 'title' ? 'orbit' : this.state === 'intro' ? 'flyby' : CAMERA_MODES[this.cameraMode];
    let pos = new THREE.Vector3(), look = new THREE.Vector3();
    let fov = 55;
    let lerp = 1 - Math.exp(-6 * dt);

    if (mode === 'orbit') {
      const t = performance.now() / 1000;
      const b = this.track.bounds;
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
      const r = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.75;
      pos.set(cx + Math.cos(t * 0.08) * r, 70, cz + Math.sin(t * 0.08) * r);
      look.set(cx, 0, cz);
      lerp = 1;
      fov = 50;
    } else if (mode === 'flyby') {
      const t = this.stateTime;
      const a = p.heading + Math.PI * 0.9 - t * 0.55;
      const dist = 34 - t * 6;
      pos.set(p.x + Math.sin(a) * dist, p.y + 16 - t * 2.5, p.z + Math.cos(a) * dist);
      look.set(p.x, p.y + 1, p.z);
      lerp = 1;
      if (this.stateTime < 0.05) this.camYaw = p.heading;
    } else {
      const spinning = p.spinTime > 0 || p.slipTime > 0;
      let targetYaw = p.heading;
      if (p.forward < -3) targetYaw = p.heading;
      const yawRate = mode === 'chase' ? 7 : 2.4;
      if (!spinning) {
        let d = targetYaw - this.camYaw;
        d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
        this.camYaw += d * (1 - Math.exp(-yawRate * dt));
      }
      const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
      const boost = Math.min(1, p.boostTime * 2);
      if (mode === 'dynamic') {
        pos.set(p.x - fx * 15, p.y + 11.5, p.z - fz * 15);
        look.set(p.x + fx * 5, p.y + 0.5, p.z + fz * 5);
        fov = 55 + boost * 10;
      } else if (mode === 'chase') {
        pos.set(p.x - fx * 7.5, p.y + 3.4, p.z - fz * 7.5);
        look.set(p.x + fx * 6, p.y + 1.2, p.z + fz * 6);
        fov = 62 + boost * 12;
        lerp = 1 - Math.exp(-14 * dt);
      } else {
        // classic: fixed high 3/4 view like the NES original
        pos.set(p.x, p.y + 38, p.z + 27);
        look.set(p.x + p.vx * 0.25, p.y, p.z + p.vz * 0.25 - 2);
        fov = 42;
      }
    }

    this.camPos.lerp(pos, lerp);
    this.camLook.lerp(look, lerp);
    cam.position.copy(this.camPos);
    if (this.shake > 0) {
      const s = this.shake * 0.6;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    cam.lookAt(this.camLook);
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * (1 - Math.exp(-5 * dt));
      cam.updateProjectionMatrix();
    }

    // shadows follow the camera focus
    const f = this.camLook;
    this.sun.position.set(f.x + 40, f.y + 70, f.z + 30);
    this.sun.target.position.copy(f);
    if (this.world?.userData.sky) this.world.userData.sky.position.copy(cam.position);
  }

  // ---------------------------------------------------------------- HUD
  buildHudStatic() {
    $('letters').innerHTML = WORD.split('').map((c) => `<span>${c}</span>`).join('');
    for (const k of ['engine', 'tires', 'battery']) $(`pip-${k}`).innerHTML = '<b></b>'.repeat(MAX_LEVEL);
  }

  setText(id, v) {
    if (this.hudCache[id] !== v) {
      this.hudCache[id] = v;
      $(id).innerHTML = v;
    }
  }

  updateHud() {
    if (!['countdown', 'race', 'finished'].includes(this.state)) return;
    const p = this.player;
    const laps = TRACKS[this.trackIndex].laps;
    const order = this.standings();
    const place = order.indexOf(p) + 1;
    this.setText('pos', `${place}<small>${ordinal(place)}</small>`);
    const lap = Math.max(1, Math.min(laps, Math.floor(p.progress / this.track.length) + 1));
    this.setText('lap', `LAP ${lap}/${laps}`);
    this.setText('time', fmtTime(p.finished ? p.finishTime : this.raceTime));
    this.setText('missiles', String(p.missiles));
    this.setText('bombs', String(p.bombs));
    const lettersKey = this.letters.join();
    if (this.hudCache.letters !== lettersKey) {
      this.hudCache.letters = lettersKey;
      [...$('letters').children].forEach((el, i) => el.classList.toggle('on', this.letters[i]));
    }
    for (const k of ['engine', 'tires', 'battery']) {
      const key = `pip-${k}`;
      if (this.hudCache[key] !== this.upgrades[k]) {
        this.hudCache[key] = this.upgrades[k];
        [...$(key).children].forEach((el, i) => el.classList.toggle('on', i < this.upgrades[k]));
      }
    }
    $('speedfill').style.width = `${Math.min(100, (Math.max(0, p.forward) / (p.stats.maxSpeed * 1.6)) * 100)}%`;

    // wrong way
    const dot = p.vx * p.q.tx + p.vz * p.q.tz;
    if (this.state === 'race' && dot < -4) this.wrongWay += 1 / 60;
    else this.wrongWay = 0;
    $('wrongway').classList.toggle('hidden', this.wrongWay < 0.8);

    this.drawMinimap();
  }

  drawMinimap() {
    const cv = $('minimap');
    const g = cv.getContext('2d');
    const W = cv.width;
    const t = this.track;
    if (this.mapTrack !== t) {
      this.mapTrack = t;
      const b = t.bounds;
      const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
      this.mapScale = (W - 30) / span;
      this.mapOff = [W / 2 - ((b.minX + b.maxX) / 2) * this.mapScale, W / 2 - ((b.minZ + b.maxZ) / 2) * this.mapScale];
      const off = document.createElement('canvas');
      off.width = off.height = W;
      const o = off.getContext('2d');
      o.lineJoin = 'round';
      for (const [w, col] of [[9, '#fff'], [5, '#555']]) {
        o.strokeStyle = col;
        o.lineWidth = w;
        o.beginPath();
        for (let i = 0; i <= t.N; i += 2) {
          const j = i % t.N;
          const x = t.x[j] * this.mapScale + this.mapOff[0], y = t.z[j] * this.mapScale + this.mapOff[1];
          i ? o.lineTo(x, y) : o.moveTo(x, y);
        }
        o.closePath();
        o.stroke();
      }
      const s0 = t.posAt(0, 0);
      o.strokeStyle = '#ffd600';
      o.lineWidth = 3;
      o.beginPath();
      o.moveTo((s0.x + s0.rx * 7) * this.mapScale + this.mapOff[0], (s0.z + s0.rz * 7) * this.mapScale + this.mapOff[1]);
      o.lineTo((s0.x - s0.rx * 7) * this.mapScale + this.mapOff[0], (s0.z - s0.rz * 7) * this.mapScale + this.mapOff[1]);
      o.stroke();
      this.mapCanvas = off;
    }
    g.clearRect(0, 0, W, W);
    g.drawImage(this.mapCanvas, 0, 0);
    for (const c of [...this.rivals, this.player]) {
      const x = c.x * this.mapScale + this.mapOff[0], y = c.z * this.mapScale + this.mapOff[1];
      g.fillStyle = '#' + c.model.paint.color.getHexString();
      g.strokeStyle = '#000';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, c.isPlayer ? 6 : 4.5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }
}

window.game = new Game();
