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
  ["#10b981", "#022c22", "#6ee7b7"],
  ["#7c3aed", "#1e1b4b", "#a78bfa"],
  ["#f472b6", "#500724", "#fda4af"],
  ["#0891b2", "#083344", "#22d3ee"],
  ["#000000", "#1a0000", "#ff0033"],
  ["#1a0033", "#000000", "#9333ea"],
  ["#330000", "#000000", "#ff1744"],
  ["#001a33", "#000000", "#00e5ff"],
  ["#1a1a00", "#000000", "#ffea00"],
  ["#000000", "#0a0a0a", "#ffffff"],
  ["#1a0000", "#000000", "#ff0040"],
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
  "Quantum Rift",
  "Eclipse Protocol",
  "Nebula Crusher",
  "Hyper Vortex",
  "Omega Annihilation",
  "Doom Cascade",
  "Inferno Abyss",
  "Chrono Shatter",
  "Singularity Collapse",
  "Absolute Zero",
  "Spike Hell",
  "Arrow Apocalypse",
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
  "ufo",
  "ship",
  "ball",
  "wave",
  "cube",
  "wave",
  "ship",
  "ufo",
  "ball",
  "wave",
  "cube",
  "wave",
];



// Level "flavor" tweaks density, gap and bias toward certain obstacle types.
export type Flavor = {
  // gap multiplier — <1 = tighter, >1 = roomier
  gapMul: number;
  // bias toward spike/block/saw mixes — values 0..1, weighted pick
  spikeBias: number;
  blockBias: number;
  sawBias: number;
  // extra patterns
  zigzag?: boolean;     // ball: alternating floor/ceiling spikes
  corridor?: boolean;   // ship/ufo: narrow saw corridors
  towers?: boolean;     // cube: tall block towers
  sawField?: boolean;   // many saws at varied heights
  laserGate?: boolean;  // paired floor+ceiling spikes you must thread
  rapid?: boolean;      // short gaps everywhere
};

const FLAVORS: Flavor[] = [
  { gapMul: 1.5, spikeBias: 0.7, blockBias: 0.2, sawBias: 0.1 },                                   // 0 tutorial
  { gapMul: 1.35, spikeBias: 0.3, blockBias: 0.1, sawBias: 0.6, corridor: true },                    // 1 ship corridor
  { gapMul: 1.3, spikeBias: 0.4, blockBias: 0.5, sawBias: 0.1, towers: true },                      // 2 block towers
  { gapMul: 1.25, spikeBias: 0.7, blockBias: 0.0, sawBias: 0.3, zigzag: true },                      // 3 ball zigzag
  { gapMul: 1.35, spikeBias: 0.4, blockBias: 0.1, sawBias: 0.5, sawField: true },                    // 4 ufo saw field
  { gapMul: 1.2, spikeBias: 0.55, blockBias: 0.35, sawBias: 0.1, rapid: true },                     // 5 cube rapid
  { gapMul: 1.6, spikeBias: 0.8, blockBias: 0.0, sawBias: 0.2 },                                    // 6 wave laser gates (eased)
  { gapMul: 1.25, spikeBias: 0.3, blockBias: 0.2, sawBias: 0.5, corridor: true, sawField: true },    // 7 ship saw maze
  { gapMul: 1.2, spikeBias: 0.8, blockBias: 0.0, sawBias: 0.2, zigzag: true, rapid: true },         // 8 ball rapid zigzag
  { gapMul: 1.4, spikeBias: 0.3, blockBias: 0.1, sawBias: 0.6, sawField: true, laserGate: true },   // 9 ufo gates
  { gapMul: 1.2, spikeBias: 0.6, blockBias: 0.1, sawBias: 0.3, rapid: true, laserGate: true },      // 10 wave inferno
  { gapMul: 1.2, spikeBias: 0.4, blockBias: 0.5, sawBias: 0.1, towers: true, rapid: true },         // 11 cube tower rush
  { gapMul: 1.2, spikeBias: 0.3, blockBias: 0.1, sawBias: 0.6, corridor: true, laserGate: true },   // 12 ship gauntlet
  { gapMul: 1.2, spikeBias: 0.7, blockBias: 0.1, sawBias: 0.2, zigzag: true, laserGate: true },     // 13 ball chaos
  { gapMul: 1.15, spikeBias: 0.4, blockBias: 0.2, sawBias: 0.4, sawField: true, laserGate: true, rapid: true }, // 14 apex
  { gapMul: 1.2, spikeBias: 0.5, blockBias: 0.2, sawBias: 0.3, corridor: true, sawField: true },                // 15 quantum rift
  { gapMul: 1.15, spikeBias: 0.6, blockBias: 0.1, sawBias: 0.3, zigzag: true, laserGate: true, rapid: true },   // 16 eclipse
  { gapMul: 1.1, spikeBias: 0.3, blockBias: 0.1, sawBias: 0.6, sawField: true, laserGate: true, rapid: true },  // 17 nebula crusher
  { gapMul: 1.05, spikeBias: 0.5, blockBias: 0.1, sawBias: 0.4, corridor: true, laserGate: true, rapid: true, zigzag: true }, // 18 hyper vortex
  { gapMul: 0.95, spikeBias: 0.5, blockBias: 0.1, sawBias: 0.4, sawField: true, laserGate: true, rapid: true, zigzag: true, corridor: true, towers: true }, // 19 OMEGA
  // === Hyper-hard final 5 ===
  { gapMul: 0.85, spikeBias: 0.5, blockBias: 0.1, sawBias: 0.4, sawField: true, laserGate: true, rapid: true, zigzag: true, corridor: true, towers: true }, // 20
  { gapMul: 0.8,  spikeBias: 0.6, blockBias: 0.1, sawBias: 0.3, sawField: true, laserGate: true, rapid: true, zigzag: true, corridor: true, towers: true }, // 21
  { gapMul: 0.75, spikeBias: 0.4, blockBias: 0.1, sawBias: 0.5, sawField: true, laserGate: true, rapid: true, zigzag: true, corridor: true, towers: true }, // 22
  { gapMul: 0.7,  spikeBias: 0.5, blockBias: 0.1, sawBias: 0.4, sawField: true, laserGate: true, rapid: true, zigzag: true, corridor: true, towers: true }, // 23
  { gapMul: 0.6,  spikeBias: 0.5, blockBias: 0.1, sawBias: 0.4, sawField: true, laserGate: true, rapid: true, zigzag: true, corridor: true, towers: true }, // 24 ABSOLUTE ZERO — insane
  // === Level 26 — SPIKE HELL: only spikes, hard ===
  { gapMul: 0.7, spikeBias: 1, blockBias: 0, sawBias: 0, rapid: true }, // 25 spikes only
  // === Level 27 — ARROW APOCALYPSE: wave only, all spikes, hyper mega hard ===
  { gapMul: 0.5, spikeBias: 1, blockBias: 0, sawBias: 0, rapid: true, laserGate: true }, // 26
];


function pickWeighted(rand: () => number, weights: number[]): number {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

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
  const f = FLAVORS[idx] ?? FLAVORS[FLAVORS.length - 1];
  const baseMinGap = Math.max(200, 420 - idx * 12);
  const baseMaxGap = Math.max(baseMinGap + 100, 700 - idx * 16);
  const minGap = baseMinGap * f.gapMul;
  const maxGap = baseMaxGap * f.gapMul;
  let altFlip = false; // for zigzag
  while (x < endX) {
    const gap = minGap + rand() * (maxGap - minGap);
    if (vehicle === "cube") {
      const pick = pickWeighted(rand, [f.spikeBias, f.blockBias, f.sawBias]);
      if (pick === 0) {
        const count = 1 + Math.floor(rand() * (1 + difficulty * 3 + (f.rapid ? 1 : 0)));
        for (let i = 0; i < count; i++) out.push({ type: "spike", x: x + i * 38, w: 34, h: 34 });
        x += count * 38 + gap * 1.2;
      } else if (pick === 1) {
        const stack = (f.towers ? 2 : 1) + Math.floor(rand() * (1 + difficulty * 2 + (f.towers ? 1 : 0)));
        const bw = 40;
        for (let i = 0; i < stack; i++) out.push({ type: "block", x, y: i * 40, w: bw, h: 40 });
        if (rand() < 0.4 + difficulty * 0.3) out.push({ type: "spike", x: x + 3, w: 34, h: 30 });
        x += bw + gap * 1.2;
      } else {
        out.push({ type: "saw", x, y: 60 + rand() * 50, r: 22 });
        x += 70 + gap * 1.2;
      }
    } else if (vehicle === "ship") {
      if (f.corridor && rand() < 0.5) {
        // narrow corridor: ceiling spike + low saw
        out.push({ type: "spike", x, w: 34, h: 34, flip: true });
        out.push({ type: "saw", x: x + 50, y: 40 + rand() * 60, r: 20 });
        x += 140 + gap * 0.9;
      } else if (f.laserGate && rand() < 0.35) {
        out.push({ type: "spike", x, w: 34, h: 34, flip: true });
        out.push({ type: "spike", x, w: 34, h: 34 });
        x += 130 + gap;
      } else {
        const pick = pickWeighted(rand, [f.spikeBias, 0.0001, f.sawBias]);
        if (pick === 0) {
          out.push({ type: "spike", x, w: 34, h: 34, flip: true });
          x += 34 + gap * 0.9;
        } else {
          out.push({ type: "saw", x, y: 120 + rand() * (f.sawField ? 220 : 180), r: 22 });
          x += 70 + gap * 1.1;
        }
      }
    } else if (vehicle === "ball") {
      if (f.zigzag) {
        out.push({ type: "spike", x, w: 34, h: 34, flip: altFlip });
        altFlip = !altFlip;
        x += 34 + gap * (f.rapid ? 0.7 : 1.0);
      } else if (f.laserGate && rand() < 0.3) {
        out.push({ type: "spike", x, w: 34, h: 34 });
        out.push({ type: "spike", x: x + 60, w: 34, h: 34, flip: true });
        x += 180 + gap;
      } else {
        const roll = rand();
        if (roll < 0.45) {
          out.push({ type: "spike", x, w: 34, h: 34 });
          x += 34 + gap * 1.0;
        } else if (roll < 0.85) {
          out.push({ type: "spike", x, w: 34, h: 34, flip: true });
          x += 34 + gap * 1.0;
        } else {
          out.push({ type: "saw", x, y: 60 + rand() * 100, r: 22 });
          x += 70 + gap * 1.1;
        }
      }
    } else if (vehicle === "ufo") {
      if (f.sawField && rand() < 0.5) {
        const c = 1 + Math.floor(rand() * 2);
        for (let i = 0; i < c; i++) out.push({ type: "saw", x: x + i * 70, y: 60 + rand() * 220, r: 20 });
        x += c * 70 + gap * 1.1;
      } else if (f.laserGate && rand() < 0.3) {
        out.push({ type: "spike", x, w: 34, h: 34 });
        out.push({ type: "spike", x: x + 10, w: 34, h: 34, flip: true });
        x += 150 + gap;
      } else {
        const pick = pickWeighted(rand, [f.spikeBias, 0.0001, f.sawBias]);
        if (pick === 0) {
          const count = 1 + Math.floor(rand() * (1 + difficulty * 2));
          for (let i = 0; i < count; i++) out.push({ type: "spike", x: x + i * 38, w: 34, h: 34 });
          x += count * 38 + gap * 1.1;
        } else {
          out.push({ type: "saw", x, y: 100 + rand() * 160, r: 22 });
          x += 70 + gap * 1.1;
        }
      }
    } else {
      // wave
      if (f.laserGate && rand() < 0.4) {
        out.push({ type: "spike", x, w: 30, h: 30 });
        out.push({ type: "spike", x: x + 50, w: 30, h: 30, flip: true });
        x += 160 + gap * 0.9;
      } else if (f.rapid) {
        out.push({ type: "spike", x, w: 30, h: 30, flip: rand() < 0.5 });
        x += 30 + gap * 0.6;
      } else {
        const roll = rand();
        if (roll < 0.5) {
          out.push({ type: "spike", x, w: 30, h: 30 });
          x += 30 + gap * 0.8;
        } else if (roll < 0.9) {
          out.push({ type: "spike", x, w: 30, h: 30, flip: true });
          x += 30 + gap * 0.8;
        } else {
          out.push({ type: "saw", x, y: 120 + rand() * 120, r: 20 });
          x += 70 + gap * 0.9;
        }
      }
    }
  }
}

const ALL_VEHICLES: Vehicle[] = ["cube", "ship", "ball", "ufo", "wave"];

export function buildLevel(idx: number): Level {
  const rand = mulberry32(1337 + idx * 7919);
  const difficulty = idx / 26;
  const speed = 380 + idx * 16;
  const gravity = 2400 + idx * 70;
  const jump = 780 + idx * 14;

  const durationSec = 90;
  const length = speed * durationSec;
  const startingVehicle = VEHICLES[idx] ?? "cube";

  const obstacles: Obstacle[] = [];
  // Portals start appearing from level 2 (idx>=1) and get more frequent with idx.
  // Level 26 (idx 25) — "Spike Hell" — locked to cube, no portals, spikes only.
  // Level 27 (idx 26) — "Arrow Apocalypse" — locked to wave, no portals, spikes only.
  const portalCount = idx === 25 || idx === 26 ? 0 : idx < 1 ? 0 : Math.min(8, 2 + Math.floor(idx / 2));
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

export const LEVELS: Level[] = Array.from({ length: 27 }, (_, i) => buildLevel(i));
