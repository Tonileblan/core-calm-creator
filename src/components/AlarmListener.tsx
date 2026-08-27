import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlarmClock,
  Heart,
  PenTool,
  Wind,
  Brain,
  Volume2,
  VolumeX,
  Sparkles,
  ArrowRight,
  RotateCcw,
  X,
  Music4,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getAudioEngine } from "@/lib/audio-engine";
import {
  ACTIVIDADES_ALARMA,
  parseAlarmaConfig,
  type AlarmaConfig,
} from "@/lib/alarm-types";
import { extractYouTubeVideoId } from "@/lib/youtube-audio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

type AlarmaRow = {
  id: string;
  tipo_alarma: string;
  hora_programada: string;
  dias_semana: string[];
  accion_vinculada: string | null;
  activa: boolean;
};

export function AlarmListener() {
  const { user, signedIn } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [alarmaSonando, setAlarmaSonando] = useState<{
    alarma: AlarmaRow;
    config: AlarmaConfig;
  } | null>(null);

  const [audioMuted, setAudioMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const disparadas = useRef<Set<string>>(new Set());

  // Formulario rápido para Agradecimientos
  const [gratitud1, setGratitud1] = useState("");
  const [gratitud2, setGratitud2] = useState("");
  const [gratitud3, setGratitud3] = useState("");

  // Formulario rápido para Escritura
  const [escrituraTexto, setEscrituraTexto] = useState("");

  // Cargar alarmas del usuario
  const { data: alarmas = [] } = useQuery({
    queryKey: ["alarms", user?.id],
    enabled: signedIn,
    queryFn: async (): Promise<AlarmaRow[]> => {
      const { data, error } = await supabase
        .from("alarms_settings")
        .select("id, tipo_alarma, hora_programada, dias_semana, accion_vinculada, activa")
        .order("hora_programada");
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  // Guardar check-in de Agradecimiento o Escritura
  const guardarCheckin = useMutation({
    mutationFn: async (payload: {
      tipo_checkin: "rutina_manana" | "rutina_noche";
      gratitud?: string;
      notas?: string;
      estado_emocional?: string;
    }) => {
      if (!user) return;
      const { error } = await supabase.from("check_ins").insert({
        user_id: user.id,
        estado_emocional: payload.estado_emocional ?? "En calma",
        tipo_checkin: payload.tipo_checkin,
        gratitud: payload.gratitud ?? null,
        notas: payload.notas ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["check_ins"] });
      toast.success("¡Actividad completada y guardada!");
      apagarAlarma();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Escuchar y disparar alarmas en tiempo real
  useEffect(() => {
    if (!alarmas.length) return;

    const interval = window.setInterval(() => {
      const now = new Date();
      const hhmm = now.toTimeString().slice(0, 5);
      const diaSemana = DIAS[(now.getDay() + 6) % 7]!;

      alarmas.forEach((a) => {
        const key = `${a.id}-${now.toDateString()}-${hhmm}`;
        if (
          a.activa &&
          a.hora_programada.slice(0, 5) === hhmm &&
          a.dias_semana.includes(diaSemana) &&
          !disparadas.current.has(key)
        ) {
          disparadas.current.add(key);
          dispararAlarma(a);
        }
      });
    }, 15000);

    return () => window.clearInterval(interval);
  }, [alarmas]);

  // Cargar lista de canciones de la Banda Sonora para resolver URLs si es necesario
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

  // Asegurar carga de YouTube Iframe API
  useEffect(() => {
    if (typeof window !== "undefined" && !(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
  }, []);

  // Escuchar evento personalizado para probar alarma de inmediato desde el perfil
  useEffect(() => {
    const handleTest = (e: CustomEvent<AlarmaRow>) => {
      if (e.detail) {
        dispararAlarma(e.detail);
      }
    };
    window.addEventListener("blowmind-test-alarm" as any, handleTest as any);
    return () => window.removeEventListener("blowmind-test-alarm" as any, handleTest as any);
  }, [canciones]);

  const iniciarAudioAlarma = (config: AlarmaConfig) => {
    // Si es música seleccionada de la Banda Sonora
    if (config.sonidoTipo === "musica") {
      const cancion = canciones.find((c) => c.id === config.sonidoId);
      const urlEfectiva = config.sonidoUrl || cancion?.url_enlace;

      if (urlEfectiva) {
        const ytId = extractYouTubeVideoId(urlEfectiva);
        if (ytId) {
          // Reproducción por YouTube
          if ((window as any).YT && (window as any).YT.Player) {
            try {
              if (!ytPlayerRef.current) {
                ytPlayerRef.current = new (window as any).YT.Player("alarm-yt-player", {
                  height: "200",
                  width: "200",
                  videoId: ytId,
                  playerVars: {
                    autoplay: 1,
                    controls: 0,
                    disablekb: 1,
                    playsinline: 1,
                  },
                  events: {
                    onReady: (e: any) => {
                      e.target.setVolume(100);
                      e.target.playVideo();
                    },
                  },
                });
              } else {
                ytPlayerRef.current.loadVideoById(ytId);
                ytPlayerRef.current.setVolume(100);
                ytPlayerRef.current.playVideo();
              }
            } catch (e) {
              console.warn("Error reproduciendo YouTube en alarma:", e);
            }
          }
        } else {
          // Archivo de audio / video directo de Supabase
          if (audioRef.current) {
            audioRef.current.src = urlEfectiva;
            audioRef.current.volume = 0.95;
            audioRef.current.load();
            audioRef.current.play().catch((err) => {
              console.warn("Autoplay bloqueado por el navegador (esperando toque):", err);
            });
          }
        }
        return;
      }
    }

    // Melodías armónicas y presets de la app
    getAudioEngine().playAlarmMelody(config.sonidoId);
  };

  const dispararAlarma = (alarma: AlarmaRow) => {
    const config = parseAlarmaConfig(alarma.accion_vinculada);
    setAlarmaSonando({ alarma, config });
    setAudioMuted(false);
    setGratitud1("");
    setGratitud2("");
    setGratitud3("");
    setEscrituraTexto("");

    // Intentar iniciar la melodía seleccionada
    iniciarAudioAlarma(config);

    // Notificación nativa
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(`Blowmind · ${config.actividadTitulo}`, {
          body: `Es hora de tu alarma: ${config.actividadTitulo}. Toca para abrir.`,
        });
      } catch (e) {
        console.warn("Notificación nativa:", e);
      }
    }

    toast("⏰ ¡Alarma activa!", {
      description: `${alarma.hora_programada.slice(0, 5)} · ${config.sonidoTitulo}`,
    });
  };

  const apagarAlarma = () => {
    getAudioEngine().stopAlarm();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    if (ytPlayerRef.current?.pauseVideo) {
      ytPlayerRef.current.pauseVideo();
    }
    setAlarmaSonando(null);
  };

  const posponerAlarma = (minutos = 5) => {
    apagarAlarma();
    toast.info(`Alarma pospuesta ${minutos} minutos`);
    window.setTimeout(() => {
      if (alarmaSonando) {
        dispararAlarma(alarmaSonando.alarma);
      }
    }, minutos * 60 * 1000);
  };

  const iniciarActividad = () => {
    if (!alarmaSonando) return;
    const { config } = alarmaSonando;
    const actividadDef = ACTIVIDADES_ALARMA.find((a) => a.id === config.actividadId);
    apagarAlarma();

    if (actividadDef?.ruta) {
      void navigate({
        to: actividadDef.ruta,
        search: (actividadDef.search as never) ?? undefined,
      });
    }
  };

  const { config, alarma } = alarmaSonando ?? {};
  const actividadDef = config ? ACTIVIDADES_ALARMA.find((a) => a.id === config.actividadId) : null;

  return (
    <>
      <audio ref={audioRef} loop preload="auto" />
      <div
        id="alarm-yt-player"
        className="fixed -bottom-96 -right-96 opacity-0 pointer-events-none w-1 h-1 overflow-hidden"
      />

      {/* Pantalla modal inmersiva de alarma */}
      {alarmaSonando && config && alarma && (
        <div className="fixed inset-0 z-50 flex h-[100dvh] w-screen flex-col justify-between bg-background/98 backdrop-blur-2xl px-5 py-6 animate-in fade-in zoom-in-95 duration-300 touch-none select-none overscroll-none overflow-y-auto">
          <div className="mx-auto flex w-full max-w-md items-center justify-between pt-[env(safe-area-inset-top)]">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
              </span>
              <span className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
                Alarma Activa
              </span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
              onClick={apagarAlarma}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

        {/* Centro de la alarma: Hora y actividad */}
        <div className="mx-auto flex w-full max-w-md flex-col items-center text-center my-auto py-4 space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/20 text-primary animate-pulse shadow-[0_0_40px_rgba(var(--primary),0.4)]">
            <AlarmClock className="h-8 w-8" />
          </div>

          <div>
            <h1 className="font-display text-6xl font-bold tracking-tight text-foreground">
              {alarma.hora_programada.slice(0, 5)}
            </h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {config.actividadTitulo}
            </p>
          </div>

          {/* Badge interactivo del sonido / música sonando */}
          <button
            type="button"
            onClick={() => iniciarAudioAlarma(config)}
            className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-secondary px-4 py-2 text-xs text-foreground/90 hover:bg-primary/20 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Toca para asegurar la reproducción de la melodía"
          >
            {config.sonidoTipo === "musica" ? (
              <Music4 className="h-4 w-4 text-primary animate-bounce" />
            ) : (
              <Volume2 className="h-4 w-4 text-primary animate-pulse" />
            )}
            <span className="truncate max-w-[220px] font-medium">{config.sonidoTitulo}</span>
            <span className="text-[0.65rem] text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-full">
              🎵 Sonando
            </span>
          </button>

          {/* ── MÓDULO INTERACTIVO DIRECTO: AGRADECIMIENTOS ── */}
          {config.actividadCategoria === "gratitud" && (
            <div className="w-full surface-panel p-4 text-left space-y-3 mt-2 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 text-rose-400">
                <Heart className="h-4 w-4" />
                <h3 className="font-display text-sm font-semibold">Momento de Gratitud</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Escribe 1 o más cosas por las que estés agradecido en este momento:
              </p>
              <div className="space-y-2">
                <Input
                  value={gratitud1}
                  onChange={(e) => setGratitud1(e.target.value)}
                  placeholder="1. Una persona o momento especial..."
                  className="text-xs h-9 bg-secondary/60"
                />
                <Input
                  value={gratitud2}
                  onChange={(e) => setGratitud2(e.target.value)}
                  placeholder="2. Una pequeña victoria u oportunidad..."
                  className="text-xs h-9 bg-secondary/60"
                />
                <Input
                  value={gratitud3}
                  onChange={(e) => setGratitud3(e.target.value)}
                  placeholder="3. Algo simple del presente..."
                  className="text-xs h-9 bg-secondary/60"
                />
              </div>
              <Button
                className="w-full rounded-full h-10 text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white shadow-md mt-1"
                disabled={guardarCheckin.isPending || (!gratitud1.trim() && !gratitud2.trim() && !gratitud3.trim())}
                onClick={() => {
                  const items = [gratitud1, gratitud2, gratitud3].filter((x) => x.trim()).join(" · ");
                  guardarCheckin.mutate({
                    tipo_checkin: "rutina_manana",
                    gratitud: items,
                  });
                }}
              >
                {guardarCheckin.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Guardar Agradecimiento y Apagar
              </Button>
            </div>
          )}

          {/* ── MÓDULO INTERACTIVO DIRECTO: ESCRITURA REFLEXIVA / DIARIO ── */}
          {config.actividadCategoria === "escritura" && (
            <div className="w-full surface-panel p-4 text-left space-y-3 mt-2 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 text-amber-400">
                <PenTool className="h-4 w-4" />
                <h3 className="font-display text-sm font-semibold">Descarga y Escritura Mental</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Plasma tus pensamientos, intenciones o preocupaciones para despejar la mente:
              </p>
              <Textarea
                rows={4}
                value={escrituraTexto}
                onChange={(e) => setEscrituraTexto(e.target.value)}
                placeholder="Escribe libremente lo que te ronda la cabeza..."
                className="text-xs bg-secondary/60 rounded-2xl resize-none"
              />
              <Button
                className="w-full rounded-full h-10 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-md mt-1"
                disabled={guardarCheckin.isPending || !escrituraTexto.trim()}
                onClick={() => {
                  guardarCheckin.mutate({
                    tipo_checkin: "rutina_manana",
                    notas: escrituraTexto.trim(),
                  });
                }}
              >
                {guardarCheckin.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Guardar Escritura y Apagar
              </Button>
            </div>
          )}
        </div>

        {/* Botones inferiores de acción */}
        <div className="mx-auto flex w-full max-w-md flex-col gap-2 pb-[env(safe-area-inset-bottom)]">
          {actividadDef?.ruta && config.actividadCategoria !== "gratitud" && config.actividadCategoria !== "escritura" && (
            <Button
              size="lg"
              className="w-full rounded-full h-12 text-base font-semibold shadow-lg bg-primary text-primary-foreground"
              onClick={iniciarActividad}
            >
              <span>Comenzar {config.actividadTitulo}</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 rounded-full border-border/80 h-11 text-xs font-semibold cursor-pointer"
              onClick={() => posponerAlarma(5)}
            >
              <RotateCcw className="mr-2 h-3.5 w-3.5" /> Posponer 5 min
            </Button>
              <Button
                variant="secondary"
                size="lg"
                className="flex-1 rounded-full h-11 text-xs font-semibold hover:bg-destructive hover:text-destructive-foreground transition-colors cursor-pointer"
                onClick={apagarAlarma}
              >
                Apagar alarma
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
