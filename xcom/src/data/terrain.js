// Tile part definitions. Every voxel of the battlescape has an optional floor
// and an optional object. Objects fill the whole voxel logically; the renderer
// is free to draw them thinner (walls connect to neighbours like thin walls).
//
// armor: explosive/projectile power needed to destroy the part (Infinity = indestructible)
// height: 0..1 fraction of the voxel height blocked for line of sight and fire
// cost: extra TU cost for walking through (objects) / base cost (floors)

export const PARTS = [null]; // index 0 = empty
export const P = {}; // key -> id

function part(key, props) {
  const id = PARTS.length;
  const p = {
    id, key, name: key, kind: 'obj', armor: 20, height: 0, cost: 0, blocksMove: false,
    flammable: 0, r: { type: 'block', color: 0x888888 }, ...props,
  };
  PARTS.push(p);
  P[key] = id;
  return p;
}
const floor = (key, props) => part(key, { kind: 'floor', cost: 4, height: 0, ...props });

// ------------------------------------------------------------------ floors
floor('grass', { armor: Infinity, r: { type: 'flat', color: 0x5f8a3a, vary: 0.08 }, flammableFloor: true });
floor('grass_dark', { armor: Infinity, r: { type: 'flat', color: 0x4e7832, vary: 0.08 }, flammableFloor: true });
floor('dirt', { armor: Infinity, r: { type: 'flat', color: 0x7a6040, vary: 0.08 } });
floor('field', { armor: Infinity, r: { type: 'flat', color: 0x8a6d3e, vary: 0.05, rows: true } });
floor('sand', { armor: Infinity, r: { type: 'flat', color: 0xc9a86a, vary: 0.06 } });
floor('sand_dark', { armor: Infinity, r: { type: 'flat', color: 0xb8945a, vary: 0.06 } });
floor('snow', { armor: Infinity, r: { type: 'flat', color: 0xe4ecf0, vary: 0.04 } });
floor('ice', { armor: Infinity, r: { type: 'flat', color: 0xb8d4e0, vary: 0.04 } });
floor('forest_floor', { armor: Infinity, r: { type: 'flat', color: 0x4a5a2a, vary: 0.1 } });
floor('road', { armor: Infinity, r: { type: 'flat', color: 0x55585c, vary: 0.03 } });
floor('scorched', { armor: Infinity, r: { type: 'flat', color: 0x2e2a26, vary: 0.1 } });
floor('water', { armor: Infinity, cost: 255, r: { type: 'flat', color: 0x3a6a8a, vary: 0.03, water: true }, noWalk: true });
// z>0 floors (destructible)
floor('wood_floor', { armor: 30, destroyTo: null, flammable: 3, r: { type: 'flat', color: 0x8a6440, vary: 0.05, planks: true } });
floor('tile_floor', { armor: 40, r: { type: 'flat', color: 0x9a948a, vary: 0.03, grid: true } });
floor('roof_tiles', { armor: 30, flammable: 2, r: { type: 'flat', color: 0x8a3a2a, vary: 0.06, roof: true } });
floor('roof_tin', { armor: 25, r: { type: 'flat', color: 0x6a7470, vary: 0.04, roof: true } });
floor('hayloft', { armor: 20, flammable: 4, r: { type: 'flat', color: 0x9a7a40, vary: 0.08, planks: true } });
floor('stair_top', { armor: 40, passage: true, r: { type: "passage", color: 0x8a6440 } });
floor('ufo_floor', { armor: 120, isUfo: true, r: { type: 'flat', color: 0x5a5a6a, vary: 0.02, grid: true, ufo: true } });
floor('ufo_roof', { armor: 120, isUfo: true, r: { type: 'flat', color: 0x70707e, vary: 0.02, roof: true, ufo: true } });
floor('ufo_lift_top', { armor: 120, isUfo: true, passage: true, r: { type: "passage", color: 0x5a5a6a, lift: true } });
floor('craft_floor', { armor: Infinity, isCraft: true, r: { type: 'flat', color: 0x4a4e52, vary: 0.02, grid: true } });
floor('craft_roof', { armor: Infinity, isCraft: true, r: { type: 'none', roof: true } });

// ------------------------------------------------------------------ objects: natural
part('tree', {
  armor: 30, height: 1, blocksMove: true, flammable: 4, destroyTo: 'stump',
  r: { type: 'tree', color: 0x3f6a2a, trunk: 0x5a4028 },
});
part('canopy', { armor: 20, height: 1, blocksMove: true, flammable: 3, decor: true, r: { type: 'canopy', color: 0x3a6526 } });
part('pine', {
  armor: 30, height: 1, blocksMove: true, flammable: 4, destroyTo: 'stump',
  r: { type: 'pine', color: 0x2d5a3a, trunk: 0x4a3420 },
});
part('pine_snow', {
  armor: 30, height: 1, blocksMove: true, flammable: 2, destroyTo: 'stump',
  r: { type: 'pine', color: 0x2d5a3a, trunk: 0x4a3420, snow: true },
});
part('stump', { armor: 20, height: 0.2, cost: 2, r: { type: 'stump', color: 0x3a2a1a } });
part('bush', { armor: 10, height: 0.45, cost: 4, flammable: 2, r: { type: 'bush', color: 0x4a7a30 } });
part('rock_small', { armor: 60, height: 0.35, cost: 4, r: { type: 'rock', color: 0x7a7872, s: 0.45 } });
part('rock_big', { armor: 90, height: 1, blocksMove: true, destroyTo: 'rock_small', r: { type: 'rock', color: 0x6a6660, s: 0.95 } });
part('cactus', { armor: 10, height: 0.8, blocksMove: true, r: { type: 'cactus', color: 0x4a7a40 } });
part('wheat', { armor: 4, passThrough: true, height: 0.45, cost: 2, flammable: 3, destroyTo: null, r: { type: 'wheat', color: 0xc8a850 } });
part('corn', { armor: 4, passThrough: true, height: 0.9, cost: 2, flammable: 3, destroyTo: null, r: { type: 'wheat', color: 0x7a9a3a, tall: true } });
part('ice_block', { armor: 60, height: 1, blocksMove: true, destroyTo: 'rock_small', r: { type: 'rock', color: 0xa8c8d8, s: 0.9 } });

// ------------------------------------------------------------------ objects: man made
part('brick_wall', { armor: 50, height: 1, blocksMove: true, destroyTo: 'rubble', r: { type: 'wall', color: 0xa0624a, group: 'house' } });
part('wood_wall', { armor: 25, height: 1, blocksMove: true, flammable: 4, destroyTo: 'rubble_wood', r: { type: 'wall', color: 0x8a5a36, group: 'house' } });
part('barn_wall', { armor: 22, height: 1, blocksMove: true, flammable: 4, destroyTo: 'rubble_wood', r: { type: 'wall', color: 0x8a2e24, group: 'house' } });
part('adobe_wall', { armor: 40, height: 1, blocksMove: true, destroyTo: 'rubble', r: { type: 'wall', color: 0xc08a5a, group: 'house' } });
part('window', { armor: 10, height: 1, blocksMove: true, seeThrough: true, destroyTo: 'broken_window', r: { type: 'window', color: 0xa0624a, group: 'house' } });
part('broken_window', { armor: 15, height: 0.4, blocksMove: true, destroyTo: 'rubble', r: { type: 'window', color: 0xa0624a, group: 'house', broken: true } });
part('door', { armor: 15, height: 1, cost: 4, door: 'wood', openTo: 'door_open', flammable: 3, destroyTo: 'rubble_wood', r: { type: 'door', color: 0x6a4020, group: 'house' } });
part('door_open', { armor: 15, height: 0, cost: 0, flammable: 3, destroyTo: 'rubble_wood', r: { type: 'door', color: 0x6a4020, group: 'house', open: true } });
part('fence', { armor: 10, height: 0.4, blocksMove: true, flammable: 2, destroyTo: null, r: { type: 'fence', color: 0x8a6a44, group: 'fence' } });
part('hedge', { armor: 12, height: 0.9, blocksMove: true, flammable: 2, destroyTo: 'bush', r: { type: 'fence', color: 0x3e6a2a, group: 'hedge', thick: true } });
part('stone_wall', { armor: 40, height: 0.45, blocksMove: true, destroyTo: 'rubble', r: { type: 'fence', color: 0x8a8680, group: 'stone', thick: true } });
part('rubble', { armor: 40, height: 0.25, cost: 4, r: { type: 'rubble', color: 0x7a6a5a } });
part('rubble_wood', { armor: 20, height: 0.2, cost: 2, flammable: 2, r: { type: 'rubble', color: 0x5a4028 } });
part('hay_bale', { armor: 10, height: 0.6, blocksMove: true, flammable: 5, r: { type: 'hay', color: 0xc8a850 } });
part('crate', { armor: 20, height: 0.6, blocksMove: true, flammable: 2, destroyTo: 'rubble_wood', r: { type: 'crate', color: 0x9a7a4a } });
part('table', { armor: 15, height: 0.45, blocksMove: true, flammable: 2, destroyTo: 'rubble_wood', r: { type: 'table', color: 0x7a5030 } });
part('bed', { armor: 15, height: 0.35, blocksMove: true, flammable: 3, destroyTo: 'rubble_wood', r: { type: 'bed', color: 0xb8b0a0 } });
part('cabinet', { armor: 15, height: 0.8, blocksMove: true, flammable: 2, destroyTo: 'rubble_wood', r: { type: 'crate', color: 0x6a4a2a, h: 0.8, w: 0.8 } });
part('stairs', { armor: 40, height: 0.5, cost: 4, stairs: true, r: { type: 'stairs', color: 0x7a5a3a } });
part('tractor', { armor: 60, height: 0.7, blocksMove: true, r: { type: 'crate', color: 0x3a7a3a, h: 0.7, w: 0.9 } });
part('fuel_tank', { armor: 20, height: 0.8, blocksMove: true, explosive: { damage: 60, radius: 3, fire: true }, destroyTo: 'rubble', r: { type: 'tank', color: 0xb0b0a8 } });

// ------------------------------------------------------------------ UFO
part('ufo_hull', { armor: 110, height: 1, blocksMove: true, isUfo: true, destroyTo: 'ufo_rubble', loot: { alloys: 1 }, r: { type: 'wall', color: 0x6c6c7c, group: 'ufo', ufo: true } });
part('ufo_wall', { armor: 80, height: 1, blocksMove: true, isUfo: true, destroyTo: 'ufo_rubble', loot: { alloys: 1 }, r: { type: 'wall', color: 0x5a5a6e, group: 'ufo', ufo: true } });
part('ufo_door', { armor: 80, height: 1, cost: 0, isUfo: true, door: 'ufo', openTo: 'ufo_door_open', destroyTo: 'ufo_rubble', r: { type: 'door', color: 0x7a7aa0, group: 'ufo', ufo: true } });
part('ufo_door_open', { armor: 80, height: 0, cost: 0, isUfo: true, closeTo: 'ufo_door', destroyTo: 'ufo_rubble', r: { type: 'door', color: 0x7a7aa0, group: 'ufo', ufo: true, open: true } });
part('ufo_rubble', { armor: 60, height: 0.3, cost: 4, isUfo: true, loot: { alloys: 1 }, r: { type: 'rubble', color: 0x4a4a5a } });
part('ufo_lift', { armor: 100, height: 0, cost: 0, lift: true, isUfo: true, r: { type: 'lift', color: 0x6a9ac8 } });
part('power_source', {
  armor: 70, height: 0.8, blocksMove: true, isUfo: true, destroyTo: 'ufo_rubble', loot: { power_source: 1, elerium: 50 },
  explosive: { damage: 150, radius: 6 }, light: true, r: { type: 'power', color: 0x60ff90 },
});
part('navigation', { armor: 60, height: 0.6, blocksMove: true, isUfo: true, destroyTo: 'ufo_rubble', loot: { navigation: 1 }, light: true, r: { type: 'console', color: 0x4a5a8a, glow: 0x60a0ff } });
part('alien_chair', { armor: 40, height: 0.5, blocksMove: true, isUfo: true, destroyTo: 'ufo_rubble', r: { type: 'chair', color: 0x5a4a6a } });
part('food_vat', { armor: 40, height: 0.8, blocksMove: true, isUfo: true, destroyTo: 'ufo_rubble', loot: { food: 1 }, r: { type: 'pod', color: 0x8a5a3a, glow: 0xc07030 } });
part('surgery', { armor: 40, height: 0.45, blocksMove: true, isUfo: true, destroyTo: 'ufo_rubble', loot: { surgery: 1 }, r: { type: 'bed', color: 0x7a8a9a, glow: 0xa0e0ff } });
part('exam_table', { armor: 40, height: 0.45, blocksMove: true, isUfo: true, destroyTo: 'ufo_rubble', loot: { examination: 1 }, r: { type: 'bed', color: 0x6a6a8a, glow: 0xe0a0ff } });
part('repro_pod', { armor: 40, height: 0.9, blocksMove: true, isUfo: true, destroyTo: 'ufo_rubble', loot: { reproduction: 1 }, r: { type: 'pod', color: 0x5a7a6a, glow: 0x80ffc0 } });
part('entertainment', { armor: 40, height: 0.7, blocksMove: true, isUfo: true, destroyTo: 'ufo_rubble', loot: { entertainment: 1 }, light: true, r: { type: 'console', color: 0x6a4a7a, glow: 0xff60e0 } });

// ------------------------------------------------------------------ Skyranger
part('craft_hull', { armor: Infinity, height: 1, blocksMove: true, isCraft: true, r: { type: 'wall', color: 0x4a584a, group: 'craft' } });
part('craft_seat', { armor: Infinity, height: 0.4, cost: 2, isCraft: true, r: { type: 'chair', color: 0x3a3a3a } });

export function partByKey(key) {
  return key == null ? 0 : P[key];
}
