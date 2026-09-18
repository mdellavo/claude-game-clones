// Level 1 dungeon. Rooms live on a 4 x 6 grid of 16 x 11 tile rooms.
// Each room: 2-tile thick walls around a 12 x 7 floor. Doors sit in the middle of each wall.
export const DUNGEON_COLS = 4;
export const DUNGEON_ROWS = 6;
export const ENTRANCE_ROOM = { col: 2, row: 5 };

// Interior templates (12 x 7). f floor, k block, W water, S statue, t triforce pedestal floor
export const TEMPLATES = {
  empty: [
    'ffffffffffff',
    'ffffffffffff',
    'ffffffffffff',
    'ffffffffffff',
    'ffffffffffff',
    'ffffffffffff',
    'ffffffffffff',
  ],
  pillars: [
    'ffffffffffff',
    'ffkffffffkff',
    'ffffffffffff',
    'ffffffffffff',
    'ffffffffffff',
    'ffkffffffkff',
    'ffffffffffff',
  ],
  blocks4: [
    'ffffffffffff',
    'ffffffffffff',
    'fffkffffkfff',
    'ffffffffffff',
    'fffkffffkfff',
    'ffffffffffff',
    'ffffffffffff',
  ],
  center: [
    'ffffffffffff',
    'ffffffffffff',
    'ffffffffffff',
    'fffffkkfffff',
    'ffffffffffff',
    'ffffffffffff',
    'ffffffffffff',
  ],
  moat: [
    'ffffffffffff',
    'ffWWWWWWWWff',
    'ffWffffffWff',
    'ffffffffffff',
    'ffWffffffWff',
    'ffWWWWWWWWff',
    'ffffffffffff',
  ],
  lair: [
    'ffffffffffff',
    'fSffffffffff',
    'ffffffffffff',
    'ffffffffffff',
    'ffffffffffff',
    'fSffffffffff',
    'ffffffffffff',
  ],
  shrine: [
    'ffffffffffff',
    'fSffffffffSf',
    'ffffffffffff',
    'ffffffffffff',
    'ffffffffffff',
    'fSffffffffSf',
    'ffffffffffff',
  ],
};

// reward: item that appears when the room is cleared. item: item already lying in the room.
export const ROOMS = {
  '2,5': { tpl: 'empty', enemies: [], exit: true },
  '1,5': { tpl: 'pillars', enemies: [['keese', 4]], reward: { kind: 'key' } },
  '3,5': { tpl: 'blocks4', enemies: [['stalfos', 3]], item: { kind: 'key', lx: 10, lz: 3 } },
  '2,4': { tpl: 'center', enemies: [['stalfos', 4]] },
  '2,3': { tpl: 'empty', enemies: [['gel', 6]] },
  '1,3': { tpl: 'blocks4', enemies: [['goriya', 2]], reward: { kind: 'boomerang' } },
  '3,3': { tpl: 'pillars', enemies: [['keese', 3], ['stalfos', 2]], reward: { kind: 'key' } },
  '3,2': { tpl: 'moat', enemies: [['gel', 4]], reward: { kind: 'bombs' } },
  '2,2': { tpl: 'blocks4', enemies: [['stalfos', 3], ['goriya', 1]] },
  '1,2': { tpl: 'empty', enemies: [], item: { kind: 'rupeeGift', amount: 25, lx: 6, lz: 3.5 } },
  '2,1': { tpl: 'pillars', enemies: [['keese', 4], ['stalfos', 2]], reward: { kind: 'key' } },
  '2,0': { tpl: 'lair', enemies: [['aquamentus', 1]], reward: { kind: 'heartContainer' }, boss: true },
  '3,0': { tpl: 'shrine', enemies: [], item: { kind: 'triforce', lx: 6, lz: 3.5 } },
};

// Doors between adjacent rooms: [colA, rowA, colB, rowB, type]
// types: open | locked | shut (closed while enemies remain) | bomb (hidden until bombed)
export const EDGES = [
  [2, 5, 2, 4, 'open'],
  [1, 5, 2, 5, 'open'],
  [2, 5, 3, 5, 'open'],
  [2, 4, 2, 3, 'locked'],
  [1, 3, 2, 3, 'locked'],
  [2, 3, 3, 3, 'open'],
  [2, 3, 2, 2, 'shut'],
  [3, 3, 3, 2, 'open'],
  [2, 2, 3, 2, 'open'],
  [1, 2, 2, 2, 'bomb'],
  [2, 2, 2, 1, 'locked'],
  [2, 1, 2, 0, 'shut'],
  [2, 0, 3, 0, 'shut'],
];
