import { makeItem, makeWeapon } from './items.js';

export const ARMORS = {
  none: { name: 'Coveralls', front: 12, side: 8, rear: 5, under: 2, color: 0x6f7f4f },
  personal: { name: 'Personal Armour', front: 50, side: 40, rear: 40, under: 30, color: 0x4f6f8f },
  power: { name: 'Power Suit', front: 100, side: 80, rear: 70, under: 60, color: 0x8f8f9a },
  flying: { name: 'Flying Suit', front: 110, side: 90, rear: 80, under: 70, color: 0x6a7faa, flying: true },
};

export const RANKS = ['Rookie', 'Squaddie', 'Sergeant', 'Captain', 'Colonel', 'Commander'];

const FIRST = {
  USA: ['John', 'Mike', 'Sarah', 'Linda', 'Robert', 'Jessica', 'Tom', 'Emily', 'David', 'Karen'],
  UK: ['Nigel', 'Emma', 'Oliver', 'Charlotte', 'Harry', 'Gemma', 'Alfie', 'Sophie'],
  Germany: ['Hans', 'Klaus', 'Ute', 'Jürgen', 'Monika', 'Stefan', 'Heike', 'Dieter'],
  France: ['Jean', 'Pierre', 'Amélie', 'Luc', 'Camille', 'Hélène', 'Marcel', 'Chloé'],
  Russia: ['Ivan', 'Olga', 'Dmitri', 'Natasha', 'Sergei', 'Yulia', 'Boris', 'Katya'],
  Japan: ['Hiro', 'Yuki', 'Kenji', 'Aiko', 'Takeshi', 'Emi', 'Ryo', 'Naomi'],
  Brazil: ['João', 'Ana', 'Paulo', 'Luana', 'Rafael', 'Bianca', 'Thiago', 'Carla'],
  Nigeria: ['Chidi', 'Ngozi', 'Emeka', 'Amaka', 'Tunde', 'Funmi', 'Obi', 'Ada'],
};
const LAST = {
  USA: ['Smith', 'Johnson', 'Brown', 'Miller', 'Davis', 'Wilson', 'Taylor', 'Carter'],
  UK: ['Hughes', 'Wright', 'Evans', 'Clarke', 'Walker', 'Hall', 'Green', 'Baker'],
  Germany: ['Müller', 'Schmidt', 'Weber', 'Fischer', 'Wagner', 'Becker', 'Hoffmann', 'Krause'],
  France: ['Dubois', 'Laurent', 'Moreau', 'Girard', 'Bonnet', 'Lefebvre', 'Mercier', 'Fournier'],
  Russia: ['Ivanov', 'Petrova', 'Sokolov', 'Volkov', 'Morozov', 'Popova', 'Lebedev', 'Kozlov'],
  Japan: ['Tanaka', 'Suzuki', 'Sato', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi'],
  Brazil: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Pereira', 'Almeida', 'Ferreira'],
  Nigeria: ['Okafor', 'Adeyemi', 'Eze', 'Balogun', 'Nwosu', 'Okonkwo', 'Bello', 'Obi'],
};

export function generateSoldier(rng, id) {
  const nation = rng.pick(Object.keys(FIRST));
  const rankRoll = rng.next();
  const rank = rankRoll < 0.45 ? 0 : rankRoll < 0.8 ? 1 : rankRoll < 0.95 ? 2 : 3;
  const bonus = rank * 3;
  return {
    id,
    name: `${rng.pick(FIRST[nation])} ${rng.pick(LAST[nation])}`,
    nation,
    rank,
    missions: rank * rng.int(1, 3),
    kills: rank * rng.int(0, 3),
    stats: {
      tu: rng.int(50, 60) + bonus,
      stamina: rng.int(40, 70) + bonus,
      health: rng.int(25, 40) + bonus,
      bravery: rng.int(1, 6) * 10,
      reactions: rng.int(30, 60) + bonus,
      firing: rng.int(40, 70) + bonus * 2,
      throwing: rng.int(50, 80) + bonus,
      strength: rng.int(20, 40) + bonus,
      melee: rng.int(20, 40) + bonus,
    },
    armor: 'none',
    skin: rng.pick([0xe8c39e, 0xc68e63, 0x8d5a3b, 0xf0d5b8, 0x5c3a24]),
    loadout: null, // filled in by loadout screen
  };
}

// ------------------------------------------------------------------ aliens
// Stats per species; ranks multiply by leader bonuses.
export const SPECIES = {
  sectoid: {
    name: 'Sectoid', tu: 54, stamina: 90, health: 30, bravery: 80, reactions: 63, firing: 52, throwing: 58,
    strength: 30, melee: 60, armor: { front: 4, side: 4, rear: 4, under: 4 }, score: 10,
    color: 0x9aa3a8, model: 'sectoid', height: 0.7, terror: 'cyberdisc',
  },
  floater: {
    name: 'Floater', tu: 55, stamina: 90, health: 35, bravery: 80, reactions: 50, firing: 50, throwing: 58,
    strength: 40, melee: 70, armor: { front: 8, side: 6, rear: 6, under: 4 }, score: 10,
    color: 0x8a5a86, model: 'floater', height: 0.8, flying: true, terror: 'reaper',
  },
  snakeman: {
    name: 'Snakeman', tu: 40, stamina: 90, health: 45, bravery: 80, reactions: 40, firing: 45, throwing: 60,
    strength: 40, melee: 70, armor: { front: 20, side: 18, rear: 15, under: 12 }, score: 12,
    color: 0xb59a3a, model: 'snakeman', height: 0.8, terror: 'chryssalid',
  },
  muton: {
    name: 'Muton', tu: 60, stamina: 90, health: 125, bravery: 90, reactions: 60, firing: 68, throwing: 70,
    strength: 90, melee: 80, armor: { front: 32, side: 30, rear: 28, under: 26 }, score: 15,
    color: 0x4f7a3a, model: 'muton', height: 0.85, terror: 'silacoid',
  },
  // terror units
  cyberdisc: {
    name: 'Cyberdisc', tu: 60, stamina: 110, health: 120, bravery: 110, reactions: 55, firing: 65, throwing: 0,
    strength: 110, melee: 0, armor: { front: 34, side: 34, rear: 34, under: 24 }, score: 20,
    color: 0x8f8f96, model: 'cyberdisc', height: 0.6, flying: true, builtin: 'disc_plasma',
    explodeOnDeath: { damage: 90, radius: 3 }, noCapture: true, isTerror: true,
  },
  reaper: {
    name: 'Reaper', tu: 60, stamina: 90, health: 180, bravery: 110, reactions: 50, firing: 0, throwing: 0,
    strength: 110, melee: 80, armor: { front: 16, side: 16, rear: 16, under: 16 }, score: 15,
    color: 0xc07030, model: 'reaper', height: 0.9, builtin: 'reaper_jaws', isTerror: true,
  },
  chryssalid: {
    name: 'Chryssalid', tu: 110, stamina: 110, health: 96, bravery: 110, reactions: 80, firing: 0, throwing: 0,
    strength: 110, melee: 100, armor: { front: 34, side: 34, rear: 34, under: 34 }, score: 20,
    color: 0x2a2a3a, model: 'chryssalid', height: 0.8, builtin: 'chryssalid_claw', isTerror: true,
  },
  silacoid: {
    name: 'Silacoid', tu: 40, stamina: 90, health: 70, bravery: 110, reactions: 40, firing: 0, throwing: 0,
    strength: 90, melee: 80, armor: { front: 30, side: 30, rear: 30, under: 30 }, score: 10,
    color: 0x6a3020, model: 'silacoid', height: 0.35, builtin: 'silacoid_touch', isTerror: true,
  },
  zombie: {
    name: 'Zombie', tu: 45, stamina: 110, health: 85, bravery: 110, reactions: 40, firing: 0, throwing: 0,
    strength: 60, melee: 60, armor: { front: 8, side: 8, rear: 8, under: 8 }, score: 5,
    color: 0x6a8a6a, model: 'zombie', height: 0.8, builtin: 'zombie_claw', noCapture: true, isTerror: true,
    hatchOnDeath: 'chryssalid',
  },
};

export const ALIEN_RANKS = {
  soldier: { name: 'Soldier', mult: 1.0 },
  navigator: { name: 'Navigator', mult: 1.05 },
  engineer: { name: 'Engineer', mult: 1.05 },
  leader: { name: 'Leader', mult: 1.15 },
  commander: { name: 'Commander', mult: 1.25 },
  terrorist: { name: 'Terrorist', mult: 1.0 },
};

export const DIFFICULTY = [
  { name: 'Beginner', statMult: 0.8, countMult: 0.8, alienVision: 20 },
  { name: 'Experienced', statMult: 0.9, countMult: 0.9, alienVision: 20 },
  { name: 'Veteran', statMult: 1.0, countMult: 1.0, alienVision: 20 },
  { name: 'Genius', statMult: 1.1, countMult: 1.15, alienVision: 20 },
  { name: 'Superhuman', statMult: 1.2, countMult: 1.3, alienVision: 20 },
];

export function alienLoadout(species, rank, rng) {
  const sp = SPECIES[species];
  if (sp.builtin) return [];
  const items = [];
  const heavy = rank === 'leader' || rank === 'commander';
  let weapon;
  switch (species) {
    case 'sectoid':
      weapon = heavy ? 'plasma_rifle' : 'plasma_pistol';
      break;
    case 'floater':
      weapon = rng.chance(0.3) ? 'plasma_pistol' : 'plasma_rifle';
      break;
    case 'snakeman':
      weapon = heavy ? 'heavy_plasma' : 'plasma_rifle';
      break;
    case 'muton':
      weapon = heavy || rng.chance(0.5) ? 'heavy_plasma' : 'plasma_rifle';
      break;
    default:
      weapon = 'plasma_pistol';
  }
  const w = makeWeapon(weapon);
  items.push({ slot: 'rhand', item: w });
  items.push({ slot: 'belt', item: makeItem(w.loaded.id) });
  if (rng.chance(heavy ? 0.7 : 0.35)) items.push({ slot: 'belt', item: makeItem('alien_grenade') });
  return items;
}
