/**
 * Blowmind audio engine — motor de audio universal que soporta:
 * 1. Síntesis Web Audio para frecuencias binaurales y ruido blanco/marrón/rosa.
 * 2. Reproductor nativo HTML5 Audio para pistas alojadas en Supabase Storage y archivos locales.
 * 3. Puente YouTube Audio con IFrame API para reproducir cualquier video de YouTube sin bloqueos.
 * 4. Integración completa con MediaSession API y WakeLock para reproducción continua en segundo plano y pantalla bloqueada.
 */

import { useEffect, useState } from "react";
import { resolvePlayableUrlSync, resolvePlayableUrl } from "./supabase-soundtrack";
import { isYouTubeUrl, extractYouTubeVideoId } from "./youtube-audio";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

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
 * Carga el script oficial de la API IFrame de YouTube de forma asíncrona
 */
function loadYouTubeIframeApi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve();
    if (window.YT && window.YT.Player) return resolve();

    const existing = document.getElementById("flowmind-yt-api-script");
    if (!existing) {
      const tag = document.createElement("script");
      tag.id = "flowmind-yt-api-script";
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScript = document.getElementsByTagName("script")[0];
      firstScript?.parentNode?.insertBefore(tag, firstScript);
    }

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevReady) prevReady();
      resolve();
    };

    const interval = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(interval);
        resolve();
      }
    }, 80);

    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, 4000);
  });
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
  private trackAudioEl: HTMLAudioElement | null = null;
  private ytPlayer: any = null;
  private ytTicker: number | null = null;
  private isYtMode = false;
  private playSessionId = 0;

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

  private bgKeeperAudioEl: HTMLAudioElement | null = null;
  private streamAudioEl: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      const resumeIfActive = () => {
        if (this._playing !== null || this.alarmInterval !== null) {
          if (this.ctx && (this.ctx.state === "suspended" || (this.ctx as any).state === "interrupted")) {
            void this.ctx.resume();
          }
          this.startBackgroundKeeper();
        }
        if (this.trackState.isPlaying) {
          if (this.isYtMode && this.ytPlayer?.playVideo) {
            try { this.ytPlayer.playVideo(); } catch {}
          } else if (this.trackAudioEl && this.trackAudioEl.paused && this.trackAudioEl.src) {
            void this.trackAudioEl.play().catch(() => {});
          }
          this.startBackgroundKeeper();
        }
      };

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          resumeIfActive();
        }
      });
      window.addEventListener("focus", resumeIfActive);
      window.addEventListener("pageshow", resumeIfActive);
    }
  }

  /**
   * Mantiene viva la sesión de audio en segundo plano en iOS / WebKit
   */
  private startBackgroundKeeper() {
    if (typeof window === "undefined") return;
    try {
      if (!this.bgKeeperAudioEl) {
        const audio = document.createElement("audio");
        audio.setAttribute("playsinline", "true");
        audio.setAttribute("webkit-playsinline", "true");
        audio.setAttribute("preload", "auto");
        audio.setAttribute("loop", "true");
        (audio as any).playsInline = true;
        audio.src = "/audio/silence.m4a";
        audio.volume = 0.01;
        audio.style.position = "fixed";
        audio.style.bottom = "0";
        audio.style.left = "0";
        audio.style.width = "1px";
        audio.style.height = "1px";
        audio.style.opacity = "0.01";
        audio.style.pointerEvents = "none";
        audio.style.zIndex = "-999";
        document.body.appendChild(audio);
        this.bgKeeperAudioEl = audio;
      }
      if (this.bgKeeperAudioEl.paused) {
        void this.bgKeeperAudioEl.play().catch(() => {});
      }
    } catch {}
  }

  private stopBackgroundKeeper() {
    if (this.bgKeeperAudioEl && !this.bgKeeperAudioEl.paused) {
      try {
        this.bgKeeperAudioEl.pause();
      } catch {}
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
      this.master.connect(this.ctx.destination);

      // Puente MediaStreamDestination para que iOS trate el Web Audio como streaming de medios
      if (typeof (this.ctx as any).createMediaStreamDestination === "function") {
        try {
          const streamDest = (this.ctx as any).createMediaStreamDestination();
          this.master.connect(streamDest);
          if (!this.streamAudioEl) {
            const streamAudio = document.createElement("audio");
            streamAudio.setAttribute("playsinline", "true");
            streamAudio.setAttribute("webkit-playsinline", "true");
            (streamAudio as any).playsInline = true;
            streamAudio.autoplay = true;
            streamAudio.srcObject = streamDest.stream;
            streamAudio.style.position = "fixed";
            streamAudio.style.bottom = "0";
            streamAudio.style.left = "0";
            streamAudio.style.width = "1px";
            streamAudio.style.height = "1px";
            streamAudio.style.opacity = "0.01";
            streamAudio.style.pointerEvents = "none";
            streamAudio.style.zIndex = "-999";
            document.body.appendChild(streamAudio);
            this.streamAudioEl = streamAudio;
            void streamAudio.play().catch(() => {});
          }
        } catch {}
      }
    }
    if (this.ctx.state === "suspended" || (this.ctx as any).state === "interrupted") {
      void this.ctx.resume();
    }
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

    if (!this.trackState.isPlaying && this.alarmInterval === null) {
      this.stopBackgroundKeeper();
    }

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

    this.startBackgroundKeeper();

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

    // MediaSession para frecuencias binaurales
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: preset.nombre,
          artist: "Frecuencias · Blowmind",
          album: "Terapia de Sonido Neurofisiológica",
          artwork: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          ],
        });
        navigator.mediaSession.playbackState = "playing";
        navigator.mediaSession.setActionHandler("stop", () => this.stop());
        navigator.mediaSession.setActionHandler("pause", () => this.stop());
      } catch {}
    }

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
   * Reproduce una melodía de alarma que suena continuamente hasta cancelarla
   */
  playAlarmMelody(soundId = "zen") {
    this.stopAlarm();
    const ctx = this.ensure();
    if (ctx.state === "suspended") void ctx.resume();

    this.startBackgroundKeeper();

    const melodias: Record<string, number[]> = {
      zen: [528, 660, 792, 990, 792, 660],
      aurora: [396, 528, 639, 741, 852, 639],
      energica: [440, 554.37, 659.25, 880, 659.25, 554.37],
      chime: [528, 528, 660, 792],
    };

    const escala = melodias[soundId] ?? melodias["zen"]!;
    let paso = 0;

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

    tocarNota();
    this.alarmInterval = window.setInterval(tocarNota, 700);
  }

  stopAlarm() {
    if (this.alarmInterval) {
      window.clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
    this.stop(0.4);
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
        navigator.mediaSession.setActionHandler("seekforward", (details) => {
          this.seekTrack(this.trackState.currentTime + (details.seekOffset || 10));
        });
        navigator.mediaSession.setActionHandler("seekbackward", (details) => {
          this.seekTrack(Math.max(0, this.trackState.currentTime - (details.seekOffset || 10)));
        });
      } catch (e) {
        console.warn("MediaSession API error:", e);
      }
    }
  }

  /**
   * Actualiza el estado dinámico de posición en la pantalla de bloqueo de iOS
   */
  private updateMediaSessionPosition() {
    if (
      typeof navigator !== "undefined" &&
      "mediaSession" in navigator &&
      "setPositionState" in navigator.mediaSession &&
      this.trackState.duration > 0
    ) {
      try {
        navigator.mediaSession.setPositionState({
          duration: this.trackState.duration,
          playbackRate: 1,
          position: Math.min(this.trackState.currentTime, this.trackState.duration),
        });
      } catch {}
    }
  }

  /**
   * Inicializa el elemento HTML5 Audio para pistas directas (Supabase, locales, MP3, M4A)
   */
  private ensureTrackAudioElement() {
    if (typeof window === "undefined") return;
    if (!this.trackAudioEl) {
      const audio = document.createElement("audio");
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      audio.setAttribute("x-webkit-airplay", "allow");
      audio.setAttribute("preload", "auto");
      (audio as any).playsInline = true;
      audio.volume = this.trackState.isMuted ? 0 : Math.max(0.1, this.trackState.volume);
      audio.style.position = "fixed";
      audio.style.bottom = "0";
      audio.style.left = "0";
      audio.style.width = "1px";
      audio.style.height = "1px";
      audio.style.opacity = "0.01";
      audio.style.pointerEvents = "none";
      audio.style.zIndex = "-999";

      audio.addEventListener("timeupdate", () => {
        if (!this.isYtMode && this.activeTrack) {
          this.trackState.currentTime = audio.currentTime || 0;
          this.updateMediaSessionPosition();
          this.emitTrackState();
        }
      });
      audio.addEventListener("loadedmetadata", () => {
        if (!this.isYtMode && this.activeTrack) {
          this.trackState.duration = audio.duration || 0;
          this.updateMediaSessionPosition();
          this.emitTrackState();
        }
      });
      audio.addEventListener("play", () => {
        if (!this.isYtMode && this.activeTrack) {
          this.trackState.isPlaying = true;
          this.startBackgroundKeeper();
          if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
            try { navigator.mediaSession.playbackState = "playing"; } catch {}
          }
          this.emitTrackState();
        }
      });
      audio.addEventListener("pause", () => {
        if (!this.isYtMode && this.activeTrack) {
          this.trackState.isPlaying = false;
          if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
            try { navigator.mediaSession.playbackState = "paused"; } catch {}
          }
          this.emitTrackState();
        }
      });
      audio.addEventListener("ended", () => {
        if (!this.isYtMode) {
          this.trackState.isPlaying = false;
          this.stopBackgroundKeeper();
          if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
            try { navigator.mediaSession.playbackState = "none"; } catch {}
          }
          this.emitTrackState();
        }
      });
      audio.addEventListener("error", (e) => {
        if (!this.isYtMode && this.activeTrack && audio.src) {
          console.warn("Audio element error on src:", audio.src, audio.error, e);
          const currentSession = this.playSessionId;
          const currentTrack = this.activeTrack;
          if (!audio.src.includes("token=")) {
            void resolvePlayableUrl(currentTrack.url, currentTrack.id).then((signedUrl) => {
              if (this.playSessionId === currentSession && signedUrl && signedUrl !== audio.src) {
                audio.src = signedUrl;
                void audio.play().catch(() => {
                  if (this.playSessionId === currentSession) {
                    this.trackState.isPlaying = false;
                    this.emitTrackState();
                  }
                });
              }
            });
          }
        }
      });

      document.body.appendChild(audio);
      this.trackAudioEl = audio;
    }
  }

  /**
   * Inicializa el reproductor de YouTube oficial en segundo plano
   */
  private async ensureYouTubePlayer(): Promise<any> {
    if (typeof window === "undefined") return null;
    await loadYouTubeIframeApi();

    return new Promise((resolve) => {
      if (this.ytPlayer) return resolve(this.ytPlayer);

      let container = document.getElementById("flowmind-yt-audio-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "flowmind-yt-audio-container";
        container.style.position = "fixed";
        container.style.width = "1px";
        container.style.height = "1px";
        container.style.bottom = "0";
        container.style.right = "0";
        container.style.opacity = "0.01";
        container.style.pointerEvents = "none";
        container.style.zIndex = "-1";
        document.body.appendChild(container);

        const targetDiv = document.createElement("div");
        targetDiv.id = "flowmind-yt-target-iframe";
        container.appendChild(targetDiv);
      }

      if (!window.YT || !window.YT.Player) {
        return resolve(null);
      }

      try {
        this.ytPlayer = new window.YT.Player("flowmind-yt-target-iframe", {
          height: "1",
          width: "1",
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: () => {
              resolve(this.ytPlayer);
            },
            onStateChange: (event: any) => {
              if (!this.isYtMode) return;
              const state = event.data;
              if (state === 1) {
                // Playing
                this.trackState.isPlaying = true;
                this.trackState.duration = this.ytPlayer.getDuration() || this.trackState.duration;
                this.startYtTicker();
                this.emitTrackState();
              } else if (state === 2) {
                // Paused
                this.trackState.isPlaying = false;
                this.stopYtTicker();
                this.emitTrackState();
              } else if (state === 0) {
                // Ended
                this.trackState.isPlaying = false;
                this.stopYtTicker();
                this.emitTrackState();
              }
            },
            onError: (e: any) => {
              console.warn("YouTube iframe player error:", e);
              if (this.isYtMode) {
                this.trackState.isPlaying = false;
                this.stopYtTicker();
                this.emitTrackState();
              }
            },
          },
        });
      } catch {
        resolve(null);
      }
    });
  }

  private startYtTicker() {
    this.stopYtTicker();
    this.ytTicker = window.setInterval(() => {
      if (this.isYtMode && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === "function") {
        try {
          this.trackState.currentTime = this.ytPlayer.getCurrentTime() || 0;
          this.trackState.duration = this.ytPlayer.getDuration() || this.trackState.duration;
          this.emitTrackState();
        } catch {}
      }
    }, 500);
  }

  private stopYtTicker() {
    if (this.ytTicker) {
      window.clearInterval(this.ytTicker);
      this.ytTicker = null;
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
   * Reproduce una pista (sea audio nativo de Supabase, local o YouTube) de manera
   * 100% síncrona e inmediata, con single-flight session ID para evitar condiciones de carrera.
   */
  async playTrack(track: TrackInfo) {
    // Si se pulsa la misma pista que ya está seleccionada: toggle play / pause
    const isSameTrack =
      this.activeTrack &&
      (this.activeTrack.id === track.id ||
        (this.activeTrack.url && this.activeTrack.url === track.url));

    if (isSameTrack) {
      if (this.trackState.isPlaying) {
        this.pauseTrack();
      } else {
        await this.resumeTrack();
      }
      return;
    }

    // Nueva reproducción: incrementar ID de sesión para invalidar callbacks previos
    const currentSession = ++this.playSessionId;

    // Detener cualquier síntesis o alarma activa
    if (this._playing) {
      this.stop(0.2);
    }
    this.stopAlarm();

    // Detener cualquier reproducción previa inmediatamente
    if (this.trackAudioEl) {
      this.trackAudioEl.pause();
    }
    if (this.ytPlayer?.pauseVideo) {
      try { this.ytPlayer.pauseVideo(); } catch {}
    }
    this.stopYtTicker();

    // Establecer estado activo de la nueva pista
    this.activeTrack = track;
    this.trackState.track = track;
    this.trackState.currentTime = 0;
    this.trackState.duration = 0;
    this.trackState.isPlaying = true;
    this.emitTrackState();

    this.setupTrackMediaSession(track);
    this.startBackgroundKeeper();

    const isYt = isYouTubeUrl(track.url);
    const directUrl = resolvePlayableUrlSync(track.url);

    if (directUrl && !isYt) {
      // ── MODO 1: REPRODUCCIÓN NATIVA INMEDIATA (99% de los casos: plantillas, Supabase Storage, MP3, M4A) ──
      this.isYtMode = false;
      this.ensureTrackAudioElement();
      if (!this.trackAudioEl) return;

      this.trackAudioEl.src = directUrl;
      this.trackAudioEl.volume = this.trackState.isMuted ? 0 : Math.max(0.1, this.trackState.volume);
      this.trackAudioEl.currentTime = 0;

      try {
        const playPromise = this.trackAudioEl.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
        if (this.playSessionId === currentSession) {
          this.trackState.isPlaying = true;
          this.emitTrackState();
        }
      } catch (err) {
        if (this.playSessionId !== currentSession) return;
        console.warn("Fallo reproducción directa, resolviendo URL autorizada...", err);
        try {
          const resolved = await resolvePlayableUrl(track.url, track.id);
          if (this.playSessionId === currentSession && resolved && this.trackAudioEl) {
            this.trackAudioEl.src = resolved;
            await this.trackAudioEl.play();
            this.trackState.isPlaying = true;
            this.emitTrackState();
          }
        } catch {
          if (this.playSessionId === currentSession) {
            this.trackState.isPlaying = false;
            this.emitTrackState();
          }
        }
      }
    } else {
      // ── MODO 2: ENLACE YOUTUBE NO DESCARGADO ──
      // Resolver audio en servidor a Supabase Storage y reproducir nativo
      try {
        const resolved = await resolvePlayableUrl(track.url, track.id);
        if (this.playSessionId !== currentSession) return;

        if (resolved && !isYouTubeUrl(resolved)) {
          track.url = resolved;
          this.isYtMode = false;
          this.ensureTrackAudioElement();
          if (this.trackAudioEl) {
            this.trackAudioEl.src = resolved;
            this.trackAudioEl.volume = this.trackState.isMuted ? 0 : Math.max(0.1, this.trackState.volume);
            this.trackAudioEl.currentTime = 0;
            await this.trackAudioEl.play();
            this.trackState.isPlaying = true;
            this.emitTrackState();
            return;
          }
        }
      } catch (e) {
        console.warn("Error resolviendo audio de YouTube:", e);
      }

      // Fallback a YouTube IFrame si no se pudo descargar
      if (this.playSessionId !== currentSession) return;
      this.isYtMode = true;
      const videoId = extractYouTubeVideoId(track.url);
      if (videoId) {
        const player = await this.ensureYouTubePlayer();
        if (this.playSessionId === currentSession && player) {
          try {
            player.setVolume((this.trackState.isMuted ? 0 : this.trackState.volume) * 100);
            if (typeof player.loadVideoById === "function") {
              player.loadVideoById(videoId);
              player.playVideo();
            }
            this.trackState.isPlaying = true;
            this.startYtTicker();
            this.emitTrackState();
          } catch {}
        }
      }
    }
  }

  pauseTrack() {
    if (this.isYtMode && this.ytPlayer?.pauseVideo) {
      try { this.ytPlayer.pauseVideo(); } catch {}
      this.stopYtTicker();
    } else if (this.trackAudioEl) {
      this.trackAudioEl.pause();
    }
    this.trackState.isPlaying = false;
    this.emitTrackState();
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try { navigator.mediaSession.playbackState = "paused"; } catch {}
    }
  }

  async resumeTrack() {
    if (this.activeTrack) {
      this.setupTrackMediaSession(this.activeTrack);
    }
    this.startBackgroundKeeper();
    if (this.isYtMode && this.ytPlayer?.playVideo) {
      try {
        this.ytPlayer.playVideo();
        this.trackState.isPlaying = true;
        this.startYtTicker();
        this.emitTrackState();
      } catch {}
    } else if (this.trackAudioEl) {
      try {
        await this.trackAudioEl.play();
        this.trackState.isPlaying = true;
        this.emitTrackState();
      } catch (err) {
        console.warn("Error al reanudar pista:", err);
      }
    }
  }

  stopTrack() {
    this.playSessionId++;
    this.stopBackgroundKeeper();
    if (this.isYtMode && this.ytPlayer?.stopVideo) {
      try { this.ytPlayer.stopVideo(); } catch {}
      this.stopYtTicker();
    }
    if (this.trackAudioEl) {
      this.trackAudioEl.pause();
      this.trackAudioEl.src = "";
    }
    this.activeTrack = null;
    this.trackState.track = null;
    this.trackState.isPlaying = false;
    this.trackState.currentTime = 0;
    this.trackState.duration = 0;
    this.emitTrackState();
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try { navigator.mediaSession.playbackState = "none"; } catch {}
    }
  }

  seekTrack(seconds: number) {
    if (this.isYtMode && this.ytPlayer?.seekTo) {
      try {
        this.ytPlayer.seekTo(seconds, true);
        this.trackState.currentTime = seconds;
        this.emitTrackState();
      } catch {}
    } else if (this.trackAudioEl) {
      this.trackAudioEl.currentTime = seconds;
      this.trackState.currentTime = seconds;
      this.emitTrackState();
    }
  }

  setTrackVolume(v: number) {
    this.trackState.volume = v;
    if (this.isYtMode && this.ytPlayer?.setVolume) {
      try { this.ytPlayer.setVolume((this.trackState.isMuted ? 0 : v) * 100); } catch {}
    }
    if (this.trackAudioEl) {
      this.trackAudioEl.volume = this.trackState.isMuted ? 0 : v;
    }
    this.emitTrackState();
  }

  toggleTrackMute() {
    this.trackState.isMuted = !this.trackState.isMuted;
    if (this.isYtMode && this.ytPlayer) {
      try {
        if (this.trackState.isMuted) {
          this.ytPlayer.mute();
        } else {
          this.ytPlayer.unMute();
          this.ytPlayer.setVolume(this.trackState.volume * 100);
        }
      } catch {}
    }
    if (this.trackAudioEl) {
      this.trackAudioEl.volume = this.trackState.isMuted ? 0 : this.trackState.volume;
      this.trackAudioEl.muted = this.trackState.isMuted;
    }
    this.emitTrackState();
  }

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
      this.ensureTrackAudioElement();

      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("pointerdown", unlock, { once: true, passive: true });
      window.addEventListener("keydown", unlock, { once: true, passive: true });
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
