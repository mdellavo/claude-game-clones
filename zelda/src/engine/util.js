export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// Deterministic per-tile hash in [0,1)
export function hash2(x, z, seed = 0) {
  let h = (x * 374761393 + z * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const DIRS = {
  up: { x: 0, z: -1 },
  down: { x: 0, z: 1 },
  left: { x: -1, z: 0 },
  right: { x: 1, z: 0 },
};
export const DIR_LIST = [DIRS.up, DIRS.down, DIRS.left, DIRS.right];
export const yawFor = (d) => Math.atan2(d.x, d.z);

export function aabbOverlap(ax, az, ah, bx, bz, bh) {
  return Math.abs(ax - bx) < ah + bh && Math.abs(az - bz) < ah + bh;
}
