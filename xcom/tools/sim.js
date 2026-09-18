// Headless battle simulation: X-COM soldiers advance toward the UFO and shoot on sight.
import { createBattle } from '../src/battle/mission.js';
import { generateSoldier } from '../src/data/units.js';
import { RNG } from '../src/rng.js';
import { computeReach } from '../src/battle/pathfinding.js';
import * as combat from '../src/battle/combat.js';
import { itemDef } from '../src/data/items.js';

const runs = +(process.argv[2] || 5);
const summary = {};
for (let run = 0; run < runs; run++) {
  const seed = 1000 + run;
  const rng = new RNG(seed);
  const soldiers = Array.from({ length: 8 }, (_, i) => generateSoldier(rng, i));
  const ufos = ['small_scout', 'medium_scout', 'large_scout', 'abductor'];
  const races = ['sectoid', 'floater', 'snakeman', 'muton'];
  const terrains = ['farm', 'forest', 'desert', 'arctic'];
  const opts = { ufo: ufos[run % 4], race: races[(run >> 1) % 4], terrain: terrains[(run >> 2) % 4], difficulty: 1, tier: run % 3 === 0 ? 'laser' : 'conventional', night: run % 5 === 4 };
  const battle = createBattle({ opts, soldiers, rng });
  battle.silent = true;
  battle.view.message = (m) => { if (process.env.V) console.log('  ', m); };
  battle.start();
  const t0 = Date.now();
  while (!battle.over && battle.turn < 40) {
    for (const u of battle.activeUnits('xcom')) {
      if (battle.over) break;
      for (let k = 0; k < 4 && u.active && !battle.over; k++) {
        const w = combat.unitWeapon(u);
        if (w && itemDef(w.id).kind === 'weapon' && !combat.hasAmmo(w)) { battle.reload(u, w); continue; }
        const vis = [...u.visible].map((id) => battle.units.get(id)).filter((t) => t.active);
        if (vis.length && w && itemDef(w.id).kind === 'weapon') {
          const t = vis[0];
          const res = await combat.shoot(battle, u, w, 'snap', { x: t.x, y: t.y, z: t.z });
          if (!res.ok) break;
          continue;
        }
        // advance to ufo
        const reach = computeReach(battle.map, u, u.tu);
        const tgt = battle.mission.ufo;
        let best = null;
        for (let y = 0; y < battle.map.l; y++) for (let x = 0; x < battle.map.w; x++) {
          const c = reach.cost(x, y, 0);
          if (c === Infinity || c > u.tu - 25) continue;
          const d = Math.hypot(x - tgt.cx, y - tgt.cy) + rng.next() * 3;
          if (!best || d < best.d) best = { x, y, d };
        }
        if (!best) break;
        const p = reach.path(best.x, best.y, 0);
        if (!p || !p.length) break;
        await battle.move(u, p, { player: true });
        break;
      }
    }
    await battle.endPlayerTurn();
  }
  const r = battle.results();
  const key = r.result;
  summary[key] = (summary[key] || 0) + 1;
  console.log(`run ${run} ${opts.ufo}/${opts.race}/${opts.terrain} -> ${r.result} in ${r.turns} turns, score ${r.score} (${r.rating}), ${Date.now() - t0}ms; xcom alive ${battle.activeUnits('xcom').length}, aliens killed ${battle.stats.aliensKilled}`);
}
console.log(summary);
