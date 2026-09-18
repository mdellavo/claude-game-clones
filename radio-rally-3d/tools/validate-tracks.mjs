import { Track } from '../src/trackgen.js';
import { TRACKS } from '../src/tracks.js';
let ok = true;
for (const def of TRACKS) {
  const t = new Track(def);
  const need = 2 * (t.hw + 2.5) + 6;
  let minClear = Infinity, where = null;
  for (let i = 0; i < t.N; i += 2) for (let j = i + 1; j < t.N; j += 2) {
    const loop = Math.min(j - i, t.N - (j - i)) * t.step;
    if (loop < 45) continue;
    const d = Math.hypot(t.x[i] - t.x[j], t.z[i] - t.z[j]);
    if (d < minClear) { minClear = d; where = [Math.round(t.x[i]), Math.round(t.z[i])]; }
  }
  let maxC = 0, cAt = 0;
  for (let i = 0; i < t.N; i++) if (Math.abs(t.curv[i]) > maxC) { maxC = Math.abs(t.curv[i]); cAt = i; }
  const minR = 1 / maxC, needR = t.hw + 2;
  let startC = 0; for (let k = -12; k < 12; k++) startC = Math.max(startC, Math.abs(t.curv[(k + t.N) % t.N]));
  const bad = minClear < need || minR < needR || startC > 0.02;
  if (bad) ok = false;
  console.log(`${bad ? 'BAD ' : 'ok  '}${def.name.padEnd(20)} len=${t.length.toFixed(0)} clear=${minClear.toFixed(1)}/${need} at ${where} minR=${minR.toFixed(1)}/${needR} at ${Math.round(t.x[cAt])},${Math.round(t.z[cAt])} startCurv=${startC.toFixed(3)}`);
}
process.exit(ok ? 0 : 1);
