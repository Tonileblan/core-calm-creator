import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Pause,
  Play,
  Timer,
  Trash2,
  Music4,
  ExternalLink,
  Loader2,
  Upload,
  Cloud,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
  Sparkles,
} from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SOUND_PRESETS, getAudioEngine, type SoundId } from "@/lib/audio-engine";
import { extractYouTubeVideoId, isYouTubeUrl } from "@/lib/youtube-audio";
import { procesarCancionServerFn } from "@/lib/soundtrack.functions";
import {
  uploadAudioToSupabase,
  eliminarCancionDeSupabase,
  resolvePlayableUrl,
} from "@/lib/supabase-soundtrack";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/audio")({
  head: () => ({
    meta: [
      { title: "Audio, frecuencias y banda sonora vital · Blowmind" },
      {
        name: "description",
        content:
          "Ondas binaurales Alpha, Theta y Delta, ruido blanco, marrón y rosa con temporizador, más tu banda sonora vital por momentos.",
      },
      { property: "og:title", content: "Ecosistema sonoro · Blowmind" },
      {
        property: "og:description",
        content:
          "Controla tu estado neurofisiológico con frecuencias binaurales y ruidos de fondo, y ancla tus canciones a cada momento.",
      },
    ],
  }),
  component: AudioPage,
});

const CATEGORIAS = [
  { id: "celebrar", label: "Celebrar" },
  { id: "despertar", label: "Despertar" },
  { id: "relajacion", label: "Relajación" },
  { id: "dormir", label: "Dormir" },
] as const;

function AudioPage() {
  return (
    <div className="mx-auto max-w-2xl touch-lock pb-24">
      <AppHeader titulo="Audio & Música" subtitulo="Frecuencias, ruido y tus anclas." />
      <div className="px-5">
        <Tabs defaultValue="frecuencias">
          <TabsList className="w-full bg-secondary/60">
            <TabsTrigger value="frecuencias" className="flex-1">
              Frecuencias
            </TabsTrigger>
            <TabsTrigger value="banda" className="flex-1">
              Banda sonora vital
            </TabsTrigger>
          </TabsList>
          <TabsContent value="frecuencias" className="pt-6">
            <Frecuencias />
          </TabsContent>
          <TabsContent value="banda" className="pt-6">
            <BandaSonora />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Frecuencias() {
  const engine = getAudioEngine();
  const [playing, setPlaying] = useState<SoundId | null>(null);
  const [volumen, setVolumen] = useState(50);
  const [minutos, setMinutos] = useState(0);
  const [restante, setRestante] = useState(0);

  useEffect(() => {
    engine.setVolume(volumen / 100);
  }, [volumen, engine]);

  useEffect(() => {
    if (restante <= 0) return;
    const t = window.setInterval(() => {
      setRestante((r) => {
        if (r <= 1) {
          engine.stop();
          setPlaying(null);
          toast.success("Temporizador finalizado");
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [restante, engine]);

  const toggle = (id: SoundId) => {
    const on = engine.play(id);
    setPlaying(on ? id : null);
    if (on && minutos > 0) setRestante(minutos * 60);
    if (!on) setRestante(0);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3">
        {SOUND_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => toggle(p.id)}
            className={
              "surface-panel flex items-center gap-4 p-4 text-left transition-all " +
              (playing === p.id ? "border-primary shadow-glow" : "hover:border-primary/50")
            }
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              {playing === p.id ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{p.nombre}</span>
              <span className="block text-xs text-muted-foreground">{p.descripcion}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="surface-panel space-y-5 p-5">
        <div>
          <Label className="text-xs text-muted-foreground">Volumen: {volumen}%</Label>
          <Slider
            className="mt-3"
            value={[volumen]}
            max={100}
            step={1}
            onValueChange={(v) => setVolumen(v[0] ?? 50)}
          />
        </div>
        <div>
          <Label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Timer className="h-3.5 w-3.5" /> Temporizador
          </Label>
          <div className="mt-3 flex flex-wrap gap-2">
            {[0, 10, 20, 30, 60].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMinutos(m);
                  if (playing) setRestante(m * 60);
                }}
                className={
                  "rounded-full border px-3 py-1.5 text-xs transition-colors " +
                  (minutos === m
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground")
                }
              >
                {m === 0 ? "Continuo" : `${m} min`}
              </button>
            ))}
          </div>
          {restante > 0 ? (
            <p className="mt-3 text-xs text-primary">
              Quedan {Math.floor(restante / 60)}:
              {String(restante % 60).padStart(2, "0")}
            </p>
          ) : null}
        </div>
        <p className="text-[0.7rem] text-muted-foreground">
          Las ondas binaurales requieren auriculares para que cada oído reciba su
          frecuencia.
        </p>
      </div>
    </div>
  );
}

type TrackActivo = {
  id: string;
  nombre: string;
  artista: string | null;
  url: string;
  categoria: string;
};

function BandaSonora() {
  const { user, signedIn } = useAuth();
  const queryClient = useQueryClient();
  const procesar = useServerFn(procesarCancionServerFn);

  const [categoria, setCategoria] = useState<string>("celebrar");
  const [nombre, setNombre] = useState("");
  const [artista, setArtista] = useState("");
  const [url, setUrl] = useState("");
  const [archivoAudio, setArchivoAudio] = useState<File | null>(null);
  const [progresoEstado, setProgresoEstado] = useState<string | null>(null);

  // Estado del reproductor integrado universal
  const [trackActivo, setTrackActivo] = useState<TrackActivo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isYoutube = isYouTubeUrl(url);

  // Carga del script oficial de YouTube Iframe API para reproducción integrada en background
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!(window as any).YT) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
      }
    }
  }, []);

  const { data: canciones = [] } = useQuery({
    queryKey: ["soundtrack", user?.id],
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vital_soundtrack")
        .select("id, nombre_cancion, artista, categoria_momento, url_enlace")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Inicia sesión para guardar tus canciones.");
      if (!archivoAudio && !url.trim()) {
        throw new Error("Pega un enlace de YouTube o selecciona un archivo de audio.");
      }

      if (archivoAudio) {
        setProgresoEstado("Subiendo archivo local a Supabase Storage...");
        const publicUrl = await uploadAudioToSupabase(user.id, archivoAudio, archivoAudio.name);
        const songTitle = nombre.trim() || archivoAudio.name.replace(/\.[^/.]+$/, "");
        const { error } = await supabase.from("vital_soundtrack").insert({
          user_id: user.id,
          nombre_cancion: songTitle,
          artista: artista.trim() || null,
          categoria_momento: categoria,
          url_enlace: publicUrl,
        });
        if (error) throw error;
      } else {
        setProgresoEstado("Descargando video/audio y guardando en Supabase...");
        await procesar({
          data: {
            nombre: nombre.trim() || undefined,
            artista: artista.trim() || undefined,
            categoria,
            url: url.trim(),
          },
        });
      }
    },
    onSuccess: () => {
      setNombre("");
      setArtista("");
      setUrl("");
      setArchivoAudio(null);
      setProgresoEstado(null);
      void queryClient.invalidateQueries({ queryKey: ["soundtrack"] });
      toast.success("Canción guardada y lista para reproducir");
    },
    onError: (e: Error) => {
      setProgresoEstado(null);
      toast.error(e.message);
    },
  });

  const del = useMutation({
    mutationFn: async (cancion: { id: string; url_enlace: string }) => {
      if (trackActivo?.id === cancion.id) {
        detenerReproduccion();
      }
      await eliminarCancionDeSupabase(cancion.id, cancion.url_enlace);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["soundtrack"] });
      toast.success("Canción eliminada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const detenerReproduccion = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    if (ytPlayerRef.current?.pauseVideo) {
      ytPlayerRef.current.pauseVideo();
    }
    setTrackActivo(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  };

  // Reproducción universal: reproduce directamente archivo Supabase o YouTube en segundo plano
  const playTrack = (s: { id: string; nombre_cancion: string; artista: string | null; categoria_momento: string; url_enlace: string }) => {
    const isThisActive = trackActivo?.id === s.id;
    const ytId = extractYouTubeVideoId(s.url_enlace);

    if (isThisActive) {
      if (isPlaying) {
        if (ytId && ytPlayerRef.current?.pauseVideo) {
          ytPlayerRef.current.pauseVideo();
        } else if (audioRef.current) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
      } else {
        if (ytId && ytPlayerRef.current?.playVideo) {
          ytPlayerRef.current.playVideo();
        } else if (audioRef.current) {
          audioRef.current.play().catch(() => toast.error("Error al reproducir audio"));
        }
        setIsPlaying(true);
      }
      return;
    }

    // Nuevo track seleccionado
    setTrackActivo({
      id: s.id,
      nombre: s.nombre_cancion,
      artista: s.artista,
      url: s.url_enlace,
      categoria: s.categoria_momento,
    });
    setCurrentTime(0);
    setDuration(0);

    if (ytId) {
      // Reproducir vía YouTube API
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      if ((window as any).YT && (window as any).YT.Player) {
        if (!ytPlayerRef.current) {
          ytPlayerRef.current = new (window as any).YT.Player("flowmind-yt-audio-container", {
            height: "1",
            width: "1",
            videoId: ytId,
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              fs: 0,
              playsinline: 1,
            },
            events: {
              onReady: (event: any) => {
                event.target.setVolume(volume * 100);
                event.target.playVideo();
                setIsPlaying(true);
              },
              onStateChange: (event: any) => {
                if (event.data === 1) setIsPlaying(true);
                else if (event.data === 2 || event.data === 0) setIsPlaying(false);
              },
            },
          });
        } else {
          ytPlayerRef.current.loadVideoById(ytId);
          ytPlayerRef.current.setVolume(volume * 100);
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
        }
      } else {
        toast.info("Iniciando reproductor...", { description: s.nombre_cancion });
      }
    } else {
      // Reproducir vía HTML5 Audio nativo (Supabase storage / archivo local)
      if (ytPlayerRef.current?.pauseVideo) {
        ytPlayerRef.current.pauseVideo();
      }

      if (audioRef.current) {
        audioRef.current.src = s.url_enlace;
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {
          toast.error("Error al reproducir el archivo de audio.");
          setIsPlaying(false);
        });
      }
    }
  };

  // Sincronización continua de tiempo de reproducción
  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      const ytId = trackActivo?.url ? extractYouTubeVideoId(trackActivo.url) : null;
      if (ytId && ytPlayerRef.current?.getCurrentTime) {
        const cur = ytPlayerRef.current.getCurrentTime() || 0;
        const dur = ytPlayerRef.current.getDuration() || 0;
        setCurrentTime(cur);
        if (dur > 0) setDuration(dur);
      } else if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime || 0);
        if (audioRef.current.duration) setDuration(audioRef.current.duration);
      }
    }, 300);
    return () => window.clearInterval(interval);
  }, [isPlaying, trackActivo]);

  const seek = (seconds: number) => {
    const ytId = trackActivo?.url ? extractYouTubeVideoId(trackActivo.url) : null;
    if (ytId && ytPlayerRef.current?.seekTo) {
      ytPlayerRef.current.seekTo(seconds, true);
      setCurrentTime(seconds);
    } else if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const skipTime = (delta: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + delta));
    seek(newTime);
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    setIsMuted(false);
    if (audioRef.current) {
      audioRef.current.volume = v;
      audioRef.current.muted = false;
    }
    if (ytPlayerRef.current?.setVolume) {
      ytPlayerRef.current.setVolume(v * 100);
      ytPlayerRef.current.unMute();
    }
  };

  const toggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    if (audioRef.current) audioRef.current.muted = newMute;
    if (ytPlayerRef.current) {
      if (newMute) ytPlayerRef.current.mute();
      else ytPlayerRef.current.unMute();
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (!signedIn) {
    return (
      <p className="surface-panel p-6 text-center text-sm text-muted-foreground">
        <Link to="/auth" className="text-primary underline">
          Inicia sesión
        </Link>{" "}
        para crear tu diario musical de estados de ánimo y guardar tus canciones en Supabase.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Contenedores ocultos de audio nativo y YouTube iframe */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsPlaying(false)}
      />
      <div id="flowmind-yt-audio-container" className="hidden pointer-events-none opacity-0 w-0 h-0 overflow-hidden" />

      {/* Formulario de adición */}
      <div className="surface-panel space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoria(c.id)}
              className={
                "rounded-full border px-3 py-1.5 text-xs transition-colors cursor-pointer " +
                (categoria === c.id
                  ? "border-primary bg-primary/15 text-primary font-semibold"
                  : "border-border text-muted-foreground hover:border-primary/40")
              }
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre de la canción (opcional si es enlace de YouTube)"
          />
          <Input
            value={artista}
            onChange={(e) => setArtista(e.target.value)}
            placeholder="Artista (opcional)"
          />
          <Input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (e.target.value) setArchivoAudio(null);
            }}
            placeholder="Enlace de YouTube o Spotify"
          />
        </div>

        {/* Notificación inteligente al detectar enlace de YouTube */}
        {isYoutube && (
          <div className="flex items-center gap-2 rounded-2xl bg-primary/10 border border-primary/30 p-3 text-xs text-primary animate-in fade-in zoom-in-95 duration-200">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>
              <strong>Enlace de YouTube detectado:</strong> Blowmind descargará y guardará el video/audio en tu base de datos Supabase para reproducirlo sin depender de YouTube.
            </span>
          </div>
        )}

        {/* Selector alternativo de archivo local */}
        <div className="flex items-center justify-between pt-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/mp4"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setArchivoAudio(file);
                setUrl("");
                if (!nombre) setNombre(file.name.replace(/\.[^/.]+$/, ""));
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>
              {archivoAudio ? `Archivo: ${archivoAudio.name}` : "O sube un archivo (MP3/MP4)"}
            </span>
          </button>

          {archivoAudio && (
            <button
              onClick={() => {
                setArchivoAudio(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-xs text-destructive hover:underline cursor-pointer"
            >
              Quitar
            </button>
          )}
        </div>

        {/* Estado de progreso */}
        {progresoEstado && (
          <div className="flex items-center gap-2 rounded-2xl bg-secondary p-3 text-xs text-muted-foreground animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            <span>{progresoEstado}</span>
          </div>
        )}

        <Button
          className="w-full rounded-full h-11 text-sm font-semibold shadow-md"
          disabled={add.isPending}
          onClick={() => add.mutate()}
        >
          {add.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando y guardando…
            </>
          ) : (
            `Guardar en ${CATEGORIAS.find((c) => c.id === categoria)?.label} (Supabase)`
          )}
        </Button>
      </div>

      {/* Lista de canciones por categoría */}
      {CATEGORIAS.map((c) => {
        const lista = canciones.filter((s) => s.categoria_momento === c.id);
        if (!lista.length) return null;
        return (
          <div key={c.id}>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="font-display text-lg font-semibold">{c.label}</h3>
              <span className="text-xs text-muted-foreground">{lista.length} canciones</span>
            </div>

            <div className="space-y-2">
              {lista.map((s) => {
                const isThisPlaying = trackActivo?.id === s.id && isPlaying;
                const isThisActive = trackActivo?.id === s.id;
                const isSupabaseHosted = s.url_enlace.includes("supabase.co") || s.url_enlace.includes("/storage/v1/");

                return (
                  <div
                    key={s.id}
                    className={cn(
                      "surface-panel flex items-center gap-3 px-4 py-3 transition-all duration-200",
                      isThisActive ? "border-primary/60 bg-primary/5 shadow-sm" : "hover:border-border",
                    )}
                  >
                    {/* Botón de reproducción directa en la app */}
                    <button
                      onClick={() => playTrack(s)}
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all active:scale-95 cursor-pointer",
                        isThisPlaying
                          ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.5)]"
                          : "bg-secondary text-foreground hover:bg-primary/20 hover:text-primary",
                      )}
                      aria-label={isThisPlaying ? "Pausar" : "Reproducir"}
                    >
                      {isThisPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4 ml-0.5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn("truncate text-sm font-medium", isThisActive ? "text-primary font-semibold" : "")}>
                          {s.nombre_cancion}
                        </p>
                        {isSupabaseHosted ? (
                          <span className="inline-flex items-center gap-1 text-[0.6rem] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary shrink-0 font-medium">
                            <Cloud className="h-2.5 w-2.5" />
                            Supabase
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[0.6rem] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">
                            Enlace
                          </span>
                        )}
                      </div>
                      {s.artista ? (
                        <p className="truncate text-xs text-muted-foreground mt-0.5">
                          {s.artista}
                        </p>
                      ) : null}
                    </div>

                    <a
                      href={s.url_enlace}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground/60 transition-colors hover:text-foreground p-1"
                      title="Abrir enlace original"
                      aria-label={`Abrir ${s.nombre_cancion}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>

                    <button
                      onClick={() => del.mutate({ id: s.id, url_enlace: s.url_enlace })}
                      disabled={del.isPending}
                      className="text-muted-foreground/60 transition-colors hover:text-destructive p-1 cursor-pointer"
                      title="Eliminar de Supabase"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Barra de Reproducción Flotante Integrada en Blowmind */}
      {trackActivo && (
        <div className="fixed bottom-20 left-4 right-4 z-40 max-w-2xl mx-auto rounded-3xl border border-primary/40 bg-surface/95 backdrop-blur-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                <Music4 className={cn("h-5 w-5", isPlaying ? "animate-bounce" : "")} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {trackActivo.nombre}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {trackActivo.artista ?? "Banda sonora vital"} · <span className="capitalize">{trackActivo.categoria}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={detenerReproduccion}
                className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground cursor-pointer hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Barra de progreso interactiva */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[0.65rem] tabular-nums text-muted-foreground w-8">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                className="flex-1 h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <span className="text-[0.65rem] tabular-nums text-muted-foreground w-8 text-right">
                {formatTime(duration)}
              </span>
            </div>

            {/* Controles de reproducción */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => changeVolume(Number(e.target.value))}
                  className="w-16 h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => skipTime(-10)}
                  className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                  title="Retroceder 10 segundos"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    const ytId = trackActivo?.url ? extractYouTubeVideoId(trackActivo.url) : null;
                    if (isPlaying) {
                      if (ytId && ytPlayerRef.current?.pauseVideo) {
                        ytPlayerRef.current.pauseVideo();
                      } else if (audioRef.current) {
                        audioRef.current.pause();
                      }
                      setIsPlaying(false);
                    } else {
                      if (ytId && ytPlayerRef.current?.playVideo) {
                        ytPlayerRef.current.playVideo();
                      } else if (audioRef.current) {
                        audioRef.current.play().catch(() => toast.error("Error al reproducir"));
                      }
                      setIsPlaying(true);
                    }
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 ml-0.5" />
                  )}
                </button>
                <button
                  onClick={() => skipTime(10)}
                  className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                  title="Avanzar 10 segundos"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </div>

              <div className="w-20 text-right">
                <span className="text-[0.65rem] text-primary font-medium flex items-center justify-end gap-1">
                  <Cloud className="h-3 w-3" /> Supabase
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
