import { useCallback, useEffect, useRef, useState } from "react";
import { LEVELS, CEIL_HEIGHT, type Level, type Obstacle, type Vehicle } from "@/lib/game-engine";

const GROUND_H = 80;
const PLAYER_SIZE = 40;
const PLAYER_X = 140;

type GameState = "menu" | "playing" | "dead" | "won";

export interface Skin {
  id: string;
  name: string;
  tagline: string;
  primary: string;   // body color
  secondary: string; // highlight
  glow: string;      // outer glow / shadow
  price: number;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";
}

export const SKINS: Skin[] = [
  { id: "default",  name: "Prism",      tagline: "Default refraction",         primary: "#22d3ee", secondary: "#ffffff", glow: "#22d3ee", price: 0,    rarity: "COMMON" },
  { id: "ember",    name: "Ember",      tagline: "Forged in molten neon",      primary: "#f97316", secondary: "#fde047", glow: "#ef4444", price: 350,  rarity: "COMMON" },
  { id: "toxic",    name: "Toxic",      tagline: "Bio-luminescent ooze",       primary: "#84cc16", secondary: "#bef264", glow: "#22c55e", price: 600,  rarity: "RARE" },
  { id: "abyss",    name: "Abyss",      tagline: "Bottled deep-sea pressure",  primary: "#0ea5e9", secondary: "#67e8f9", glow: "#1e3a8a", price: 900,  rarity: "RARE" },
  { id: "rose",     name: "Rose Quartz",tagline: "Crystalline pink halo",      primary: "#ec4899", secondary: "#fbcfe8", glow: "#f43f5e", price: 1400, rarity: "EPIC" },
  { id: "void",     name: "Void",       tagline: "Light bends around it",      primary: "#1f2937", secondary: "#a855f7", glow: "#a855f7", price: 2200, rarity: "EPIC" },
  { id: "solar",    name: "Solar Flare",tagline: "Plasma forged outside time", primary: "#facc15", secondary: "#ffffff", glow: "#f97316", price: 3500, rarity: "LEGENDARY" },
  { id: "aurora",   name: "Aurora",     tagline: "Polar sky on glass",         primary: "#a855f7", secondary: "#22d3ee", glow: "#ec4899", price: 5500, rarity: "LEGENDARY" },
  { id: "obsidian", name: "Obsidian",   tagline: "Edge of the singularity",    primary: "#0b1220", secondary: "#f5f5f5", glow: "#ffffff", price: 9000, rarity: "MYTHIC" },
];

const RARITY_COLOR: Record<Skin["rarity"], string> = {
  COMMON: "#94a3b8",
  RARE: "#22d3ee",
  EPIC: "#a855f7",
  LEGENDARY: "#facc15",
  MYTHIC: "#f43f5e",
};

interface Props {
  level: Level;
  bestAttempts: number | null;
  skin: Skin;
  onExit: () => void;
  onWin: (info: { attempts: number; reward: number; isNewRecord: boolean }) => void;
}

const BASE_REWARD = 50;
const RECORD_BONUS = 100;
const computeReward = (levelIndex: number, attempts: number, prevBest: number | null) => {
  const base = BASE_REWARD * (levelIndex + 1);
  const isNewRecord = prevBest === null || attempts < prevBest;
  const bonus = isNewRecord ? RECORD_BONUS * (levelIndex + 1) : 0;
  // Extra starter bonus for first two levels
  const starterBonus = levelIndex < 2 ? 200 : 0;
  return { reward: base + bonus + starterBonus, isNewRecord };
};


const VEHICLE_LABELS: Record<Vehicle, string> = {
  cube: "GEM",
  ship: "ROCKET",
  ball: "STAR",
  ufo: "RHOMB",
  wave: "BOLT",
};

function Game({ level, bestAttempts, skin, onExit, onWin }: Props) {
  const [winInfo, setWinInfo] = useState<{ reward: number; isNewRecord: boolean } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>("playing");
  const [, force] = useState(0);
  const [progress, setProgress] = useState(0);
  const [attempts, setAttempts] = useState(1);
  const attemptsRef = useRef(1);
  const bumpAttempts = useCallback(() => {
    attemptsRef.current += 1;
    setAttempts(attemptsRef.current);
  }, []);

  const [currentVehicle, setCurrentVehicle] = useState<Vehicle>(level.startingVehicle);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let vehicle: Vehicle = level.startingVehicle;
    const hasCeil = () => true;
    const consumedPortals = new Set<number>();
    

    const switchVehicle = (next: Vehicle) => {
      vehicle = next;
      vy = 0;
      gravityDir = 1;
      setCurrentVehicle(next);
      // give a little vertical safety on switch into flying mode
      if (hasCeil() && py < 20) py = 60;
    };

    // World state
    let scrollX = 0;
    let py = hasCeil() ? 60 : 0; // y above ground (positive = up)
    let vy = 0;
    let onGround = true;
    let onCeiling = false;
    let gravityDir = 1; // 1 = down (toward ground), -1 = up (toward ceiling) — used by ball
    let rotation = 0;
    let last = performance.now();
    let running = true;
    let inputHeld = false;
    let prevHeld = false;

    

    const reset = () => {
      scrollX = 0;
      vy = 0;
      onGround = true;
      onCeiling = false;
      gravityDir = 1;
      rotation = 0;
      vehicle = level.startingVehicle;
      setCurrentVehicle(level.startingVehicle);
      consumedPortals.clear();
      py = hasCeil() ? 60 : 0;
      stateRef.current = "playing";
      setProgress(0);
      force((n) => n + 1);
    };

    const die = () => {
      if (stateRef.current !== "playing") return;
      stateRef.current = "dead";
      force((n) => n + 1);
    };

    const win = () => {
      if (stateRef.current !== "playing") return;
      stateRef.current = "won";
      const a = attemptsRef.current;
      const { reward, isNewRecord } = computeReward(level.index, a, bestAttempts);
      setWinInfo({ reward, isNewRecord });
      force((n) => n + 1);
      onWin({ attempts: a, reward, isNewRecord });
    };


    const handlePress = () => {
      inputHeld = true;
      if (stateRef.current === "dead") {
        bumpAttempts();
        reset();
        return;
      }
      if (stateRef.current !== "playing") return;

      if (vehicle === "cube") {
        if (onGround) {
          vy = level.jump;
          onGround = false;
        }
      } else if (vehicle === "ball") {
        if (onGround || onCeiling) {
          gravityDir *= -1;
          onGround = false;
          onCeiling = false;
          vy = 0;
        }
      } else if (vehicle === "ufo") {
        // tap-only flap (handled on press edge below too)
        vy = level.jump * 0.85;
      }
      // ship / wave use hold state in the frame loop
    };

    const handleRelease = () => {
      inputHeld = false;
    };

    const keyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        if (!prevHeld) handlePress();
        prevHeld = true;
      } else if (e.code === "Escape") {
        onExit();
      }
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        prevHeld = false;
        handleRelease();
      }
    };
    const pointerDown = () => handlePress();
    const pointerUp = () => handleRelease();

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointerup", pointerUp);

    // Collision: returns true on lethal hit, "land" if landed on block top
    const collides = (o: Obstacle, groundY: number) => {
      const px1 = PLAYER_X;
      const px2 = PLAYER_X + PLAYER_SIZE;
      const py1 = groundY - py - PLAYER_SIZE; // top in screen coords
      const py2 = groundY - py; // bottom

      if (o.type === "spike") {
        const ox = o.x - scrollX;
        if (ox + o.w < px1 || ox > px2) return false;
        let oy1: number, oy2: number;
        if (o.flip) {
          // ceiling spike, hangs down from top of play area
          const ceilY = groundY - CEIL_HEIGHT;
          oy1 = ceilY;
          oy2 = ceilY + o.h;
        } else {
          oy2 = groundY;
          oy1 = groundY - o.h;
        }
        const ix1 = Math.max(px1, ox) + 4;
        const ix2 = Math.min(px2, ox + o.w) - 4;
        if (ix1 >= ix2) return false;
        return py2 > oy1 + 4 && py1 < oy2 - 4;
      }
      if (o.type === "block") {
        const ox = o.x - scrollX;
        const ox2 = ox + o.w;
        const oy2 = groundY - o.y;
        const oy1 = oy2 - o.h;
        if (px2 <= ox + 2 || px1 >= ox2 - 2) return false;
        if (py2 <= oy1 + 2 || py1 >= oy2 - 2) return false;
        if (vy <= 0 && py1 < oy1 && py2 > oy1 && py2 - oy1 < 18) {
          return "land" as const;
        }
        return true;
      }
      if (o.type === "saw") {
        const ox = o.x - scrollX;
        const oy = groundY - o.y - o.r;
        const cx = Math.max(px1, Math.min(ox, px2));
        const cy = Math.max(py1, Math.min(oy, py2));
        const dx = ox - cx;
        const dy = oy - cy;
        return dx * dx + dy * dy < (o.r - 4) * (o.r - 4);
      }
      return false;
    };

    const frame = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const groundY = h - GROUND_H;
      const ceilingPy = CEIL_HEIGHT - PLAYER_SIZE; // max py when ceiling exists

      if (stateRef.current === "playing") {
        scrollX += level.speed * dt;

        // ----- VEHICLE PHYSICS -----
        if (vehicle === "cube") {
          vy -= level.gravity * dt;
          py += vy * dt;
        } else if (vehicle === "ship") {
          const thrust = level.gravity * 0.9;
          vy += (inputHeld ? thrust : -thrust) * dt;
          vy = Math.max(-700, Math.min(700, vy));
          py += vy * dt;
        } else if (vehicle === "ball") {
          // gravity direction can be flipped
          vy -= level.gravity * 0.85 * dt * gravityDir;
          py += vy * dt;
        } else if (vehicle === "ufo") {
          vy -= level.gravity * 0.9 * dt;
          py += vy * dt;
        } else if (vehicle === "wave") {
          const v = level.speed; // 45° travel
          vy = inputHeld ? v : -v;
          py += vy * dt;
        }

        // ----- BLOCK LANDING (cube only) -----
        let landedOnBlock = false;
        if (vehicle === "cube") {
          for (const o of level.obstacles) {
            if (o.type !== "block") continue;
            const ox = o.x - scrollX;
            if (ox > w || ox + o.w < 0) continue;
            const px1 = PLAYER_X;
            const px2 = PLAYER_X + PLAYER_SIZE;
            const blockTop = o.y + o.h;
            if (px2 > ox + 2 && px1 < ox + o.w - 2) {
              const prevBottom = py - vy * dt;
              if (vy <= 0 && prevBottom >= blockTop - 1 && py <= blockTop + 1) {
                py = blockTop;
                vy = 0;
                onGround = true;
                landedOnBlock = true;
              }
            }
          }
        }

        // ----- GROUND / CEILING CLAMPS -----
        onCeiling = false;
        if (!landedOnBlock) {
          if (py <= 0) {
            py = 0;
            vy = 0;
            onGround = true;
          } else {
            onGround = false;
          }
        }
        if (hasCeil() && py >= ceilingPy) {
          py = ceilingPy;
          vy = 0;
          onCeiling = true;
        }

        // ----- ROTATION -----
        if (vehicle === "cube") {
          if (!onGround) rotation += dt * 6;
          else rotation = Math.round(rotation / (Math.PI / 2)) * (Math.PI / 2);
        } else if (vehicle === "ball") {
          rotation += dt * 8 * gravityDir;
        } else if (vehicle === "ship") {
          rotation = Math.max(-0.5, Math.min(0.5, -vy / 700));
        } else if (vehicle === "wave") {
          rotation = inputHeld ? -Math.PI / 4 : Math.PI / 4;
        } else {
          rotation = 0;
        }

        // ----- PORTALS -----
        for (let i = 0; i < level.obstacles.length; i++) {
          const o = level.obstacles[i];
          if (o.type !== "portal") continue;
          if (consumedPortals.has(i)) continue;
          const ox = o.x - scrollX;
          if (ox <= PLAYER_X + PLAYER_SIZE / 2 && ox > PLAYER_X - 200) {
            consumedPortals.add(i);
            switchVehicle(o.vehicle);
          }
        }

        // ----- COLLISIONS -----
        for (const o of level.obstacles) {
          if (o.type === "portal") continue;
          const ox = (o as { x: number }).x - scrollX;
          if (ox > w + 60 || ox < -120) continue;
          const r = collides(o, groundY);
          if (r === true) {
            die();
            break;
          }
        }

        const prog = Math.min(1, scrollX / level.length);
        setProgress(prog);
        if (prog >= 1) win();
      }

      // ----- RENDER -----
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, level.bgFrom);
      grad.addColorStop(1, level.bgTo);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // parallax stars
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 137 - scrollX * 0.2) % (w + 40) + w + 40) % (w + 40);
        const sy = (i * 53) % (groundY - 40);
        ctx.fillRect(sx, sy, 2, 2);
      }

      // ground
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, groundY, w, GROUND_H);
      ctx.strokeStyle = level.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(w, groundY);
      ctx.stroke();

      // ceiling wall for all levels
      {
        const ceilY = groundY - CEIL_HEIGHT;
        // solid base
        ctx.fillStyle = "rgba(10,10,15,0.85)";
        ctx.fillRect(0, 0, w, ceilY);
        // hazard stripes
        ctx.fillStyle = "rgba(239,68,68,0.25)";
        const stripeW = 20;
        const offset = scrollX % (stripeW * 2);
        for (let sx = -offset; sx < w; sx += stripeW * 2) {
          ctx.fillRect(sx, 0, stripeW, ceilY);
        }
        // top danger line
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, ceilY);
        ctx.lineTo(w, ceilY);
        ctx.stroke();
        ctx.shadowBlur = 0;
        // inner accent
        ctx.strokeStyle = level.accent;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, ceilY - 3);
        ctx.lineTo(w, ceilY - 3);
        ctx.stroke();
      }

      // ground grid
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      const offset = scrollX % gridSize;
      for (let x = -offset; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // obstacles
      for (const o of level.obstacles) {
        const ox = (o as { x: number }).x - scrollX;
        if (ox > w + 60 || ox < -120) continue;
        if (o.type === "spike") {
          // MINI LASER EMITTER
          const flip = !!o.flip;
          const baseY = flip ? groundY - CEIL_HEIGHT : groundY;
          const tipY = flip ? baseY + o.h : baseY - o.h;
          const cx = ox + o.w / 2;
          // Emitter base
          ctx.fillStyle = "#1f2937";
          ctx.strokeStyle = "rgba(0,0,0,0.7)";
          ctx.lineWidth = 2;
          const baseH = 6;
          ctx.fillRect(ox, flip ? baseY - 1 : baseY - baseH + 1, o.w, baseH);
          ctx.strokeRect(ox, flip ? baseY - 1 : baseY - baseH + 1, o.w, baseH);
          // Glowing emitter dot
          ctx.fillStyle = level.accent;
          ctx.shadowColor = level.accent;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(cx, flip ? baseY + 2 : baseY - baseH / 2 - 1, 2.5, 0, Math.PI * 2);
          ctx.fill();
          // Laser beam (pulsing width via scrollX)
          const pulse = 0.6 + Math.abs(Math.sin(scrollX * 0.04)) * 0.4;
          const beamW = 4 * pulse;
          const beamGrad = ctx.createLinearGradient(cx - beamW, 0, cx + beamW, 0);
          beamGrad.addColorStop(0, "rgba(255,255,255,0)");
          beamGrad.addColorStop(0.5, "#ffffff");
          beamGrad.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = beamGrad;
          ctx.fillRect(cx - beamW, Math.min(baseY, tipY), beamW * 2, Math.abs(tipY - baseY));
          // Outer glow halo
          ctx.fillStyle = level.accent + "55";
          ctx.fillRect(cx - beamW * 2, Math.min(baseY, tipY), beamW * 4, Math.abs(tipY - baseY));
          // Tip burst
          ctx.beginPath();
          ctx.arc(cx, tipY, 3 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (o.type === "block") {
          const by = groundY - o.y - o.h;
          ctx.fillStyle = level.accent;
          ctx.fillRect(ox, by, o.w, o.h);
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.lineWidth = 2;
          ctx.strokeRect(ox, by, o.w, o.h);
        } else if (o.type === "saw") {
          const cx = ox;
          const cy = groundY - o.y - o.r;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(scrollX * 0.05);
          ctx.fillStyle = "#e5e7eb";
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            ctx.lineTo(Math.cos(a) * o.r, Math.sin(a) * o.r);
            const a2 = a + Math.PI / 8;
            ctx.lineTo(Math.cos(a2) * (o.r * 0.7), Math.sin(a2) * (o.r * 0.7));
          }
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#1f2937";
          ctx.beginPath();
          ctx.arc(0, 0, o.r * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (o.type === "portal") {
          // Vertical portal gate spanning play area
          const topY = groundY - CEIL_HEIGHT;
          const colorMap: Record<Vehicle, string> = {
            cube: "#fbbf24",
            ship: "#ec4899",
            ball: "#22d3ee",
            ufo: "#a855f7",
            wave: "#84cc16",
          };
          const c = colorMap[o.vehicle];
          const grd = ctx.createLinearGradient(ox, 0, ox + 40, 0);
          grd.addColorStop(0, "rgba(255,255,255,0)");
          grd.addColorStop(0.5, c);
          grd.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = grd;
          ctx.fillRect(ox - 4, topY, 48, CEIL_HEIGHT);
          ctx.strokeStyle = c;
          ctx.lineWidth = 3;
          ctx.strokeRect(ox + 4, topY + 4, 32, CEIL_HEIGHT - 8);
          // label
          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 11px system-ui";
          ctx.textAlign = "center";
          ctx.fillText(VEHICLE_LABELS[o.vehicle], ox + 20, topY + CEIL_HEIGHT / 2);
        }
      }

      // player
      const cy = groundY - py - PLAYER_SIZE / 2;
      ctx.save();
      ctx.translate(PLAYER_X + PLAYER_SIZE / 2, cy);
      ctx.rotate(rotation);

      const pg = ctx.createLinearGradient(-20, -20, 20, 20);
      pg.addColorStop(0, "#ffffff");
      pg.addColorStop(1, level.accent);
      ctx.fillStyle = pg;
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 3;

      const s = PLAYER_SIZE / 2;
      // Shared shadow + gradient helper
      const pgrad = ctx.createRadialGradient(-s * 0.4, -s * 0.5, 2, 0, 0, s * 1.8);
      pgrad.addColorStop(0, skin.secondary);
      pgrad.addColorStop(0.3, skin.primary);
      pgrad.addColorStop(1, "#0b1220");
      ctx.fillStyle = pgrad;
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = skin.glow;
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;

      if (vehicle === "cube") {
        // HEXAGONAL GEM
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 2;
          const x = Math.cos(a) * s;
          const y = Math.sin(a) * s;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.stroke();
        // inner facet lines
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * s * 0.85, Math.sin(a) * s * 0.85);
          ctx.stroke();
        }
      } else if (vehicle === "ship") {
        // PENTAGON ROCKET pointing right
        ctx.beginPath();
        ctx.moveTo(s, 0);
        ctx.lineTo(s * 0.2, -s * 0.9);
        ctx.lineTo(-s, -s * 0.6);
        ctx.lineTo(-s, s * 0.6);
        ctx.lineTo(s * 0.2, s * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(s * 0.15, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (vehicle === "ball") {
        // 5-POINT STAR
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? s : s * 0.45;
          const a = (Math.PI / 5) * i - Math.PI / 2;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.stroke();
      } else if (vehicle === "ufo") {
        // DIAMOND (rhombus)
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.stroke();
        // crossbar facets
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-s, 0);
        ctx.lineTo(s, 0);
        ctx.moveTo(0, -s);
        ctx.lineTo(0, s);
        ctx.stroke();
      } else if (vehicle === "wave") {
        // LIGHTNING BOLT
        ctx.beginPath();
        ctx.moveTo(-s * 0.2, -s);
        ctx.lineTo(s * 0.6, -s * 0.2);
        ctx.lineTo(s * 0.05, -s * 0.05);
        ctx.lineTo(s * 0.5, s);
        ctx.lineTo(-s * 0.6, s * 0.1);
        ctx.lineTo(-s * 0.05, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.stroke();
      }
      ctx.restore();

      // wave trail
      if (vehicle === "wave" && stateRef.current === "playing") {
        ctx.strokeStyle = `${level.accent}66`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(PLAYER_X, cy);
        ctx.lineTo(PLAYER_X - 60, cy + (inputHeld ? 60 : -60));
        ctx.stroke();
      }

      if (stateRef.current === "dead") {
        ctx.fillStyle = "rgba(239,68,68,0.18)";
        ctx.fillRect(0, 0, w, h);
      }

      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    return () => {
      running = false;
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointerup", pointerUp);
    };
  }, [level, skin, onExit, onWin]);

  const state = stateRef.current;

  const hint =
    currentVehicle === "cube"
      ? "TAP / SPACE — JUMP"
      : currentVehicle === "ship"
      ? "HOLD — FLY UP · RELEASE — FALL"
      : currentVehicle === "ball"
      ? "TAP — FLIP GRAVITY"
      : currentVehicle === "ufo"
      ? "TAP IN AIR — FLAP"
      : "HOLD — UP · RELEASE — DOWN";

  return (
    <div className="fixed inset-0 bg-black">
      <canvas ref={canvasRef} className="w-full h-full block touch-none" />

      <div className="absolute top-0 left-0 right-0 p-4 flex items-center gap-4 text-white">
        <button
          onClick={onExit}
          className="px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 backdrop-blur text-sm font-bold tracking-wider"
        >
          ← MENU
        </button>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-widest opacity-70">
            Level {level.index + 1} — {level.name}
            <span className="ml-2 px-2 py-0.5 rounded bg-white/15 text-[10px]">
              {VEHICLE_LABELS[currentVehicle]}
            </span>
          </div>
          <div className="h-2 mt-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress * 100}%`,
                background: `linear-gradient(90deg, ${level.bgFrom}, ${level.accent})`,
              }}
            />
          </div>
        </div>
        <div className="text-sm font-bold opacity-80">
          {Math.floor(progress * 100)}%
        </div>
        <div className="text-sm font-bold opacity-80">ATTEMPT {attempts}</div>
      </div>

      {state === "dead" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-6xl font-black text-red-500 tracking-widest drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]">
              CRASHED
            </div>
            <div className="mt-2 text-white/80 text-sm tracking-widest">
              TAP / SPACE TO RETRY
            </div>
          </div>
        </div>
      )}

      {state === "won" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-center pointer-events-auto">
            <div className="text-6xl font-black tracking-widest" style={{ color: level.accent }}>
              LEVEL COMPLETE
            </div>
            {winInfo && (
              <div className="mt-4 space-y-1">
                {winInfo.isNewRecord && (
                  <div className="text-yellow-300 font-bold tracking-[0.3em] text-sm animate-pulse">
                    ★ NEW RECORD · {attempts} {attempts === 1 ? "ATTEMPT" : "ATTEMPTS"} ★
                  </div>
                )}
                <div className="text-white text-2xl font-black tracking-widest">
                  +{winInfo.reward} ◆ PRISMS
                </div>
                {bestAttempts !== null && !winInfo.isNewRecord && (
                  <div className="text-white/60 text-xs tracking-widest">
                    BEST: {bestAttempts} · BEAT IT FOR BONUS
                  </div>
                )}
              </div>
            )}
            <button
              onClick={onExit}
              className="mt-6 px-6 py-3 rounded-lg bg-white text-black font-bold tracking-widest hover:scale-105 transition"
            >
              CONTINUE →
            </button>
          </div>
        </div>
      )}


      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs tracking-widest">
        {hint}
      </div>
    </div>
  );
}

export default function GeometryGame() {
  const [screen, setScreen] = useState<"intro" | "levels" | "shop" | "playing">("intro");
  const [selected, setSelected] = useState<number | null>(null);
  // SSR-safe defaults — hydrate from localStorage in an effect to avoid mismatch.
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [bestAttempts, setBestAttempts] = useState<Record<number, number>>({});
  const [prisms, setPrisms] = useState<number>(0);
  const [ownedSkins, setOwnedSkins] = useState<Set<string>>(new Set(["default"]));
  const [equippedSkinId, setEquippedSkinId] = useState<string>("default");
  const [shopMsg, setShopMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const c = localStorage.getItem("gd-completed");
      if (c) setCompleted(new Set(JSON.parse(c) as number[]));
      const b = localStorage.getItem("gd-best");
      if (b) setBestAttempts(JSON.parse(b) as Record<number, number>);
      const p = localStorage.getItem("gd-prisms");
      if (p) setPrisms(Number(p) || 0);
      const o = localStorage.getItem("gd-skins");
      if (o) setOwnedSkins(new Set(["default", ...(JSON.parse(o) as string[])]));
      const e = localStorage.getItem("gd-equipped");
      if (e) setEquippedSkinId(e);
    } catch {}
  }, []);

  const equippedSkin = SKINS.find((s) => s.id === equippedSkinId) ?? SKINS[0];

  const buySkin = (id: string) => {
    const skin = SKINS.find((s) => s.id === id);
    if (!skin) return;
    if (ownedSkins.has(id)) {
      setEquippedSkinId(id);
      try { localStorage.setItem("gd-equipped", id); } catch {}
      setShopMsg(`EQUIPPED · ${skin.name.toUpperCase()}`);
      return;
    }
    if (prisms < skin.price) {
      setShopMsg(`NEED ${skin.price - prisms} MORE ◆`);
      return;
    }
    const nextPrisms = prisms - skin.price;
    const nextOwned = new Set(ownedSkins);
    nextOwned.add(id);
    setPrisms(nextPrisms);
    setOwnedSkins(nextOwned);
    setEquippedSkinId(id);
    try {
      localStorage.setItem("gd-prisms", String(nextPrisms));
      localStorage.setItem("gd-skins", JSON.stringify([...nextOwned].filter((x) => x !== "default")));
      localStorage.setItem("gd-equipped", id);
    } catch {}
    setShopMsg(`UNLOCKED · ${skin.name.toUpperCase()}`);
  };

  const handleWin = useCallback(
    (i: number, info: { attempts: number; reward: number; isNewRecord: boolean }) => {
      setCompleted((prev) => {
        const next = new Set(prev);
        next.add(i);
        try {
          localStorage.setItem("gd-completed", JSON.stringify([...next]));
        } catch {}
        return next;
      });
      if (info.isNewRecord) {
        setBestAttempts((prev) => {
          const next = { ...prev, [i]: info.attempts };
          try {
            localStorage.setItem("gd-best", JSON.stringify(next));
          } catch {}
          return next;
        });
      }
      setPrisms((p) => {
        const next = p + info.reward;
        try {
          localStorage.setItem("gd-prisms", String(next));
        } catch {}
        return next;
      });
    },
    [],
  );

  const selectLevel = (i: number) => {
    setSelected(i);
    setScreen("playing");
  };

  const goToMenu = () => {
    setSelected(null);
    setScreen("levels");
  };

  if (screen === "shop") {
    return (
      <div className="min-h-screen px-4 py-12 md:py-16 bg-[#070710]">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <button
              onClick={() => { setShopMsg(null); setScreen("intro"); }}
              className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm font-bold tracking-widest"
            >
              ← BACK
            </button>
            <h2
              className="text-4xl md:text-5xl font-black tracking-[0.2em] bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(120deg, #22d3ee, #a855f7, #f472b6)" }}
            >
              SKIN VAULT
            </h2>
            <div className="px-4 py-2 rounded-full border border-white/15 bg-white/5 text-white tracking-[0.25em] text-sm font-bold">
              <span className="text-cyan-300">◆</span> {prisms}
            </div>
          </div>
          {shopMsg && (
            <div className="mb-6 text-center text-white tracking-[0.3em] text-sm font-bold animate-pulse">
              {shopMsg}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SKINS.map((s) => {
              const owned = ownedSkins.has(s.id);
              const equipped = equippedSkinId === s.id;
              const canAfford = prisms >= s.price;
              return (
                <div
                  key={s.id}
                  className="relative overflow-hidden rounded-2xl p-5 border text-white"
                  style={{
                    borderColor: equipped ? s.glow : "rgba(255,255,255,0.1)",
                    background: `linear-gradient(155deg, ${s.primary}33, ${s.glow}22 60%, #0a0a14)`,
                    boxShadow: equipped ? `0 0 40px -10px ${s.glow}` : undefined,
                  }}
                >
                  <div className="flex items-center justify-between text-[10px] tracking-[0.25em] font-bold">
                    <span style={{ color: RARITY_COLOR[s.rarity] }}>{s.rarity}</span>
                    {equipped && <span className="text-white/80">EQUIPPED</span>}
                  </div>
                  <div className="my-6 flex justify-center">
                    <div
                      className="w-20 h-20 rotate-45 rounded-md"
                      style={{
                        background: `radial-gradient(circle at 30% 30%, ${s.secondary}, ${s.primary} 55%, #0b1220)`,
                        boxShadow: `0 0 30px ${s.glow}`,
                      }}
                    />
                  </div>
                  <h3 className="text-xl font-black tracking-widest">{s.name.toUpperCase()}</h3>
                  <p className="text-xs text-white/60 tracking-wider mt-1">{s.tagline}</p>
                  <button
                    onClick={() => buySkin(s.id)}
                    disabled={!owned && !canAfford}
                    className="mt-5 w-full px-4 py-3 rounded-lg font-black tracking-widest text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: equipped
                        ? "rgba(255,255,255,0.1)"
                        : owned
                        ? "#ffffff"
                        : `linear-gradient(90deg, ${s.primary}, ${s.glow})`,
                      color: equipped ? "#ffffff" : owned ? "#000000" : "#ffffff",
                    }}
                  >
                    {equipped
                      ? "EQUIPPED"
                      : owned
                      ? "EQUIP"
                      : s.price === 0
                      ? "FREE"
                      : `◆ ${s.price.toLocaleString()}`}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-10 text-center text-white/40 text-xs tracking-widest">
            EARN ◆ PRISMS BY CLEARING LEVELS · BIGGER REWARDS FOR FEWER ATTEMPTS
          </p>
        </div>
      </div>
    );
  }


  if (screen === "intro") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0a0a12] overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full opacity-30"
              style={{
                width: 2 + (i % 4),
                height: 2 + (i % 4),
                left: `${(i * 37) % 100}%`,
                top: `${(i * 23) % 100}%`,
                background: i % 2 === 0 ? "#22d3ee" : "#a855f7",
                animation: `pulse ${2 + (i % 5)}s ease-in-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center px-4">
          <h1 className="text-7xl md:text-9xl font-black tracking-tighter text-white drop-shadow-[0_0_40px_rgba(34,211,238,0.4)]">
            GEO
            <br />
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(135deg, #22d3ee, #a855f7)" }}
            >
              RUSH
            </span>
          </h1>

          <p className="mt-6 text-white/50 tracking-[0.3em] uppercase text-sm md:text-base">
            25 Levels &middot; 5 Vehicles &middot; Rhythm Runner
          </p>

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setScreen("levels")}
              className="px-14 py-5 text-2xl font-black tracking-[0.2em] text-black bg-white rounded-full
                         hover:scale-105 hover:shadow-[0_0_60px_rgba(255,255,255,0.3)] active:scale-95
                         transition-all duration-200"
            >
              PLAY
            </button>
            <button
              onClick={() => { setShopMsg(null); setScreen("shop"); }}
              className="px-10 py-5 text-xl font-black tracking-[0.2em] text-white rounded-full border-2 border-white/30
                         hover:border-white/70 hover:scale-105 active:scale-95 transition-all duration-200
                         bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10"
            >
              ◆ SHOP
            </button>
          </div>

          <p className="mt-8 text-white/40 text-xs tracking-widest">
            ◆ {prisms.toLocaleString()} PRISMS · {ownedSkins.size}/{SKINS.length} SKINS
          </p>
          <p className="mt-2 text-white/30 text-xs tracking-widest">
            GEM · ROCKET · STAR · RHOMB · BOLT
          </p>
        </div>
      </div>
    );
  }

  if (selected !== null && screen === "playing") {
    const level = LEVELS[selected];
    return (
      <Game
        key={selected}
        level={level}
        bestAttempts={bestAttempts[selected] ?? null}
        skin={equippedSkin}
        onExit={goToMenu}
        onWin={(info) => handleWin(selected, info)}
      />
    );
  }


  return (
    <div className="min-h-screen px-4 py-12 md:py-20">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1
            className="text-5xl md:text-7xl font-black tracking-widest bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(120deg, oklch(0.78 0.2 195), oklch(0.72 0.22 340), oklch(0.78 0.2 80))",
            }}
          >
            PRISM RUSH
          </h1>
          <p className="mt-3 text-muted-foreground tracking-widest text-sm uppercase">
            20 levels · 5 shapes · neon shape-runner
          </p>
          <div className="mt-4 inline-flex items-center gap-3 px-4 py-2 rounded-full border border-white/15 bg-white/5 text-white tracking-[0.25em] text-sm font-bold">
            <span className="text-cyan-300">◆</span> {prisms.toLocaleString()} PRISMS
            <button
              onClick={() => { setShopMsg(null); setScreen("shop"); }}
              className="ml-2 px-3 py-1 rounded-full bg-white text-black text-xs tracking-widest hover:scale-105 transition"
            >
              SHOP
            </button>
          </div>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {LEVELS.map((lv, i) => {
            const done = completed.has(i);
            const stars = Math.min(5, Math.ceil((i + 1) / 2.2));
            return (
              <button
                key={i}
                onClick={() => selectLevel(i)}
                className="group relative overflow-hidden rounded-2xl p-5 text-left border border-white/10 hover:border-white/30 transition transform hover:-translate-y-1 hover:shadow-2xl"
                style={{
                  background: `linear-gradient(135deg, ${lv.bgFrom}, ${lv.bgTo})`,
                }}
              >
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                  <div
                    className="absolute -bottom-6 right-4 w-16 h-16 rotate-45"
                    style={{ background: lv.accent }}
                  />
                </div>
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs tracking-widest opacity-80">
                      LEVEL {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 backdrop-blur tracking-widest">
                      {VEHICLE_LABELS[lv.startingVehicle]}
                    </span>
                  </div>
                  <h3 className="mt-3 text-2xl font-black tracking-wider">{lv.name}</h3>
                  <div className="mt-4 flex gap-1">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <span
                        key={s}
                        className="w-3 h-3"
                        style={{
                          background: s < stars ? lv.accent : "rgba(255,255,255,0.2)",
                          transform: "rotate(45deg)",
                        }}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs tracking-widest opacity-80">
                    <span>SPEED {Math.round(lv.speed)}</span>
                    <span>{done ? "✓ DONE" : "~3:00"}</span>
                  </div>
                  {bestAttempts[i] !== undefined && (
                    <div className="mt-2 text-[10px] tracking-widest text-white/70">
                      BEST · {bestAttempts[i]} {bestAttempts[i] === 1 ? "ATTEMPT" : "ATTEMPTS"}
                    </div>
                  )}

                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-12 text-center text-xs text-muted-foreground tracking-widest">
          SPACE / W / ↑ / TAP — ACTION · ESC — EXIT · HOLD ON DEATH TO RETRY
        </div>
      </div>
    </div>
  );
}
