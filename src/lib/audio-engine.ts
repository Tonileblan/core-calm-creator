/**
 * Blowmind audio engine — genera ruido y frecuencias binaurales en tiempo real
 * con la Web Audio API (sin archivos de audio).
 */

export type SoundId =
  | "alpha"
  | "theta"
  | "delta"
  | "white"
  | "brown"
  | "pink";

export type SoundPreset = {
  id: SoundId;
  nombre: string;
  descripcion: string;
  tipo: "binaural" | "ruido";
  /** Frecuencia de batido para binaurales (Hz) */
  beat?: number;
  carrier?: number;
};

export const SOUND_PRESETS: SoundPreset[] = [
  {
    id: "alpha",
    nombre: "Ondas Alpha · 10 Hz",
    descripcion: "Foco relajado y creatividad. Ideal para trabajo profundo.",
    tipo: "binaural",
    beat: 10,
    carrier: 200,
  },
  {
    id: "theta",
    nombre: "Ondas Theta · 6 Hz",
    descripcion: "Meditación profunda, visualización e intuición.",
    tipo: "binaural",
    beat: 6,
    carrier: 160,
  },
  {
    id: "delta",
    nombre: "Ondas Delta · 2.5 Hz",
    descripcion: "Sueño reparador y descanso profundo.",
    tipo: "binaural",
    beat: 2.5,
    carrier: 120,
  },
  {
    id: "brown",
    nombre: "Ruido Marrón",
    descripcion: "Grave y envolvente. Reduce la hiperactividad mental.",
    tipo: "ruido",
  },
  {
    id: "white",
    nombre: "Ruido Blanco",
    descripcion: "Aislamiento acústico y enmascaramiento de distracciones.",
    tipo: "ruido",
  },
  {
    id: "pink",
    nombre: "Ruido Rosa",
    descripcion: "Equilibrado y natural. Buen fondo para leer o dormir.",
    tipo: "ruido",
  },
];

type Nodes = {
  gain: GainNode;
  stop: () => void;
};

function noiseBuffer(ctx: AudioContext, kind: "white" | "brown" | "pink") {
  const seconds = 4;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  let b0 = 0,
    b1 = 0,
    b2 = 0;
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "white") {
      data[i] = w * 0.6;
    } else if (kind === "brown") {
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 6;
    } else {
      b0 = 0.99765 * b0 + w * 0.099;
      b1 = 0.963 * b1 + w * 0.2965;
      b2 = 0.57 * b2 + w * 1.0526;
      data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
    }
  }
  return buffer;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private current: Nodes | null = null;
  private master: GainNode | null = null;
  private _volume = 0.5;
  private _playing: SoundId | null = null;

  get playing() {
    return this._playing;
  }

  get volume() {
    return this._volume;
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  setVolume(v: number) {
    this._volume = v;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }
  }

  stop(fade = 0.6) {
    const node = this.current;
    this.current = null;
    this._playing = null;
    if (!node || !this.ctx) return;
    const t = this.ctx.currentTime;
    node.gain.gain.cancelScheduledValues(t);
    node.gain.gain.setTargetAtTime(0, t, fade / 3);
    const stop = node.stop;
    window.setTimeout(stop, fade * 1000 + 120);
  }

  /** Arranca un preset. Devuelve true si quedó reproduciéndose. */
  play(id: SoundId, fadeIn = 1.2): boolean {
    if (this._playing === id) {
      this.stop();
      return false;
    }
    this.stop(0.25);
    const ctx = this.ensure();
    const preset = SOUND_PRESETS.find((p) => p.id === id);
    if (!preset || !this.master) return false;

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.master);

    if (preset.tipo === "binaural") {
      const carrier = preset.carrier ?? 180;
      const beat = preset.beat ?? 8;
      const merger = ctx.createChannelMerger(2);
      const left = ctx.createOscillator();
      const right = ctx.createOscillator();
      left.type = "sine";
      right.type = "sine";
      left.frequency.value = carrier;
      right.frequency.value = carrier + beat;
      const lg = ctx.createGain();
      const rg = ctx.createGain();
      lg.gain.value = 0.5;
      rg.gain.value = 0.5;
      left.connect(lg).connect(merger, 0, 0);
      right.connect(rg).connect(merger, 0, 1);
      merger.connect(gain);
      left.start();
      right.start();
      this.current = {
        gain,
        stop: () => {
          left.stop();
          right.stop();
          merger.disconnect();
          gain.disconnect();
        },
      };
    } else {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, preset.id as "white" | "brown" | "pink");
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = preset.id === "brown" ? 900 : 12000;
      src.connect(filter).connect(gain);
      src.start();
      this.current = {
        gain,
        stop: () => {
          src.stop();
          filter.disconnect();
          gain.disconnect();
        },
      };
    }

    gain.gain.setTargetAtTime(0.9, ctx.currentTime, fadeIn / 3);
    this._playing = id;
    return true;
  }

  /** Sube el volumen progresivamente (despertar progresivo). */
  progressiveWake(id: SoundId, seconds = 90) {
    this.setVolume(0.03);
    this.play(id, 4);
    const start = Date.now();
    const timer = window.setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / (seconds * 1000));
      this.setVolume(0.03 + p * 0.7);
      if (p >= 1) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }

  /** Tono corto para marcar fases de respiración / fin de bloque. */
  chime(frequency = 528, duration = 0.5) {
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    g.gain.value = 0.0001;
    osc.connect(g).connect(ctx.destination);
    const t = ctx.currentTime;
    g.gain.setTargetAtTime(0.18 * this._volume + 0.05, t, 0.02);
    g.gain.setTargetAtTime(0, t + duration * 0.4, duration / 4);
    osc.start(t);
    osc.stop(t + duration + 0.4);
  }
}

let engine: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (!engine) engine = new AudioEngine();
  return engine;
}
