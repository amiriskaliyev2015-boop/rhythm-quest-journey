// Geometry Dash-like game engine. Procedurally generates 11 levels of
// increasing difficulty. Each level is ~3 minutes long at level speed.

export type Obstacle =
  | { type: "spike"; x: number; w: number; h: number }
  | { type: "block"; x: number; y: number; w: number; h: number }
  | { type: "saw"; x: number; y: number; r: number };

export interface Level {
  index: number;
  name: string;
  speed: number; // px per second
  gravity: number;
  jump: number;
  bgFrom: string;
  bgTo: string;
  accent: string;
  durationSec: number;
  obstacles: Obstacle[];
  length: number; // total scroll length in px
}

// Seeded RNG so each level is deterministic.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  ["#0ea5e9", "#1e3a8a", "#22d3ee"],
  ["#22c55e", "#064e3b", "#a3e635"],
  ["#f59e0b", "#7c2d12", "#fde047"],
  ["#ef4444", "#7f1d1d", "#fb7185"],
  ["#a855f7", "#3b0764", "#e879f9"],
  ["#ec4899", "#831843", "#fb7185"],
  ["#06b6d4", "#0c4a6e", "#67e8f9"],
  ["#84cc16", "#365314", "#bef264"],
  ["#f97316", "#7c2d12", "#fdba74"],
  ["#8b5cf6", "#2e1065", "#c4b5fd"],
  ["#f43f5e", "#4c0519", "#fb7185"],
];

const NAMES = [
  "Stereo Madness",
  "Back On Track",
  "Polargeist",
  "Dry Out",
  "Base After Base",
  "Cant Let Go",
  "Jumper",
  "Time Machine",
  "Cycles",
  "xStep",
  "Clutterfunk",
];

export function buildLevel(idx: number): Level {
  const rand = mulberry32(1337 + idx * 7919);
  const difficulty = idx / 10; // 0..1
  const speed = 320 + idx * 28; // 320 -> 600 px/s
  const gravity = 2400 + idx * 80;
  const jump = 780 + idx * 18;
  const durationSec = 180;
  const length = speed * durationSec;

  const obstacles: Obstacle[] = [];
  // First 4 seconds: empty runway
  let x = speed * 4;
  const minGap = Math.max(140, 320 - idx * 18);
  const maxGap = Math.max(minGap + 80, 520 - idx * 22);

  while (x < length - speed * 3) {
    const roll = rand();
    const gap = minGap + rand() * (maxGap - minGap);

    if (roll < 0.55) {
      // spikes (1..1+difficulty*3)
      const count = 1 + Math.floor(rand() * (1 + difficulty * 3));
      for (let i = 0; i < count; i++) {
        obstacles.push({ type: "spike", x: x + i * 38, w: 34, h: 34 });
      }
      x += count * 38 + gap;
    } else if (roll < 0.85) {
      // block stack with spike on top (sometimes)
      const stack = 1 + Math.floor(rand() * (1 + difficulty * 2));
      const bw = 40;
      for (let i = 0; i < stack; i++) {
        obstacles.push({
          type: "block",
          x,
          y: i * 40,
          w: bw,
          h: 40,
        });
      }
      if (rand() < 0.4 + difficulty * 0.3) {
        obstacles.push({ type: "spike", x: x + 3, w: 34, h: 30 });
      }
      x += bw + gap;
    } else if (idx >= 4) {
      // floating saw - requires careful jump
      obstacles.push({
        type: "saw",
        x,
        y: 60 + rand() * 50,
        r: 22,
      });
      x += 50 + gap;
    } else {
      // gap (rest)
      x += gap;
    }
  }

  const palette = PALETTES[idx % PALETTES.length];
  return {
    index: idx,
    name: NAMES[idx] ?? `Level ${idx + 1}`,
    speed,
    gravity,
    jump,
    bgFrom: palette[0],
    bgTo: palette[1],
    accent: palette[2],
    durationSec,
    obstacles,
    length,
  };
}

export const LEVELS: Level[] = Array.from({ length: 11 }, (_, i) => buildLevel(i));
