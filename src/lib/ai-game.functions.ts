import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Level, Obstacle, Vehicle } from "@/lib/game-engine";

const vehicles = ["cube", "ship", "ball", "ufo", "wave"] as const;
const themes = ["neon", "void", "solar", "frost", "toxic", "plasma"] as const;

type Theme = (typeof themes)[number];

const aiLevelInput = z.object({
  prompt: z.string().max(80).optional().default("neon rush"),
  difficulty: z.enum(["easy", "normal", "hard", "rage"]).default("normal"),
});

const coachInput = z.object({
  levelName: z.string().max(80),
  vehicle: z.enum(vehicles),
  percent: z.number().min(0).max(100),
  attempts: z.number().int().min(1).max(9999),
  bestPercent: z.number().min(0).max(100),
});

const paletteByTheme: Record<Theme, [string, string, string]> = {
  neon: ["#0891b2", "#111827", "#22d3ee"],
  void: ["#1e1b4b", "#030712", "#a855f7"],
  solar: ["#f97316", "#451a03", "#fde047"],
  frost: ["#0f766e", "#082f49", "#67e8f9"],
  toxic: ["#166534", "#052e16", "#a3e635"],
  plasma: ["#86198f", "#1e1b4b", "#f0abfc"],
};

const hashText = (text: string) => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number) => {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = <T,>(items: readonly T[], rand: () => number) => items[Math.floor(rand() * items.length)] ?? items[0];

const difficultyConfig = {
  easy: { idx: 4, speed: 430, gap: 760, portals: 1, duration: 48 },
  normal: { idx: 10, speed: 540, gap: 620, portals: 2, duration: 55 },
  hard: { idx: 18, speed: 690, gap: 490, portals: 3, duration: 62 },
  rage: { idx: 26, speed: 820, gap: 390, portals: 4, duration: 70 },
};

const sanitizeHex = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
};

const sanitizeVehicle = (value: unknown, fallback: Vehicle): Vehicle => {
  return vehicles.includes(value as Vehicle) ? (value as Vehicle) : fallback;
};

const sanitizeTheme = (value: unknown, fallback: Theme): Theme => {
  return themes.includes(value as Theme) ? (value as Theme) : fallback;
};

async function askGeminiForPlan(prompt: string, difficulty: keyof typeof difficultyConfig) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Return only compact JSON for a rhythm runner level. " +
                  "Schema: {\"name\":\"short title\",\"theme\":\"neon|void|solar|frost|toxic|plasma\",\"vehicle\":\"cube|ship|ball|ufo|wave\",\"density\":0.2-1,\"hazard\":\"spikes|saws|mixed|gates\"}. " +
                  `Player prompt: ${prompt}. Difficulty: ${difficulty}.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 160,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) return null;
  const json = await response.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") return null;

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildAiLevel(input: z.infer<typeof aiLevelInput>, plan: Record<string, unknown> | null): Level {
  const seed = hashText(`${input.prompt}:${input.difficulty}:${JSON.stringify(plan ?? {})}`);
  const rand = mulberry32(seed);
  const config = difficultyConfig[input.difficulty];
  const fallbackTheme = pick(themes, rand);
  const theme = sanitizeTheme(plan?.theme, fallbackTheme);
  const palette = paletteByTheme[theme];
  const startingVehicle = sanitizeVehicle(plan?.vehicle, pick(vehicles, rand));
  const density = Math.max(0.2, Math.min(1, Number(plan?.density) || 0.55));
  const hazard = typeof plan?.hazard === "string" ? plan.hazard : "mixed";
  const name =
    typeof plan?.name === "string" && plan.name.trim().length > 0
      ? plan.name.trim().slice(0, 28)
      : `AI ${theme.toUpperCase()} RIFT`;

  const speed = config.speed;
  const durationSec = config.duration;
  const length = speed * durationSec;
  const obstacles: Obstacle[] = [];
  const portalEvery = length / (config.portals + 1);

  for (let i = 1; i <= config.portals; i++) {
    obstacles.push({ type: "portal", x: portalEvery * i, vehicle: pick(vehicles, rand) });
  }

  let x = speed * 3.5;
  let flip = false;
  while (x < length - speed * 2.5) {
    const gap = config.gap * (1.15 - density * 0.35) + rand() * 220;
    const roll = rand();
    const useSaws = hazard === "saws" || (hazard === "mixed" && roll > 0.62);
    const useGates = hazard === "gates" || (input.difficulty === "rage" && roll > 0.72);

    if (useGates && startingVehicle !== "cube") {
      obstacles.push({ type: "spike", x, w: 32, h: 32 });
      obstacles.push({ type: "spike", x: x + 58, w: 32, h: 32, flip: true });
      x += 120 + gap * 0.85;
    } else if (useSaws && startingVehicle !== "cube") {
      obstacles.push({ type: "saw", x, y: 80 + rand() * 220, r: 18 + Math.round(rand() * 8) });
      x += 80 + gap;
    } else if (startingVehicle === "cube" && roll > 0.7) {
      const stack = input.difficulty === "easy" ? 1 : 1 + Math.floor(rand() * 3);
      for (let i = 0; i < stack; i++) {
        obstacles.push({ type: "block", x, y: i * 40, w: 42, h: 40 });
      }
      if (input.difficulty !== "easy" && rand() > 0.5) {
        obstacles.push({ type: "spike", x: x + 4, w: 32, h: 28 });
      }
      x += 48 + gap;
    } else {
      const count = 1 + Math.floor(rand() * (input.difficulty === "rage" ? 3 : 2));
      for (let i = 0; i < count; i++) {
        obstacles.push({ type: "spike", x: x + i * 38, w: 32, h: 32, flip: startingVehicle === "ball" ? flip : undefined });
        flip = !flip;
      }
      x += count * 38 + gap;
    }
  }

  return {
    index: 90 + (seed % 1000),
    name,
    startingVehicle,
    speed,
    gravity: 2450 + config.idx * 55,
    jump: 800 + config.idx * 8,
    bgFrom: sanitizeHex(plan?.bgFrom, palette[0]),
    bgTo: sanitizeHex(plan?.bgTo, palette[1]),
    accent: sanitizeHex(plan?.accent, palette[2]),
    durationSec,
    obstacles,
    length,
  };
}

export const generateAiLevel = createServerFn({ method: "POST" })
  .inputValidator((input) => aiLevelInput.parse(input))
  .handler(async ({ data }) => {
    const plan = await askGeminiForPlan(data.prompt, data.difficulty).catch(() => null);
    return buildAiLevel(data, plan);
  });

export const getAiCoachTip = createServerFn({ method: "POST" })
  .inputValidator((input) => coachInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text:
                      "You are an arcade rhythm-runner coach. Give one short, practical tip, max 18 words. " +
                      `Level: ${data.levelName}. Vehicle: ${data.vehicle}. Death percent: ${data.percent}. Attempts: ${data.attempts}. Best percent: ${data.bestPercent}.`,
                  },
                ],
              },
            ],
            generationConfig: { temperature: 0.7, maxOutputTokens: 60 },
          }),
        },
      ).catch(() => null);

      if (response?.ok) {
        const json = await response.json().catch(() => null);
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text === "string" && text.trim()) {
          return text.trim().replace(/^["']|["']$/g, "").slice(0, 140);
        }
      }
    }

    if (data.percent < 20) return "Focus on the first pattern. Tap later and keep your rhythm steady.";
    if (data.vehicle === "ship") return "Use tiny holds instead of long presses. Smooth flight beats big corrections.";
    if (data.vehicle === "wave") return "Feather the input quickly. Wide zigzags make the next gate harder.";
    if (data.vehicle === "ball") return "Flip only after clearing the spike tip. Early flips cause ceiling crashes.";
    return "Watch the next hazard, not your character. Let the rhythm cue your jump.";
  });
