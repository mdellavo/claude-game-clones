import * as THREE from 'three';
import { RIDERS, COURSES, DIFFICULTIES, CHAMP_POINTS, STAT_RANGES, MAX_MISSES } from './config.js';
import { World } from './world.js';
import { Race } from './race.js';
import { Particles } from './particles.js';
import { HUD, fmtTime, ordinal } from './hud.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { ChaseCamera } from './camera.js';
import { Track } from './track.js';
import { MotionBlur } from './motionblur.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, 1, 0.3, 9000);

const menuEl = document.getElementById('menu');
const loadingEl = document.getElementById('loading');
const hud = new HUD();
const audio = new Audio();
const input = new Input();
const chase = new ChaseCamera(camera);
const motionBlur = new MotionBlur(renderer);

const RECORDS_KEY = 'tidebreaker.records';
function loadRecords() {
  try { return JSON.parse(localStorage.getItem(RECORDS_KEY)) || {}; } catch { return {}; }
}
function saveRecords(r) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(r)); } catch { /* storage unavailable */ }
}

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

class Game {
  constructor() {
    this.world = null;
    this.particles = null;
    this.race = null;
    this.t = 0;
    this.screen = 'title';
    this.paused = false;
    this.sel = { rider: 0, course: 0, diff: 0, mode: 'race' };
    this.champ = null;
    this.navIndex = 0;
    this.attractCamT = 0;
    this.miniTracks = {};
  }

  async loadCourse(idx) {
    const course = COURSES[idx];
    if (this.world && this.world.course === course) return;
    loadingEl.hidden = false;
    loadingEl.textContent = `Loading ${course.name}…`;
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 20)));
    if (this.race) { this.race.dispose(); this.race = null; }
    if (this.world) this.world.dispose();
    if (this.particles) this.particles.dispose(scene);
    this.world = new World(scene, course);
    this.particles = new Particles(scene, this.world, course.water.foam);
    this.resize();
    loadingEl.hidden = true;
  }

  newRace(mode, riderIdx = this.sel.rider) {
    if (this.race) this.race.dispose();
    this.particles.clear();
    this.race = new Race({
      world: this.world, particles: this.particles, audio, hud, riderIdx, mode,
      diff: DIFFICULTIES[this.sel.diff], t: this.t,
    });
    const f = this.race.focus;
    chase.snap(f.craft);
    if (mode !== 'attract') {
      hud.setup(this.race);
      hud.show(true);
    } else {
      hud.show(false);
    }
  }

  async startAttract() {
    await this.loadCourse(this.sel.course);
    this.newRace('attract');
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    motionBlur.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (this.particles) this.particles.setScale(h * renderer.getPixelRatio(), camera.fov);
  }

  // ---------------- Menus ----------------

  setMenu(html, onMount) {
    menuEl.innerHTML = html;
    this.navIndex = 0;
    const items = this.navItems();
    const selIdx = items.findIndex((el) => el.classList.contains('sel'));
    this.navIndex = selIdx >= 0 ? selIdx : 0;
    this.highlight();
    menuEl.querySelectorAll('[data-nav]').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        this.navIndex = this.navItems().indexOf(el);
        this.highlight();
      });
    });
    if (onMount) onMount();
  }

  navItems() {
    return [...menuEl.querySelectorAll('[data-nav]')];
  }

  highlight() {
    this.navItems().forEach((el, i) => el.classList.toggle('focus', i === this.navIndex));
    const items = this.navItems();
    items.forEach((el) => { if (el.tagName === 'BUTTON') el.classList.toggle('sel', false); });
    const cur = items[this.navIndex];
    if (cur && cur.tagName === 'BUTTON') cur.classList.add('sel');
    if (cur && cur.classList.contains('card')) {
      items.filter((el) => el.classList.contains('card')).forEach((el) => el.classList.toggle('sel', el === cur));
    }
  }

  menuNav() {
    const items = this.navItems();
    if (!items.length) return;
    const prev = this.navIndex;
    if (input.wasPressed('ArrowDown', 'ArrowRight', 'KeyS', 'KeyD', 'PadDown', 'PadRight', 'Tab')) this.navIndex = (this.navIndex + 1) % items.length;
    if (input.wasPressed('ArrowUp', 'ArrowLeft', 'KeyW', 'KeyA', 'PadUp', 'PadLeft')) this.navIndex = (this.navIndex - 1 + items.length) % items.length;
    if (prev !== this.navIndex) {
      audio.menuMove();
      this.highlight();
      const cur = items[this.navIndex];
      if (cur.dataset.hover) cur.dispatchEvent(new Event('mouseenter'));
    }
    if (input.wasPressed('Enter', 'Space', 'PadA', 'PadStart')) items[this.navIndex].click();
    if (input.wasPressed('Escape', 'Backspace', 'PadB')) {
      const back = menuEl.querySelector('[data-back]');
      if (back) back.click();
    }
  }

  bind(sel, fn) {
    menuEl.querySelectorAll(sel).forEach((el) => el.addEventListener('click', (e) => {
      audio.init();
      audio.menuOk();
      fn(el, e);
    }));
  }

  showTitle() {
    this.screen = 'title';
    this.setMenu(`
      <div class="title-wrap">
        <div class="title"><h1>TIDEBREAKER</h1><div class="tag">JET-SKI CHAMPIONSHIP</div></div>
        <button data-nav id="go" class="sel">PRESS START</button>
        <div class="hint">Keyboard or gamepad · Best with sound on</div>
      </div>`, () => this.bind('#go', () => this.showMain()));
  }

  showMain() {
    this.screen = 'main';
    this.setMenu(`
      <div class="panel" style="max-width:520px">
        <div class="title"><h1 style="font-size:64px">TIDEBREAKER</h1><div class="tag" style="margin-bottom:18px">JET-SKI CHAMPIONSHIP</div></div>
        <div class="menu-list">
          <button data-nav data-mode="champ">CHAMPIONSHIP</button>
          <button data-nav data-mode="race">SINGLE RACE</button>
          <button data-nav data-mode="tt">TIME TRIAL</button>
          <button data-nav id="controls">HOW TO PLAY</button>
          <button data-nav data-back id="back">BACK</button>
        </div>
      </div>`, () => {
      this.bind('[data-mode]', (el) => { this.sel.mode = el.dataset.mode; this.showRiders(); });
      this.bind('#controls', () => this.showControls());
      this.bind('#back', () => this.showTitle());
    });
  }

  showControls() {
    this.screen = 'controls';
    this.setMenu(`
      <div class="panel" style="max-width:720px">
        <h2>HOW TO PLAY</h2>
        <div class="controls">
          <div><kbd>W</kbd><kbd>↑</kbd></div><div>Throttle (gamepad: A / RT)</div>
          <div><kbd>A</kbd><kbd>D</kbd><kbd>←</kbd><kbd>→</kbd></div><div>Steer</div>
          <div><kbd>S</kbd><kbd>↓</kbd></div><div>Lean back — nose up for bigger air off waves and ramps</div>
          <div><kbd>Shift</kbd></div><div>Lean forward — dig in for tighter turns (gamepad: stick up / bumper)</div>
          <div><kbd>Space</kbd></div><div>Stunt while airborne: + steer = barrel roll, + S = backflip, + W = front flip</div>
          <div><kbd>C</kbd></div><div>Change camera</div>
          <div><kbd>R</kbd></div><div>Reset to course</div>
          <div><kbd>M</kbd></div><div>Music on/off</div>
          <div><kbd>Esc</kbd><kbd>P</kbd></div><div>Pause</div>
        </div>
        <div class="hint">
          Pass <b class="buoy-red">RED</b> buoys on their <b>right</b> and <b class="buoy-yel">YELLOW</b> buoys on their <b>left</b> — follow the floating arrows.<br>
          Each correct buoy adds a bar of <b>POWER</b> (more top speed). A miss drains it, and ${MAX_MISSES} misses means disqualification.<br>
          Land a stunt for a speed boost — but finish the rotation before you hit the water! Hold throttle just before GO for a rocket start.
        </div>
        <div class="row"><button data-nav data-back id="back">BACK</button></div>
      </div>`, () => this.bind('#back', () => this.showMain()));
  }

  statBars(r) {
    const bar = (label, key) => {
      const [a, b] = STAT_RANGES[key];
      const pct = Math.round(15 + ((r[key] - a) / (b - a)) * 85);
      return `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${pct}%"></i></div></div>`;
    };
    return bar('SPEED', 'top') + bar('ACCEL', 'accel') + bar('HANDLING', 'handling') + bar('GRIP', 'grip');
  }

  showRiders() {
    this.screen = 'riders';
    const cards = RIDERS.map((r, i) => `
      <div class="card ${i === this.sel.rider ? 'sel' : ''}" data-nav data-rider="${i}">
        <div class="swatch" style="background:linear-gradient(135deg, ${hex(r.hull)} 0 45%, ${hex(r.trim)} 45% 52%, ${hex(r.suit)} 52% 80%, ${hex(r.helmet)} 80%)"></div>
        <div class="name">${r.name}</div>
        <div class="desc">${r.desc}</div>
        ${this.statBars(r)}
      </div>`).join('');
    const title = { champ: 'CHAMPIONSHIP', race: 'SINGLE RACE', tt: 'TIME TRIAL' }[this.sel.mode];
    this.setMenu(`
      <div class="panel">
        <h2>${title} — CHOOSE YOUR RIDER</h2>
        <div class="cards">${cards}</div>
        <div class="row"><button data-nav data-back id="back">BACK</button></div>
      </div>`, () => {
      this.bind('[data-rider]', (el) => {
        this.sel.rider = +el.dataset.rider;
        if (this.sel.mode === 'champ') this.showChampSetup();
        else this.showCourses();
      });
      this.bind('#back', () => this.showMain());
    });
  }

  miniTrackSvg(course) {
    if (!this.miniTracks[course.id]) {
      const tr = new Track(course);
      const b = tr.bounds;
      const w = b.maxX - b.minX, h = b.maxZ - b.minZ;
      const sc = Math.min(260 / w, 80 / h);
      const pts = [];
      for (let i = 0; i < tr.N; i += 20) pts.push(`${(300 - (tr.px[i] - b.minX) * sc - (300 - w * sc) / 2).toFixed(1)},${(90 - (tr.pz[i] - b.minZ) * sc - (90 - h * sc) / 2).toFixed(1)}`);
      this.miniTracks[course.id] = pts.join(' ');
    }
    const s = course.sky, wtr = course.water;
    return `<svg class="course-mini" viewBox="0 0 300 90" preserveAspectRatio="xMidYMid meet" style="background:linear-gradient(${hex(s.zenith)}, ${hex(s.horizon)} 45%, ${hex(wtr.shallow)} 46%, ${hex(wtr.deep)})">
      <polygon points="${this.miniTracks[course.id]}" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round" opacity=".95"/></svg>`;
  }

  diffOpts() {
    return `<div class="opts">${DIFFICULTIES.map((d, i) => `<button data-nav data-diff="${i}" class="${i === this.sel.diff ? 'sel' : ''}">${d.name.toUpperCase()}</button>`).join('')}</div>`;
  }

  bindDiff() {
    this.bind('[data-diff]', (el) => {
      this.sel.diff = +el.dataset.diff;
      menuEl.querySelectorAll('[data-diff]').forEach((b) => b.classList.toggle('chosen', b === el));
      menuEl.querySelectorAll('[data-diff]').forEach((b) => (b.style.outline = b === el ? '3px solid #ffe14d' : ''));
    });
    const cur = menuEl.querySelector(`[data-diff="${this.sel.diff}"]`);
    if (cur) cur.style.outline = '3px solid #ffe14d';
  }

  showCourses() {
    this.screen = 'courses';
    const recs = loadRecords();
    const cards = COURSES.map((c, i) => {
      const r = recs[c.id];
      return `
      <div class="card ${i === this.sel.course ? 'sel' : ''}" data-nav data-course="${i}">
        ${this.miniTrackSvg(c)}
        <div class="name">${c.name}</div>
        <div class="desc">${c.blurb}</div>
        <div class="stat"><span>RECORD</span>${r ? fmtTime(r.total) : '--:--.--'}</div>
      </div>`;
    }).join('');
    this.setMenu(`
      <div class="panel">
        <h2>${this.sel.mode === 'tt' ? 'TIME TRIAL' : 'SINGLE RACE'} — CHOOSE A COURSE</h2>
        <div class="cards">${cards}</div>
        ${this.sel.mode === 'race' ? `<div class="hint" style="margin-top:16px">DIFFICULTY</div>${this.diffOpts()}` : ''}
        <div class="row"><button data-nav data-back id="back">BACK</button></div>
      </div>`, () => {
      this.bind('[data-course]', (el) => this.beginRace(+el.dataset.course, this.sel.mode));
      if (this.sel.mode === 'race') this.bindDiff();
      this.bind('#back', () => this.showRiders());
    });
  }

  showChampSetup() {
    this.screen = 'champsetup';
    const list = COURSES.map((c, i) => `<div class="card" style="cursor:default"><div class="name">${i + 1}. ${c.name}</div><div class="desc">${c.blurb}</div></div>`).join('');
    this.setMenu(`
      <div class="panel">
        <h2>CHAMPIONSHIP</h2>
        <div class="cards">${list}</div>
        <div class="hint" style="margin-top:16px">Points per race: ${CHAMP_POINTS.map((p, i) => `${i + 1}${ordinal(i + 1)} = ${p}`).join(' · ')}<br>DIFFICULTY</div>
        ${this.diffOpts()}
        <div class="row"><button data-nav id="start">START CHAMPIONSHIP</button><button data-nav data-back id="back">BACK</button></div>
      </div>`, () => {
      this.bindDiff();
      this.bind('#start', () => {
        this.champ = { round: 0, points: Object.fromEntries(RIDERS.map((r) => [r.id, 0])) };
        this.beginRace(0, 'champ');
      });
      this.bind('#back', () => this.showRiders());
    });
  }

  async beginRace(courseIdx, mode) {
    audio.init();
    this.sel.course = courseIdx;
    this.mode = mode;
    menuEl.innerHTML = '';
    await this.loadCourse(courseIdx);
    this.newRace(mode === 'tt' ? 'tt' : 'race');
    this.screen = 'race';
    this.paused = false;
    const c = COURSES[courseIdx];
    hud.subText(mode === 'champ' ? `ROUND ${this.champ.round + 1} — ${c.name.toUpperCase()}` : c.name.toUpperCase(), 3);
  }

  showPause() {
    this.paused = true;
    this.screen = 'paused';
    audio.setEngine({ speed: 0, throttle: 0, airborne: false, active: false });
    this.setMenu(`
      <div class="panel" style="max-width:420px">
        <h2 style="text-align:center">PAUSED</h2>
        <div class="menu-list">
          <button data-nav data-back id="resume">RESUME</button>
          <button data-nav id="restart">RESTART</button>
          <button data-nav id="quit">QUIT TO MENU</button>
        </div>
      </div>`, () => {
      this.bind('#resume', () => this.resume());
      this.bind('#restart', () => {
        if (this.mode === 'champ') {
          this.champ.round = this.champ.round || 0;
        }
        this.beginRace(this.sel.course, this.mode);
      });
      this.bind('#quit', () => this.quitToMenu());
    });
  }

  resume() {
    menuEl.innerHTML = '';
    this.paused = false;
    this.screen = 'race';
  }

  async quitToMenu() {
    this.paused = false;
    this.champ = null;
    hud.show(false);
    audio.setEngine({ speed: 0, throttle: 0, airborne: false, active: false });
    this.newRace('attract');
    this.showMain();
  }

  showResults() {
    this.screen = 'results';
    const race = this.race;
    audio.setEngine({ speed: 0, throttle: 0, airborne: false, active: false });
    const rows = race.results();
    const course = this.world.course;
    let extra = '';
    let champRows = '';
    let buttons;

    if (this.mode === 'tt') {
      const p = race.player;
      const recs = loadRecords();
      const prev = recs[course.id];
      let isRecord = false;
      if (!p.dq) {
        const best = Math.min(...p.lapTimes);
        if (!prev || p.finishTime < prev.total) { recs[course.id] = { total: p.finishTime, lap: Math.min(best, prev?.lap ?? Infinity) }; isRecord = true; }
        else if (best < prev.lap) recs[course.id].lap = best;
        saveRecords(recs);
      }
      extra = `<div class="hint" style="font-size:20px">${p.dq ? 'DISQUALIFIED — too many missed buoys' : isRecord ? '<b style="color:#ffe14d">NEW COURSE RECORD!</b>' : `Record: ${fmtTime(prev.total)}`}</div>`;
      buttons = `<button data-nav id="retry">RETRY</button><button data-nav id="menu">MENU</button>`;
    } else if (this.mode === 'champ') {
      rows.forEach((r, i) => {
        r.pts = r.e.dq ? 0 : CHAMP_POINTS[i] ?? 0;
        this.champ.points[r.e.rider.id] += r.pts;
      });
      const last = this.champ.round >= COURSES.length - 1;
      buttons = `<button data-nav id="standings">${last ? 'FINAL STANDINGS' : 'STANDINGS'}</button>`;
    } else {
      buttons = `<button data-nav id="retry">RETRY</button><button data-nav id="menu">MENU</button>`;
    }

    const table = rows.map((r, i) => `
      <tr class="${r.e.isPlayer ? 'me' : ''}">
        <td>${r.e.dq ? 'DQ' : `${i + 1}${ordinal(i + 1)}`}</td>
        <td>${r.e.rider.name}</td>
        <td class="num">${r.e.dq ? '—' : (r.e.finished ? '' : '~') + fmtTime(r.time)}</td>
        <td class="num">${fmtTime(r.best)}</td>
        <td class="num">${r.e.stuntScore}</td>
        ${this.mode === 'champ' ? `<td class="num">+${r.pts}</td>` : ''}
      </tr>`).join('');
    champRows = this.mode === 'champ' ? '<th>PTS</th>' : '';

    this.setMenu(`
      <div class="panel" style="max-width:760px">
        <h2>${course.name.toUpperCase()} — RESULTS</h2>
        <table class="results"><tr><th>POS</th><th>RIDER</th><th>TIME</th><th>BEST LAP</th><th>STUNTS</th>${champRows}</tr>${table}</table>
        ${extra}
        <div class="row">${buttons}</div>
      </div>`, () => {
      this.bind('#retry', () => this.beginRace(this.sel.course, this.mode));
      this.bind('#menu', () => this.quitToMenu());
      this.bind('#standings', () => this.showStandings());
    });
    hud.show(false);
  }

  showStandings() {
    this.screen = 'standings';
    const ch = this.champ;
    const last = ch.round >= COURSES.length - 1;
    const table = RIDERS.map((r) => ({ r, pts: ch.points[r.id] }))
      .sort((a, b) => b.pts - a.pts)
      .map((x, i) => `<tr class="${RIDERS.indexOf(x.r) === this.sel.rider ? 'me' : ''}"><td>${i + 1}${ordinal(i + 1)}</td><td>${x.r.name}</td><td class="num">${x.pts}</td></tr>`).join('');
    const sorted = RIDERS.map((r) => ch.points[r.id]);
    const mine = ch.points[RIDERS[this.sel.rider].id];
    const champion = last && mine >= Math.max(...sorted);
    if (champion) audio.fanfare();
    this.setMenu(`
      <div class="panel" style="max-width:620px">
        <h2>${last ? (champion ? '🏆 CHAMPION! 🏆' : 'FINAL STANDINGS') : `STANDINGS AFTER ROUND ${ch.round + 1}`}</h2>
        <table class="results"><tr><th>POS</th><th>RIDER</th><th>POINTS</th></tr>${table}</table>
        <div class="row">${last ? '<button data-nav id="menu">MENU</button>' : `<button data-nav id="next">NEXT: ${COURSES[ch.round + 1].name.toUpperCase()}</button><button data-nav id="menu">QUIT</button>`}</div>
      </div>`, () => {
      this.bind('#next', () => {
        ch.round++;
        this.beginRace(ch.round, 'champ');
      });
      this.bind('#menu', () => this.quitToMenu());
    });
  }

  // ---------------- Loop ----------------

  tick(dt) {
    input.pollGamepad();
    const inRace = this.screen === 'race' || this.screen === 'paused';

    if (this.screen === 'title' && input.wasPressed('Enter', 'Space', 'PadA', 'PadStart')) {
      audio.init();
      audio.menuOk();
      this.showMain();
    } else if (this.screen !== 'race') {
      this.menuNav();
    }

    if (input.wasPressed('KeyM')) {
      audio.init();
      hud.subText(audio.toggleMusic() ? 'MUSIC ON' : 'MUSIC OFF', 1);
    }

    if (this.screen === 'race') {
      if (input.wasPressed('Escape', 'KeyP', 'PadStart')) this.showPause();
      if (input.wasPressed('KeyC')) chase.cycle();
      if (input.wasPressed('KeyR') && this.race.player && !this.race.player.finished && this.race.state === 'racing') this.race.respawn(this.race.player, this.t);
    } else if (this.screen === 'paused' && input.wasPressed('KeyP')) {
      this.resume();
    }

    if (!this.world || !this.race) return;

    if (!this.paused) {
      this.t += dt;
      this.race.update(dt, this.t, input);
      this.particles.update(dt, this.t);
    }

    const race = this.race;
    let blurCraft = null;
    if (race.mode === 'attract') {
      const f = race.focus;
      this.attractCamT += dt;
      if (Math.floor(this.attractCamT / 9) % 2 === 0) {
        chase.orbit(f.craft, dt, this.world, this.t, 11);
      } else {
        if (this._lastMode !== 1) chase.snap(f.craft);
        chase.follow(f.craft, dt, this.world, this.t);
        blurCraft = f.craft;
      }
      this._lastMode = Math.floor(this.attractCamT / 9) % 2;
      if (race.state === 'done') this.newRace('attract');
    } else {
      const p = race.player;
      if (this.screen === 'results' || this.screen === 'standings') chase.orbit(p.craft, dt, this.world, this.t, 9);
      else {
        chase.follow(p.craft, dt, this.world, this.t);
        if (!this.paused) blurCraft = p.craft;
      }
      hud.update(dt, race, p);
      if (inRace && race.state === 'done' && this.screen === 'race') this.showResults();
    }

    this.world.update(this.t, camera, dt);
    motionBlur.update(dt, camera, blurCraft);
  }
}

const game = new Game();
window.addEventListener('resize', () => game.resize());
window.addEventListener('pointerdown', () => audio.init(), { once: true });

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.tick(dt);
  if (game.world) motionBlur.render(scene, camera);
  input.endFrame();
}

game.startAttract().then(() => {
  game.showTitle();
  requestAnimationFrame(frame);
});
window.__game = game;
