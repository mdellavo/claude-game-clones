import { sfx } from '../engine/audio.js';

// Pixel-art icons: each string row, chars map to colors.
function pixelSvg(rows, palette, scale = 3) {
  const h = rows.length, w = rows[0].length;
  let rects = '';
  rows.forEach((r, y) => {
    for (let x = 0; x < w; x++) {
      const c = palette[r[x]];
      if (c) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges">${rects}</svg>`;
}

const HEART_ROWS = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
const HEART_HALF = ['.XX.WW.', 'XXXWWWW', 'XXXWWWW', '.XXWWW.', '..XWW..', '...W...'];
const heart = (type) => {
  if (type === 'full') return pixelSvg(HEART_ROWS, { X: '#e82838' });
  if (type === 'half') return pixelSvg(HEART_HALF, { X: '#e82838', W: '#fcd8d0' });
  return pixelSvg(HEART_ROWS, { X: '#fcd8d0' });
};

export const ICONS = {
  rupee: pixelSvg(['..X..', '.XGX.', 'XGGLX', 'XGGLX', 'XGGLX', '.XGX.', '..X..'], { X: '#107030', G: '#30d060', L: '#b0ffb0' }, 2),
  key: pixelSvg(['.XXX.', 'X...X', '.XXX.', '..X..', '..XX.', '..X..', '..XX.'], { X: '#f0c020' }, 2),
  bomb: pixelSvg(['...F.', '..W..', '.BBB.', 'BBBBB', 'BLBBB', 'BBBBB', '.BBB.'], { F: '#ffa020', W: '#ddd', B: '#2848b0', L: '#8098ff' }, 2),
  sword: pixelSvg(['...W', '..W.', '.W..', 'W...', 'BB..', 'B...'].map((r) => r), { W: '#e8f0ff', B: '#9a6a2a' }, 5),
  boomerang: pixelSvg(['XXXX', 'XX..', 'X.X.', 'X...'], { X: '#c07030' }, 5),
  bombBig: pixelSvg(['...F.', '..W..', '.BBB.', 'BBBBB', 'BLBBB', 'BBBBB', '.BBB.'], { F: '#ffa020', W: '#ddd', B: '#2848b0', L: '#8098ff' }, 4),
  triforce: pixelSvg(['...X...', '..XXX..', '.XXXXX.', 'XXXXXXX'], { X: '#ffd020' }, 5),
};

export class UI {
  constructor() {
    this.hud = document.getElementById('hud');
    this.dialog = document.getElementById('dialog');
    this.fadeEl = document.getElementById('fade');
    this.overlay = document.getElementById('overlay');
    this.toast = document.getElementById('toast');
    this.typing = null;
    this.hud.innerHTML = `
      <div class="hud-map"><div class="hud-map-grid"></div><div class="hud-level"></div></div>
      <div class="hud-counts">
        <div>${ICONS.rupee}<span>X</span><b data-k="rupees">0</b></div>
        <div>${ICONS.key}<span>X</span><b data-k="keys">0</b></div>
        <div>${ICONS.bomb}<span>X</span><b data-k="bombs">0</b></div>
      </div>
      <div class="hud-slots">
        <div class="slot"><div class="slot-box" data-slot="b"></div><label>B</label></div>
        <div class="slot"><div class="slot-box" data-slot="a"></div><label>A</label></div>
      </div>
      <div class="hud-life"><div class="life-label">-LIFE-</div><div class="hearts"></div></div>
    `;
    this.els = {
      rupees: this.hud.querySelector('[data-k=rupees]'),
      keys: this.hud.querySelector('[data-k=keys]'),
      bombs: this.hud.querySelector('[data-k=bombs]'),
      b: this.hud.querySelector('[data-slot=b]'),
      a: this.hud.querySelector('[data-slot=a]'),
      hearts: this.hud.querySelector('.hearts'),
      map: this.hud.querySelector('.hud-map-grid'),
      level: this.hud.querySelector('.hud-level'),
    };
    this.cache = {};
  }

  set(key, html) {
    if (this.cache[key] === html) return;
    this.cache[key] = html;
    return true;
  }

  updateHud(game) {
    const p = game.player;
    const pad = (n) => String(n);
    if (this.set('rupees', p.rupees)) this.els.rupees.textContent = pad(p.rupees);
    if (this.set('keys', p.keys)) this.els.keys.textContent = pad(p.keys);
    if (this.set('bombs', p.bombs)) this.els.bombs.textContent = pad(p.bombs);
    const bIcon = p.bItem === 'boomerang' && p.hasBoomerang ? ICONS.boomerang : p.bItem === 'bomb' && p.bombs > 0 ? ICONS.bombBig : '';
    if (this.set('b', bIcon)) this.els.b.innerHTML = bIcon;
    const aIcon = p.hasSword ? ICONS.sword : '';
    if (this.set('a', aIcon)) this.els.a.innerHTML = aIcon;

    let hearts = '';
    for (let i = 0; i < p.maxHp / 2; i++) {
      const v = p.hp - i * 2;
      hearts += `<i>${heart(v >= 2 ? 'full' : v === 1 ? 'half' : 'empty')}</i>`;
    }
    if (this.set('hearts', hearts)) this.els.hearts.innerHTML = hearts;

    const area = game.area;
    const key = `${area.id}:${game.screen.col},${game.screen.row}:${[...game.visitedRooms].length}`;
    if (this.set('map', key)) {
      let html = '';
      const cols = area.kind === 'cave' ? game.overworld.cols : area.cols;
      const rows = area.kind === 'cave' ? game.overworld.rows : area.rows;
      const cur = area.kind === 'cave' ? game.caveReturn.screen : game.screen;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const k = `${c},${r}`;
          let cls = 'cell';
          if (area.kind === 'dungeon') {
            if (!area.screenExists(c, r)) cls += ' void';
            else if (game.visitedRooms.has(k)) cls += ' visited';
            else cls += ' unknown';
          }
          if (c === cur.col && r === cur.row) cls += ' here';
          html += `<div class="${cls}"></div>`;
        }
      }
      this.els.map.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      this.els.map.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
      this.els.map.className = `hud-map-grid ${area.kind === 'dungeon' ? 'dungeon' : 'overworld'}`;
      this.els.map.innerHTML = html;
      this.els.level.textContent = area.kind === 'dungeon' ? 'LEVEL-1' : '';
    }
    this.hud.classList.toggle('low', p.hp <= 2 && p.hp > 0);
  }

  // Typewriter dialog text
  say(text, { speed = 0.045 } = {}) {
    this.clearDialog();
    this.dialog.textContent = '';
    this.dialog.classList.add('show');
    let i = 0;
    const tick = () => {
      if (i >= text.length) { this.typing = null; return; }
      const ch = text[i++];
      this.dialog.textContent += ch;
      if (ch !== ' ' && ch !== '\n') sfx.text();
      this.typing = setTimeout(tick, speed * 1000);
    };
    tick();
  }

  clearDialog() {
    if (this.typing) clearTimeout(this.typing);
    this.typing = null;
    this.dialog.classList.remove('show');
    this.dialog.textContent = '';
  }

  flashToast(text) {
    this.toast.textContent = text;
    this.toast.classList.remove('show');
    void this.toast.offsetWidth;
    this.toast.classList.add('show');
  }

  fade(to, dur = 0.35) {
    return new Promise((resolve) => {
      this.fadeEl.style.transition = `opacity ${dur}s linear`;
      this.fadeEl.style.opacity = String(to);
      setTimeout(resolve, dur * 1000);
    });
  }

  showOverlay(html, cls = '') {
    this.overlay.className = `show ${cls}`;
    this.overlay.innerHTML = html;
  }

  hideOverlay() {
    this.overlay.className = '';
    this.overlay.innerHTML = '';
  }

  showTitle() {
    this.showOverlay(`
      <div class="title">
        <div class="title-tri">${ICONS.triforce}</div>
        <h1>THE LEGEND OF<br><span>ZELDA</span></h1>
        <div class="subtitle">ISOMETRIC EDITION</div>
        <div class="blink">PRESS ENTER</div>
        <table class="controls">
          <tr><td>ARROWS / WASD</td><td>MOVE</td></tr>
          <tr><td>Z / J / SPACE</td><td>SWORD (A)</td></tr>
          <tr><td>X / K</td><td>ITEM (B)</td></tr>
          <tr><td>C / TAB</td><td>SWITCH ITEM</td></tr>
          <tr><td>ENTER</td><td>INVENTORY</td></tr>
          <tr><td>V</td><td>CAMERA VIEW</td></tr>
          <tr><td>M</td><td>MUTE</td></tr>
        </table>
        <div class="fan">A fan-made 3D tribute. Gamepads supported.</div>
      </div>`, 'title-screen');
  }

  showPause(game, cursor) {
    const p = game.player;
    const items = game.bItems();
    const itemHtml = items.length
      ? items.map((it, i) => `<div class="inv-item ${i === cursor ? 'sel' : ''}">${it === 'boomerang' ? ICONS.boomerang : ICONS.bombBig}</div>`).join('')
      : '<div class="inv-empty">NO ITEMS YET</div>';
    const tri = Array.from({ length: 8 }, (_, i) => `<div class="tri ${i < p.triforce ? 'got' : ''}">${ICONS.triforce}</div>`).join('');
    this.showOverlay(`
      <div class="pause">
        <h2>INVENTORY</h2>
        <div class="inv-row">
          <div class="inv-current"><div class="slot-box">${items[cursor] === 'boomerang' ? ICONS.boomerang : items[cursor] === 'bomb' ? ICONS.bombBig : ''}</div><label>USE B BUTTON<br>FOR THIS</label></div>
          <div class="inv-items">${itemHtml}</div>
        </div>
        <h2>TRIFORCE</h2>
        <div class="tri-row">${tri}</div>
        <div class="hint">LEFT/RIGHT: SELECT &nbsp; ENTER: RESUME</div>
      </div>`, 'pause-screen');
  }

  showGameOver() {
    this.showOverlay(`<div class="gameover"><h1>GAME OVER</h1><div class="blink">PRESS ENTER TO CONTINUE</div></div>`, 'gameover-screen');
  }

  showWin() {
    this.showOverlay(`
      <div class="win">
        <div class="title-tri big">${ICONS.triforce}</div>
        <h1>YOU FOUND A PIECE<br>OF THE TRIFORCE!</h1>
        <p>Level 1 is conquered. The overworld is still yours to explore.</p>
        <div class="blink">PRESS ENTER</div>
      </div>`, 'win-screen');
  }
}
