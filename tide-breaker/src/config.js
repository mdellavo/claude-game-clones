// Original riders and courses for Tidebreaker.

export const RIDERS = [
  {
    id: 'rio', name: 'Rio Vance', desc: 'Balanced all-rounder. A safe first pick.',
    top: 25.5, accel: 13.5, handling: 1.85, grip: 5.4, weight: 1.0,
    hull: 0xe63946, trim: 0xf6f6f6, suit: 0x1d3557, helmet: 0xf1faee, visor: 0x1b1b1b,
  },
  {
    id: 'juno', name: 'Juno Park', desc: 'Light and nimble. Carves the tightest lines.',
    top: 24.6, accel: 14.5, handling: 2.2, grip: 6.2, weight: 0.82,
    hull: 0xffb703, trim: 0x2b2d42, suit: 0x8338ec, helmet: 0xffffff, visor: 0x3a0ca3,
  },
  {
    id: 'brick', name: 'Brick Halloran', desc: 'Heavy hitter with a monster top speed.',
    top: 27.2, accel: 11.5, handling: 1.55, grip: 4.7, weight: 1.35,
    hull: 0x2a9d8f, trim: 0xe9c46a, suit: 0x264653, helmet: 0xe76f51, visor: 0x111111,
  },
  {
    id: 'lena', name: 'Lena Sorvik', desc: 'Explosive launches out of every turn.',
    top: 25.0, accel: 16.5, handling: 1.95, grip: 5.0, weight: 0.95,
    hull: 0xff006e, trim: 0xffffff, suit: 0x3a86ff, helmet: 0x111111, visor: 0xff006e,
  },
];

export const STAT_RANGES = {
  top: [24, 27.5], accel: [11, 17], handling: [1.5, 2.25], grip: [4.5, 6.3],
};

export const DIFFICULTIES = [
  { id: 'normal', name: 'Normal', aiSpeed: 0.9, aiNoise: 1.0, trick: 0.15 },
  { id: 'hard', name: 'Hard', aiSpeed: 0.96, aiNoise: 0.6, trick: 0.3 },
  { id: 'expert', name: 'Expert', aiSpeed: 1.01, aiNoise: 0.3, trick: 0.5 },
];

export const CHAMP_POINTS = [10, 6, 3, 1];
export const MAX_MISSES = 5;

export const COURSES = [
  {
    id: 'lagoon', name: 'Sunny Lagoon', blurb: 'Calm turquoise water between palm islands.',
    laps: 3, width: 38, seed: 11, scale: 1.0,
    points: [[0, 0], [120, -10], [230, 20], [290, 110], [260, 220], [160, 260], [60, 220], [-20, 250], [-120, 240], [-190, 160], [-180, 60], [-100, 10]],
    buoySpacing: 72, buoyOffset: 6,
    ramps: [{ t: 0.42, off: 0 }, { t: 0.83, off: -8 }],
    waves: { swell: 0.45, chop: 0.16, dir: 0.6, sets: 0.25, speed: 1.0 },
    sky: { zenith: 0x2a78d4, horizon: 0xcdeeff, sun: 0xfff1d6, sunDir: [0.45, 0.6, -0.35], clouds: 0.38, cloudColor: 0xffffff, sunStrength: 1.0 },
    water: { deep: 0x065a8c, shallow: 0x2fd6c8, foam: 0xffffff },
    light: { hemiSky: 0xbfe6ff, hemiGround: 0x5a7a50, hemi: 1.6, sun: 2.8 },
    land: { base: -8, amp: 30, bank: 16, edge: 55, palette: 'tropical' },
    props: { palms: 260, rocks: 70, houses: 6, posts: 0, bergs: 0, pines: 0, lighthouse: false },
  },
  {
    id: 'harbor', name: 'Sunset Harbor', blurb: 'Weave past piers as the sun goes down.',
    laps: 3, width: 36, seed: 23, scale: 0.85,
    points: [[0, 0], [180, 0], [320, 40], [380, 150], [330, 240], [200, 230], [120, 300], [140, 400], [40, 460], [-90, 420], [-140, 300], [-100, 180], [-150, 80], [-100, 10]],
    buoySpacing: 68, buoyOffset: 6,
    ramps: [{ t: 0.07, off: 6 }, { t: 0.56, off: 0 }],
    waves: { swell: 0.6, chop: 0.24, dir: 2.2, sets: 0.3, speed: 1.0 },
    sky: { zenith: 0x2b3a78, horizon: 0xffa25c, sun: 0xffb46a, sunDir: [-0.7, 0.12, 0.55], clouds: 0.5, cloudColor: 0xffc49a, sunStrength: 1.4 },
    water: { deep: 0x0d2f55, shallow: 0x2a8a8f, foam: 0xfff1e4 },
    light: { hemiSky: 0xffb98a, hemiGround: 0x3b2c3a, hemi: 1.3, sun: 3.0 },
    land: { base: -4, amp: 26, bank: 20, edge: 60, palette: 'harbor' },
    props: { palms: 60, rocks: 50, houses: 40, posts: 26, bergs: 0, pines: 40, lighthouse: true },
  },
  {
    id: 'storm', name: 'Storm Reef', blurb: 'Open sea, heavy swells and huge air.',
    laps: 3, width: 44, seed: 37, scale: 0.8,
    points: [[0, 0], [200, -40], [380, 20], [450, 180], [380, 330], [220, 360], [100, 300], [-40, 380], [-200, 340], [-260, 200], [-180, 70]],
    buoySpacing: 80, buoyOffset: 7,
    ramps: [{ t: 0.25, off: -6 }, { t: 0.66, off: 6 }],
    waves: { swell: 1.35, chop: 0.32, dir: -0.9, sets: 0.35, speed: 1.1 },
    sky: { zenith: 0x4b5866, horizon: 0xaab6bf, sun: 0xdde6ee, sunDir: [0.2, 0.5, 0.8], clouds: 0.78, cloudColor: 0x8a939b, sunStrength: 0.35 },
    water: { deep: 0x123a4a, shallow: 0x3a7f86, foam: 0xf2f7f7 },
    light: { hemiSky: 0xb8c4cc, hemiGround: 0x3a3f40, hemi: 1.8, sun: 1.2 },
    land: { base: -22, amp: 34, bank: 4, edge: 40, palette: 'storm' },
    props: { palms: 20, rocks: 120, houses: 0, posts: 0, bergs: 0, pines: 0, lighthouse: true },
  },
  {
    id: 'glacier', name: 'Glacier Fjord', blurb: 'Narrow icy channels between towering cliffs.',
    laps: 3, width: 32, seed: 51, scale: 0.9,
    points: [[0, 0], [140, -30], [260, 40], [250, 160], [150, 210], [180, 320], [300, 360], [330, 480], [200, 540], [60, 480], [-40, 380], [-20, 260], [-120, 180], [-140, 60], [-80, 0]],
    buoySpacing: 66, buoyOffset: 5,
    ramps: [{ t: 0.3, off: 0 }, { t: 0.72, off: 0 }],
    waves: { swell: 0.35, chop: 0.2, dir: 1.4, sets: 0.2, speed: 0.9 },
    sky: { zenith: 0x4f86c6, horizon: 0xe6f2ff, sun: 0xffffff, sunDir: [-0.3, 0.45, -0.6], clouds: 0.3, cloudColor: 0xffffff, sunStrength: 0.9 },
    water: { deep: 0x0b3b5a, shallow: 0x4fb0c6, foam: 0xffffff },
    light: { hemiSky: 0xdcecff, hemiGround: 0x6a7a88, hemi: 1.9, sun: 2.4 },
    land: { base: 4, amp: 40, bank: 40, edge: 80, palette: 'glacier' },
    props: { palms: 0, rocks: 60, houses: 3, posts: 0, bergs: 14, pines: 180, lighthouse: false },
  },
];
