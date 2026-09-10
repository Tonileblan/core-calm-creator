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
import { SOUND_PRESETS, getAudioEngine, useTrackPlayer, type SoundId } from "@/lib/audio-engine";
import { getBackgroundTimer } from "@/lib/background-timer";
import { useWakeLock } from "@/hooks/useWakeLock";
import { procesarCancionServerFn } from "@/lib/soundtrack.functions";
import {
  uploadAudioToSupabase,
  eliminarCancionDeSupabase,
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
  const endTimeRef = useRef<number | null>(null);

  // Mantener pantalla encendida si hay audio activo
  useWakeLock(!!playing);

  useEffect(() => {
    engine.setVolume(volumen / 100);
  }, [volumen, engine]);

  useEffect(() => {
    if (restante <= 0) {
      endTimeRef.current = null;
      return;
    }

    if (!endTimeRef.current) {
      endTimeRef.current = Date.now() + restante * 1000;
    }

    const timer = getBackgroundTimer();
    const updateCountdown = () => {
      if (!endTimeRef.current) return;
      const left = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setRestante(left);
      if (left <= 0) {
        engine.stop();
        setPlaying(null);
        endTimeRef.current = null;
        timer.clearInterval("audio-frequencies-timer");
        toast.success("Temporizador finalizado");
      }
    };

    timer.setInterval("audio-frequencies-timer", updateCountdown, 1000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        updateCountdown();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", updateCountdown);

    return () => {
      timer.clearInterval("audio-frequencies-timer");
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", updateCountdown);
    };
  }, [restante, engine]);

  const toggle = (id: SoundId) => {
    const on = engine.play(id);
    setPlaying(on ? id : null);
    if (on && minutos > 0) {
      const sec = minutos * 60;
      endTimeRef.current = Date.now() + sec * 1000;
      setRestante(sec);
    }
    if (!on) {
      endTimeRef.current = null;
      setRestante(0);
    }
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

const PLANTILLAS_SONORAS = [
  {
    id: "plantilla-despertar",
    nombre: "Amanecer Sereno",
    artista: "Blowmind Audio Lab",
    categoria: "despertar",
    descripcion: "Frecuencia acústica suave para iniciar el día con vitalidad y enfoque claro.",
    url: "https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3",
  },
  {
    id: "plantilla-celebrar",
    nombre: "Triunfo & Vitalidad",
    artista: "Blowmind Audio Lab",
    categoria: "celebrar",
    descripcion: "Acordes optimistas para anclar momentos de gratitud, progreso y éxito.",
    url: "https://assets.mixkit.co/music/preview/mixkit-sun-and-sky-578.mp3",
  },
  {
    id: "plantilla-relajacion",
    nombre: "Calma Interior 432Hz",
    artista: "Blowmind Audio Lab",
    categoria: "relajacion",
    descripcion: "Paisaje sonoro orgánico para meditación, respiración y paz mental.",
    url: "https://assets.mixkit.co/music/preview/mixkit-deep-urban-623.mp3",
  },
  {
    id: "plantilla-dormir",
    nombre: "Océano Nocturno Delta",
    artista: "Blowmind Audio Lab",
    categoria: "dormir",
    descripcion: "Texturas envolventes para desacelerar la mente e inducir un sueño profundo.",
    url: "https://assets.mixkit.co/music/preview/mixkit-sleepy-cat-135.mp3",
  },
];

function BandaSonora() {
  const { user, signedIn } = useAuth();
  const queryClient = useQueryClient();
  const procesar = useServerFn(procesarCancionServerFn);

  const [categoria, setCategoria] = useState<string>("celebrar");
  const [nombre, setNombre] = useState("");
  const [artista, setArtista] = useState("");
  const [enlaceAudio, setEnlaceAudio] = useState("");
  const [mostrarEnlaceManual, setMostrarEnlaceManual] = useState(false);
  const [archivoAudio, setArchivoAudio] = useState<File | null>(null);
  const [progresoEstado, setProgresoEstado] = useState<string | null>(null);

  // Reproductor global persistente (no se detiene en segundo plano ni al cambiar de pestaña)
  const player = useTrackPlayer();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Mantener pantalla activa mientras se reproduce música
  useWakeLock(player.isPlaying);

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
      if (!archivoAudio && !enlaceAudio.trim()) {
        throw new Error("Selecciona un archivo de audio (MP3/M4A/WAV) o ingresa un enlace.");
      }

      if (archivoAudio) {
        setProgresoEstado("Subiendo archivo de audio a tu almacenamiento en Supabase...");
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
        setProgresoEstado("Procesando y almacenando audio independiente en Supabase...");
        await procesar({
          data: {
            nombre: nombre.trim() || undefined,
            artista: artista.trim() || undefined,
            categoria,
            url: enlaceAudio.trim(),
          },
        });
      }
    },
    onSuccess: () => {
      setNombre("");
      setArtista("");
      setEnlaceAudio("");
      setArchivoAudio(null);
      setMostrarEnlaceManual(false);
      setProgresoEstado(null);
      void queryClient.invalidateQueries({ queryKey: ["soundtrack"] });
      toast.success("Canción guardada en tu Banda Sonora (independiente)");
    },
    onError: (e: Error) => {
      setProgresoEstado(null);
      toast.error(e.message);
    },
  });

  const agregarPlantilla = useMutation({
    mutationFn: async (plantilla: typeof PLANTILLAS_SONORAS[0]) => {
      if (!user) throw new Error("Inicia sesión para guardar canciones.");
      setProgresoEstado(`Añadiendo ${plantilla.nombre}...`);
      const { error } = await supabase.from("vital_soundtrack").insert({
        user_id: user.id,
        nombre_cancion: plantilla.nombre,
        artista: plantilla.artista,
        categoria_momento: plantilla.categoria,
        url_enlace: plantilla.url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setProgresoEstado(null);
      void queryClient.invalidateQueries({ queryKey: ["soundtrack"] });
      toast.success("Pista añadida a tu Banda Sonora");
    },
    onError: (e: Error) => {
      setProgresoEstado(null);
      toast.error(e.message);
    },
  });

  const del = useMutation({
    mutationFn: async (cancion: { id: string; url_enlace: string }) => {
      if (player.track?.id === cancion.id) {
        player.stopTrack();
      }
      await eliminarCancionDeSupabase(cancion.id, cancion.url_enlace);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["soundtrack"] });
      toast.success("Canción eliminada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handlePlayTrack = (s: { id: string; nombre_cancion: string; artista: string | null; categoria_momento: string; url_enlace: string }) => {
    void player.playTrack({
      id: s.id,
      nombre: s.nombre_cancion,
      artista: s.artista,
      url: s.url_enlace,
      categoria: s.categoria_momento,
    });
  };

  const skipTime = (delta: number) => {
    const newTime = Math.max(0, Math.min(player.duration, player.currentTime + delta));
    player.seekTrack(newTime);
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
        para crear tu diario musical de estados de ánimo y alojar tus canciones en Supabase de forma 100% independiente.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Formulario de subida de audio */}
      <div className="surface-panel space-y-4 p-5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Momento vital
          </Label>
          <span className="text-[0.65rem] text-primary font-medium flex items-center gap-1">
            <Cloud className="h-3 w-3" /> Audio nativo sin dependencias
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoria(c.id)}
              className={
                "rounded-full border px-3 py-1.5 text-xs transition-colors cursor-pointer " +
                (categoria === c.id
                  ? "border-primary bg-primary/15 text-primary font-semibold shadow-sm"
                  : "border-border text-muted-foreground hover:border-primary/40")
              }
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Zona de subida de archivo de audio principal */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.wav,.aac,.flac,.ogg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setArchivoAudio(file);
              setEnlaceAudio("");
              if (!nombre) setNombre(file.name.replace(/\.[^/.]+$/, ""));
            }
          }}
        />

        {!archivoAudio && !mostrarEnlaceManual && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border hover:border-primary/60 bg-secondary/30 hover:bg-primary/5 p-6 text-center cursor-pointer transition-all duration-200"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary group-hover:scale-110 transition-transform mb-3">
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Sube tu canción (MP3, M4A, WAV, AAC, FLAC)
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Se almacena directamente en tu nube de Supabase para sonar siempre en segundo plano y con la pantalla bloqueada.
            </p>
          </div>
        )}

        {archivoAudio && (
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  <Music4 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {archivoAudio.name}
                  </p>
                  <p className="text-[0.65rem] text-muted-foreground">
                    {(archivoAudio.size / (1024 * 1024)).toFixed(2)} MB · Archivo de audio listo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setArchivoAudio(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-xs text-destructive hover:underline cursor-pointer px-2 py-1"
              >
                Cambiar
              </button>
            </div>
          </div>
        )}

        {mostrarEnlaceManual && (
          <div className="space-y-2 animate-in fade-in duration-150">
            <Label className="text-xs text-muted-foreground">Enlace de audio o descarga</Label>
            <Input
              value={enlaceAudio}
              onChange={(e) => {
                setEnlaceAudio(e.target.value);
                if (e.target.value) setArchivoAudio(null);
              }}
              placeholder="https://ejemplo.com/cancion.mp3 o enlace de audio"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Título de la canción"
          />
          <Input
            value={artista}
            onChange={(e) => setArtista(e.target.value)}
            placeholder="Artista (opcional)"
          />
        </div>

        <div className="flex items-center justify-between pt-1 text-xs">
          <button
            type="button"
            onClick={() => setMostrarEnlaceManual(!mostrarEnlaceManual)}
            className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            {mostrarEnlaceManual ? "← Volver a subida de archivo" : "O ingresar enlace de audio / web"}
          </button>
        </div>

        {/* Estado de progreso */}
        {progresoEstado && (
          <div className="flex items-center gap-2 rounded-2xl bg-secondary p-3 text-xs text-muted-foreground animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            <span>{progresoEstado}</span>
          </div>
        )}

        <Button
          className="w-full rounded-full h-11 text-sm font-semibold shadow-md cursor-pointer"
          disabled={add.isPending || (!archivoAudio && !enlaceAudio.trim())}
          onClick={() => add.mutate()}
        >
          {add.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando en Supabase…
            </>
          ) : (
            `Guardar canción en ${CATEGORIAS.find((c) => c.id === categoria)?.label}`
          )}
        </Button>
      </div>

      {/* Sugerencias de pistas curadas listas para usar */}
      <div className="surface-panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Plantillas sonoras de alta fidelidad</h3>
          </div>
          <span className="text-[0.65rem] text-muted-foreground">Listas para anclaje</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Pistas relajantes y de activación creadas especialmente para reproducirse sin cortes en segundo plano.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {PLANTILLAS_SONORAS.map((item) => {
            const yaAgregada = canciones.some((c) => c.nombre_cancion === item.nombre);
            const isPlayingThis = player.track?.url === item.url && player.isPlaying;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-secondary/30 hover:border-primary/40 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => {
                    void player.playTrack({
                      id: item.id,
                      nombre: item.nombre,
                      artista: item.artista,
                      url: item.url,
                      categoria: item.categoria,
                    });
                  }}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all cursor-pointer",
                    isPlayingThis
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-secondary text-foreground hover:bg-primary/20 hover:text-primary",
                  )}
                  title="Escuchar muestra"
                >
                  {isPlayingThis ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
                </button>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate text-foreground">{item.nombre}</p>
                  <p className="text-[0.65rem] text-muted-foreground capitalize">{item.categoria}</p>
                </div>

                {!yaAgregada ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-[0.7rem] h-7 px-2.5 cursor-pointer hover:border-primary hover:text-primary"
                    disabled={agregarPlantilla.isPending}
                    onClick={() => agregarPlantilla.mutate(item)}
                  >
                    + Añadir
                  </Button>
                ) : (
                  <span className="text-[0.65rem] text-primary font-medium px-2 py-0.5 rounded-full bg-primary/10">
                    Añadida
                  </span>
                )}
              </div>
            );
          })}
        </div>
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
                const isThisPlaying = player.track?.id === s.id && player.isPlaying;
                const isThisActive = player.track?.id === s.id;

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
                      onClick={() => handlePlayTrack(s)}
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
                        <span className="inline-flex items-center gap-1 text-[0.6rem] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary shrink-0 font-medium">
                          <Cloud className="h-2.5 w-2.5" />
                          Audio Supabase
                        </span>
                      </div>
                      {s.artista ? (
                        <p className="truncate text-xs text-muted-foreground mt-0.5">
                          {s.artista}
                        </p>
                      ) : null}
                    </div>

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
      {player.track && (
        <div className="fixed bottom-20 left-4 right-4 z-40 max-w-2xl mx-auto rounded-3xl border border-primary/40 bg-surface/95 backdrop-blur-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                <Music4 className={cn("h-5 w-5", player.isPlaying ? "animate-bounce" : "")} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {player.track.nombre}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {player.track.artista ?? "Banda sonora vital"} · <span className="capitalize">{player.track.categoria}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => player.stopTrack()}
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
                {formatTime(player.currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={player.duration || 100}
                value={player.currentTime}
                onChange={(e) => player.seekTrack(Number(e.target.value))}
                className="flex-1 h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <span className="text-[0.65rem] tabular-nums text-muted-foreground w-8 text-right">
                {formatTime(player.duration)}
              </span>
            </div>

            {/* Controles de reproducción */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => player.toggleTrackMute()}
                  className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
                >
                  {player.isMuted || player.volume === 0 ? (
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
                  value={player.isMuted ? 0 : player.volume}
                  onChange={(e) => player.setTrackVolume(Number(e.target.value))}
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
                    if (player.isPlaying) {
                      player.pauseTrack();
                    } else {
                      void player.resumeTrack();
                    }
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 cursor-pointer"
                >
                  {player.isPlaying ? (
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
