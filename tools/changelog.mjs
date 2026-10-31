// Writes a CHANGELOG.md for every game from its git history, newest first.
//   node tools/changelog.mjs
// Each entry is a commit that touched the game's folder: its subject, plus the line from the commit body that
// names this game (multi-game commits list one bullet per game), or the body's opening paragraph when the commit
// was about this game alone. Vite games (xcom, zelda) get theirs in public/ so the build copies it into dist/.
// The devkit's "Changelog" menu entry in each game shows the file.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 });

// display names from the README table: | **Name**<br>`folder/` | ...
const names = {};
for (const line of readFileSync(join(root, 'README.md'), 'utf8').split('\n')) {
  const m = line.match(/^\| \*\*(.+?)\*\*<br>`([^`]+)\/`/);
  if (m) names[m[2]] = m[1];
}
const games = readdirSync(root).filter((d) => !d.startsWith('.') && !d.startsWith('_') && statSync(join(root, d)).isDirectory() && existsSync(join(root, d, 'index.html')));

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clean = (s) => { s = s.replace(/\s+/g, ' ').trim(); return s.charAt(0).toUpperCase() + s.slice(1); };

for (const g of games) {
  const name = names[g] || g;
  const pkg = existsSync(join(root, g, 'package.json')) ? JSON.parse(readFileSync(join(root, g, 'package.json'), 'utf8')) : null;
  const vite = !!pkg?.scripts?.build?.includes('vite');
  if (vite) mkdirSync(join(root, g, 'public'), { recursive: true });
  const out = join(root, g, vite ? 'public' : '', 'CHANGELOG.md');
  // the README rows and screenshots are shared files, so only commits inside the folder count
  const raw = git('log', '--no-merges', '--date=short', '--format=%h%x1f%ad%x1f%s%x1f%b%x1e', '--', g, `:(exclude)${g}/CHANGELOG.md`, `:(exclude)${g}/public/CHANGELOG.md`, `:(exclude)${g}/CREDITS.md`, `:(exclude)${g}/public/CREDITS.md`);
  const commits = raw.split('\x1e').map((s) => s.trim()).filter(Boolean).map((s) => { const [hash, date, subject, body = ''] = s.split('\x1f'); return { hash, date, subject, body }; });
  const nameRe = new RegExp(`^([-*] )?(?:${escapeRe(name)}|${escapeRe(name.replace(/ '\d\d$/, ''))}|${escapeRe(g)})[^:]*:\\s*(.+)$`, 'i');
  const lines = [`# ${name} changelog`, '', `Every change to \`${g}/\`, newest first, generated from the git history by \`tools/changelog.mjs\`.`, ''];
  let day = null;
  for (const c of commits) {
    if (c.date !== day) { if (day) lines.push(''); day = c.date; lines.push(`## ${day}`, ''); }
    const body = c.body.replace(/\r/g, '').split('\n').filter((l) => !/^(Co-Authored-By|Claude-Session):/i.test(l));
    // a bullet naming this game, with its continuation lines
    let detail = '';
    for (let i = 0; i < body.length; i++) {
      const m = body[i].match(nameRe);
      if (!m) continue;
      detail = m[2];
      // a bullet continues on indented lines; a paragraph ("Name: ...") runs to the next blank line
      for (let j = i + 1; j < body.length && (m[1] ? /^\s+\S/.test(body[j]) : body[j].trim()); j++) detail += ' ' + body[j].trim();
      break;
    }
    if (!detail) {
      const touched = git('show', '--name-only', '--format=', c.hash).split('\n').map((p) => p.split('/')[0]).filter((d) => games.includes(d));
      if (new Set(touched).size === 1) detail = (body.join('\n').split(/\n\s*\n/).find((p) => p.trim()) || '').trim();
    }
    lines.push(`- **${c.subject}** \`${c.hash}\``);
    if (detail) lines.push(`  ${clean(detail)}`);
  }
  if (!commits.length) lines.push('No changes recorded yet.');
  writeFileSync(out, lines.join('\n') + '\n');
  console.log(`${g.padEnd(22)} ${String(commits.length).padStart(3)} entries -> ${out.slice(root.length)}`);
}
