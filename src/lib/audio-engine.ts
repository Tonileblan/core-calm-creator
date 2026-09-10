/**
 * Blowmind audio engine — genera ruido y frecuencias binaurales en tiempo real
 * con la Web Audio API, puente HTML5 Audio y soporte de MediaSession para reproducción
 * ininterrumpida en segundo plano y pantalla de bloqueo en móviles.
 */

import { useEffect, useState } from "react";
import { resolvePlayableUrlSync, resolvePlayableUrl } from "./supabase-soundtrack";

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

export type TrackInfo = {
  id: string;
  nombre: string;
  artista: string | null;
  url: string;
  categoria?: string;
};

export type TrackPlayerState = {
  track: TrackInfo | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
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

/**
 * Genera dinámicamente un buffer WAV de audio silencioso PCM (8kHz mono)
 * para anclar la sesión de audio nativa de iOS y Android en segundo plano para frecuencias Web Audio.
 */
function createSilentWavBlobUrl(seconds = 4): string {
  if (typeof window === "undefined") return "";
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 8;
  const numSamples = sampleRate * seconds;
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);

  // Cabecera RIFF/WAVE
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numSamples, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, numSamples, true);

  const pcm = new Uint8Array(buffer, 44, numSamples);
  pcm.fill(128); // Silencio en 8-bit unsigned

  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

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
  private streamDestination: MediaStreamAudioDestinationNode | null = null;
  private streamAudioEl: HTMLAudioElement | null = null;
  private silentCarrierEl: HTMLAudioElement | null = null;
  private trackAudioEl: HTMLAudioElement | null = null;
  private activeTrack: TrackInfo | null = null;
  private trackListeners: Set<(state: TrackPlayerState) => void> = new Set();
  private trackState: TrackPlayerState = {
    track: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.85,
    isMuted: false,
  };
  private _volume = 0.5;
  private _playing: SoundId | null = null;
  private alarmInterval: number | null = null;
  private silentBlobUrl: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      const resumeIfActive = () => {
        // 1. Reanudar sintetizadores / alarmas
        if (this._playing !== null || this.alarmInterval !== null) {
          if (this.ctx && (this.ctx.state === "suspended" || (this.ctx as any).state === "interrupted")) {
            void this.ctx.resume();
          }
          if (this.silentCarrierEl && this.silentCarrierEl.paused) {
            void this.silentCarrierEl.play().catch(() => {});
          }
          if (this.streamAudioEl && this.streamAudioEl.paused) {
            void this.streamAudioEl.play().catch(() => {});
          }
        }
        // 2. Reanudar canción de Banda Sonora
        if (this.trackState.isPlaying && this.trackAudioEl && this.trackAudioEl.paused && this.trackAudioEl.src) {
          void this.trackAudioEl.play().catch(() => {});
        }
      };

      document.addEventListener("visibilitychange", resumeIfActive);
      window.addEventListener("focus", resumeIfActive);
      window.addEventListener("pageshow", resumeIfActive);
      window.addEventListener("touchend", resumeIfActive, { passive: true });
    }
  }

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

      // Salida estándar a destino de altavoces
      this.master.connect(this.ctx.destination);

      // Puente MediaStream para forzar a iOS Safari y Android a mantener viva la reproducción en segundo plano
      if (typeof this.ctx.createMediaStreamDestination === "function") {
        try {
          this.streamDestination = this.ctx.createMediaStreamDestination();
          this.master.connect(this.streamDestination);
          this.ensureStreamAudioElement();
        } catch (e) {
          console.warn("createMediaStreamDestination warning:", e);
        }
      }
    }
    if (this.ctx.state === "suspended" || (this.ctx as any).state === "interrupted") {
      void this.ctx.resume();
    }
    this.ensureSilentCarrier();
    return this.ctx;
  }

  /**
   * Elemento de audio con MediaStream para forzar al kernel de audio móvil
   * a no silenciar las frecuencias ni la alarma cuando la pantalla se apaga.
   */
  private ensureStreamAudioElement() {
    if (typeof window === "undefined" || !this.streamDestination) return;
    if (!this.streamAudioEl) {
      const audio = document.createElement("audio");
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      audio.setAttribute("preload", "auto");
      (audio as any).playsInline = true;
      audio.autoplay = true;
      audio.volume = 0.01;
      audio.srcObject = this.streamDestination.stream;
      audio.style.position = "fixed";
      audio.style.opacity = "0";
      audio.style.pointerEvents = "none";
      audio.style.bottom = "0";
      audio.style.right = "0";
      document.body.appendChild(audio);
      this.streamAudioEl = audio;
    } else if (this.streamAudioEl.srcObject !== this.streamDestination.stream) {
      this.streamAudioEl.srcObject = this.streamDestination.stream;
    }
  }

  /**
   * Elemento de audio portador continuo en bucle para anclar la sesión en segundo plano.
   */
  private ensureSilentCarrier() {
    if (typeof window === "undefined") return;
    if (!this.silentCarrierEl) {
      if (!this.silentBlobUrl) {
        this.silentBlobUrl = createSilentWavBlobUrl(4);
      }
      const audio = document.createElement("audio");
      audio.src = this.silentBlobUrl;
      audio.loop = true;
      (audio as any).playsInline = true;
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      audio.setAttribute("preload", "auto");
      audio.volume = 0.01;
      audio.style.position = "fixed";
      audio.style.opacity = "0";
      audio.style.pointerEvents = "none";
      audio.style.bottom = "0";
      audio.style.right = "0";
      this.silentCarrierEl = audio;
      document.body.appendChild(audio);
    }
  }

  private startBackgroundSession(
    title: string,
    artist = "Blowmind · Foco & Bienestar",
    onPlay?: () => void,
    onPause?: () => void,
    onStop?: () => void
  ) {
    this.ensureSilentCarrier();
    if (this.silentCarrierEl) {
      this.silentCarrierEl.play().catch(() => {});
    }
    if (this.streamDestination) {
      this.ensureStreamAudioElement();
      if (this.streamAudioEl) {
        this.streamAudioEl.play().catch(() => {});
      }
    }

    // Configuración de la API MediaSession para pantalla de bloqueo
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist,
          album: "Frecuencias & Banda Sonora Vital",
          artwork: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          ],
        });
        navigator.mediaSession.playbackState = "playing";

        navigator.mediaSession.setActionHandler("play", () => {
          if (onPlay) {
            onPlay();
          } else {
            if (this.ctx?.state === "suspended") void this.ctx.resume();
            if (this.silentCarrierEl) void this.silentCarrierEl.play();
            if (this.streamAudioEl) void this.streamAudioEl.play();
          }
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          if (onPause) {
            onPause();
          } else {
            this.stop();
          }
        });
        navigator.mediaSession.setActionHandler("stop", () => {
          if (onStop) {
            onStop();
          } else {
            this.stop();
          }
        });
        navigator.mediaSession.setActionHandler("seekto", (details) => {
          if (details.seekTime !== undefined && details.seekTime !== null) {
            this.seekTrack(details.seekTime);
          }
        });
      } catch (e) {
        console.warn("MediaSession API error:", e);
      }
    }
  }

  private stopBackgroundSession() {
    if (this.silentCarrierEl) {
      this.silentCarrierEl.pause();
    }
    if (this.streamAudioEl) {
      this.streamAudioEl.pause();
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

  /** Arranca un preset de frecuencias binaurales o ruido. */
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

      // Mezcla de seno y triángulo para un tono suave y cálido
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
   * Configura la información de la canción en la pantalla de bloqueo (MediaSession)
   */
  private setupTrackMediaSession(track: TrackInfo) {
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.nombre,
          artist: track.artista || "Banda Sonora Vital",
          album: "Blowmind · " + (track.categoria ? track.categoria.toUpperCase() : "Banda Sonora"),
          artwork: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          ],
        });
        navigator.mediaSession.playbackState = "playing";

        navigator.mediaSession.setActionHandler("play", () => {
          void this.resumeTrack();
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          this.pauseTrack();
        });
        navigator.mediaSession.setActionHandler("stop", () => {
          this.stopTrack();
        });
        navigator.mediaSession.setActionHandler("seekto", (details) => {
          if (details.seekTime !== undefined && details.seekTime !== null) {
            this.seekTrack(details.seekTime);
          }
        });
      } catch (e) {
        console.warn("MediaSession API error:", e);
      }
    }
  }

  /**
   * Asegura que el elemento <audio> para canciones de Banda Sonora esté presente en el DOM
   * configurado con playsinline para reproducción ininterrumpida en segundo plano.
   */
  private ensureTrackAudioElement() {
    if (typeof window === "undefined") return;
    if (!this.trackAudioEl) {
      const audio = document.createElement("audio");
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      audio.setAttribute("preload", "auto");
      (audio as any).playsInline = true;
      audio.volume = this.trackState.isMuted ? 0 : Math.max(0.1, this.trackState.volume);
      audio.style.position = "fixed";
      audio.style.opacity = "0";
      audio.style.pointerEvents = "none";
      audio.style.bottom = "0";
      audio.style.right = "0";

      audio.addEventListener("timeupdate", () => {
        this.trackState.currentTime = audio.currentTime || 0;
        this.emitTrackState();
      });
      audio.addEventListener("loadedmetadata", () => {
        this.trackState.duration = audio.duration || 0;
        this.emitTrackState();
      });
      audio.addEventListener("play", () => {
        this.trackState.isPlaying = true;
        if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "playing";
        }
        this.emitTrackState();
      });
      audio.addEventListener("pause", () => {
        this.trackState.isPlaying = false;
        if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "paused";
        }
        this.emitTrackState();
      });
      audio.addEventListener("ended", () => {
        this.trackState.isPlaying = false;
        if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "none";
        }
        this.emitTrackState();
      });
      audio.addEventListener("error", (e) => {
        console.warn("Audio element error on src:", audio.src, audio.error, e);
        // Si hay error en la fuente directa, intentar resolver URL firmada automáticamente
        if (this.activeTrack && !audio.src.includes("token=")) {
          void resolvePlayableUrl(this.activeTrack.url).then((signedUrl) => {
            if (signedUrl && signedUrl !== audio.src) {
              audio.src = signedUrl;
              void audio.play().catch((err) => {
                console.warn("Error reintentando audio firmado:", err);
                this.trackState.isPlaying = false;
                this.emitTrackState();
              });
            }
          });
        } else {
          this.trackState.isPlaying = false;
          this.emitTrackState();
        }
      });

      document.body.appendChild(audio);
      this.trackAudioEl = audio;
    }
  }

  private emitTrackState() {
    const copy = { ...this.trackState };
    this.trackListeners.forEach((listener) => {
      try {
        listener(copy);
      } catch (err) {
        console.warn("Track listener error:", err);
      }
    });
  }

  getTrackState(): TrackPlayerState {
    return { ...this.trackState };
  }

  subscribeTrackState(listener: (s: TrackPlayerState) => void): () => void {
    this.trackListeners.add(listener);
    listener({ ...this.trackState });
    return () => {
      this.trackListeners.delete(listener);
    };
  }

  /**
   * Reproduce una pista de la Banda Sonora Vital manteniendo la sesión viva en segundo plano.
   */
  async playTrack(track: TrackInfo) {
    if (this.activeTrack?.id === track.id) {
      if (this.trackState.isPlaying) {
        this.pauseTrack();
      } else {
        await this.resumeTrack();
      }
      return;
    }

    // Detener frecuencias / alarmas si estaban activas
    if (this._playing) {
      this.stop(0.2);
    }
    this.stopAlarm();

    // Pausar los elementos portadores silenciosos para que no compitan con el elemento de música principal
    if (this.silentCarrierEl) this.silentCarrierEl.pause();
    if (this.streamAudioEl) this.streamAudioEl.pause();

    this.ensureTrackAudioElement();
    if (!this.trackAudioEl) return;

    this.activeTrack = track;
    this.trackState.track = track;
    this.trackState.currentTime = 0;
    this.trackState.duration = 0;
    this.trackState.isPlaying = true;
    this.emitTrackState();

    // Configurar MediaSession directamente para la canción
    this.setupTrackMediaSession(track);

    // 1. Obtener URL reproducible (síncrona para inicio instantáneo)
    const initialUrl = resolvePlayableUrlSync(track.url);
    this.trackAudioEl.src = initialUrl;
    this.trackAudioEl.volume = this.trackState.isMuted ? 0 : Math.max(0.1, this.trackState.volume);
    this.trackAudioEl.currentTime = 0;

    // 2. Iniciar reproducción
    try {
      const playPromise = this.trackAudioEl.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
      this.trackState.isPlaying = true;
      this.emitTrackState();
    } catch (err: any) {
      console.warn("Fallo reproducción inicial, resolviendo URL autorizada de Supabase...", err);

      try {
        const signedUrl = await resolvePlayableUrl(track.url);
        if (signedUrl && signedUrl !== this.trackAudioEl.src) {
          this.trackAudioEl.src = signedUrl;
          await this.trackAudioEl.play();
          this.trackState.isPlaying = true;
          this.emitTrackState();
          return;
        }
      } catch (retryErr) {
        console.error("Error definitivo al reproducir pista:", retryErr);
      }

      this.trackState.isPlaying = false;
      this.emitTrackState();
    }
  }

  pauseTrack() {
    if (this.trackAudioEl) {
      this.trackAudioEl.pause();
    }
    this.trackState.isPlaying = false;
    this.emitTrackState();
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.playbackState = "paused";
      } catch {
        // ignore
      }
    }
  }

  async resumeTrack() {
    this.ensureTrackAudioElement();
    if (!this.trackAudioEl) return;
    if (this.activeTrack) {
      this.setupTrackMediaSession(this.activeTrack);
    }
    try {
      await this.trackAudioEl.play();
      this.trackState.isPlaying = true;
      this.emitTrackState();
    } catch (err) {
      console.warn("Error al reanudar pista:", err);
      // Reintentar con URL firmada
      if (this.activeTrack) {
        try {
          const signedUrl = await resolvePlayableUrl(this.activeTrack.url);
          if (signedUrl && signedUrl !== this.trackAudioEl.src) {
            this.trackAudioEl.src = signedUrl;
            await this.trackAudioEl.play();
            this.trackState.isPlaying = true;
            this.emitTrackState();
          }
        } catch {
          // ignore
        }
      }
    }
  }

  stopTrack() {
    if (this.trackAudioEl) {
      this.trackAudioEl.pause();
      this.trackAudioEl.src = "";
    }
    this.activeTrack = null;
    this.trackState.track = null;
    this.trackState.isPlaying = false;
    this.trackState.currentTime = 0;
    this.trackState.duration = 0;
    this.stopBackgroundSession();
    this.emitTrackState();
  }

  seekTrack(seconds: number) {
    if (this.trackAudioEl) {
      this.trackAudioEl.currentTime = seconds;
      this.trackState.currentTime = seconds;
      this.emitTrackState();
    }
  }

  setTrackVolume(v: number) {
    this.trackState.volume = v;
    if (this.trackAudioEl) {
      this.trackAudioEl.volume = this.trackState.isMuted ? 0 : v;
    }
    this.emitTrackState();
  }

  toggleTrackMute() {
    this.trackState.isMuted = !this.trackState.isMuted;
    if (this.trackAudioEl) {
      this.trackAudioEl.volume = this.trackState.isMuted ? 0 : this.trackState.volume;
      this.trackAudioEl.muted = this.trackState.isMuted;
    }
    this.emitTrackState();
  }

  /**
   * Desbloquea el AudioContext en la primera interacción del usuario en la ventana
   */
  unlockAudio() {
    const unlock = () => {
      const ctx = this.ensure();
      if (ctx.state === "suspended") {
        void ctx.resume().then(() => {
          const buf = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
        });
      }
      this.ensureSilentCarrier();
      this.ensureTrackAudioElement();

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

/**
 * Hook de React para conectar cualquier componente al reproductor de pistas global
 */
export function useTrackPlayer() {
  const engine = getAudioEngine();
  const [state, setState] = useState<TrackPlayerState>(engine.getTrackState());

  useEffect(() => {
    return engine.subscribeTrackState(setState);
  }, [engine]);

  return {
    ...state,
    playTrack: (track: TrackInfo) => engine.playTrack(track),
    pauseTrack: () => engine.pauseTrack(),
    resumeTrack: () => engine.resumeTrack(),
    stopTrack: () => engine.stopTrack(),
    seekTrack: (secs: number) => engine.seekTrack(secs),
    setTrackVolume: (vol: number) => engine.setTrackVolume(vol),
    toggleTrackMute: () => engine.toggleTrackMute(),
  };
}
