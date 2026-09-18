// Overworld: 6 x 4 screens, each 16 x 11 tiles.
// Legend:
//  .  grass          ,  dirt path      y  desert sand     F  flowers (walkable)
//  T  tree           R  mountain rock  r  boulder         G  gravestone
//  S  statue         W  water          B  bridge
//  C  cave entrance  D  dungeon entrance
//  x  bombable rock (hides a cave)
export const SCREEN_W = 16;
export const SCREEN_H = 11;
export const OW_COLS = 6;
export const OW_ROWS = 4;
export const START_SCREEN = { col: 2, row: 3 };
export const START_POS = { x: 2 * 16 + 7.5, z: 3 * 11 + 6.5 };

// screens[row][col]
const S = {};

S['0,0'] = [
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRCRRRRRRRR',
  'RRRRR......RRRRR',
  'RRR..........RRR',
  'RR..............',
  'R..r............',
  'R...............',
  'RR............RR',
  'RRR...r......RRR',
  'RRRR........RRRR',
  'RRRRRR....RRRRRR',
];
S['1,0'] = [
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'RRRR....RRRRRRRR',
  'RR.......RRRR..R',
  '...........rr...',
  '................',
  '......r.........',
  'RR...........RRR',
  'RRRR....RRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
];
S['2,0'] = [
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRDRRRRRRRR',
  'RRRRRS...SRRRRRR',
  'RRR..........RRR',
  '...S........S..R',
  '...............R',
  '...S........S..R',
  'RR.............R',
  'RRR...........RR',
  'RRRR...,,...RRRR',
  'RRRRRR,,,,RRRRRR',
];
S['3,0'] = [
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRCRRRR',
  'RRWWWWWR.......R',
  'RWWWWWWW.......R',
  'RWWWWWW.........',
  'RWWWWW..........',
  'RWWWWW.....r....',
  'RWWWWWW........R',
  'RRWWWWW.......RR',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
];
S['4,0'] = [
  'RRRRRRRRRRRRRRRR',
  'R..............R',
  'R.G.G.G..G.G.G.R',
  'R..............R',
  '..G.G.G..G.G.G..',
  '................',
  '..G.G.G..G.G.G..',
  'R..............R',
  'R.G.G.G..G.G.G.R',
  'R..............R',
  'RRRRRR....RRRRRR',
];
S['5,0'] = [
  'RRRRRRRRRRRRRRRR',
  'RRRRRxRRRRRRRRRR',
  'R..............R',
  'R..G..G..G..G..R',
  '...............R',
  '...............R',
  '...G..G..G..G..R',
  'R..............R',
  'R..G..G..G..G..R',
  'R..............R',
  'RRRRRR....RRRRRR',
];

S['0,1'] = [
  'TTTTTT....TTTTTT',
  'TT.....TT.....TT',
  'T...T......T...T',
  'T..............T',
  'T.....TTTT......',
  'T.....T..T......',
  'T.....T..T......',
  'T..............T',
  'T...T......T...T',
  'TT............TT',
  'TTTTTT....TTTTTT',
];
S['1,1'] = [
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRxRRRRRRR',
  'RRR..........RRR',
  'T..............T',
  '................',
  '...T..T..T..T...',
  '................',
  'T..............T',
  'T.T.T.T.T.T.T.TT',
  'TTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTT',
];
S['2,1'] = [
  'RRRRRR,,,,RRRRRR',
  'RRRRR.,,,,.RRRRR',
  'RRR...,,,,...RRR',
  'R.....,,,,.....R',
  ',,,,,,,,,,,,,,,,',
  ',,,,,,,,,,,,,,,,',
  '......,,,,......',
  'T.....,,,,.....T',
  'T..T..,,,,..T..T',
  'T.....,,,,.....T',
  'TTTTTT,,,,TTTTTT',
];
S['3,1'] = [
  'RRRRRRRRRRRRRRRR',
  'R..............R',
  'R..r........r..R',
  'R..............R',
  '................',
  '................',
  '................',
  'WWWW..BBBB..WWWW',
  'WWWWWWBBBBWWWWWW',
  'WWWWWWBBBBWWWWWW',
  'WWWWWWBBBBWWWWWW',
];
S['4,1'] = [
  'RRRRRR....RRRRRR',
  'RRR..........RRR',
  'RR..rr....rr..RR',
  'R..............R',
  '................',
  '...rr......rr...',
  '................',
  'R..............R',
  'RR..rr....rr..RR',
  'RRR..........RRR',
  'RRRRRR....RRRRRR',
];
S['5,1'] = [
  'RRRRRRyyyyRRRRRR',
  'RyyyyyyyyyyyyyyR',
  'RyyryyyyyyyyyryR',
  'RyyyyyyyyyyyyyyR',
  'yyyyyyyyyyyyyyyR',
  'yyyyyyrryyyyyyyR',
  'yyyyyyyyyyyyyyyR',
  'RyyyyyyyyyyyyyyR',
  'RyyryyyyyyyyyryR',
  'RyyyyyyyyyyyyyyR',
  'RRRRRRRRRRRRRRRR',
];

S['0,2'] = [
  'TTTTTT....TTTTTT',
  'T..............T',
  'T.T.T.T..T.T.T.T',
  'T..............T',
  'T.T.T.T..T.T....',
  'T...............',
  'T.T.T.T..T.T....',
  'T..............T',
  'T.T.T.T..T.T.T.T',
  'T..............T',
  'TTTTTT....TTTTTT',
];
S['1,2'] = [
  'TTTTRRRRTTTTTTTT',
  'TTTTRCRRTTTTTTTT',
  'T..............T',
  'T..T....T....T.T',
  '................',
  '..T....T....T...',
  '................',
  'T..T....T....T.T',
  'T..............T',
  'T.T.T.T..T.T.T.T',
  'TTTTTT....TTTTTT',
];
S['2,2'] = [
  'TTTTTT....TTTTTT',
  'T.....,,,,.....T',
  'T.....,,,,.....T',
  'T..F..,,,,..F..T',
  ',,,,,,,,,,,,,,,,',
  ',,,,,,,,,,,,,,,,',
  ',,,,,,,,,,,,,,,,',
  'T..F..,,,,..F..T',
  'T.....,,,,.....T',
  'T.....,,,,.....T',
  'TTTTTT,,,,TTTTTT',
];
S['3,2'] = [
  'WWWWWWBBBBWWWWWW',
  'WWWWWWBBBBWWWWWW',
  'WWWWWWBBBBWWWWWW',
  'WWWW........WWWW',
  '................',
  '................',
  '................',
  'R.r.....r....r.R',
  'RR............RR',
  'RRRR........RRRR',
  'RRRRRRRRRRRRRRRR',
];
S['4,2'] = [
  'RRRRRRyyyyRRRRRR',
  'RyyyyyyyyyyyyyyR',
  'RyyyyyyyyyyyyyyR',
  'RyyyryyyyyyyryyR',
  'yyyyyyyyyyyyyyyy',
  'yyyyyyyyyyyyyyyy',
  'yyyyyyyyyyyyyyyy',
  'RyyyryyyyyyyryyR',
  'RyyyyyyyyyyyyyyR',
  'RyyyyyyyyyyyyyyR',
  'RRRRRRyyyyRRRRRR',
];
S['5,2'] = [
  'RRRRRRRRRRRRRRRR',
  'R............WWW',
  'R...........WWWW',
  'R..r........WWWW',
  '............WWWW',
  '............WWWW',
  '..........WWWWWW',
  'R.....r....WWWWW',
  'R..........WWWWW',
  'R..........WWWWW',
  'RRRRRR....RRWWWW',
];

S['0,3'] = [
  'TTTTTT....TTTTTT',
  'T..............T',
  'T.....,,,,.....T',
  'T.....,..,.....T',
  'T.....,..,......',
  'T....,,..,,,,,,,',
  'T...............',
  'WW.............T',
  'WWWW.....r.....T',
  'WWWWWW.........T',
  'WWWWWWWWWWWWWWWW',
];
S['1,3'] = [
  'TTTTTT....TTTTTT',
  'T..............T',
  'T..T..T...T..T.T',
  'T..............T',
  '................',
  '....T.....T.....',
  '................',
  'T..............T',
  'T..T..T....T..TT',
  'T..............T',
  'TTTTTTTTTTTTTTTT',
];
S['2,3'] = [
  'RRRRRR....RRRRRR',
  'RRRCRR....RRRRRR',
  'RR.............R',
  'R..............R',
  '..........r.....',
  '................',
  '....r...........',
  'R..............R',
  'RR....FF.......R',
  'RRR..........RRR',
  'RRRRRRRRRRRRRRRR',
];
S['3,3'] = [
  'RRRRRRRRRRRRRRRR',
  'RRRWWWWWWWWWWRRR',
  'RR.WWWWWWWWWW.RR',
  'R...r......r...R',
  '................',
  '..r...rr...r....',
  '................',
  'R..r........r..R',
  'R..............R',
  'RRR....rr....RRR',
  'RRRRRRRRRRRRRRRR',
];
S['4,3'] = [
  'TTTTTT....TTTTTT',
  'TT.T.T....T.T.TT',
  'T..............T',
  'T.TT..TT..TT.T.T',
  '................',
  '..T..T....T..T..',
  '................',
  'T.TT..TT..TT.T.T',
  'T..............T',
  'TT.T.T.TT.T.T.TT',
  'TTTTTTTTTTTTTTTT',
];
S['5,3'] = [
  'RRRRRR....RRRRRR',
  'RRRRRR....RRRCRR',
  'R.............WW',
  'R............WWW',
  '............WWWW',
  '...r........WWWW',
  '...........WWWWW',
  'R..........WWWWW',
  'RR.........WWWWW',
  'RRRR.....WWWWWWW',
  'RRRRRRRWWWWWWWWW',
];

export const SCREENS = S;

// Enemy spawns per screen: [type, count]
export const OW_ENEMIES = {
  '0,0': [['tektite', 3]],
  '1,0': [['tektite', 4]],
  '2,0': [['moblin', 2], ['octorok', 2]],
  '3,0': [['octorok', 3]],
  '4,0': [['keese', 4]],
  '5,0': [['moblinBlue', 3]],
  '0,1': [['moblinBlue', 4]],
  '1,1': [['moblin', 3]],
  '2,1': [['octorok', 4]],
  '3,1': [['tektite', 4]],
  '4,1': [['moblin', 5]],
  '5,1': [['leever', 5]],
  '0,2': [['moblin', 3]],
  '1,2': [['moblin', 4]],
  '2,2': [['octorok', 5]],
  '3,2': [['octorok', 3]],
  '4,2': [['leever', 5]],
  '5,2': [['octorokBlue', 4]],
  '0,3': [['octorok', 3]],
  '1,3': [['octorok', 4]],
  '2,3': [],
  '3,3': [['tektite', 4]],
  '4,3': [['octorokBlue', 4]],
  '5,3': [['tektite', 3]],
};

// Cave contents, keyed by screen "col,row".
export const CAVES = {
  '2,3': {
    npc: 'oldman',
    text: "IT'S NOT SAFE OUT THERE\nALONE. TAKE THIS!",
    items: [{ kind: 'sword' }],
  },
  '1,2': {
    npc: 'merchant',
    text: 'BUY SOMETHING, TRAVELER!',
    items: [
      { kind: 'bombs', price: 20 },
      { kind: 'key', price: 80 },
      { kind: 'heartRefill', price: 10 },
    ],
  },
  '0,0': {
    npc: 'oldwoman',
    text: 'THE DUNGEON AWAITS NORTH\nOF THE CROSSROADS.',
    items: [],
  },
  '3,0': {
    npc: 'moblinFriend',
    text: "SHH... IT'S A SECRET\nTO EVERYONE.",
    items: [{ kind: 'rupeeGift', amount: 50 }],
  },
  '1,1': {
    npc: 'moblinFriend',
    text: "YOU FOUND MY HIDEOUT!\nTAKE THESE RUPEES.",
    items: [{ kind: 'rupeeGift', amount: 30 }],
  },
  '5,0': {
    npc: 'oldman',
    text: 'A GIFT FOR THE BRAVE\nWHO FIND THIS PLACE.',
    items: [{ kind: 'heartContainer' }],
  },
  '5,3': {
    npc: 'oldman',
    text: 'TAKE ANY ONE YOU WANT.',
    items: [{ kind: 'heartContainer', choice: true }, { kind: 'rupeeGift', amount: 100, choice: true }],
  },
};
