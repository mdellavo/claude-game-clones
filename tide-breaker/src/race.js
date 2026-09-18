import { RIDERS, MAX_MISSES } from './config.js';
import { Craft } from './craft.js';
import { AIDriver } from './ai.js';
import { mulberry32, clamp } from './noise.js';

const STEP = 1 / 120;

export class Race {
  // mode: 'race' | 'tt' | 'attract'
  constructor({ world, particles, audio, hud, riderIdx, mode, diff, t }) {
    Object.assign(this, { world, particles, audio, hud, mode, diff });
    this.laps = world.course.laps;
    this.entries = [];
    this.time = 0;
    this.state = 'countdown';
    this.countdown = mode === 'attract' ? 0.01 : 3.6;
    this.acc = 0;
    this.doneTimer = 0;
    this.playerPressAt = null;
    this.prevThrottle = 0;
    const rnd = (this.rnd = mulberry32((Date.now() & 0xffff) + 1));

    let roster;
    if (mode === 'tt') roster = [riderIdx];
    else if (mode === 'attract') roster = [0, 1, 2, 3];
    else roster = [0, 1, 2, 3].filter((i) => i !== riderIdx).concat(riderIdx);
    if (mode !== 'tt') {
      // Shuffle grid slots, keeping the player on an inside lane.
      for (let i = roster.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [roster[i], roster[j]] = [roster[j], roster[i]];
      }
    }
    const tr = world.track;
    roster.forEach((ri, slot) => {
      const rider = RIDERS[ri];
      const craft = new Craft(world, rider);
      const p = world.startSlot(slot, roster.length);
      craft.place(p.x, p.z, p.yaw, t);
      world.group.add(craft.mesh.root);
      const isPlayer = mode !== 'attract' && ri === riderIdx;
      const n = tr.nearest(p.x, p.z);
      const e = {
        craft, rider, isPlayer, ai: null, hint: n.i, lastS: n.s, total: n.s > tr.length / 2 ? n.s - tr.length : n.s, lat: n.lat,
        lapsDone: 0, lapStart: 0, lapTimes: [], finished: false, finishTime: Infinity, nextBuoy: 0, misses: 0, dq: false,
        place: slot + 1, wrongWay: 0, outTime: 0, stuntScore: 0,
      };
      if (!isPlayer) {
        e.ai = new AIDriver(e, this, diff, rnd);
        e.baseMul = diff.aiSpeed * (0.985 + rnd() * 0.03);
      }
      craft.updateMesh();
      this.entries.push(e);
    });
    this.player = this.entries.find((e) => e.isPlayer) || null;
  }

  get focus() {
    if (this.player) return this.player;
    return [...this.entries].sort((a, b) => a.place - b.place)[0];
  }

  start() {
    this.state = 'racing';
    for (const e of this.entries) {
      e.craft.frozen = false;
      if (e.ai && this.rnd() < 0.25 + this.diff.trick) e.craft.boostTime = 1.2;
    }
    const p = this.player;
    if (p && p.craft.input.throttle && this.playerPressAt !== null && this.playerPressAt <= 0.7) {
      p.craft.boostTime = 1.6;
      this.hud.subText('ROCKET START!', 1.5);
      this.audio.trick();
    }
  }

  update(dt, t, input) {
    const hud = this.hud, audio = this.audio;
    const isAttract = this.mode === 'attract';

    if (this.player) {
      const pc = this.player.craft;
      if (!this.player.finished) pc.input = input.racing();
      if (this.state === 'countdown') {
        if (pc.input.throttle && !this.prevThrottle) this.playerPressAt = this.countdown;
        this.prevThrottle = pc.input.throttle;
      }
    }

    if (this.state === 'countdown') {
      const prev = Math.ceil(this.countdown);
      this.countdown -= dt;
      const now = Math.ceil(this.countdown);
      if (!isAttract && now !== prev && now > 0 && now <= 3) {
        hud.message(String(now), '', 0.9);
        audio.countBeep(false);
      }
      if (this.countdown <= 0) {
        if (!isAttract) {
          hud.message('GO!', 'gold', 1);
          audio.countBeep(true);
        }
        this.start();
      }
    } else {
      this.time += dt;
    }

    for (const e of this.entries) {
      if (e.ai) {
        e.ai.update(dt, t);
        if (this.player && !e.finished) {
          const gap = this.player.total - e.total;
          e.craft.speedMul = e.baseMul * (1 + clamp(gap / 500, -0.05, 0.07));
        } else e.craft.speedMul = e.baseMul ?? 1;
      }
    }

    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 10) {
      const st = t - this.acc + STEP;
      for (const e of this.entries) e.craft.step(STEP, st);
      this.collideCrafts();
      this.acc -= STEP;
      steps++;
    }
    if (steps >= 10) this.acc = 0;

    for (const e of this.entries) {
      const c = e.craft;
      c.updateMesh();
      this.particles.emitCraft(c, dt);
      this.handleEvents(e);
      if (this.state !== 'countdown') this.track(e, dt, t);
    }
    this.rank();

    if (!isAttract && this.player) {
      if (this.player.finished) this.doneTimer += dt;
      if (this.doneTimer > 4.5 && this.state !== 'done') this.state = 'done';
      const pc = this.player.craft;
      audio.setEngine({ speed: pc.speed, throttle: pc.input.throttle, airborne: pc.airborne, active: true });
      this.world.showArrow(this.player.finished || !this.world.track.buoys.length ? -1 : this.player.nextBuoy % this.world.track.buoys.length, t);
    } else {
      this.world.showArrow(-1, t);
      if (this.entries.every((e) => e.finished)) this.state = 'done';
    }
  }

  collideCrafts() {
    const E = this.entries;
    for (let i = 0; i < E.length; i++) {
      for (let j = i + 1; j < E.length; j++) {
        const a = E[i].craft, b = E[j].craft;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, dy = b.pos.y - a.pos.y;
        const d2 = dx * dx + dz * dz;
        if (d2 > 3.2 || Math.abs(dy) > 1.5 || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, nz = dz / d;
        const wa = a.rider.weight, wb = b.rider.weight;
        const overlap = 1.8 - d;
        a.pos.x -= nx * overlap * (wb / (wa + wb));
        a.pos.z -= nz * overlap * (wb / (wa + wb));
        b.pos.x += nx * overlap * (wa / (wa + wb));
        b.pos.z += nz * overlap * (wa / (wa + wb));
        const rel = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
        if (rel < 0) {
          const imp = (-rel * 1.4) / (wa + wb);
          a.vel.x -= nx * imp * wb; a.vel.z -= nz * imp * wb;
          b.vel.x += nx * imp * wa; b.vel.z += nz * imp * wa;
          if (-rel > 4 && (E[i].isPlayer || E[j].isPlayer)) this.audio.bump();
        }
      }
    }
  }

  handleEvents(e) {
    const c = e.craft;
    const near = this.player ? c.pos.distanceTo(this.player.craft.pos) < 40 : false;
    for (const ev of c.events) {
      if (ev.type === 'land') {
        const s = clamp(ev.impact / 10, 0, 1.2);
        if (ev.air > 0.25 || ev.impact > 4) this.particles.splash(c.pos.x, c.pos.y, c.pos.z, s);
        if (e.isPlayer && ev.impact > 3) this.audio.splash(s);
        else if (near && ev.impact > 5) this.audio.splash(s * 0.3);
      } else if (ev.type === 'trick') {
        const pts = ev.names.length * 100 * ev.names.length;
        e.stuntScore += pts;
        if (e.isPlayer) {
          this.hud.trick(`${ev.names.join(' + ')}!  +${pts}`);
          this.audio.trick();
        }
      } else if (ev.type === 'crash') {
        this.particles.splash(c.pos.x, c.pos.y, c.pos.z, 1.2);
        if (e.isPlayer) {
          this.hud.message('WIPEOUT!', 'bad', 1.2);
          this.audio.crash();
        }
      } else if (ev.type === 'bump') {
        if (e.isPlayer) this.audio.bump();
      }
    }
    c.events.length = 0;
  }

  track(e, dt, t) {
    const tr = this.world.track, L = tr.length, c = e.craft;
    const n = tr.nearest(c.pos.x, c.pos.z, e.hint);
    e.hint = n.i;
    let ds = n.s - e.lastS;
    if (ds < -L / 2) ds += L;
    if (ds > L / 2) ds -= L;
    e.total += ds;
    e.lastS = n.s;
    e.lat = n.lat;
    if (e.finished) return;

    const hd = Math.sin(c.yaw) * n.tx + Math.cos(c.yaw) * n.tz;
    e.wrongWay = hd < -0.3 && c.speed > 4 ? e.wrongWay + dt : 0;
    if (e.isPlayer && e.wrongWay > 1.2) this.hud.subText('WRONG WAY!', 0.3);

    if (Math.abs(n.lat) > tr.width + 45) e.outTime += dt;
    else e.outTime = Math.max(0, e.outTime - dt);
    if (e.isPlayer && e.outTime > 1) this.hud.subText('RETURN TO COURSE!', 0.3);
    if (e.outTime > 5 || (e.ai && c.speed < 1.5 && (e.stuck = (e.stuck || 0) + dt) > 3)) {
      this.respawn(e, t);
      e.stuck = 0;
    } else if (e.ai && c.speed >= 1.5) e.stuck = 0;

    const nb = tr.buoys.length;
    while (nb && e.nextBuoy < this.laps * nb) {
      const k = e.nextBuoy;
      const b = tr.buoys[k % nb];
      const sG = Math.floor(k / nb) * L + b.s;
      if (e.total < sG) break;
      const rel = n.lat - b.off;
      const ok = (b.color === 'r' ? rel > 0 : rel < 0) && Math.abs(rel) < 45;
      if (ok) {
        c.power = Math.min(5, c.power + 1);
        if (e.isPlayer) {
          this.audio.buoyGood();
          this.world.pulseBuoy(k % nb);
          if (c.power === 5) this.hud.subText('MAX POWER!', 1.2);
        }
      } else {
        c.power = 0;
        e.misses++;
        if (e.isPlayer) {
          this.audio.buoyBad();
          this.hud.message(e.misses >= MAX_MISSES ? '' : 'MISS!', 'bad', 0.8);
        }
        if (e.misses >= MAX_MISSES && this.mode !== 'attract') {
          e.dq = true;
          e.finished = true;
          c.coast = true;
          if (e.isPlayer) {
            this.hud.message('DISQUALIFIED', 'bad', 4);
            this.becomeAI(e);
          }
          return;
        }
      }
      e.nextBuoy++;
    }

    if (e.total >= (e.lapsDone + 1) * L) {
      e.lapsDone++;
      e.lapTimes.push(this.time - e.lapStart);
      e.lapStart = this.time;
      if (e.lapsDone >= this.laps) {
        e.finished = true;
        e.finishTime = this.time;
        c.coast = true;
        if (e.isPlayer) {
          this.rank();
          const place = e.place;
          this.hud.message(this.entries.length > 1 ? (place === 1 ? '1ST PLACE!' : 'FINISH!') : 'FINISH!', 'gold', 4);
          this.audio.fanfare();
          this.becomeAI(e);
        }
      } else if (e.isPlayer) {
        if (e.lapsDone === this.laps - 1) this.hud.message('FINAL LAP', 'gold', 1.6);
        else this.hud.message(`LAP ${e.lapsDone + 1}`, '', 1.2);
      }
    }
  }

  becomeAI(e) {
    e.ai = new AIDriver(e, this, this.diff, this.rnd);
    e.baseMul = 1;
  }

  respawn(e, t) {
    const tr = this.world.track;
    const p = tr.pointAt(e.lastS, 0);
    const power = e.craft.power;
    e.craft.place(p.x, p.z, p.yaw, t);
    e.craft.power = Math.max(0, power - 1);
    e.craft.frozen = false;
    e.outTime = 0;
    e.hint = -1;
    if (e.isPlayer) this.hud.message('RESET', '', 0.8);
  }

  rank() {
    const sorted = [...this.entries].sort((a, b) => {
      if (a.dq !== b.dq) return a.dq ? 1 : -1;
      if (a.finished && b.finished && !a.dq) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.total - a.total;
    });
    sorted.forEach((e, i) => (e.place = i + 1));
  }

  results() {
    const L = this.world.track.length;
    const rows = this.entries.map((e) => {
      let time = e.finishTime;
      if (!e.finished && !e.dq) {
        const avg = Math.max(15, e.total / Math.max(1, this.time));
        time = this.time + (this.laps * L - e.total) / avg;
      }
      return { e, time: e.dq ? Infinity : time, best: e.lapTimes.length ? Math.min(...e.lapTimes) : Infinity };
    });
    rows.sort((a, b) => (a.e.dq !== b.e.dq ? (a.e.dq ? 1 : -1) : a.time - b.time));
    return rows;
  }

  dispose() {
    for (const e of this.entries) {
      this.world.group.remove(e.craft.mesh.root);
      e.craft.mesh.root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
  }
}
