import { generateMission } from '../src/battle/mapgen.js';
import { RNG } from '../src/rng.js';
import { PARTS } from '../src/data/terrain.js';
const [ufo='large_scout', terrain='farm', seed='1'] = process.argv.slice(2);
const res = generateMission({ ufo, terrain, race: 'sectoid', difficulty: 2 }, new RNG(+seed));
const m = res.map;
const ch = { tree:'T', pine:'T', pine_snow:'T', bush:'b', rock_small:'r', rock_big:'R', wheat:'w', corn:'c', brick_wall:'#', wood_wall:'#', barn_wall:'#', adobe_wall:'#', window:'o', door:'d', fence:'+', hedge:'H', hay_bale:'h', ufo_hull:'@', ufo_wall:'=', ufo_door:'D', power_source:'P', navigation:'N', alien_chair:'C', ufo_lift:'L', craft_hull:'%', stairs:'S', ufo_rubble:'~', rubble:'~', canopy:'^' };
for (let z = 0; z < 2; z++) {
  console.log('z=' + z);
  for (let y = 0; y < m.l; y++) {
    let s = '';
    for (let x = 0; x < m.w; x++) {
      const i = m.idx(x, y, z);
      const a = res.aliens.find(a => a.x===x&&a.y===y&&a.z===z);
      if (a) { s += 'A'; continue; }
      const o = PARTS[m.obj[i]], f = PARTS[m.floor[i]];
      s += o ? (ch[o.key] || '?') : f ? (z ? (f.r.roof ? '_' : ',') : (f.isCraft ? ':' : f.key==='scorched' ? 'x' : f.noWalk ? '~' : '.')) : ' ';
    }
    console.log(s);
  }
}
console.log(res.aliens);
