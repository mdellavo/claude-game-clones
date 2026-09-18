import { h, clear } from './dom.js';
import { itemIcon } from './icons.js';
import { BattleView } from '../render/battleview.js';
import { computeReach } from '../battle/pathfinding.js';
import { dirTo } from '../battle/map.js';
import * as combat from '../battle/combat.js';
import { eyePos } from '../battle/los.js';
import { itemDef, itemName } from '../data/items.js';
import { InventoryScreen } from './inventory.js';
import { helpContent } from './app.js';
import { sfx, audioSettings, setMuted, setVolume } from '../audio.js';

const MODE_NAMES = { auto: 'Auto Shot', snap: 'Snap Shot', aimed: 'Aimed Shot' };

export class BattleHud {
  constructor(container, battle, { onEnd, onQuit }) {
    this.container = container;
    this.battle = battle;
    this.onEnd = onEnd;
    this.onQuit = onQuit;
    this.mode = { type: 'move' };
    this.busy = false;
    this.sel = null;
    this.reachKey = '';
    this.reach = null;
    this.keys = new Set();
    this.logLines = [];
    this.actionCount = 0;
    this.spottedThisTurn = new Set();

    const view = (this.view = new BattleView(container, battle));
    battle.view = view;
    this.buildDom();
    this.bindInput();

    view.on('message', (m, kind) => this.log(m, kind));
    view.on('spotted', (t) => {
      if (this.spottedThisTurn.has(t.id)) return;
      this.spottedThisTurn.add(t.id);
      sfx('spotted');
    });
    view.on('visibility', () => {
      this.updateEnemies();
      if (this.battle.side === 'alien') this.updateHiddenOverlay();
    });
    view.on('damage', (u, dmg) => this.floatText(u, `-${dmg}`, '#ff6060'));
    view.on('frame', (dt) => this.onFrame(dt));
    view.on('viewLevel', () => this.refresh());
    view.on('reaction', (u) => this.floatText(u, 'REACTION!', '#ffd040'));
    view.on('turn', (side, turn) => {
      if (side === 'xcom') {
        this.spottedThisTurn.clear();
        for (const u of battle.unitList('xcom')) u.done = false;
      }
      this.refresh();
      void turn;
    });

    battle.start();
    const first = battle.activeUnits('xcom')[0];
    if (first) {
      this.select(first);
      view.centerOn(first.x, first.y, first.z, true);
    }
    this.banner(`TURN 1`, 1400);
    sfx('turn');
    this.refresh();
  }

  dispose() {
    this.view.dispose();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.closeMenu();
  }

  // ---------------------------------------------------------------- DOM
  buildDom() {
    const c = this.container;
    this.topbar = h('div', { class: 'topbar panel' });
    this.logEl = h('div', { class: 'log' });
    this.enemiesEl = h('div', { class: 'enemies' });
    this.tooltip = h('div', { class: 'tooltip', style: { display: 'none' } });
    this.bannerEl = h('div', { class: 'banner', style: { display: 'none' } });
    this.hiddenEl = h('div', { class: 'hidden-movement', style: { display: 'none' } },
      h('div', { class: 'box panel' }, h('h1', {}, 'HIDDEN MOVEMENT'), h('div', { class: 'small' }, 'Alien activity detected')));

    this.rightHand = h('div', { class: 'hand', onclick: () => this.openHandMenu('rhand') });
    this.leftHand = h('div', { class: 'hand', onclick: () => this.openHandMenu('lhand') });
    const btn = (label, title, fn) => h('button', { title, onclick: () => { sfx('click'); fn(); } }, label);
    this.btn = {
      up: btn('▲', 'View level up [PgUp]', () => this.view.setViewLevel(this.view.viewLevel + 1)),
      down: btn('▼', 'View level down [PgDn]', () => this.view.setViewLevel(this.view.viewLevel - 1)),
      kneel: btn('Kneel', 'Kneel / stand [K]', () => this.kneel()),
      inv: btn('Inv', 'Inventory [I]', () => this.openInventory()),
      center: btn('◎', 'Center on soldier [C]', () => this.centerSel()),
      prev: btn('◀', 'Previous soldier [Shift+Tab]', () => this.nextUnit(-1)),
      next: btn('▶', 'Next soldier [Tab]', () => this.nextUnit(1)),
      done: btn('▶✓', 'Done with soldier, next', () => this.doneNext()),
      end: btn('End Turn', 'End turn [Enter]', () => this.endTurn()),
      abort: btn('Abort', 'Abort mission', () => this.confirmAbort()),
      opts: btn('☰', 'Options', () => this.openOptions()),
    };
    this.reserveBtns = {};
    for (const [k, label] of [['none', 'Free'], ['snap', 'Snap'], ['aimed', 'Aimed'], ['auto', 'Auto']]) {
      this.reserveBtns[k] = h('button', {
        title: `Reserve TUs for ${label.toLowerCase()} shot`,
        onclick: () => { this.battle.reserve = k; this.refresh(); },
      }, label);
    }
    this.unitName = h('span', { class: 'uname' });
    this.unitRank = h('span', { class: 'small' });
    this.bars = h('div', { class: 'bars' });
    const center = h('div', { class: 'hud-center' },
      h('div', { class: 'hud-buttons' }, Object.values(this.btn)),
      h('div', { class: 'unit-info' }, h('span', {}, this.unitName, ' ', this.unitRank),
        h('span', { class: 'hud-buttons' }, h('span', { class: 'small', style: { alignSelf: 'center' } }, 'Reserve'), Object.values(this.reserveBtns))),
      this.bars,
    );
    this.bottom = h('div', { class: 'hud-bottom panel' }, this.rightHand, center, this.leftHand);
    c.append(this.topbar, this.logEl, this.enemiesEl, this.bottom, this.hiddenEl, this.bannerEl, this.tooltip);
    for (const el of [this.topbar, this.bottom, this.enemiesEl]) {
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('wheel', (e) => e.stopPropagation());
    }
  }

  log(msg, kind = 'info') {
    const color = { good: 'var(--good)', bad: 'var(--bad)', warn: 'var(--warn)', info: 'var(--text)' }[kind] || 'var(--text)';
    const el = h('div', { style: { color } }, msg);
    this.logEl.append(el);
    while (this.logEl.children.length > 7) this.logEl.firstChild.remove();
    setTimeout(() => (el.style.opacity = '0'), 7000);
    setTimeout(() => el.remove(), 8200);
  }

  banner(text, ms = 1500, color = null) {
    this.bannerEl.textContent = text;
    this.bannerEl.style.color = color || '';
    this.bannerEl.style.display = '';
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => (this.bannerEl.style.display = 'none'), ms);
  }

  floatText(u, text, color) {
    const p = this.view.projectToScreen(u.x + 0.5, u.y + 0.5, u.z + 1);
    const el = h('div', {
      style: {
        position: 'fixed', left: p.x + 'px', top: p.y + 'px', color, fontSize: '26px', pointerEvents: 'none',
        textShadow: '2px 2px 0 #000', transition: 'transform 1.1s ease-out, opacity 1.1s', transform: 'translate(-50%,0)', zIndex: 15,
      },
    }, text);
    this.container.append(el);
    requestAnimationFrame(() => {
      el.style.transform = 'translate(-50%,-50px)';
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 1200);
  }

  // ---------------------------------------------------------------- refresh
  refresh() {
    const b = this.battle;
    const u = this.sel;
    clear(this.topbar).append(
      h('span', { class: 'hi' }, `TURN ${b.turn}`),
      h('span', { class: b.side === 'xcom' ? 'good' : 'bad' }, b.side === 'xcom' ? 'X-COM' : 'ALIENS'),
      h('span', {}, `Level ${this.view.viewLevel + 1}/${b.map.h}`),
      h('span', { class: 'small' }, `${b.map.night ? 'Night' : 'Day'} · ${b.mission.ufo.def.name}`),
      h('span', { class: 'small' }, `Squad ${b.activeUnits('xcom').length}`),
    );
    const playerTurn = b.side === 'xcom' && !this.busy && !b.over;
    for (const k of ['kneel', 'inv', 'prev', 'next', 'done', 'end', 'abort']) this.btn[k].disabled = !playerTurn;
    for (const [k, el] of Object.entries(this.reserveBtns)) el.classList.toggle('on', b.reserve === k);
    this.btn.kneel.classList.toggle('on', !!(u && u.kneeling));

    if (!u) {
      this.unitName.textContent = '';
      this.unitRank.textContent = '';
      clear(this.bars);
      this.renderHand(this.rightHand, null, 'R');
      this.renderHand(this.leftHand, null, 'L');
      return;
    }
    this.unitName.textContent = u.name;
    this.unitRank.textContent = `${u.rankName}${u.panic ? ' - ' + u.panic.toUpperCase() : ''}${u.wounds ? ` - ${u.wounds} fatal wound${u.wounds > 1 ? 's' : ''}` : ''}`;
    const bar = (label, val, max, color, extra) => [
      h('span', {}, label),
      h('span', { class: 'num' }, Math.max(0, Math.round(val))),
      h('div', { class: 'bar' },
        h('div', { style: { width: Math.max(0, Math.min(100, (val / max) * 100)) + '%', background: color } }),
        extra ? h('div', { class: 'stun', style: { width: Math.min(100, (extra / max) * 100) + '%' } }) : null),
    ];
    clear(this.bars).append(
      ...bar('TU', u.tu, u.stats.tu, 'var(--tu)'),
      ...bar('Energy', u.energy, u.stats.stamina, 'var(--energy)'),
      ...bar('Health', u.health, u.stats.health, 'var(--health)', u.stun),
      ...bar('Morale', u.morale, 100, 'var(--morale)'),
    );
    this.renderHand(this.rightHand, u.hand('rhand'), 'R');
    this.renderHand(this.leftHand, u.hand('lhand'), 'L');
    this.updateEnemies();
  }

  renderHand(el, item, label) {
    clear(el);
    el.append(h('span', { class: 'label' }, label === 'R' ? 'R.HAND' : 'L.HAND'));
    if (!item) return;
    const d = itemDef(item.id);
    if (d.ammo) el.append(h('span', { class: 'ammo' }, item.loaded ? item.loaded.rounds : 'EMPTY'));
    else if (d.kind === 'medikit') el.append(h('span', { class: 'ammo' }, item.uses));
    if (item.primed) el.append(h('span', { class: 'ammo', style: { color: 'var(--bad)' } }, 'PRIMED'));
    el.append(itemIcon(item, 72, 80, 0.7), h('div', { class: 'name' }, itemName(item)));
  }

  updateEnemies() {
    const visible = this.battle.activeUnits('alien').filter((a) => this.battle.visibleToPlayer(a));
    const key = visible.map((a) => a.id).join(',');
    if (key === this._enemyKey) return;
    this._enemyKey = key;
    clear(this.enemiesEl);
    visible.forEach((a, i) => {
      this.enemiesEl.append(h('button', {
        title: a.name,
        onclick: () => {
          this.view.centerOn(a.x, a.y, a.z);
          this.view.setViewLevel(this.levelHasRoofAbove(a) ? a.z : this.battle.map.h - 1);
        },
      }, i + 1));
    });
  }

  updateHiddenOverlay() {
    const anyVisible = this.battle.activeUnits('alien').some((a) => this.battle.visibleToPlayer(a));
    this.hiddenEl.style.display = this.battle.side === 'alien' && !anyVisible && !this.battle.over ? '' : 'none';
  }

  // ---------------------------------------------------------------- selection
  select(u) {
    if (!u || !u.active || u.faction !== 'xcom') return;
    if (this.sel !== u) this.mode = { type: 'move' };
    this.sel = u;
    this.view.selected = u;
    this.reachKey = '';
    this.view.setViewLevel(this.levelHasRoofAbove(u) ? u.z : this.battle.map.h - 1);
    this.refresh();
  }

  levelHasRoofAbove(u) {
    // true if something above the unit would hide it
    const m = this.battle.map;
    for (let z = u.z + 1; z < m.h; z++) if (m.floor[m.idx(u.x, u.y, z)]) return true;
    return false;
  }

  centerSel() {
    if (!this.sel) return;
    this.view.centerOn(this.sel.x, this.sel.y, this.sel.z);
    this.view.setViewLevel(this.levelHasRoofAbove(this.sel) ? this.sel.z : this.battle.map.h - 1);
  }

  nextUnit(dir = 1, skipDone = true) {
    const list = this.battle.activeUnits('xcom');
    if (!list.length) return;
    let i = list.indexOf(this.sel);
    for (let k = 0; k < list.length; k++) {
      i = (i + dir + list.length) % list.length;
      const u = list[i];
      if (skipDone && (u.done || u.tu <= 0) && k < list.length - 1) continue;
      this.select(u);
      this.centerSel();
      return;
    }
  }

  doneNext() {
    if (this.sel) this.sel.done = true;
    const remaining = this.battle.activeUnits('xcom').filter((u) => !u.done && u.tu > 0);
    if (!remaining.length) {
      this.log('All soldiers have finished. Press End Turn.', 'info');
      return;
    }
    this.nextUnit(1);
  }

  getReach() {
    const u = this.sel;
    if (!u) return null;
    const key = `${u.id}:${u.x},${u.y},${u.z}:${u.tu}:${u.kneeling}:${this.actionCount}:${this.battle.turn}`;
    if (key !== this.reachKey) {
      this.reachKey = key;
      this.reach = computeReach(this.battle.map, u, Math.min(255, u.tu + 80));
    }
    return this.reach;
  }

  // ---------------------------------------------------------------- input
  bindInput() {
    const canvas = this.view.renderer.domElement;
    let down = null;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      this.closeMenu();
      down = { x: e.clientX, y: e.clientY, button: e.button, dragging: false, lx: e.clientX, ly: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      this.mouse = { x: e.clientX, y: e.clientY };
      if (down) {
        const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
        if (!down.dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.dragging = true;
        if (down.dragging) {
          if (down.button === 2) {
            this.view.cam.yawTarget -= dx * 0.008;
            this.view.cam.yaw = this.view.cam.yawTarget;
          } else {
            const k = (this.view.cam.zoom * 2) / canvas.clientHeight;
            this.view.pan(-dx * k, -dy * k / Math.sin(this.view.cam.pitch));
          }
          down.lx = e.clientX;
          down.ly = e.clientY;
          return;
        }
      }
      this.hover(e);
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!down) return;
      const d = down;
      down = null;
      if (d.dragging) {
        if (d.button === 2) {
          // snap rotation to the nearest 45 degrees
          const c = this.view.cam;
          c.yawTarget = Math.round((c.yawTarget - Math.PI / 4) / (Math.PI / 4)) * (Math.PI / 4) + Math.PI / 4;
        }
        return;
      }
      const tile = this.view.pick(e.clientX, e.clientY);
      if (d.button === 0) this.leftClick(tile);
      else if (d.button === 2) this.rightClick(tile);
    });
    canvas.addEventListener('pointerleave', () => {
      this.tooltip.style.display = 'none';
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.view.zoomBy(e.deltaY > 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });

    this.onKeyDown = (e) => {
      if (document.querySelector('.modal')) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      const playerTurn = this.battle.side === 'xcom' && !this.busy && !this.battle.over;
      switch (k) {
        case 'q':
          this.view.rotate(-1);
          break;
        case 'e':
          this.view.rotate(1);
          break;
        case '+':
        case '=':
          this.view.zoomBy(1 / 1.2);
          break;
        case '-':
          this.view.zoomBy(1.2);
          break;
        case 'pageup':
        case ']':
          this.view.setViewLevel(this.view.viewLevel + 1);
          break;
        case 'pagedown':
        case '[':
          this.view.setViewLevel(this.view.viewLevel - 1);
          break;
        case 'tab':
          e.preventDefault();
          if (playerTurn) this.nextUnit(e.shiftKey ? -1 : 1, false);
          break;
        case 'c':
          this.centerSel();
          break;
        case 'k':
          if (playerTurn) this.kneel();
          break;
        case 'i':
          if (playerTurn) this.openInventory();
          break;
        case 'r':
          if (playerTurn) this.reloadSel();
          break;
        case 'f':
          if (playerTurn) this.openHandMenu(this.sel?.hand('rhand') ? 'rhand' : 'lhand');
          break;
        case 'enter':
          if (playerTurn) this.endTurn();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
          this.battle.reserve = ['none', 'snap', 'aimed', 'auto'][+k - 1];
          this.refresh();
          break;
        case 'escape':
          if (this.menuEl) this.closeMenu();
          else if (this.mode.type !== 'move') this.setMode({ type: 'move' });
          else this.openOptions();
          break;
      }
    };
    this.onKeyUp = (e) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  onFrame(dt) {
    const k = this.keys;
    const sp = dt * this.view.cam.zoom * 1.6;
    let dx = 0, dz = 0;
    if (k.has('a') || k.has('arrowleft')) dx -= sp;
    if (k.has('d') || k.has('arrowright')) dx += sp;
    if (k.has('w') || k.has('arrowup')) dz += sp;
    if (k.has('s') || k.has('arrowdown')) dz -= sp;
    if (dx || dz) this.view.pan(dx, dz);
    if (this.battle.side === 'alien') this.updateHiddenOverlay();
  }

  setMode(m) {
    this.mode = m;
    this.view.showAim(null);
    this.view.showPath(null);
    if (this.mouse) this.hover(this.mouse);
  }

  hover(e) {
    const tile = this.view.pick(e.x ?? e.clientX, e.y ?? e.clientY);
    this.hoverTile = tile;
    const tip = this.tooltip;
    const showTip = (text, color = '') => {
      tip.textContent = text;
      tip.style.color = color;
      tip.style.display = '';
      const mx = e.x ?? e.clientX, my = e.y ?? e.clientY;
      const w = tip.offsetWidth;
      tip.style.left = (mx + 18 + w > window.innerWidth ? mx - w - 12 : mx + 18) + 'px';
      tip.style.top = my + 14 + 'px';
    };
    tip.style.display = 'none';
    this.view.showPath(null);
    this.view.showAim(null);
    if (!tile) {
      this.view.setCursor(null);
      return;
    }
    const u = this.sel;
    const b = this.battle;
    const m = this.mode;
    const hoverUnit = tile.unit || b.unitAtPos(tile.x, tile.y, tile.z);
    const visibleAlien = hoverUnit && hoverUnit.faction === 'alien' && b.visibleToPlayer(hoverUnit);
    if (m.type === 'move') {
      this.view.setCursor(tile, visibleAlien ? 0xff4040 : hoverUnit && hoverUnit.faction === 'xcom' ? 0x40ff80 : 0xffff40);
      if (visibleAlien) showTip(hoverUnit.name, '#ff8080');
      if (!u || this.busy || b.side !== 'xcom' || (hoverUnit && hoverUnit.faction === 'xcom')) return;
      const reach = this.getReach();
      const path = reach.path(tile.x, tile.y, tile.z);
      if (!path || !path.length) return;
      const reserve = b.reserveCost(u) + (u.kneeling ? 8 : 0);
      const kneel = u.kneeling ? 8 : 0;
      this.view.showPath(path, (p) => (p.cost + kneel <= u.tu - b.reserveCost(u) ? 0x40ff40 : p.cost + kneel <= u.tu ? 0xffb030 : 0xff3030));
      const cost = path[path.length - 1].cost + kneel;
      showTip(`${cost} TU`, cost <= u.tu - reserve + kneel ? '#80ff80' : cost <= u.tu ? '#ffc060' : '#ff6060');
      return;
    }
    this.view.setCursor(tile, 0xff4040);
    if (!u) return;
    if (m.type === 'shoot') {
      const cost = combat.modeCost(b, u, m.weapon, m.mode);
      const acc = Math.round(combat.accuracy(b, u, m.weapon, m.mode) * 100);
      const aim = combat.aimPoint(b, tile);
      this.view.showAim(eyePos(b.map, u), aim);
      const dist = Math.round(Math.hypot(tile.x - u.x, tile.y - u.y, tile.z - u.z));
      showTip(`${MODE_NAMES[m.mode]}  ${acc}%  ${cost} TU  (${dist} tiles)`, u.tu >= cost ? '#ffe080' : '#ff6060');
    } else if (m.type === 'throw') {
      const range = combat.throwRange(u, m.item);
      const dist = Math.hypot(tile.x - u.x, tile.y - u.y);
      const cost = b.tuCostPct(u, 25);
      showTip(`Throw ${itemName(m.item)}  ${cost} TU${dist > range ? '  OUT OF RANGE' : ''}`, dist > range || u.tu < cost ? '#ff6060' : '#ffe080');
    } else if (m.type === 'melee') {
      const cost = b.tuCostPct(u, itemDef(m.weapon.id).tu);
      const adj = Math.max(Math.abs(tile.x - u.x), Math.abs(tile.y - u.y)) <= 1 && tile.z === u.z;
      showTip(`${itemDef(m.weapon.id).dmgType === 'STUN' ? 'Stun' : 'Hit'}  ${cost} TU${adj ? '' : '  NOT ADJACENT'}`, adj && u.tu >= cost ? '#ffe080' : '#ff6060');
    } else if (m.type === 'medikit') {
      showTip(`${m.label} - select patient (10 TU)`, '#80ff80');
    }
  }

  async runAction(fn) {
    if (this.busy) return;
    this.busy = true;
    this.view.showPath(null);
    this.view.showAim(null);
    this.refresh();
    try {
      const res = await fn();
      if (res && res.ok === false && res.reason) {
        sfx('error');
        this.log(res.reason, 'warn');
      }
      if (res && res.stopped === 'spotted') this.log('Movement halted: alien spotted!', 'warn');
    } catch (err) {
      console.error(err);
    }
    this.actionCount++;
    this.busy = false;
    if (this.sel && !this.sel.active) {
      this.sel = null;
      this.nextUnit(1, false);
    }
    this.refresh();
    if (this.battle.over) return this.finish();
    if (this.mouse) this.hover(this.mouse);
  }

  leftClick(tile) {
    const b = this.battle;
    if (!tile || this.busy || b.side !== 'xcom' || b.over) return;
    const u = this.sel;
    const m = this.mode;
    const target = tile.unit || b.unitAtPos(tile.x, tile.y, tile.z);
    if (m.type === 'move') {
      if (target && target.faction === 'xcom') {
        sfx('click');
        this.select(target);
        return;
      }
      if (!u) return;
      const reach = this.getReach();
      const path = reach.path(tile.x, tile.y, tile.z);
      if (!path || !path.length) return;
      if (path[path.length - 1].cost + (u.kneeling ? 8 : 0) > u.tu) {
        sfx('error');
        this.log('Not enough time units', 'warn');
        return;
      }
      if (u.panic) return this.log(`${u.name} is ${u.panic}!`, 'warn');
      this.runAction(async () => {
        const res = await b.move(u, path, { player: true });
        if (res.stopped === 'reserve') this.log('Time units reserved for firing', 'warn');
        return res;
      });
      return;
    }
    if (!u) return;
    const sel = u;
    if (m.type === 'shoot') {
      this.setMode({ type: 'move' });
      this.runAction(() => combat.shoot(b, sel, m.weapon, m.mode, { x: tile.x, y: tile.y, z: tile.z }));
    } else if (m.type === 'throw') {
      this.setMode({ type: 'move' });
      this.runAction(() => combat.throwItem(b, sel, m.item, { x: tile.x, y: tile.y, z: tile.z }));
    } else if (m.type === 'melee') {
      this.setMode({ type: 'move' });
      const victim = target || b.bodiesAt(tile.x, tile.y, tile.z)[0];
      this.runAction(() => combat.melee(b, sel, m.weapon, victim));
    } else if (m.type === 'medikit') {
      this.setMode({ type: 'move' });
      const patient = target || b.bodiesAt(tile.x, tile.y, tile.z).find((x) => x.status === 'unconscious');
      this.runAction(async () => b.medikit(sel, m.kit, patient, m.action));
    }
  }

  rightClick(tile) {
    if (this.mode.type !== 'move') {
      this.setMode({ type: 'move' });
      return;
    }
    const b = this.battle;
    const u = this.sel;
    if (!tile || !u || this.busy || b.side !== 'xcom' || b.over) return;
    const dir = dirTo(tile.x - u.x, tile.y - u.y);
    if (dir < 0) return;
    this.runAction(async () => {
      const ok = await b.turnUnit(u, dir);
      return ok ? { ok: true } : { ok: false, reason: 'Not enough time units' };
    });
  }

  kneel() {
    const u = this.sel;
    if (!u || this.busy) return;
    const res = this.battle.kneel(u);
    if (!res.ok) {
      sfx('error');
      this.log(res.reason, 'warn');
    }
    this.actionCount++;
    this.refresh();
  }

  reloadSel() {
    const u = this.sel;
    if (!u) return;
    const w = u.hand('rhand') || u.hand('lhand');
    if (!w) return;
    const res = this.battle.reload(u, w);
    if (!res.ok) {
      sfx('error');
      this.log(res.reason, 'warn');
    } else sfx('click');
    this.refresh();
  }

  // ---------------------------------------------------------------- menus
  closeMenu() {
    if (this.menuEl) {
      this.menuEl.remove();
      this.menuEl = null;
    }
  }

  openHandMenu(slot) {
    const u = this.sel;
    const b = this.battle;
    this.closeMenu();
    if (!u || this.busy || b.side !== 'xcom' || b.over) return;
    const item = u.hand(slot);
    if (!item) return;
    const d = itemDef(item.id);
    const entries = [];
    const add = (label, info, fn, disabled = false) => entries.push({ label, info, fn, disabled });
    if (u.panic) {
      this.log(`${u.name} is ${u.panic}!`, 'warn');
      return;
    }
    if (d.kind === 'weapon') {
      const loaded = combat.hasAmmo(item);
      for (const mode of ['auto', 'snap', 'aimed']) {
        if (!d.modes[mode]) continue;
        const cost = combat.modeCost(b, u, item, mode);
        const acc = Math.round(combat.accuracy(b, u, item, mode) * 100);
        add(MODE_NAMES[mode], `Acc ${acc}%  TU ${cost}`, () => this.setMode({ type: 'shoot', weapon: item, mode }), !loaded || u.tu < cost);
      }
      if (d.ammo) {
        const ammo = u.findAmmoFor(item);
        if (!loaded) add('Reload', ammo ? 'TU 15' : 'no ammo', () => { this.reloadSel(); }, !ammo || u.tu < 15);
      }
    }
    if (d.kind === 'grenade') {
      if (!item.primed) add('Prime Grenade', `TU ${b.tuCostPct(u, 50)}`, () => { const r = b.prime(u, item); if (!r.ok) this.log(r.reason, 'warn'); this.refresh(); }, u.tu < b.tuCostPct(u, 50));
    }
    if (d.kind === 'melee') {
      add(d.dmgType === 'STUN' ? 'Stun' : 'Hit', `TU ${b.tuCostPct(u, d.tu)}`, () => this.setMode({ type: 'melee', weapon: item }), u.tu < b.tuCostPct(u, d.tu));
    }
    if (d.kind === 'medikit') {
      for (const [action, label] of [['heal', 'Heal Wounds'], ['stim', 'Stimulant'], ['pain', 'Pain Killer']]) {
        add(label, `TU 10 (${item.uses} left)`, () => this.setMode({ type: 'medikit', kit: item, action, label }), u.tu < 10 || item.uses <= 0);
      }
    }
    add('Throw', `TU ${b.tuCostPct(u, 25)}`, () => this.setMode({ type: 'throw', item }), u.tu < b.tuCostPct(u, 25));

    const el = h('div', { class: 'menu-pop panel' },
      h('div', { class: 'hi', style: { padding: '0 6px' } }, itemName(item)),
      entries.map((en) => h('button', {
        disabled: en.disabled,
        onclick: () => { sfx('click'); this.closeMenu(); en.fn(); },
      }, h('span', {}, en.label), h('span', {}, en.info))),
    );
    const handEl = slot === 'rhand' ? this.rightHand : this.leftHand;
    const r = handEl.getBoundingClientRect();
    this.container.append(el);
    const mr = el.getBoundingClientRect();
    el.style.left = Math.max(4, Math.min(window.innerWidth - mr.width - 4, r.left + r.width / 2 - mr.width / 2)) + 'px';
    el.style.top = Math.max(4, r.top - mr.height - 6) + 'px';
    this.menuEl = el;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  openInventory() {
    const u = this.sel;
    if (!u || this.busy) return;
    new InventoryScreen(this.container, {
      unit: u,
      battle: this.battle,
      onClose: () => {
        this.actionCount++;
        this.refresh();
      },
    });
  }

  modal(content) {
    const m = h('div', { class: 'modal', onclick: (e) => e.target === m && m.remove() }, h('div', { class: 'panel' }, content));
    this.container.append(m);
    return m;
  }

  openOptions() {
    const m = this.modal([
      h('h2', {}, 'Options'),
      h('div', { class: 'grid-form' },
        'Animation speed', h('select', { onchange: (e) => (this.view.speed = +e.target.value) },
          [[0.75, 'Slow'], [1, 'Normal'], [1.75, 'Fast'], [3, 'Very fast']].map(([v, l]) => h('option', { value: v, selected: this.view.speed === v }, l))),
        'Volume', h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: audioSettings.volume, oninput: (e) => setVolume(+e.target.value) }),
        'Mute', h('input', { type: 'checkbox', checked: audioSettings.muted, onchange: (e) => setMuted(e.target.checked) }),
      ),
      h('div', { style: { marginTop: '14px' } }, helpContent()),
      h('div', { class: 'row', style: { marginTop: '12px' } },
        h('button', { onclick: () => { m.remove(); this.confirmAbort(); } }, 'Abort Mission'),
        h('button', { onclick: () => { m.remove(); this.onQuit(); } }, 'Quit to Title'),
        h('div', { class: 'spacer' }),
        h('button', { onclick: () => m.remove() }, 'Resume'),
      ),
    ]);
  }

  confirmAbort() {
    if (this.busy || this.battle.side !== 'xcom') return;
    const b = this.battle;
    const onCraft = b.activeUnits('xcom').filter((u) => b.map.isCraftTile(u.x, u.y, u.z)).length;
    const total = b.activeUnits('xcom').length;
    const m = this.modal([
      h('h2', {}, 'Abort Mission?'),
      h('div', {}, `${onCraft} of ${total} soldiers are aboard the Skyranger.`),
      h('div', { class: 'small' }, 'Soldiers outside the Skyranger will be lost. No UFO components will be recovered.'),
      h('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'flex-end' } },
        h('button', { onclick: () => m.remove() }, 'Cancel'),
        h('button', { onclick: () => { m.remove(); b.abort(); this.finish(); } }, 'Abort'),
      ),
    ]);
  }

  // ---------------------------------------------------------------- turn flow
  async endTurn() {
    const b = this.battle;
    if (this.busy || b.side !== 'xcom' || b.over) return;
    this.closeMenu();
    this.setMode({ type: 'move' });
    this.busy = true;
    this.tooltip.style.display = 'none';
    this.refresh();
    sfx('alienturn');
    try {
      const done = b.endPlayerTurn();
      // the alien side starts once primed grenades have gone off
      const wait = setInterval(() => {
        if (b.side === 'alien') this.updateHiddenOverlay();
      }, 100);
      await done;
      clearInterval(wait);
    } catch (err) {
      console.error(err);
    }
    this.hiddenEl.style.display = 'none';
    this.busy = false;
    this.actionCount++;
    if (b.over) return this.finish();
    this.banner(`TURN ${b.turn}`, 1400);
    sfx('turn');
    if (!this.sel || !this.sel.active) this.nextUnit(1, false);
    else this.centerSel();
    this.refresh();
  }

  finish() {
    if (this._finished) return;
    this._finished = true;
    const r = this.battle.over.result;
    this.hiddenEl.style.display = 'none';
    const text = r === 'victory' ? 'CRASH SITE SECURED' : r === 'defeat' ? 'SQUAD LOST' : 'MISSION ABORTED';
    this.banner(text, 5000, r === 'victory' ? 'var(--good)' : 'var(--bad)');
    this.busy = true;
    setTimeout(() => this.onEnd(this.battle.results()), 2200);
  }
}
