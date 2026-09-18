import { h, clear } from './dom.js';
import { itemIcon } from './icons.js';
import { SLOTS, moveCost } from '../battle/unit.js';
import { itemDef, itemName, makeItem, makeWeapon, weaponDamage, itemWeight } from '../data/items.js';
import { ARMORS } from '../data/units.js';
import { sfx } from '../audio.js';

const CELL = 36;

// opts: { unit, battle?, stores?: string[], title?, onClose, onPrev?, onNext?, extra? }
export class InventoryScreen {
  constructor(parent, opts) {
    this.parent = parent;
    this.opts = opts;
    this.unit = opts.unit;
    this.battle = opts.battle || null;
    this.held = null;
    this.hover = null;
    this.message = '';
    this.root = h('div', { class: 'modal', oncontextmenu: (e) => e.preventDefault() });
    this.heldEl = h('div', { class: 'inv-held' });
    this.onMove = (e) => {
      this.heldEl.style.left = e.clientX - CELL / 2 + 'px';
      this.heldEl.style.top = e.clientY - CELL / 2 + 'px';
    };
    this.onKey = (e) => {
      if (e.key === 'Escape') {
        if (this.held) this.drop();
        else this.close();
        e.stopPropagation();
      }
    };
    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('keydown', this.onKey, true);
    parent.append(this.root, this.heldEl);
    this.render();
  }

  close() {
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('keydown', this.onKey, true);
    this.root.remove();
    this.heldEl.remove();
    this.opts.onClose && this.opts.onClose();
  }

  setUnit(u) {
    this.unit = u;
    this.held = null;
    this.message = '';
    this.render();
  }

  groundItems() {
    const u = this.unit;
    if (this.battle) return this.battle.map.groundItems(u.x, u.y, u.z);
    return (this._storeItems ||= (this.opts.stores || []).map((id) => {
      const d = itemDef(id);
      return d.kind === 'weapon' ? makeWeapon(id) : makeItem(id);
    }));
  }

  drop() {
    this.held = null;
    clear(this.heldEl);
    this.render();
  }

  pick(item, from) {
    sfx('click');
    this.held = { item, from };
    clear(this.heldEl);
    const d = itemDef(item.id);
    this.heldEl.append(this.itemBox(item, d.w || 1, d.h || 1, true));
    this.render();
  }

  // attempt to place held item into slot at cell
  place(slot, cx, cy) {
    const { item, from } = this.held;
    const u = this.unit;
    const d = itemDef(item.id);
    // loading ammo into a weapon in hand
    if (SLOTS[slot].single) {
      const w = u.hand(slot);
      if (w && w !== item && d.kind === 'ammo') {
        const wd = itemDef(w.id);
        if (wd.ammo && wd.ammo.includes(item.id)) {
          if (this.battle) {
            const inStore = from === 'store';
            const res = this.battle.loadWith(u, w, item);
            if (!res.ok) return this.fail(res.reason);
            void inStore;
          } else {
            if (w.loaded && w.loaded.rounds > 0) return this.fail('Weapon already loaded');
            const real = from === 'store' ? makeItem(item.id) : item;
            if (from !== 'store') u.removeItem(item);
            w.loaded = real;
          }
          sfx('click');
          return this.drop();
        }
      }
    }
    let x = cx, y = cy;
    if (SLOTS[slot].single) x = y = 0;
    if (this.battle) {
      const res = this.battle.moveItem(u, item, slot, x, y);
      if (!res.ok) return this.fail(res.reason);
    } else {
      if (!u.canPlace(item, slot, x, y, from === 'store' ? null : item)) return this.fail('No room');
      if (from === 'store') {
        const real = d.kind === 'weapon' ? makeWeapon(item.id) : makeItem(item.id);
        u.place(real, slot, x, y);
      } else {
        u.removeItem(item);
        u.place(item, slot, x, y);
      }
    }
    sfx('click');
    this.message = '';
    this.drop();
  }

  toGround() {
    const { item, from } = this.held;
    const u = this.unit;
    if (this.battle) {
      if (from === 'ground') return this.drop();
      const res = this.battle.moveItem(u, item, 'ground');
      if (!res.ok) return this.fail(res.reason);
    } else if (from !== 'store') {
      u.removeItem(item);
    }
    sfx('click');
    this.drop();
  }

  fail(reason) {
    sfx('error');
    this.message = reason;
    this.render();
  }

  itemBox(item, w, h2, floating = false) {
    const d = itemDef(item.id);
    const el = h('div', {
      class: 'inv-item' + (item.primed ? ' primed' : ''),
      style: {
        width: w * CELL + 'px', height: h2 * CELL + 'px', position: floating ? 'relative' : 'absolute',
        background: 'linear-gradient(#ffffff10,#00000030)',
      },
      title: itemName(item),
    });
    el.append(itemIcon(item, w * CELL, h2 * CELL, Math.min(w * CELL, h2 * CELL) / 100 + 0.3));
    let rounds = null;
    if (d.kind === 'weapon' && d.ammo) rounds = item.loaded ? item.loaded.rounds : 0;
    else if (d.kind === 'ammo') rounds = item.rounds;
    else if (d.kind === 'medikit') rounds = item.uses;
    if (rounds != null) el.append(h('span', { class: 'rounds' }, rounds));
    return el;
  }

  render() {
    const u = this.unit;
    const root = clear(this.root);
    const panel = h('div', { class: 'panel', onclick: (e) => e.stopPropagation() });
    root.append(panel);

    const armor = u.soldier ? ARMORS[u.soldier.armor || 'none'] : null;
    const weight = Math.round(u.carriedWeight());
    const header = h('div', { class: 'row', style: { marginBottom: '8px' } },
      this.opts.onPrev && h('button', { onclick: () => this.opts.onPrev() }, '◀'),
      h('h2', { style: { margin: 0 } }, u.name),
      this.opts.onNext && h('button', { onclick: () => this.opts.onNext() }, '▶'),
      h('div', { class: 'spacer' }),
      this.battle ? h('span', {}, 'TUs ', h('span', { class: 'hi' }, u.tu)) : null,
      h('span', { class: weight > u.stats.strength ? 'bad' : '' }, `Weight ${weight}/${u.stats.strength}`),
      armor && this.opts.onArmor
        ? h('select', { onchange: (e) => this.opts.onArmor(e.target.value) },
          Object.entries(ARMORS).filter(([k]) => !this.opts.armors || this.opts.armors.includes(k)).map(([k, a]) => h('option', { value: k, selected: k === u.soldier.armor }, a.name)))
        : armor && h('span', { class: 'small' }, armor.name),
      h('button', { onclick: () => this.close() }, 'OK'),
    );
    panel.append(header);

    const inv = h('div', { class: 'inv' });
    panel.append(inv);

    // body section
    const bodyW = 13 * CELL, bodyH = 9 * CELL;
    const body = h('div', { class: 'inv-body', style: { width: bodyW + 'px', height: bodyH + 'px' } });
    body.append(silhouette(bodyW, bodyH));
    inv.append(body);
    for (const [key, s] of Object.entries(SLOTS)) {
      const el = h('div', {
        class: 'inv-slot',
        style: {
          left: s.px * CELL + 'px', top: s.py * CELL + 'px', width: s.w * CELL + 'px', height: s.h * CELL + 'px',
          backgroundSize: `${CELL}px ${CELL}px`,
        },
      }, h('span', { class: 'cap' }, s.name + (this.held && this.battle ? ` (${moveCost(this.heldFromSlot(), key)} TU)` : '')));
      if (s.cells) {
        s.cells.forEach((row, y) => [...row].forEach((c, x) => {
          if (c === '0') el.append(h('div', { class: 'inv-cell-off', style: { left: x * CELL + 'px', top: y * CELL + 'px', width: CELL + 1 + 'px', height: CELL + 1 + 'px' } }));
        }));
      }
      el.addEventListener('click', (e) => {
        if (!this.held) return;
        const r = el.getBoundingClientRect();
        const cx = Math.floor((e.clientX - r.left) / CELL);
        const cy = Math.floor((e.clientY - r.top) / CELL);
        this.place(key, cx, cy);
      });
      for (const e of u.inventory.filter((e) => e.slot === key)) {
        const d = itemDef(e.item.id);
        let w = d.w || 1, hh = d.h || 1;
        let left = e.x * CELL, top = e.y * CELL;
        if (s.single) {
          w = Math.min(w, s.w);
          hh = Math.min(hh, s.h);
          left = ((s.w - w) * CELL) / 2;
          top = ((s.h - hh) * CELL) / 2;
        }
        const box = this.itemBox(e.item, w, hh);
        box.style.left = left + 'px';
        box.style.top = top + 'px';
        if (this.held && this.held.item === e.item) box.style.opacity = '0.25';
        box.addEventListener('click', (ev) => {
          if (this.held) {
            // allow dropping ammo onto the weapon itself
            if (s.single) {
              ev.stopPropagation();
              this.place(key, 0, 0);
            }
            return;
          }
          ev.stopPropagation();
          this.pick(e.item, key);
        });
        box.addEventListener('contextmenu', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          this.unloadItem(e.item);
        });
        box.addEventListener('mouseenter', () => this.showInfo(e.item));
        el.append(box);
      }
      body.append(el);
    }

    // ground / stores
    const side = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
    inv.append(side);
    side.append(h('div', { class: 'hi' }, this.battle ? 'Ground' : 'Skyranger Stores'));
    const gw = 10;
    const ground = h('div', {
      class: 'inv-ground',
      style: { width: gw * CELL + 2 + 'px', height: 7 * CELL + 2 + 'px' },
      onclick: () => this.held && this.toGround(),
    });
    side.append(ground);
    // shelf packing
    let x = 0, y = 0, rowH = 0;
    for (const it of this.groundItems()) {
      const d = itemDef(it.id);
      const w = d.w || 1, hh = d.h || 1;
      if (x + w > gw) {
        x = 0;
        y += rowH;
        rowH = 0;
      }
      const box = this.itemBox(it, w, hh);
      box.style.left = x * CELL + 'px';
      box.style.top = y * CELL + 'px';
      if (this.held && this.held.item === it) box.style.opacity = '0.25';
      box.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (this.held) return this.toGround();
        this.pick(it, this.battle ? 'ground' : 'store');
      });
      box.addEventListener('mouseenter', () => this.showInfo(it));
      ground.append(box);
      x += w;
      rowH = Math.max(rowH, hh);
    }
    this.infoEl = h('div', { class: 'inv-info panel', style: { padding: '6px 10px', width: gw * CELL + 2 + 'px' } });
    side.append(this.infoEl);
    this.showInfo(this.hover);
    side.append(h('div', { class: 'small', style: { maxWidth: gw * CELL + 'px' } },
      'Click an item to pick it up, click a slot to place it. Drop ammo onto a weapon to load it. Right-click a weapon to unload.',
      this.battle ? ' Moving items costs TUs.' : ' Clicking the stores takes a new item; dropping an item back returns it.'));
    if (this.message) side.append(h('div', { class: 'bad' }, this.message));
    if (this.opts.extra) side.append(this.opts.extra());
  }

  heldFromSlot() {
    if (!this.held) return 'ground';
    return this.held.from === 'store' ? 'ground' : this.held.from;
  }

  unloadItem(item) {
    const d = itemDef(item.id);
    if (d.kind !== 'weapon' || !item.loaded) return;
    if (this.battle) {
      const res = this.battle.unload(this.unit, item);
      if (!res.ok) return this.fail(res.reason);
    } else {
      const clip = item.loaded;
      item.loaded = null;
      this.unit.autoPlace(clip, ['belt', 'backpack', 'rshoulder', 'lshoulder', 'rleg', 'lleg']);
    }
    sfx('click');
    this.render();
  }

  showInfo(item) {
    this.hover = item;
    if (!this.infoEl) return;
    clear(this.infoEl);
    if (!item) {
      this.infoEl.append(h('span', { class: 'small' }, 'Hover an item for details'));
      return;
    }
    const d = itemDef(item.id);
    this.infoEl.append(h('div', { class: 'hi' }, itemName(item)));
    const lines = [];
    if (d.kind === 'weapon') {
      const dmg = weaponDamage(item);
      if (d.ammo) lines.push(item.loaded ? `Loaded: ${itemDef(item.loaded.id).name} (${item.loaded.rounds})` : 'Not loaded');
      if (dmg) lines.push(`Damage ${dmg.damage} ${dmg.dmgType}`);
      lines.push(Object.entries(d.modes).map(([m, v]) => `${m} ${v.acc}%/${v.tu}%TU`).join('  '));
      if (d.ammo) lines.push('Ammo: ' + d.ammo.map((a) => itemDef(a).name).join(', '));
    } else if (d.kind === 'ammo') {
      lines.push(`Damage ${d.damage} ${d.dmgType}${d.radius ? ' (area)' : ''}   Rounds ${item.rounds}`);
    } else if (d.kind === 'grenade') {
      lines.push(`Damage ${d.damage} ${d.dmgType}  radius ${d.radius}${item.primed ? '  PRIMED' : ''}`);
    } else if (d.kind === 'melee') {
      lines.push(`Damage ${d.damage} ${d.dmgType}   ${d.tu}% TU`);
    } else if (d.kind === 'medikit') {
      lines.push(`Uses left ${item.uses}`);
    }
    lines.push(`Weight ${itemWeight(item)}`);
    for (const l of lines) this.infoEl.append(h('div', {}, l));
  }
}

function silhouette(w, hgt) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', w);
  svg.setAttribute('height', hgt);
  svg.setAttribute('class', 'silhouette');
  svg.innerHTML = `<g fill="#8ab4ff">
    <circle cx="${w / 2}" cy="40" r="26"/>
    <rect x="${w / 2 - 60}" y="72" width="120" height="120" rx="18"/>
    <rect x="${w / 2 - 92}" y="80" width="30" height="120" rx="12"/>
    <rect x="${w / 2 + 62}" y="80" width="30" height="120" rx="12"/>
    <rect x="${w / 2 - 55}" y="195" width="48" height="120" rx="12"/>
    <rect x="${w / 2 + 7}" y="195" width="48" height="120" rx="12"/>
  </g>`;
  return svg;
}
