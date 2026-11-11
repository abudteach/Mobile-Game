// Global tuning values for DRIP CLASH.
export const MAP_W = 64;
export const MAP_H = 36;
export const HALF_W = MAP_W / 2;
export const HALF_H = MAP_H / 2;
export const CELL = 0.5; // size of one paint cell in world units

export const TEAM_COLORS = [0x18d6ff, 0xff2f8e];
export const TEAM_CSS = ['#18d6ff', '#ff2f8e'];
export const TEAM_CSS_DARK = ['#0a86c9', '#c2126a'];

export const MATCH_TIME = 180; // seconds
export const WAVE_INTERVAL = 14;
export const MAX_LEVEL = 8;

export const SPAWN = [{ x: -29.5, z: 0 }, { x: 29.5, z: 0 }];
export const CORE_POS = [{ x: -24.5, z: 0 }, { x: 24.5, z: 0 }];
export const TOWER_POS = [{ x: -11.5, z: 0 }, { x: 11.5, z: 0 }];

// Cover blocks. Defined for one quadrant and mirrored so the arena is fair.
const QUADRANT = [
  { x: -18.5, z: -7.5, w: 6, d: 2.5, h: 1.9 },
  { x: -7, z: -10, w: 2.5, d: 6, h: 2.2 },
  { x: -13.5, z: -12.5, w: 3, d: 3, h: 1.5 },
  { x: -26, z: -12, w: 2.5, d: 2.5, h: 1.7 },
  { x: 0, z: -6.5, w: 5, d: 2.5, h: 2.0 },
];

export const OBSTACLES = [];
for (const o of QUADRANT) {
  const xs = o.x === 0 ? [0] : [o.x, -o.x];
  const zs = o.z === 0 ? [0] : [o.z, -o.z];
  for (const x of xs) for (const z of zs) OBSTACLES.push({ ...o, x, z });
}

export const BOT_NAMES = ['Lumi', 'Taro', 'Pixel', 'Yuna', 'Bo', 'Nox', 'Milo', 'Zuri', 'Fynn', 'Kiwi', 'Jax', 'Suki'];
