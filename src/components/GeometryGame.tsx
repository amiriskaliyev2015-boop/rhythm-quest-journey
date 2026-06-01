import { useCallback, useEffect, useRef, useState } from "react";
import { LEVELS, type Level, type Obstacle } from "@/lib/game-engine";

const GROUND_H = 80;
const PLAYER_SIZE = 40;
const PLAYER_X = 140;

type GameState = "menu" | "playing" | "dead" | "won";

interface Props {
  level: Level;
  onExit: () => void;
  onWin: () => void;
}

function Game({ level, onExit, onWin }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>("playing");
  const [, force] = useState(0);
  const [progress, setProgress] = useState(0);
  const [attempts, setAttempts] = useState(1);

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

    // World state
    let scrollX = 0;
    let py = 0; // y above ground (positive = up)
    let vy = 0;
    let onGround = true;
    let rotation = 0;
    let last = performance.now();
    let running = true;
    let jumpHeld = false;

    const reset = () => {
      scrollX = 0;
      py = 0;
      vy = 0;
      onGround = true;
      rotation = 0;
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
      force((n) => n + 1);
      onWin();
    };

    const tryJump = () => {
      jumpHeld = true;
      if (stateRef.current === "dead") {
        setAttempts((a) => a + 1);
        reset();
        return;
      }
      if (stateRef.current !== "playing") return;
      if (onGround) {
        vy = level.jump;
        onGround = false;
      }
    };

    const keyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        tryJump();
      } else if (e.code === "Escape") {
        onExit();
      }
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        jumpHeld = false;
      }
    };
    const pointerDown = () => tryJump();
    const pointerUp = () => {
      jumpHeld = false;
    };

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointerup", pointerUp);

    // Collision helpers
    const playerRect = () => ({
      x: PLAYER_X,
      y: py, // above ground
      w: PLAYER_SIZE,
      h: PLAYER_SIZE,
    });

    const collides = (o: Obstacle, groundY: number) => {
      const pr = playerRect();
      // convert to screen coords (y axis flipped — ground at groundY)
      const px1 = pr.x;
      const px2 = pr.x + pr.w;
      const py1 = groundY - pr.y - pr.h;
      const py2 = groundY - pr.y;

      if (o.type === "spike") {
        const ox = o.x - scrollX;
        if (ox + o.w < px1 || ox > px2) return false;
        const oy2 = groundY;
        const oy1 = groundY - o.h;
        // triangle approx with shrink
        const ix1 = Math.max(px1, ox) + 4;
        const ix2 = Math.min(px2, ox + o.w) - 4;
        if (ix1 >= ix2) return false;
        return py2 > oy1 + 4 && py1 < oy2;
      }
      if (o.type === "block") {
        const ox = o.x - scrollX;
        const ox2 = ox + o.w;
        const oy2 = groundY - o.y;
        const oy1 = oy2 - o.h;
        if (px2 <= ox + 2 || px1 >= ox2 - 2) return false;
        if (py2 <= oy1 + 2 || py1 >= oy2 - 2) return false;
        // landing on top?
        if (vy <= 0 && py1 < oy1 && py2 > oy1 && py2 - oy1 < 18) {
          // land
          py = groundY - oy1 - PLAYER_SIZE - (groundY - oy1 - PLAYER_SIZE);
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

      if (stateRef.current === "playing") {
        scrollX += level.speed * dt;
        // gravity
        vy -= level.gravity * dt;
        py += vy * dt;

        // Check block landing first
        let landedOnBlock = false;
        let topOfBlock = 0;
        for (const o of level.obstacles) {
          if (o.type !== "block") continue;
          const ox = o.x - scrollX;
          if (ox > w || ox + o.w < 0) continue;
          const pr = playerRect();
          const px1 = pr.x;
          const px2 = pr.x + pr.w;
          const blockTop = o.y + o.h; // height above ground
          if (px2 > ox + 2 && px1 < ox + o.w - 2) {
            // Falling onto top
            const prevBottom = py - vy * dt;
            if (vy <= 0 && prevBottom >= blockTop - 1 && py <= blockTop + 1) {
              py = blockTop;
              vy = 0;
              onGround = true;
              landedOnBlock = true;
              topOfBlock = blockTop;
            }
          }
        }

        // Ground
        if (!landedOnBlock) {
          if (py <= 0) {
            py = 0;
            vy = 0;
            onGround = true;
          } else {
            onGround = false;
          }
        }

        // If standing on a block but block moved away, fall
        if (landedOnBlock) {
          let stillOn = false;
          for (const o of level.obstacles) {
            if (o.type !== "block") continue;
            const ox = o.x - scrollX;
            const blockTop = o.y + o.h;
            const pr = playerRect();
            if (
              Math.abs(py - blockTop) < 2 &&
              blockTop === topOfBlock &&
              pr.x + pr.w > ox + 2 &&
              pr.x < ox + o.w - 2
            ) {
              stillOn = true;
              break;
            }
          }
          if (!stillOn) onGround = false;
        }

        // Rotation
        if (!onGround) rotation += dt * 6;
        else rotation = Math.round(rotation / (Math.PI / 2)) * (Math.PI / 2);

        // Collisions
        for (const o of level.obstacles) {
          const ox = (o as any).x - scrollX;
          if (ox > w + 60 || ox < -120) continue;
          const r = collides(o, groundY);
          if (r === true) {
            die();
            break;
          }
        }

        // Progress / win
        const prog = Math.min(1, scrollX / level.length);
        setProgress(prog);
        if (prog >= 1) win();
      }

      // ----- RENDER -----
      // background gradient
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
        const ox = (o as any).x - scrollX;
        if (ox > w + 60 || ox < -120) continue;
        if (o.type === "spike") {
          ctx.fillStyle = level.accent;
          ctx.beginPath();
          ctx.moveTo(ox, groundY);
          ctx.lineTo(ox + o.w / 2, groundY - o.h);
          ctx.lineTo(ox + o.w, groundY);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.stroke();
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
      ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 3;
      ctx.strokeRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(-8, -8, 6, 6);
      ctx.fillRect(2, -8, 6, 6);
      ctx.restore();

      // death glow
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
      void jumpHeld;
    };
  }, [level, onExit, onWin]);

  const state = stateRef.current;

  return (
    <div className="fixed inset-0 bg-black">
      <canvas ref={canvasRef} className="w-full h-full block touch-none" />

      {/* HUD */}
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
            <button
              onClick={onExit}
              className="mt-6 px-6 py-3 rounded-lg bg-white text-black font-bold tracking-widest hover:scale-105 transition"
            >
              CONTINUE →
            </button>
          </div>
        </div>
      )}

      {/* Mobile hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs tracking-widest">
        SPACE / TAP TO JUMP
      </div>
    </div>
  );
}

export default function GeometryGame() {
  const [selected, setSelected] = useState<number | null>(null);
  const [completed, setCompleted] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem("gd-completed");
      return new Set(raw ? (JSON.parse(raw) as number[]) : []);
    } catch {
      return new Set();
    }
  });

  const handleWin = useCallback(
    (i: number) => {
      setCompleted((prev) => {
        const next = new Set(prev);
        next.add(i);
        try {
          localStorage.setItem("gd-completed", JSON.stringify([...next]));
        } catch {}
        return next;
      });
    },
    [],
  );

  if (selected !== null) {
    const level = LEVELS[selected];
    return (
      <Game
        key={selected}
        level={level}
        onExit={() => setSelected(null)}
        onWin={() => handleWin(selected)}
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
            GEO RUSH
          </h1>
          <p className="mt-3 text-muted-foreground tracking-widest text-sm uppercase">
            11 levels · jump, fly, survive · ~3 min each
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {LEVELS.map((lv, i) => {
            const done = completed.has(i);
            const stars = Math.min(5, Math.ceil((i + 1) / 2.2));
            return (
              <button
                key={i}
                onClick={() => setSelected(i)}
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
                    {done && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 backdrop-blur">
                        ✓ DONE
                      </span>
                    )}
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
                    <span>~3:00</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-12 text-center text-xs text-muted-foreground tracking-widest">
          SPACE / W / ↑ / TAP TO JUMP — ESC TO EXIT — HOLD ANY KEY ON DEATH TO RETRY
        </div>
      </div>
    </div>
  );
}
