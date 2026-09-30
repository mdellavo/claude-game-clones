// Assembles the GitHub Pages site in _site/: the launcher, the README it reads its
// game list from, the screenshots, and every game folder ready to serve statically.
//
//   node tools/build-site.mjs            then serve _site/, e.g. python3 -m http.server -d _site
//
// Games with a Vite "build" script (xcom, zelda) are built with relative asset paths
// and their dist/ is published in place of the source. Games that import three.js from
// ./node_modules (radio-rally-3d, tide-breaker) get their dependencies installed and
// ship node_modules/three alongside the source. Everything else is copied as-is.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '_site');
const run = (cmd, cwd) => { console.log(`  $ ${cmd}`); execSync(cmd, { cwd, stdio: 'inherit' }); };
const skipDirs = new Set(['node_modules', 'dist', '.git']);

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ['index.html', 'README.md']) cpSync(join(root, f), join(out, f));
cpSync(join(root, 'screenshots'), join(out, 'screenshots'), { recursive: true });

const games = readdirSync(root).filter(d => !d.startsWith('.') && !d.startsWith('_') && statSync(join(root, d)).isDirectory() && existsSync(join(root, d, 'index.html')));
for (const g of games) {
  const src = join(root, g), dest = join(out, g), pkgPath = join(src, 'package.json');
  const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : null;
  console.log(`${g}`);
  if (pkg?.scripts?.build?.includes('vite')) {
    if (!existsSync(join(src, 'node_modules'))) run('npm ci', src);
    run('npx vite build --base=./ --emptyOutDir', src);
    cpSync(join(src, 'dist'), dest, { recursive: true });
  } else {
    cpSync(src, dest, { recursive: true, filter: p => !p.slice(src.length).split(/[\\/]/).some(part => skipDirs.has(part)) });
    if (pkg?.dependencies?.three) {
      if (!existsSync(join(src, 'node_modules', 'three'))) run('npm ci', src);
      // the import maps only reach build/ and the examples/jsm addons
      for (const part of ['package.json', 'build', 'examples/jsm']) cpSync(join(src, 'node_modules/three', part), join(dest, 'node_modules/three', part), { recursive: true });
    }
  }
}
console.log(`\nBuilt ${games.length} games into ${out}`);
