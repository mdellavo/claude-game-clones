import { SCREENS, SCREEN_W, SCREEN_H, OW_COLS, OW_ROWS } from '../maps/overworld.js';
import { DUNGEON_COLS, DUNGEON_ROWS, ROOMS, EDGES, TEMPLATES } from '../maps/dungeon1.js';

export const W = SCREEN_W;
export const H = SCREEN_H;

// Tiles that block movement for walkers.
const SOLID = new Set(['T', 'R', 'r', 'G', 'S', 'W', 'x', 'w', 'k', ' ']);
// Tiles that block projectiles (water doesn't).
const PROJ_SOLID = new Set(['T', 'R', 'r', 'G', 'S', 'x', 'w', 'k', ' ']);

export class Area {
  constructor(id, kind, cols, rows) {
    this.id = id;
    this.kind = kind;
    this.cols = cols;
    this.rows = rows;
    this.width = cols * W;
    this.height = rows * H;
    this.tiles = new Array(this.width * this.height).fill(' ');
    this.doorAt = new Map(); // tile index -> door
    this.doors = [];
    this.version = 0; // bumps when tiles change (re-render)
  }

  inBounds(tx, tz) {
    return tx >= 0 && tz >= 0 && tx < this.width && tz < this.height;
  }

  get(tx, tz) {
    if (!this.inBounds(tx, tz)) return ' ';
    return this.tiles[tz * this.width + tx];
  }

  set(tx, tz, c) {
    if (!this.inBounds(tx, tz)) return;
    this.tiles[tz * this.width + tx] = c;
    this.version++;
  }

  screenExists(col, row) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return false;
    if (this.kind === 'dungeon') return !!ROOMS[`${col},${row}`];
    return true;
  }

  // doorState(door) -> true if door blocks
  isSolid(tx, tz, doorBlocks, forProjectile = false) {
    const c = this.get(tx, tz);
    if (c === 'd') {
      const door = this.doorAt.get(tz * this.width + tx);
      return doorBlocks ? doorBlocks(door) : false;
    }
    return forProjectile ? PROJ_SOLID.has(c) : SOLID.has(c);
  }
}

export function buildOverworld() {
  const a = new Area('overworld', 'overworld', OW_COLS, OW_ROWS);
  for (let row = 0; row < OW_ROWS; row++) {
    for (let col = 0; col < OW_COLS; col++) {
      const scr = SCREENS[`${col},${row}`];
      if (!scr) throw new Error(`missing screen ${col},${row}`);
      if (scr.length !== H) throw new Error(`screen ${col},${row} has ${scr.length} rows`);
      scr.forEach((line, lz) => {
        if (line.length !== W) throw new Error(`screen ${col},${row} row ${lz} has ${line.length} cols`);
        for (let lx = 0; lx < W; lx++) {
          a.tiles[(row * H + lz) * a.width + col * W + lx] = line[lx];
        }
      });
    }
  }
  return a;
}

export function buildDungeon() {
  const a = new Area('dungeon1', 'dungeon', DUNGEON_COLS, DUNGEON_ROWS);
  for (const key of Object.keys(ROOMS)) {
    const [col, row] = key.split(',').map(Number);
    const room = ROOMS[key];
    const ox = col * W;
    const oz = row * H;
    for (let lz = 0; lz < H; lz++) {
      for (let lx = 0; lx < W; lx++) {
        const wall = lx < 2 || lx >= W - 2 || lz < 2 || lz >= H - 2;
        a.tiles[(oz + lz) * a.width + ox + lx] = wall ? 'w' : TEMPLATES[room.tpl][lz - 2][lx - 2];
      }
    }
    if (room.exit) {
      for (const lx of [7, 8]) for (const lz of [9, 10]) a.tiles[(oz + lz) * a.width + ox + lx] = 'E';
    }
  }
  EDGES.forEach(([ca, ra, cb, rb, type], i) => {
    const door = { id: `d${i}`, type, rooms: [`${ca},${ra}`, `${cb},${rb}`], tiles: [], vertical: ca === cb };
    const put = (col, row, lx, lz) => {
      const idx = (row * H + lz) * a.width + col * W + lx;
      a.tiles[idx] = 'd';
      a.doorAt.set(idx, door);
      door.tiles.push({ tx: col * W + lx, tz: row * H + lz, room: `${col},${row}` });
    };
    if (ca === cb) {
      // vertical neighbours: A is north of B
      const [top, bottom] = ra < rb ? [ra, rb] : [rb, ra];
      for (const lx of [7, 8]) {
        put(ca, top, lx, 9); put(ca, top, lx, 10);
        put(ca, bottom, lx, 0); put(ca, bottom, lx, 1);
      }
    } else {
      const [left, right] = ca < cb ? [ca, cb] : [cb, ca];
      put(left, ra, 14, 5); put(left, ra, 15, 5);
      put(right, ra, 0, 5); put(right, ra, 1, 5);
    }
    a.doors.push(door);
  });
  return a;
}

export function buildCave() {
  const a = new Area('cave', 'cave', 1, 1);
  const layout = [
    'wwwwwwwwwwwwwwww',
    'wwwwwwwwwwwwwwww',
    'ww............ww',
    'ww............ww',
    'ww............ww',
    'ww............ww',
    'ww............ww',
    'ww............ww',
    'ww............ww',
    'wwwwwww..wwwwwww',
    'wwwwwwwEEwwwwwww',
  ];
  layout.forEach((line, z) => { for (let x = 0; x < W; x++) a.tiles[z * W + x] = line[x] === '.' ? 'f' : line[x]; });
  a.tiles[9 * W + 7] = 'f';
  a.tiles[9 * W + 8] = 'f';
  return a;
}
