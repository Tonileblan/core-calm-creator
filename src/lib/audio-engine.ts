/**
 * Blowmind audio engine — genera ruido y frecuencias binaurales en tiempo real
 * con la Web Audio API, puente HTML5 Audio y soporte de MediaSession para reproducción
 * ininterrumpida en segundo plano y pantalla de bloqueo en móviles.
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

// WAV de silencio de 1 segundo para anclar la sesión de audio en iOS/Android
const SILENT_AUDIO_URI =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

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
  private silentAudioEl: HTMLAudioElement | null = null;
  private alarmInterval: number | null = null;

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
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    this.ensureSilentCarrier();
    return this.ctx;
  }

  /**
   * Elemento de audio silencioso en bucle para forzar a iOS Safari y Android
   * a mantener vivo el proceso de audio cuando la pantalla se apaga o la app pasa a segundo plano.
   */
  private ensureSilentCarrier() {
    if (typeof window === "undefined") return;
    if (!this.silentAudioEl) {
      const audio = document.createElement("audio");
      audio.src = SILENT_AUDIO_URI;
      audio.loop = true;
      (audio as any).playsInline = true;
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      audio.volume = 0.01;
      this.silentAudioEl = audio;
      document.body.appendChild(audio);
    }
  }

  private startBackgroundSession(title: string, artist = "Blowmind · Foco & Bienestar") {
    this.ensureSilentCarrier();
    if (this.silentAudioEl) {
      this.silentAudioEl.play().catch(() => {
        // En algunos casos requiere interacción del usuario
      });
    }

    // Configuración de la API MediaSession para pantalla de bloqueo
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist,
          album: "Frecuencias & Bienestar Mental",
          artwork: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          ],
        });
        navigator.mediaSession.playbackState = "playing";

        navigator.mediaSession.setActionHandler("play", () => {
          if (this.ctx?.state === "suspended") void this.ctx.resume();
          if (this.silentAudioEl) void this.silentAudioEl.play();
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          this.stop();
        });
        navigator.mediaSession.setActionHandler("stop", () => {
          this.stop();
        });
      } catch (e) {
        console.warn("MediaSession API error:", e);
      }
    }
  }

  private stopBackgroundSession() {
    if (this.silentAudioEl) {
      this.silentAudioEl.pause();
    }
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.playbackState = "none";
      } catch {
        // ignore
      }
    }
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
    this.stopBackgroundSession();

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

    // Activar soporte en segundo plano y pantalla de bloqueo
    this.startBackgroundSession(preset.nombre, "Blowmind · Frecuencias");
    return true;
  }

  /** Sube el volumen progresivamente (despertar progresivo). */
  progressiveWake(id: SoundId, seconds = 90) {
    this.setVolume(0.05);
    this.play(id, 4);
    const start = Date.now();
    const timer = window.setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / (seconds * 1000));
      this.setVolume(0.05 + p * 0.75);
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
    g.gain.setTargetAtTime(0.25 * this._volume + 0.1, t, 0.02);
    g.gain.setTargetAtTime(0, t + duration * 0.4, duration / 4);
    osc.start(t);
    osc.stop(t + duration + 0.4);
  }

  /**
   * Reproduce una melodía de alarma rica y rítmica que suena continuamente hasta cancelarla
   */
  playAlarmMelody(soundId = "zen") {
    this.stopAlarm();
    const ctx = this.ensure();
    if (ctx.state === "suspended") void ctx.resume();

    // Iniciar sesión en segundo plano para que no se pause con la pantalla bloqueada
    this.startBackgroundSession("⏰ Alarma Activa", "Blowmind · Alarma de Bienestar");

    // Notas de melodías (frecuencias en Hz)
    const melodias: Record<string, number[]> = {
      zen: [528, 660, 792, 990, 792, 660], // Escala pentatónica 528Hz
      aurora: [396, 528, 639, 741, 852, 639], // Tonos Solfeggio
      energica: [440, 554.37, 659.25, 880, 659.25, 554.37], // Acorde Mayor La brillante
      chime: [528, 528, 660, 792],
    };

    const escala = melodias[soundId] ?? melodias["zen"]!;
    let paso = 0;

    // Si es un preset de ruido u ondas, iniciar también el fondo
    if (["brown", "white", "pink", "alpha", "theta", "delta"].includes(soundId)) {
      this.play(soundId as SoundId, 2);
    }

    const tocarNota = () => {
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") void this.ctx.resume();

      const freq = escala[paso % escala.length]!;
      paso++;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Mezcla de seno y triángulo para un tono de campana / arpa suave y cálido
      osc.type = soundId === "energica" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.35 * Math.max(0.4, this._volume),
        this.ctx.currentTime + 0.04
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(this.master ?? this.ctx.destination);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 1.3);
    };

    // Tocar primera nota inmediatamente
    tocarNota();
    this.alarmInterval = window.setInterval(tocarNota, 700);
  }

  stopAlarm() {
    if (this.alarmInterval) {
      window.clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
    this.stop(0.4);
    this.stopBackgroundSession();
  }

  /**
   * Desbloquea el AudioContext en la primera interacción del usuario en la ventana
   */
  unlockAudio() {
    const unlock = () => {
      const ctx = this.ensure();
      if (ctx.state === "suspended") {
        void ctx.resume().then(() => {
          // Reproducir un micro-silencio para desbloquear hardware
          const buf = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
        });
      }
      this.ensureSilentCarrier();

      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("pointerdown", unlock, { once: true, passive: true });
      window.addEventListener("keydown", unlock, { once: true, passive: true });
      window.addEventListener("touchstart", unlock, { once: true, passive: true });
    }
  }
}

let engine: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (!engine) {
    engine = new AudioEngine();
    if (typeof window !== "undefined") {
      engine.unlockAudio();
    }
  }
  return engine;
}
