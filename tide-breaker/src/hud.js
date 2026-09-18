import { MAX_MISSES } from './config.js';

export const fmtTime = (t) => {
  if (!isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
};
export const ordinal = (n) => (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');

export class HUD {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.root = $('hud');
    this.posNum = $('pos-num');
    this.posSuf = $('pos-suf');
    this.lapNum = $('lap-num');
    this.lapTotal = $('lap-total');
    this.time = $('time-total');
    this.lapTimes = $('lap-times');
    this.speed = $('speed-val');
    this.power = $('power');
    this.miss = $('miss-dots');
    this.msg = $('hud-msg');
    this.sub = $('hud-sub');
    this.trickEl = $('hud-trick');
    this.mini = $('minimap');
    this.posEl = $('hud-pos');
    this.power.innerHTML = '<i></i>'.repeat(5);
    this.miss.innerHTML = '<i></i>'.repeat(MAX_MISSES);
    this.msgT = 0;
    this.subT = 0;
    this.trickT = 0;
    this.last = {};
  }

  show(on) {
    this.root.hidden = !on;
  }

  setup(race) {
    this.race = race;
    this.lapTotal.textContent = `/${race.laps}`;
    this.posEl.style.visibility = race.entries.length > 1 ? 'visible' : 'hidden';
    this.message('', '', 0);
    this.subText('', 0);
    this.trickEl.textContent = '';
    this.last = {};
    const tr = race.world.track;
    const b = tr.bounds;
    const size = this.mini.width, pad = 16;
    const sc = (size - pad * 2) / Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    const ox = (size - (b.maxX - b.minX) * sc) / 2, oz = (size - (b.maxZ - b.minZ) * sc) / 2;
    // Flip x so the map matches the chase view (screen-right is world -x).
    this.map = (x, z) => [size - (ox + (x - b.minX) * sc), size - (oz + (z - b.minZ) * sc)];
  }

  message(text, cls = '', dur = 1.2) {
    this.msg.textContent = text;
    this.msg.className = '';
    void this.msg.offsetWidth;
    this.msg.className = `pop ${cls}`;
    this.msgT = dur;
  }

  subText(text, dur = 1.5) {
    this.sub.textContent = text;
    this.subT = dur;
  }

  trick(text) {
    this.trickEl.textContent = text;
    this.trickEl.className = '';
    void this.trickEl.offsetWidth;
    this.trickEl.className = 'pop';
    this.trickT = 1.6;
  }

  update(dt, race, player) {
    if (this.msgT > 0 && (this.msgT -= dt) <= 0) this.msg.textContent = '';
    if (this.subT > 0 && (this.subT -= dt) <= 0) this.sub.textContent = '';
    if (this.trickT > 0 && (this.trickT -= dt) <= 0) this.trickEl.textContent = '';
    if (!player) return;
    const set = (key, val, fn) => {
      if (this.last[key] !== val) {
        this.last[key] = val;
        fn(val);
      }
    };
    set('pos', player.place, (v) => { this.posNum.textContent = v; this.posSuf.textContent = ordinal(v); });
    set('lap', Math.min(player.lapsDone + 1, race.laps), (v) => (this.lapNum.textContent = v));
    const shown = player.finished && !player.dq ? player.finishTime : race.time;
    this.time.textContent = fmtTime(Math.max(0, shown));
    set('speed', Math.round(player.craft.speed * 3.6), (v) => (this.speed.textContent = v));
    set('power', player.craft.power, (v) => {
      [...this.power.children].forEach((el, i) => el.classList.toggle('on', i < v));
      this.power.classList.toggle('max', v >= 5);
    });
    set('miss', player.misses, (v) => [...this.miss.children].forEach((el, i) => el.classList.toggle('on', i < v)));
    set('laps', player.lapTimes.join(','), () => {
      const best = Math.min(...player.lapTimes);
      this.lapTimes.innerHTML = player.lapTimes.map((t, i) => `<div class="${t === best && player.lapTimes.length > 1 ? 'best' : ''}">L${i + 1} ${fmtTime(t)}</div>`).join('');
    });
    this.drawMap(race, player);
  }

  drawMap(race, player) {
    const ctx = this.mini.getContext('2d');
    const size = this.mini.width;
    const tr = race.world.track;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(3, 25, 50, 0.45)';
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 18);
    ctx.fill();
    ctx.lineJoin = 'round';
    const path = () => {
      ctx.beginPath();
      for (let i = 0; i <= tr.N; i += 8) {
        const [x, y] = this.map(tr.px[i % tr.N], tr.pz[i % tr.N]);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
    };
    path();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = '#e9fbff';
    ctx.lineWidth = 5;
    ctx.stroke();
    const s0 = tr.sample(0);
    const [gx, gy] = this.map(s0.x + s0.rx * 12, s0.z + s0.rz * 12);
    const [hx, hy] = this.map(s0.x - s0.rx * 12, s0.z - s0.rz * 12);
    ctx.strokeStyle = '#ff3c6e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    const nb = tr.buoys.length;
    if (nb && !player.finished) {
      const b = tr.buoys[player.nextBuoy % nb];
      const p = tr.pointAt(b.s, b.off);
      const [x, y] = this.map(p.x, p.z);
      ctx.fillStyle = b.color === 'r' ? '#ff3b3b' : '#ffd21f';
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const e of [...race.entries].sort((a, b) => a.isPlayer - b.isPlayer)) {
      const [x, y] = this.map(e.craft.pos.x, e.craft.pos.z);
      ctx.fillStyle = '#' + e.rider.hull.toString(16).padStart(6, '0');
      ctx.strokeStyle = e.isPlayer ? '#fff' : '#000';
      ctx.lineWidth = e.isPlayer ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(x, y, e.isPlayer ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}
