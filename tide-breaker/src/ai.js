import { clamp, wrapAngle } from './noise.js';

export class AIDriver {
  constructor(entry, race, diff, rnd) {
    this.e = entry;
    this.race = race;
    this.diff = diff;
    this.rnd = rnd;
    this.passOff = 3.5 + rnd() * 2.5;
    this.phase = rnd() * 100;
    this.stuntHold = 0;
    this.stuntSteer = 0;
    this.decided = false;
  }

  target() {
    const e = this.e, race = this.race, tr = race.world.track;
    const nb = tr.buoys.length;
    if (nb && e.nextBuoy < race.laps * nb) {
      const k = e.nextBuoy;
      const b = tr.buoys[k % nb];
      const side = b.color === 'r' ? 1 : -1;
      const sG = Math.floor(k / nb) * tr.length + b.s;
      const ahead = sG - e.total;
      const lat = b.off + side * this.passOff;
      if (ahead > 70) return tr.pointAt(e.total + 45, lat * 0.5);
      return tr.pointAt(Math.max(sG, e.total + 16), lat);
    }
    return tr.pointAt(e.total + 40, 0);
  }

  update(dt, t) {
    const c = this.e.craft, W = this.race.world;
    const inp = c.input;
    const tg = this.target();
    const desired = Math.atan2(tg.x - c.pos.x, tg.z - c.pos.z);
    const diff = wrapAngle(desired - c.yaw);
    let steer = clamp(-diff * 2.6, -1, 1);

    // Feel for land ahead and turn away from it.
    const probe = 12 + c.speed * 0.7;
    const hit = (a) => {
      const y = c.yaw + a;
      return W.terrainHeight(c.pos.x + Math.sin(y) * probe, c.pos.z + Math.cos(y) * probe) > -1.2;
    };
    const left = hit(0.45), right = hit(-0.45), mid = hit(0);
    if (left && !right) steer += 0.9;
    else if (right && !left) steer -= 0.9;
    else if (mid) steer += steer >= 0 ? 0.8 : -0.8;

    steer += Math.sin(t * 0.9 + this.phase) * 0.12 * this.diff.aiNoise;
    inp.steer = clamp(steer, -1, 1);
    inp.throttle = Math.abs(diff) > 1.4 && c.speed > 9 ? 0.3 : 1;
    inp.leanFwd = Math.abs(diff) > 0.4 ? 1 : 0;
    inp.leanBack = 0;
    inp.stunt = 0;

    if (c.airborne) {
      if (!this.decided && c.vel.y > 6.5) {
        this.decided = true;
        if (this.rnd() < this.diff.trick) {
          this.stuntHold = 0.15;
          this.stuntSteer = this.rnd() < 0.5 ? -1 : 1;
        }
      }
      if (this.stuntHold > 0) {
        this.stuntHold -= dt;
        inp.stunt = 1;
        inp.steer = this.stuntSteer;
      }
    } else {
      this.decided = false;
    }
  }
}
