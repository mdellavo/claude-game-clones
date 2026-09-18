function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class AIDriver {
  constructor(car, skill, aggression) {
    this.car = car;
    this.skill = skill; // fraction of max speed
    this.aggression = aggression; // 0..1 weapon use
    this.lane = (Math.random() - 0.5) * 4;
    this.laneTimer = 1 + Math.random() * 3;
    this.stuck = 0;
    this.reverse = 0;
    this.weaponCd = 3 + Math.random() * 4;
    this.pos = {};
  }

  think(dt, game) {
    const c = this.car;
    const t = game.track;
    const hw = t.hw;
    const out = { throttle: 1, steer: 0, fire: false, bomb: false };
    const speed = c.forward;

    // recover when stuck against a wall or facing backwards
    if (this.reverse > 0) {
      this.reverse -= dt;
      out.throttle = -1;
      out.steer = this.reverseSteer;
      return out;
    }
    if (game.state === 'race' && c.spinTime <= 0 && Math.abs(speed) < 2.5) this.stuck += dt;
    else this.stuck = 0;
    if (this.stuck > 1.2) {
      this.stuck = 0;
      this.reverse = 0.9;
      this.reverseSteer = c.q.lat > 0 ? 1 : -1;
    }

    this.laneTimer -= dt;
    if (this.laneTimer <= 0) {
      this.laneTimer = 2 + Math.random() * 4;
      this.lane = (Math.random() - 0.5) * hw * 1.1;
    }
    let lane = this.lane;
    const look = 6 + Math.abs(speed) * 0.42;

    // take the inside line through corners
    const curv = t.curv[Math.floor(t.wrapS(c.q.s + look) / t.step) % t.N];
    lane -= Math.sign(curv) * Math.min(hw * 0.5, Math.abs(curv) * 90);

    // go for zippers, avoid hazards and bombs
    for (const z of game.items.zippers) {
      const ds = t.deltaS(c.q.s, z.s);
      if (ds > 4 && ds < 35) lane = z.lat;
    }
    const avoid = (s, lat, r) => {
      const ds = t.deltaS(c.q.s, s);
      if (ds > 0 && ds < 28 && Math.abs(lat - lane) < r + 1.6) {
        lane = lat + (lat > 0 ? -(r + 2.2) : r + 2.2);
      }
    };
    for (const h of game.items.hazards) avoid(h.s, h.lat, h.r);
    for (const b of game.items.bombs) avoid(b.s, b.lat, 0.8);
    lane = Math.max(-hw + 1.6, Math.min(hw - 1.6, lane));

    const p = t.posAt(c.q.s + look, lane, this.pos);
    const desired = Math.atan2(p.x - c.x, p.z - c.z);
    const diff = wrapAngle(desired - c.heading);
    out.steer = Math.max(-1, Math.min(1, -diff * 2.6));

    // speed through corners
    let target = c.stats.maxSpeed * this.skill;
    const ca = t.curvatureAhead(c.q.s + 3, 8 + Math.abs(speed) * 0.9);
    if (ca > 1e-3) target = Math.min(target, (c.stats.turn * 0.95) / ca);
    // rubber band vs. player
    const gap = game.player.progress - c.progress;
    if (gap > 25) target *= 1 + Math.min(0.12, (gap - 25) * 0.002);
    else if (gap < -40) target *= 0.94;
    if (Math.abs(diff) > 1.2 && speed > 12) target = Math.min(target, 14);

    if (speed < target) out.throttle = 1;
    else if (speed > target + 3) out.throttle = -0.6;
    else out.throttle = 0.3;

    // weapons
    this.weaponCd -= dt;
    if (this.weaponCd <= 0 && game.state === 'race') {
      this.weaponCd = 1;
      for (const o of game.cars) {
        if (o === c) continue;
        const ds = t.deltaS(c.q.s, o.q.s);
        if (c.missiles > 0 && ds > 6 && ds < 35 && Math.abs(o.q.lat - c.q.lat) < 2.2 && Math.random() < this.aggression * (o.isPlayer ? 1 : 0.4)) {
          out.fire = true;
          this.weaponCd = 4 + Math.random() * 4;
          break;
        }
        if (c.bombs > 0 && ds < -3 && ds > -18 && Math.random() < this.aggression * 0.6) {
          out.bomb = true;
          this.weaponCd = 5 + Math.random() * 4;
          break;
        }
      }
    }
    return out;
  }
}
