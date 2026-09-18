import { h, clear } from './dom.js';
import { RNG } from '../rng.js';
import { generateSoldier, ARMORS, RANKS, DIFFICULTY } from '../data/units.js';
import { UFOS, RACES, TERRAINS } from '../data/ufos.js';
import { TIERS, storesFor, defaultLoadout, createBattle } from '../battle/mission.js';
import { makeSoldierUnit } from '../battle/unit.js';
import { itemDef, makeItem, makeWeapon } from '../data/items.js';
import { InventoryScreen } from './inventory.js';
import { BattleHud } from './hud.js';
import { sfx } from '../audio.js';

const ROSTER_KEY = 'xcom-crash-roster-v1';
const OPTS_KEY = 'xcom-crash-opts-v1';
const MAX_SQUAD = 10;
const ROSTER_SIZE = 14;

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, v) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

export class App {
  constructor(root) {
    this.root = root;
    this.rng = new RNG();
    this.roster = load(ROSTER_KEY, null);
    this.opts = load(OPTS_KEY, null) || {
      ufo: 'medium_scout', race: 'sectoid', terrain: 'farm', night: false, difficulty: 1, tier: 'conventional',
    };
    this.nextSoldierId = 1;
    if (!this.roster) this.newRoster();
    else this.nextSoldierId = Math.max(0, ...this.roster.map((s) => s.id)) + 1;
    this.fillRoster();
  }

  newRoster() {
    this.roster = [];
    this.fillRoster();
  }

  fillRoster() {
    while (this.roster.length < ROSTER_SIZE) {
      const s = generateSoldier(this.rng, this.nextSoldierId++);
      s.armor = TIERS[this.opts?.tier || 'conventional'].armor;
      s.selected = this.roster.filter((r) => r.selected).length < 8;
      this.roster.push(s);
    }
    this.saveRoster();
  }

  saveRoster() {
    save(ROSTER_KEY, this.roster);
  }

  start() {
    this.showTitle();
  }

  screen(cls = '') {
    if (this.hud) {
      this.hud.dispose();
      this.hud = null;
    }
    clear(this.root);
    const s = h('div', { class: 'screen ' + cls }, h('div', { class: 'stars' }));
    this.root.append(s);
    return s;
  }

  // ---------------------------------------------------------------- title
  showTitle() {
    const s = this.screen('title-screen');
    s.append(
      h('div', { class: 'logo' }, 'X-COM'),
      h('div', { class: 'sub' }, 'CRASH SITE RECOVERY'),
      h('div', { class: 'menu' },
        h('button', { onclick: () => (sfx('click'), this.showSetup()) }, 'New Mission'),
        h('button', { onclick: () => (sfx('click'), this.quickMission()) }, 'Quick Random Mission'),
        h('button', { onclick: () => (sfx('click'), this.showHelp()) }, 'How to Play'),
      ),
      h('div', { class: 'small', style: { maxWidth: '640px' } },
        'A tactical tribute to UFO: Enemy Unknown (1994). Interceptors have downed a UFO. Lead your Skyranger squad to the crash site, eliminate or capture the surviving aliens and recover alien technology.'),
    );
  }

  showHelp(onBack) {
    const s = this.screen();
    s.append(h('div', { class: 'panel' },
      h('h2', {}, 'How to Play'),
      helpContent(),
      h('div', { class: 'row', style: { marginTop: '14px' } }, h('button', { onclick: () => (onBack ? onBack() : this.showTitle()) }, 'Back')),
    ));
  }

  quickMission() {
    const r = this.rng;
    this.opts = {
      ufo: r.pick(Object.keys(UFOS)), race: r.pick(Object.keys(RACES)), terrain: r.pick(Object.keys(TERRAINS)),
      night: r.chance(0.35), difficulty: this.opts.difficulty ?? 1, tier: this.opts.tier || 'conventional',
    };
    save(OPTS_KEY, this.opts);
    this.showSquad();
  }

  // ---------------------------------------------------------------- setup
  showSetup() {
    const s = this.screen();
    const o = this.opts;
    const brief = h('div', { class: 'briefing' });
    const updateBrief = () => {
      const ufo = UFOS[o.ufo];
      const crew = ufo.crew.reduce((n, c) => n + c[1], 0);
      brief.textContent =
        `INTERCEPT REPORT\n` +
        `UFO type ........ ${ufo.name}\n` +
        `Crash location .. ${TERRAINS[o.terrain].name}\n` +
        `Local time ...... ${o.night ? '02:14 (night)' : '14:32 (day)'}\n` +
        `Alien race ...... ${RACES[o.race].name}\n` +
        `Estimated crew .. ${Math.max(1, Math.round(crew * 0.8))}-${crew}\n\n` +
        `Skyranger-1 is approaching the crash site. Neutralise all alien resistance and secure the UFO.`;
      save(OPTS_KEY, o);
    };
    const sel = (key, entries) =>
      h('select', { onchange: (e) => { o[key] = e.target.value; updateBrief(); } },
        entries.map(([k, v]) => h('option', { value: k, selected: String(o[key]) === String(k) }, v)));
    s.append(h('div', { class: 'panel' },
      h('h2', {}, 'UFO Crash Site'),
      h('div', { class: 'grid-form' },
        'UFO', sel('ufo', Object.entries(UFOS).map(([k, v]) => [k, v.name])),
        'Alien race', sel('race', Object.entries(RACES).map(([k, v]) => [k, v.name])),
        'Terrain', sel('terrain', Object.entries(TERRAINS).map(([k, v]) => [k, v.name])),
        'Time', h('select', { onchange: (e) => { o.night = e.target.value === '1'; updateBrief(); } },
          h('option', { value: '0', selected: !o.night }, 'Day'), h('option', { value: '1', selected: o.night }, 'Night')),
        'Difficulty', h('select', { onchange: (e) => { o.difficulty = +e.target.value; updateBrief(); } },
          DIFFICULTY.map((d, i) => h('option', { value: i, selected: o.difficulty === i }, d.name))),
        'Equipment', h('select', { onchange: (e) => { o.tier = e.target.value; this.resetLoadouts(); updateBrief(); } },
          Object.entries(TIERS).map(([k, v]) => h('option', { value: k, selected: o.tier === k }, v.name))),
      ),
      brief,
      h('div', { class: 'row' },
        h('button', { onclick: () => this.showTitle() }, 'Back'),
        h('button', {
          onclick: () => {
            const r = this.rng;
            Object.assign(o, { ufo: r.pick(Object.keys(UFOS)), race: r.pick(Object.keys(RACES)), terrain: r.pick(Object.keys(TERRAINS)), night: r.chance(0.35) });
            this.showSetup();
          },
        }, 'Randomise'),
        h('div', { class: 'spacer' }),
        h('button', { onclick: () => (sfx('click'), this.showSquad()) }, 'Select Squad ▶'),
      ),
    ));
    updateBrief();
  }

  resetLoadouts() {
    for (const s of this.roster) {
      s.loadout = null;
      s.armor = TIERS[this.opts.tier].armor;
    }
    this.saveRoster();
  }

  armorsForTier() {
    const t = this.opts.tier;
    if (t === 'conventional') return ['none'];
    if (t === 'laser') return ['none', 'personal'];
    return ['none', 'personal', 'power', 'flying'];
  }

  // ---------------------------------------------------------------- squad
  showSquad() {
    const s = this.screen();
    const panel = h('div', { class: 'panel' });
    s.append(panel);
    const render = () => {
      clear(panel);
      const squad = this.roster.filter((r) => r.selected);
      panel.append(h('div', { class: 'row' },
        h('h2', { style: { margin: 0 } }, 'Skyranger-1 Crew'),
        h('div', { class: 'spacer' }),
        h('span', {}, `Squad ${squad.length}/${MAX_SQUAD}`),
      ));
      panel.append(h('div', { class: 'small', style: { margin: '4px 0 8px' } },
        `${UFOS[this.opts.ufo].name} · ${RACES[this.opts.race].name} · ${TERRAINS[this.opts.terrain].name} · ${this.opts.night ? 'Night' : 'Day'} · ${DIFFICULTY[this.opts.difficulty].name}`));
      const table = h('table', { class: 'roster' },
        h('tr', {}, ['', 'Name', 'Rank', 'Msn', 'Kills', 'TU', 'Sta', 'HP', 'Brv', 'Rea', 'Fir', 'Thr', 'Str', 'Armour', 'Weapon', ''].map((t) => h('th', {}, t))),
      );
      this.roster.forEach((sol, idx) => {
        const lo = sol.loadout || defaultLoadout(this.opts.tier, this.roster.filter((r) => r.selected).indexOf(sol));
        const weapon = lo.find((e) => e.slot === 'rhand');
        const st = sol.stats;
        table.append(h('tr', { class: sol.selected ? 'sel' : '' },
          h('td', {}, h('input', {
            type: 'checkbox', checked: !!sol.selected,
            onchange: (e) => {
              if (e.target.checked && squad.length >= MAX_SQUAD) {
                e.target.checked = false;
                return;
              }
              sol.selected = e.target.checked;
              this.saveRoster();
              render();
            },
          })),
          h('td', {}, sol.name),
          h('td', {}, RANKS[sol.rank]),
          h('td', { class: 'num' }, sol.missions),
          h('td', { class: 'num' }, sol.kills),
          ...['tu', 'stamina', 'health', 'bravery', 'reactions', 'firing', 'throwing', 'strength'].map((k) => h('td', { class: 'num' }, st[k])),
          h('td', { class: 'small' }, ARMORS[sol.armor || 'none'].name),
          h('td', { class: 'small' }, weapon ? itemDef(weapon.id).name : '-'),
          h('td', {}, h('button', { onclick: () => this.equip(idx, render) }, 'Equip')),
        ));
      });
      panel.append(h('div', { style: { overflowX: 'auto' } }, table));
      panel.append(h('div', { class: 'row', style: { marginTop: '12px' } },
        h('button', { onclick: () => this.showSetup() }, '◀ Mission'),
        h('button', {
          onclick: () => {
            if (!confirmInline(panel, 'Dismiss the whole roster and recruit new soldiers?', () => {
              this.newRoster();
              render();
            })) return;
          },
        }, 'New Recruits'),
        h('button', { onclick: () => (this.resetLoadouts(), render()) }, 'Reset Equipment'),
        h('div', { class: 'spacer' }),
        h('button', {
          disabled: !squad.length,
          onclick: () => (sfx('click'), this.launch()),
        }, 'Launch Skyranger ▶'),
      ));
    };
    render();
  }

  equip(idx, onDone) {
    const selectedIdx = () => this.roster.filter((r) => r.selected);
    const sol = this.roster[idx];
    const makeTemp = (s) => {
      const u = makeSoldierUnit(s);
      const lo = s.loadout || defaultLoadout(this.opts.tier, Math.max(0, selectedIdx().indexOf(s)));
      for (const e of lo) {
        const d = itemDef(e.id);
        const it = d.kind === 'weapon' ? makeWeapon(e.id, e.ammo || undefined) : makeItem(e.id);
        if (d.kind === 'weapon' && d.ammo && !e.ammo) it.loaded = null;
        if (u.canPlace(it, e.slot, e.x || 0, e.y || 0)) u.place(it, e.slot, e.x || 0, e.y || 0);
        else u.autoPlace(it);
      }
      return u;
    };
    const commit = (s, u) => {
      s.loadout = u.inventory.map((e) => ({ id: e.item.id, ammo: e.item.loaded ? e.item.loaded.id : null, slot: e.slot, x: e.x, y: e.y }));
      this.saveRoster();
    };
    let cur = idx;
    let unit = makeTemp(sol);
    const screen = new InventoryScreen(this.root, {
      unit,
      stores: storesFor(this.opts.tier),
      armors: this.armorsForTier(),
      onArmor: (a) => {
        this.roster[cur].armor = a;
        commit(this.roster[cur], unit);
        unit = makeTemp(this.roster[cur]);
        screen.setUnit(unit);
      },
      onClose: () => {
        commit(this.roster[cur], unit);
        onDone && onDone();
      },
      onPrev: () => go(-1),
      onNext: () => go(1),
    });
    const go = (d) => {
      commit(this.roster[cur], unit);
      cur = (cur + d + this.roster.length) % this.roster.length;
      unit = makeTemp(this.roster[cur]);
      screen.setUnit(unit);
    };
  }

  // ---------------------------------------------------------------- battle
  launch() {
    const squad = this.roster.filter((r) => r.selected);
    // freeze default loadouts so squad order doesn't change them
    squad.forEach((s, i) => {
      if (!s.loadout) s.loadout = defaultLoadout(this.opts.tier, i);
      if (!s.armor) s.armor = TIERS[this.opts.tier].armor;
    });
    this.saveRoster();
    const s = this.screen();
    s.className = 'battle';
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const rng = new RNG(seed);
    const battle = createBattle({ opts: this.opts, soldiers: squad, rng });
    this.hud = new BattleHud(s, battle, {
      onEnd: (results) => this.showDebrief(results),
      onQuit: () => this.showTitle(),
    });
  }

  // ---------------------------------------------------------------- debrief
  showDebrief(res) {
    // update roster
    for (const { unit, fate } of res.soldiers) {
      const sol = this.roster.find((r) => r.id === unit.soldier.id);
      if (!sol) continue;
      if (fate === 'KIA' || fate === 'MIA') {
        this.roster.splice(this.roster.indexOf(sol), 1);
        continue;
      }
      sol.missions++;
      sol.kills += unit.kills;
      // experience
      const st = sol.stats;
      const r = this.rng;
      if (unit.shotsFired) st.firing = Math.min(120, st.firing + r.int(0, 2) + (unit.kills ? r.int(1, 3) : 0));
      if (unit.hitsTaken) st.health = Math.min(60, st.health + r.int(0, 1));
      st.tu = Math.min(80, st.tu + r.int(0, 1));
      st.stamina = Math.min(90, st.stamina + r.int(0, 1));
      st.reactions = Math.min(100, st.reactions + (unit.kills ? r.int(0, 2) : 0));
      unit.promoted = false;
      const score = sol.missions + sol.kills * 2;
      const want = score >= 30 ? 4 : score >= 18 ? 3 : score >= 10 ? 2 : score >= 3 ? 1 : 0;
      if (want > sol.rank) {
        sol.rank = want;
        unit.promoted = true;
      }
    }
    this.fillRoster();
    const s = this.screen();
    const title = res.result === 'victory' ? 'MISSION SUCCESSFUL' : res.result === 'aborted' ? 'MISSION ABORTED' : 'MISSION FAILED';
    sfx(res.result === 'victory' ? 'victory' : 'defeat');
    s.append(h('div', { class: 'panel debrief' },
      h('h2', {}, title),
      h('div', { class: 'row' }, h('span', {}, `Turns: ${res.turns}`), h('div', { class: 'spacer' }),
        h('span', {}, 'Rating: '), h('span', { class: 'rating ' + (res.score > 50 ? 'good' : res.score > 0 ? 'hi' : 'bad') }, res.rating)),
      h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '28px', marginTop: '10px' } },
        h('div', { style: { flex: '1 1 380px' } },
          h('h3', {}, 'Score'),
          h('table', {},
            res.lines.map((l) => h('tr', {}, h('td', {}, l.label), h('td', { class: 'num' }, l.count), h('td', { class: 'num ' + (l.score < 0 ? 'bad' : 'good') }, l.score))),
            h('tr', {}, h('td', { class: 'hi' }, 'TOTAL'), h('td', {}), h('td', { class: 'num hi' }, res.score)),
          ),
          h('h3', { style: { marginTop: '14px' } }, 'Recovered'),
          res.recovered.length
            ? h('table', {}, res.recovered.map((r) => h('tr', {}, h('td', {}, r.name), h('td', { class: 'num' }, r.count))))
            : h('div', { class: 'small' }, 'Nothing recovered.'),
        ),
        h('div', { style: { flex: '1 1 320px' } },
          h('h3', {}, 'Squad'),
          h('table', {}, res.soldiers.map(({ unit, fate }) => h('tr', {},
            h('td', {}, unit.name),
            h('td', { class: 'num' }, `${unit.kills} kills`),
            h('td', { class: fate === 'ok' ? 'good' : fate === 'wounded' ? 'warn' : 'bad' }, fate === 'ok' ? (unit.promoted ? 'PROMOTED' : 'OK') : fate.toUpperCase()),
          ))),
        ),
      ),
      h('div', { class: 'row', style: { marginTop: '16px' } },
        h('div', { class: 'spacer' }),
        h('button', { onclick: () => this.showTitle() }, 'Main Menu'),
        h('button', { onclick: () => this.showSetup() }, 'Next Mission ▶'),
      ),
    ));
  }
}

function confirmInline(panel, text, yes) {
  const m = h('div', { class: 'modal' },
    h('div', { class: 'panel' },
      h('div', {}, text),
      h('div', { class: 'row', style: { marginTop: '12px', justifyContent: 'flex-end' } },
        h('button', { onclick: () => m.remove() }, 'Cancel'),
        h('button', { onclick: () => (m.remove(), yes()) }, 'Yes'),
      ),
    ),
  );
  document.getElementById('app').append(m);
  return false;
}

export function helpContent() {
  const rows = [
    ['Left click', 'Select soldier / move to tile / fire at target'],
    ['Right click', 'Turn to face tile · cancel targeting'],
    ['Right drag / Q E', 'Rotate camera'],
    ['Left or middle drag / WASD', 'Pan camera'],
    ['Mouse wheel / + -', 'Zoom'],
    ['PgUp PgDn / [ ]', 'Change view level'],
    ['Tab / Shift+Tab', 'Next / previous soldier'],
    ['K', 'Kneel / stand (kneeling improves accuracy)'],
    ['I', 'Inventory'],
    ['R', 'Reload weapon'],
    ['F', 'Fire main weapon (opens fire mode menu)'],
    ['C', 'Center on selected soldier'],
    ['1-4', 'Reserve TUs: none / snap / aimed / auto'],
    ['Enter', 'End turn'],
    ['Esc', 'Cancel / menu'],
  ];
  return h('div', {},
    h('div', { class: 'help-grid' }, rows.map(([k, v]) => [h('b', {}, k), h('span', {}, v)])),
    h('p', { class: 'small', style: { maxWidth: '720px' } },
      'Each soldier has Time Units (TUs) to spend each turn on moving, turning, kneeling, firing and handling items. ' +
      'Aliens with enough TUs and reactions will shoot at soldiers that move in their field of view - so will your soldiers during the alien turn. ' +
      'Kill or stun every alien to secure the site. Stunned aliens count as live captures. Grenades must be primed and explode at the end of the turn. ' +
      'Shooting a UFO power source will cause a massive explosion. Return to the Skyranger and press Abort to evacuate: soldiers left outside are lost.'),
  );
}
