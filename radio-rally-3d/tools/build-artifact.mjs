// Bundles the game into a single self-contained HTML page (three.js from jsDelivr).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
const out = process.argv[2] || 'dist/rc-pro-am-3d.html';
const js = execFileSync('npx', ['--yes', 'esbuild@0.24.0', 'src/main.js', '--bundle', '--format=esm', '--minify', '--external:three'], { encoding: 'utf8' });
if (js.includes('</script')) throw new Error('bundle contains </script');
const bundle = js
  .replaceAll('from"three"', `from"${THREE_URL}"`)
  .replaceAll("'NINTENDO'", "'SUPERCAR'")
  .replaceAll('"NINTENDO"', '"SUPERCAR"')
  .replaceAll('NINTENDO! SUPER TRUCK!', 'SUPERCAR! SUPER TRUCK!');
if (/NINTENDO/.test(bundle)) throw new Error('branding left in bundle');
let html = readFileSync('index.html', 'utf8')
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<\/?html[^>]*>\s*/gi, '')
  .replace(/<\/?head>\s*/gi, '')
  .replace(/<\/?body>\s*/gi, '')
  .replace(/<meta [^>]*>\s*/gi, '')
  .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '')
  .replace('<script type="module" src="./src/main.js"></script>', () => `<script type="module">\n${bundle}</script>`);

// Shareable build: an unbranded tribute rather than the trademarked name.
const REBRAND = [
  ['<title>R.C. Pro-Am 3D</title>', '<title>Radio Rally 3D</title>'],
  ['R.C. PRO-AM<br><span>3D</span>', 'RADIO RALLY<br><span>3D</span>'],
  ['RADIO-CONTROLLED OFF-ROAD RACING', 'A TRIBUTE TO THE NES R.C. PRO-AM'],
  ['COLLECT N-I-N-T-E-N-D-O!', 'COLLECT S-U-P-E-R-C-A-R!'],
];
for (const [a, b] of REBRAND) {
  if (!html.includes(a)) throw new Error(`missing: ${a}`);
  html = html.replace(a, b);
}
mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
