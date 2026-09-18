// Headless race sim: 4 AI-driven cars per track, reports lap times, stuck time and wall hits.
import { Track } from '../src/trackgen.js';
import { TRACKS } from '../src/tracks.js';
import { Car, BASE_STATS, collideCars } from '../src/car.js';
import { AIDriver } from '../src/ai.js';

const STEP = 1 / 120;
const only = process.argv[2] ? [Number(process.argv[2])] : TRACKS.map((_, i) => i);
for (const ti of only) {
  const def = TRACKS[ti];
  const track = new Track(def);
  const hazards = track.features.filter((f) => f.type === 'puddle' || f.type === 'oil');
  const zippers = track.features.filter((f) => f.type === 'zipper');
  const cars = [0, 1, 2, 3].map((i) => new Car({ color: 0xff0000, name: 'C' + i, isPlayer: i === 3 }));
  const game = { track, cars, state: 'race', items: { zippers, hazards, bombs: [] }, player: cars[3] };
  const hw = track.hw;
  const grid = [[-6, -hw * 0.4], [-6, hw * 0.4], [-13, -hw * 0.4], [-13, hw * 0.4]];
  const drivers = cars.map((c, i) => new AIDriver(c, [0.97, 0.93, 0.9, 0.95][i], 0));
  cars.forEach((c, i) => { c.stats = { ...BASE_STATS }; c.reset(track, ...grid[i]); });
  const stats = cars.map(() => ({ stuck: 0, walls: 0, air: 0, maxAir: 0, finish: null }));
  let t = 0;
  while (t < 240 && cars.some((c) => c.progress < def.laps * track.length)) {
    for (const [i, c] of cars.entries()) {
      const o = drivers[i].think(STEP, game);
      c.update(STEP, o);
      if (c.onGround) for (const z of zippers) if (Math.abs(track.deltaS(z.s, c.q.s)) < 2.5 && Math.abs(c.q.lat - z.lat) < 2.2) c.boost();
      for (const h of hazards) { const ds = track.deltaS(h.s, c.q.s), dl = c.q.lat - h.lat; if (ds * ds + dl * dl < h.r * h.r) { if (h.type === 'puddle') c.inPuddle = true; else c.slip(); } }
      for (const e of c.events) if (e.type === 'wall') stats[i].walls++;
      c.events.length = 0;
      if (Math.abs(c.forward) < 2 && t > 3) stats[i].stuck += STEP;
      if (!c.onGround) { stats[i].air += STEP; stats[i].maxAir = Math.max(stats[i].maxAir, c.airTime); }
      if (stats[i].finish == null && c.progress >= def.laps * track.length) stats[i].finish = t;
    }
    collideCars(cars);
    t += STEP;
  }
  console.log(`${def.name} (L=${track.length.toFixed(0)}, ${def.laps} laps)`);
  stats.forEach((s, i) => console.log(`  car${i} finish=${s.finish?.toFixed(1) ?? 'DNF ' + (cars[i].progress / track.length).toFixed(2)} lap=${s.finish ? (s.finish / def.laps).toFixed(1) : '-'} stuck=${s.stuck.toFixed(1)} walls=${s.walls} air=${s.air.toFixed(1)} maxAir=${s.maxAir.toFixed(2)}`));
}
