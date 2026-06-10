// Procedural per-level chiptune music using WebAudio.
// No external assets — each level gets unique tempo / key / waveform / pattern.

const SCALES: Record<string, number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10, 12],
  dorian: [0, 2, 3, 5, 7, 9, 10, 12],
  phrygian: [0, 1, 3, 5, 7, 8, 10, 12],
  pentaMinor: [0, 3, 5, 7, 10, 12, 15, 17],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11, 12],
};

interface LevelMusicConfig {
  rootMidi: number;     // base note (e.g. 48 = C3)
  scale: keyof typeof SCALES;
  bpm: number;
  leadWave: OscillatorType;
  bassWave: OscillatorType;
  pattern: number[];    // indices into scale (lead arpeggio, length 16)
  bassPattern: number[]; // length 8
  swing?: number;       // 0..1
}

// Hash level index -> config. Deterministic, but distinct per level.
function configForLevel(idx: number): LevelMusicConfig {
  const scales = Object.keys(SCALES) as (keyof typeof SCALES)[];
  const waves: OscillatorType[] = ["square", "sawtooth", "triangle", "sine"];
  const roots = [45, 47, 48, 50, 52, 43, 46, 49]; // A2..E3 spread

  const root = roots[idx % roots.length];
  const scale = scales[(idx * 3) % scales.length];
  // Tempo ramps up with difficulty.
  const bpm = 92 + idx * 4; // 92 -> 188 at level 24

  const leadWave = waves[idx % waves.length];
  const bassWave = idx % 2 === 0 ? "triangle" : "square";

  // Build a pseudo-random pattern from the level index.
  const rand = (seed: number) => {
    let s = (idx + 1) * 9301 + seed * 49297;
    s = (s * 233280 + 1) % 233280;
    return s / 233280;
  };

  const pattern: number[] = [];
  for (let i = 0; i < 16; i++) {
    const r = rand(i + 1);
    if (r < 0.18) pattern.push(-1); // rest
    else pattern.push(Math.floor(r * 8));
  }

  const bassPattern: number[] = [];
  const bassDegrees = [0, 0, 4, 0, 3, 0, 4, 5];
  for (let i = 0; i < 8; i++) {
    bassPattern.push(bassDegrees[(i + idx) % 8]);
  }

  return {
    rootMidi: root,
    scale,
    bpm,
    leadWave,
    bassWave,
    pattern,
    bassPattern,
    swing: 0.08,
  };
}

const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class LevelMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private config: LevelMusicConfig;
  private muted = false;
  private stopped = true;

  constructor(levelIndex: number) {
    this.config = configForLevel(levelIndex);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(
        m ? 0 : 0.18,
        this.ctx.currentTime + 0.05
      );
    }
  }

  async start() {
    if (!this.stopped) return;
    this.stopped = false;
    try {
      const Ctx =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      if (this.ctx.state === "suspended") {
        await this.ctx.resume().catch(() => {});
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.18;
      // Soft lowpass for warmth.
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 4200;
      filter.Q.value = 0.6;
      this.master.connect(filter);
      filter.connect(this.ctx.destination);

      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.05;
      this.tick();
    } catch {
      // Audio unavailable — silently ignore.
    }
  }

  stop() {
    this.stopped = true;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.ctx) {
      const ctx = this.ctx;
      try {
        this.master?.gain.cancelScheduledValues(ctx.currentTime);
        this.master?.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
        setTimeout(() => {
          ctx.close().catch(() => {});
        }, 150);
      } catch {
        // ignore
      }
      this.ctx = null;
      this.master = null;
    }
  }

  private tick = () => {
    if (this.stopped || !this.ctx || !this.master) return;
    const sixteenth = 60 / this.config.bpm / 4;
    // Schedule ahead 200ms.
    while (this.nextTime < this.ctx.currentTime + 0.2) {
      this.scheduleStep(this.step, this.nextTime, sixteenth);
      // Apply swing on off-beats.
      const swing = this.step % 2 === 1 ? sixteenth * (this.config.swing ?? 0) : 0;
      this.nextTime += sixteenth + swing - (this.step % 2 === 0 ? sixteenth * (this.config.swing ?? 0) : 0);
      this.step = (this.step + 1) % 16;
    }
    this.timer = window.setTimeout(this.tick, 50) as unknown as number;
  };

  private scheduleStep(step: number, time: number, sixteenth: number) {
    if (!this.ctx || !this.master) return;
    const scale = SCALES[this.config.scale];

    if (step === 0 || step === 8) {
      const chordRoot = this.config.rootMidi + (step === 0 ? 12 : 17);
      this.playChord(chordRoot, time, sixteenth * 8, 0.035);
    }

    // Lead arpeggio every 16th.
    const deg = this.config.pattern[step];
    if (deg >= 0) {
      const midi = this.config.rootMidi + 24 + scale[deg];
      this.playNote(midi, time, sixteenth * 0.9, this.config.leadWave, 0.07);
    }

    // Bass on every 2 steps (8ths).
    if (step % 2 === 0) {
      const bDeg = this.config.bassPattern[(step / 2) % 8];
      const midi = this.config.rootMidi + scale[bDeg];
      this.playNote(midi, time, sixteenth * 1.8, this.config.bassWave, 0.13);
    }

    if (step % 4 === 2) {
      const harmonyMidi = this.config.rootMidi + 19 + scale[(step / 2) % scale.length];
      this.playNote(harmonyMidi, time, sixteenth * 1.6, "triangle", 0.045);
    }

    // Kick on 1 and 3 of each beat group (steps 0, 4, 8, 12).
    if (step % 4 === 0) {
      this.playKick(time);
    }
    // Hat on off-beats.
    if (step % 2 === 1) {
      this.playHat(time, step % 8 === 7 ? 0.04 : 0.02);
    }
    // Snare on backbeat (steps 4 and 12).
    if (step === 4 || step === 12) {
      this.playSnare(time);
    }
  }

  private playNote(
    midi: number,
    time: number,
    duration: number,
    type: OscillatorType,
    gain: number
  ) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = midiToFreq(midi);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private playChord(rootMidi: number, time: number, duration: number, gain: number) {
    if (!this.ctx || !this.master) return;
    const notes = [0, 7, 12, 15];
    notes.forEach((offset, index) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = index % 2 === 0 ? "triangle" : "sine";
      osc.frequency.value = midiToFreq(rootMidi + offset);
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(gain / (index + 1), time + 0.08);
      g.gain.linearRampToValueAtTime(gain * 0.35, time + duration * 0.65);
      g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      osc.connect(g);
      g.connect(this.master!);
      osc.start(time);
      osc.stop(time + duration + 0.05);
    });
  }

  private playKick(time: number) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
    g.gain.setValueAtTime(0.25, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    osc.connect(g);
    g.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  private playHat(time: number, gain: number) {
    if (!this.ctx || !this.master) return;
    const bufferSize = 0.03 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.master);
    src.start(time);
    src.stop(time + 0.04);
  }

  private playSnare(time: number) {
    if (!this.ctx || !this.master) return;
    const bufferSize = 0.15 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(time);
    src.stop(time + 0.15);
  }
}

export class MenuMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private muted = false;
  private stopped = true;
  private readonly progression = [48, 43, 45, 41];

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(m ? 0 : 0.14, this.ctx.currentTime + 0.12);
    }
  }

  async start() {
    if (!this.stopped) return;
    this.stopped = false;
    try {
      const Ctx =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      if (this.ctx.state === "suspended") {
        await this.ctx.resume().catch(() => {});
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.14;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 3600;
      filter.Q.value = 0.5;
      this.master.connect(filter);
      filter.connect(this.ctx.destination);
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.08;
      this.tick();
    } catch {
      // Ignore unavailable browser audio.
    }
  }

  stop() {
    this.stopped = true;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.ctx) {
      const ctx = this.ctx;
      try {
        this.master?.gain.cancelScheduledValues(ctx.currentTime);
        this.master?.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
        setTimeout(() => {
          ctx.close().catch(() => {});
        }, 240);
      } catch {
        // ignore
      }
      this.ctx = null;
      this.master = null;
    }
  }

  private tick = () => {
    if (this.stopped || !this.ctx || !this.master) return;
    const eighth = 60 / 104 / 2;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      this.scheduleStep(this.step, this.nextTime, eighth);
      this.nextTime += eighth;
      this.step = (this.step + 1) % 32;
    }
    this.timer = window.setTimeout(this.tick, 60) as unknown as number;
  };

  private scheduleStep(step: number, time: number, eighth: number) {
    const root = this.progression[Math.floor(step / 8) % this.progression.length];
    if (step % 8 === 0) {
      this.playPad(root, time, eighth * 8);
      this.playBass(root - 12, time, eighth * 3.5);
    }
    if (step % 4 === 2) {
      this.playBass(root - 5, time, eighth * 2);
    }
    const melody = [12, 15, 19, 17, 12, 10, 7, 10, 12, 15, 22, 19, 17, 15, 12, 10];
    if (step % 2 === 0) {
      this.playBell(root + melody[(step / 2) % melody.length], time, eighth * 1.5);
    }
  }

  private playPad(rootMidi: number, time: number, duration: number) {
    if (!this.ctx || !this.master) return;
    [0, 7, 12, 15].forEach((offset, index) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = midiToFreq(rootMidi + offset);
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.032 / (index + 1), time + 0.28);
      g.gain.linearRampToValueAtTime(0.014, time + duration * 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      osc.connect(g);
      g.connect(this.master!);
      osc.start(time);
      osc.stop(time + duration + 0.05);
    });
  }

  private playBass(midi: number, time: number, duration: number) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = midiToFreq(midi);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.08, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(time);
    osc.stop(time + duration + 0.03);
  }

  private playBell(midi: number, time: number, duration: number) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = midiToFreq(midi);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.045, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }
}
