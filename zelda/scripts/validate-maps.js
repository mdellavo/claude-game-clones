import { buildOverworld, buildDungeon, W, H } from '../src/world/area.js';
import { START_POS, OW_COLS, OW_ROWS, CAVES } from '../src/maps/overworld.js';
import { ROOMS } from '../src/maps/dungeon1.js';

let errors = 0;
const ow = buildOverworld();
// edge consistency
for (let row = 0; row < OW_ROWS; row++) for (let col = 0; col < OW_COLS; col++) {
  const ox = col * W, oz = row * H;
  if (col + 1 < OW_COLS) for (let z = 0; z < H; z++) {
    const a = ow.isSolid(ox + W - 1, oz + z), b = ow.isSolid(ox + W, oz + z);
    if (a !== b) { console.log(`E/W mismatch ${col},${row} -> ${col + 1},${row} row ${z}`); errors++; }
  }
  if (row + 1 < OW_ROWS) for (let x = 0; x < W; x++) {
    const a = ow.isSolid(ox + x, oz + H - 1), b = ow.isSolid(ox + x, oz + H);
    if (a !== b) { console.log(`N/S mismatch ${col},${row} -> ${col},${row + 1} col ${x}`); errors++; }
  }
}
// reachability (treat bombable x as walkable-from-below target)
const seen = new Set();
const q = [[Math.floor(START_POS.x), Math.floor(START_POS.z)]];
seen.add(q[0].join());
while (q.length) {
  const [x, z] = q.pop();
  for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx = x + dx, nz = z + dz, k = nx + ',' + nz;
    if (seen.has(k) || !ow.inBounds(nx, nz) || ow.isSolid(nx, nz)) continue;
    seen.add(k); q.push([nx, nz]);
  }
}
const screensReached = new Set([...seen].map(k => { const [x, z] = k.split(',').map(Number); return `${Math.floor(x / W)},${Math.floor(z / H)}`; }));
for (let row = 0; row < OW_ROWS; row++) for (let col = 0; col < OW_COLS; col++)
  if (!screensReached.has(`${col},${row}`)) { console.log('unreachable screen', col, row); errors++; }
for (let z = 0; z < ow.height; z++) for (let x = 0; x < ow.width; x++) {
  const c = ow.get(x, z);
  if ('CDx'.includes(c)) {
    const scr = `${Math.floor(x / W)},${Math.floor(z / H)}`;
    const below = `${x},${z + 1}`;
    const ok = c === 'x' ? seen.has(below) : seen.has(`${x},${z}`);
    if (!ok) { console.log(`entrance ${c} at ${scr} unreachable`); errors++; }
    if (!'R'.includes(ow.get(x, z - 1))) { console.log(`entrance ${c} at ${scr} has no rock above`); errors++; }
    if (c !== 'D' && !CAVES[scr]) { console.log(`cave at ${scr} has no CAVES entry`); errors++; }
  }
}
const dg = buildDungeon();
for (const key of Object.keys(ROOMS)) {
  const [col, row] = key.split(',').map(Number);
  // every door's inner landing tile must be floor
  for (const d of dg.doors) for (const t of d.tiles) {
    if (t.room !== key) continue;
    const lx = t.tx - col * W, lz = t.tz - row * H;
    const inner = lz === 1 ? [lx, 2] : lz === 9 ? [lx, 8] : lx === 1 ? [2, lz] : lx === 14 ? [13, lz] : null;
    if (inner && dg.get(col * W + inner[0], row * H + inner[1]) !== 'f') { console.log(`door ${d.id} blocked in room ${key}`); errors++; }
  }
}
console.log(errors ? `${errors} errors` : `maps OK (${seen.size} reachable overworld tiles, ${dg.doors.length} doors)`);
process.exit(errors ? 1 : 0);
