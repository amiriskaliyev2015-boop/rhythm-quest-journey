// Geometry runner engine. 11 levels with progressive difficulty and
// different vehicle types (cube/ship/ball/ufo/wave).

export type Vehicle = "cube" | "ship" | "ball" | "ufo" | "wave";

export type Obstacle =
  | { type: "spike"; x: number; w: number; h: number; flip?: boolean }
  | { type: "block"; x: number; y: number; w: number; h: number }
  | { type: "saw"; x: number; y: number; r: number }
  | { type: "portal"; x: number; vehicle: Vehicle };

export const CEIL_HEIGHT = 360; // play area height for flying vehicles

export interface Level {
  index: number;
  name: string;
  startingVehicle: Vehicle;
  speed: number;
  gravity: number;
  jump: number;
  bgFrom: string;
  bgTo: string;
  accent: string;
  durationSec: number;
  obstacles: Obstacle[];
  length: number;
}

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
  ["#14b8a6", "#134e4a", "#5eead4"],
  ["#eab308", "#422006", "#fde68a"],
  ["#3b82f6", "#1e1b4b", "#93c5fd"],
  ["#dc2626", "#450a0a", "#fca5a5"],
];

const NAMES = [
  "Neon Pulse",
  "Sky Glide",
  "Frostbyte",
  "Rolling Static",
  "Saucer Run",
  "Crimson Drop",
  "Wave Surge",
  "Astro Cruiser",
  "Pendulum",
  "Hover Storm",
  "Final Circuit",
  "Plasma Drift",
  "Solar Flare",
  "Void Runner",
  "Apex Singularity",
];

const VEHICLES: Vehicle[] = [
  "cube",
  "ship",
  "cube",
  "ball",
  "ufo",
  "cube",
  "wave",
  "ship",
  "ball",
  "ufo",
  "wave",
  "cube",
  "ship",
  "ball",
  "wave",
];


function genSegment(
  vehicle: Vehicle,
  startX: number,
  endX: number,
  rand: () => number,
  difficulty: number,
  idx: number,
  out: Obstacle[],
) {
  let x = startX;
  const minGap = Math.max(140, 320 - idx * 18);
  const maxGap = Math.max(minGap + 80, 520 - idx * 22);
  while (x < endX) {
    const roll = rand();
    const gap = minGap + rand() * (maxGap - minGap);
    if (vehicle === "cube") {
      if (roll < 0.55) {
        const count = 1 + Math.floor(rand() * (1 + difficulty * 3));
        for (let i = 0; i < count; i++) out.push({ type: "spike", x: x + i * 38, w: 34, h: 34 });
        x += count * 38 + gap;
      } else if (roll < 0.85) {
        const stack = 1 + Math.floor(rand() * (1 + difficulty * 2));
        const bw = 40;
        for (let i = 0; i < stack; i++) out.push({ type: "block", x, y: i * 40, w: bw, h: 40 });
        if (rand() < 0.4 + difficulty * 0.3) out.push({ type: "spike", x: x + 3, w: 34, h: 30 });
        x += bw + gap;
      } else if (idx >= 4) {
        out.push({ type: "saw", x, y: 60 + rand() * 50, r: 22 });
        x += 50 + gap;
      } else {
        x += gap;
      }
    } else if (vehicle === "ship") {
      // Ship/rocket: keep floor clear so the player can skim along the ground.
      if (roll < 0.55) {
        out.push({ type: "spike", x, w: 34, h: 34, flip: true });
        x += 34 + gap * 0.7;
      } else if (roll < 0.8) {
        out.push({ type: "saw", x, y: 120 + rand() * 180, r: 22 });
        x += 50 + gap;
      } else {
        // ceiling laser + mid saw combo
        out.push({ type: "spike", x, w: 34, h: 34, flip: true });
        out.push({ type: "saw", x: x + 70, y: 80 + rand() * 120, r: 20 });
        x += 120 + gap;
      }
    } else if (vehicle === "ball") {
      if (roll < 0.45) {
        out.push({ type: "spike", x, w: 34, h: 34 });
        x += 34 + gap * 0.8;
      } else if (roll < 0.85) {
        out.push({ type: "spike", x, w: 34, h: 34, flip: true });
        x += 34 + gap * 0.8;
      } else {
        out.push({ type: "spike", x, w: 34, h: 34 });
        out.push({ type: "spike", x: x + 60, w: 34, h: 34, flip: true });
        x += 100 + gap;
      }
    } else if (vehicle === "ufo") {
      if (roll < 0.55) {
        const count = 1 + Math.floor(rand() * (1 + difficulty * 2));
        for (let i = 0; i < count; i++) out.push({ type: "spike", x: x + i * 38, w: 34, h: 34 });
        x += count * 38 + gap;
      } else if (roll < 0.85) {
        out.push({ type: "spike", x, w: 34, h: 34, flip: true });
        x += 34 + gap;
      } else {
        out.push({ type: "saw", x, y: 100 + rand() * 160, r: 22 });
        x += 50 + gap;
      }
    } else {
      if (roll < 0.5) {
        out.push({ type: "spike", x, w: 30, h: 30 });
        x += 30 + gap * 0.6;
      } else if (roll < 0.9) {
        out.push({ type: "spike", x, w: 30, h: 30, flip: true });
        x += 30 + gap * 0.6;
      } else {
        out.push({ type: "saw", x, y: 120 + rand() * 120, r: 20 });
        x += 50 + gap * 0.7;
      }
    }
  }
}

const ALL_VEHICLES: Vehicle[] = ["cube", "ship", "ball", "ufo", "wave"];

export function buildLevel(idx: number): Level {
  const rand = mulberry32(1337 + idx * 7919);
  const difficulty = idx / 14;
  const speed = 8000 + idx * 22;
  const gravity = 2400 + idx * 70;
  const jump = 780 + idx * 14;
  const durationSec = 90;
  const length = speed * durationSec;
  const startingVehicle = VEHICLES[idx] ?? "cube";

  const obstacles: Obstacle[] = [];
  // Portals start appearing from level 2 (idx>=1) and get more frequent with idx
  const portalCount = idx < 1 ? 0 : Math.min(8, 2 + Math.floor(idx / 2));
  const switchPoints: number[] = [];
  for (let i = 1; i <= portalCount; i++) {
    switchPoints.push((length * i) / (portalCount + 1));
  }

  let currentVehicle = startingVehicle;
  let cursor = speed * 4; // empty runway
  for (const sp of switchPoints) {
    genSegment(currentVehicle, cursor, sp - 80, rand, difficulty, idx, obstacles);
    // pick a different vehicle
    let next = currentVehicle;
    let guard = 0;
    while (next === currentVehicle && guard++ < 10) {
      next = ALL_VEHICLES[Math.floor(rand() * ALL_VEHICLES.length)];
    }
    obstacles.push({ type: "portal", x: sp, vehicle: next });
    currentVehicle = next;
    cursor = sp + 80;
  }
  genSegment(currentVehicle, cursor, length - speed * 3, rand, difficulty, idx, obstacles);

  const palette = PALETTES[idx % PALETTES.length];
  return {
    index: idx,
    name: NAMES[idx] ?? `Level ${idx + 1}`,
    startingVehicle,
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

export const LEVELS: Level[] = Array.from({ length: 15 }, (_, i) => buildLevel(i));
