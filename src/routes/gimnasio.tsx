import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ElementType } from "react";
import { toast } from "sonner";
import {
  Brain,
  Flame,
  Loader2,
  Timer,
  Grid3x3,
  Eye,
  Palette,
  Calculator,
  Sparkles,
  ArrowLeft,
  X,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronRight,
  GitFork,
} from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getAudioEngine, type SoundId } from "@/lib/audio-engine";
import { reencuadrarPensamiento } from "@/lib/wellness.functions";
import {
  SecuenciaGame,
  ParejasGame,
  StroopGame,
  CalculoGame,
  TrenesGame,
  type Registrar,
} from "@/components/MindGames";
import { useScrollLock } from "@/hooks/useScrollLock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gimnasio")({
  head: () => ({
    meta: [
      { title: "Gimnasio mental · Actividades independientes · Blowmind" },
      {
        name: "description",
        content:
          "Ejercicios cognitivos independientes: memoria de patrones, memoria visual de parejas, control Stroop, cálculo mental y bloques de foco.",
      },
      { property: "og:title", content: "Gimnasio mental · Blowmind" },
      {
        property: "og:description",
        content:
          "Entrenamientos de foco y agilidad mental como actividades dedicadas e inmersivas.",
      },
    ],
  }),
  component: Gimnasio,
});

type ActividadId =
  "trenes" | "secuencia" | "parejas" | "stroop" | "calculo" | "foco" | "reencuadre";

type ActividadDef = {
  id: ActividadId;
  titulo: string;
  subtitulo: string;
  tag: string;
  icon: ElementType;
  colorClass: string;
  bgClass: string;
  borderClass: string;
};

const ACTIVIDADES: ActividadDef[] = [
  {
    id: "trenes",
    titulo: "Cruce de Vías",
    subtitulo: "Cambia las vías y guía los trenes de colores",
    tag: "Atención y Vías",
    icon: GitFork,
    colorClass: "text-amber-400",
    bgClass: "bg-amber-500/15",
    borderClass: "border-amber-500/30 hover:border-amber-400/60",
  },
  {
    id: "parejas",
    titulo: "Memoria Visual",
    subtitulo: "Encuentra las parejas de símbolos luminosos",
    tag: "Parejas",
    icon: Eye,
    colorClass: "text-teal-400",
    bgClass: "bg-teal-500/15",
    borderClass: "border-teal-500/30 hover:border-teal-400/60",
  },
  {
    id: "secuencia",
    titulo: "Memoria de Trabajo",
    subtitulo: "Repite la secuencia de luces y tonos",
    tag: "Secuencia",
    icon: Grid3x3,
    colorClass: "text-amber-400",
    bgClass: "bg-amber-500/15",
    borderClass: "border-amber-500/30 hover:border-amber-400/60",
  },
  {
    id: "stroop",
    titulo: "Control Inhibitorio",
    subtitulo: "Pulsa el color de la tinta, ignora la palabra",
    tag: "Stroop",
    icon: Palette,
    colorClass: "text-purple-400",
    bgClass: "bg-purple-500/15",
    borderClass: "border-purple-500/30 hover:border-purple-400/60",
  },
  {
    id: "calculo",
    titulo: "Agilidad Mental",
    subtitulo: "Resuelve operaciones contrarreloj",
    tag: "Cálculo",
    icon: Calculator,
    colorClass: "text-sky-400",
    bgClass: "bg-sky-500/15",
    borderClass: "border-sky-500/30 hover:border-sky-400/60",
  },
  {
    id: "foco",
    titulo: "Bloque de Foco",
    subtitulo: "Pomodoro profundo con ondas binaurales",
    tag: "Concentración",
    icon: Timer,
    colorClass: "text-primary",
    bgClass: "bg-primary/15",
    borderClass: "border-primary/30 hover:border-primary/60",
  },
  {
    id: "reencuadre",
    titulo: "Reestructuración Cognitiva",
    subtitulo: "Desglosa pensamientos de estrés con IA",
    tag: "IA Coaching",
    icon: Sparkles,
    colorClass: "text-rose-400",
    bgClass: "bg-rose-500/15",
    borderClass: "border-rose-500/30 hover:border-rose-400/60",
  },
];

const BLOQUES_FOCO = [
  { minutos: 25, pausa: 5, sonido: "alpha" as SoundId, label: "Clásico 25/5" },
  { minutos: 50, pausa: 10, sonido: "white" as SoundId, label: "Profundo 50/10" },
  { minutos: 15, pausa: 3, sonido: "brown" as SoundId, label: "Arranque 15/3" },
];

function Gimnasio() {
  const { user, signedIn } = useAuth();
  const queryClient = useQueryClient();
  const [actividadActiva, setActividadActiva] = useState<ActividadId | null>(null);

  // Bloqueo estricto del viewport cuando una actividad está abierta
  useScrollLock(actividadActiva !== null);

  const { data: stats = [] } = useQuery({
    queryKey: ["gym", user?.id],
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mental_gym_stats")
        .select("id, tipo_ejercicio, duracion_minutos, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const minutosTotales = stats.reduce((a, s) => a + (s.duracion_minutos ?? 0), 0);
  const bloquesHoy = stats.filter(
    (s) =>
      new Date(s.created_at).toDateString() === new Date().toDateString() &&
      s.tipo_ejercicio.startsWith("bloque_foco"),
  ).length;

  const registrar: Registrar = (ejercicio, minutos, detalle) => {
    if (!user) return;
    void supabase
      .from("mental_gym_stats")
      .insert({
        user_id: user.id,
        tipo_ejercicio: ejercicio,
        duracion_minutos: minutos,
        completado: true,
        detalle: detalle as never,
      })
      .then(() => queryClient.invalidateQueries({ queryKey: ["gym"] }));
  };

  const actividadSeleccionada = ACTIVIDADES.find((a) => a.id === actividadActiva);

  return (
    <>
      {/* ── 1. HUB PRINCIPAL DE ACTIVIDADES ── */}
      <div className="mx-auto max-w-2xl px-5">
        <AppHeader titulo="Gimnasio mental" subtitulo="Elige una actividad independiente." />

        {/* Resumen de estadísticas */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <Stat label="Bloques hoy" value={String(bloquesHoy)} icon={Timer} />
          <Stat label="Minutos totales" value={String(minutosTotales)} icon={Flame} />
          <Stat label="Sesiones" value={String(stats.length)} icon={Brain} />
        </div>

        {/* Selector de Actividades Independientes */}
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold px-1">
            Actividades disponibles
          </p>

          <div className="grid gap-3">
            {ACTIVIDADES.map((act) => {
              const Icon = act.icon;
              return (
                <button
                  key={act.id}
                  onClick={() => setActividadActiva(act.id)}
                  className={cn(
                    "surface-panel flex items-center justify-between p-4 text-left transition-all duration-200 cursor-pointer active:scale-[0.99] group",
                    act.borderClass,
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                        act.bgClass,
                      )}
                    >
                      <Icon className={cn("h-6 w-6", act.colorClass)} strokeWidth={2} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                          {act.titulo}
                        </h3>
                        <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                          {act.tag}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{act.subtitulo}</p>
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary transition-transform group-hover:translate-x-0.5 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 2. PANTALLA DE ACTIVIDAD INDEPENDIENTE (100dvh Bloqueado) ── */}
      {actividadActiva && actividadSeleccionada && (
        <div
          className="fixed inset-0 z-50 flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col justify-between bg-background/98 backdrop-blur-2xl px-5 py-4 touch-none select-none overscroll-none overflow-hidden"
          style={{ overscrollBehavior: "none" }}
        >
          {/* Encabezado de la actividad */}
          <div className="mx-auto flex w-full max-w-md items-center justify-between pt-[env(safe-area-inset-top)] pb-2 border-b border-border/40">
            <button
              onClick={() => setActividadActiva(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2 py-1 -ml-2 rounded-full hover:bg-secondary"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Actividades</span>
            </button>

            <div className="flex items-center gap-2">
              <actividadSeleccionada.icon
                className={cn("h-4 w-4", actividadSeleccionada.colorClass)}
              />
              <h2 className="font-display text-sm font-semibold text-foreground">
                {actividadSeleccionada.titulo}
              </h2>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground -mr-2"
              onClick={() => setActividadActiva(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Área interactiva central de la actividad */}
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-3 overflow-hidden">
            {actividadActiva === "trenes" ? <TrenesGame registrar={registrar} /> : null}

            {actividadActiva === "parejas" ? <ParejasGame registrar={registrar} /> : null}

            {actividadActiva === "secuencia" ? <SecuenciaGame registrar={registrar} /> : null}

            {actividadActiva === "stroop" ? <StroopGame registrar={registrar} /> : null}

            {actividadActiva === "calculo" ? <CalculoGame registrar={registrar} /> : null}

            {actividadActiva === "foco" ? (
              <FocusTimerIndependent
                onDone={async (min, sonido) => {
                  getAudioEngine().stop();
                  getAudioEngine().chime(639, 1);
                  toast.success("Bloque completado", { description: `${min} min de foco` });
                  if (!user) return;
                  await supabase.from("mental_gym_stats").insert({
                    user_id: user.id,
                    tipo_ejercicio: `bloque_foco_${min}`,
                    duracion_minutos: min,
                    completado: true,
                    detalle: { sonido },
                  });
                  void queryClient.invalidateQueries({ queryKey: ["gym"] });
                }}
              />
            ) : null}

            {actividadActiva === "reencuadre" ? (
              <ReencuadreIndependent
                onSaved={() => queryClient.invalidateQueries({ queryKey: ["gym"] })}
                onClose={() => setActividadActiva(null)}
              />
            ) : null}
          </div>

          {/* Pie de actividad */}
          <div className="mx-auto flex w-full max-w-md items-center justify-between pb-[env(safe-area-inset-bottom)] pt-2 border-t border-border/40 text-[0.68rem] text-muted-foreground">
            <span>Blowmind · {actividadSeleccionada.tag}</span>
            <button
              onClick={() => setActividadActiva(null)}
              className="text-primary underline cursor-pointer font-medium"
            >
              Salir de la actividad
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Timer }) {
  return (
    <div className="surface-panel p-4">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 font-display text-2xl tabular-nums">{value}</p>
      <p className="text-[0.65rem] text-muted-foreground">{label}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ACTIVIDAD INDEPENDIENTE: BLOQUE DE FOCO
───────────────────────────────────────────────────────────── */

function FocusTimerIndependent({ onDone }: { onDone: (minutos: number, sonido: SoundId) => void }) {
  const [bloque, setBloque] = useState(BLOQUES_FOCO[0]!);
  const [segundos, setSegundos] = useState(BLOQUES_FOCO[0]!.minutos * 60);
  const [corriendo, setCorriendo] = useState(false);

  useEffect(() => {
    setSegundos(bloque.minutos * 60);
    setCorriendo(false);
  }, [bloque]);

  useEffect(() => {
    if (!corriendo) return;
    const t = window.setInterval(() => {
      setSegundos((s) => {
        if (s <= 1) {
          setCorriendo(false);
          onDone(bloque.minutos, bloque.sonido);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [corriendo, bloque, onDone]);

  const toggle = () => {
    if (!corriendo) {
      getAudioEngine().play(bloque.sonido);
      if (segundos === 0) setSegundos(bloque.minutos * 60);
    } else {
      getAudioEngine().stop();
    }
    setCorriendo((c) => !c);
  };

  const pct = 100 - (segundos / (bloque.minutos * 60)) * 100;
  const tiempoFormateado = `${String(Math.floor(segundos / 60)).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center justify-between h-full w-full max-w-sm mx-auto py-2 touch-none select-none">
      {/* Selector de bloques */}
      <div className="flex flex-wrap justify-center gap-2 w-full">
        {BLOQUES_FOCO.map((b) => (
          <button
            key={b.label}
            onClick={() => setBloque(b)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              bloque.label === b.label
                ? "border-primary bg-primary/20 text-primary shadow-sm"
                : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Reloj central */}
      <div className="my-auto text-center space-y-3">
        <p className="font-display text-7xl sm:text-8xl tabular-nums text-foreground drop-shadow-md tracking-tight">
          {tiempoFormateado}
        </p>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">
          {corriendo ? `Audio activo (${bloque.sonido})` : "Listo para comenzar"}
        </p>
        <div className="w-56 mx-auto pt-2">
          <Progress value={pct} className="h-2" />
        </div>
      </div>

      {/* Controles inferiores */}
      <div className="w-full space-y-2">
        <div className="flex gap-2 w-full">
          <Button
            variant="outline"
            size="lg"
            className="rounded-full flex-1 border-border/80 h-12"
            onClick={() => {
              getAudioEngine().stop();
              setCorriendo(false);
              setSegundos(bloque.minutos * 60);
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
          <Button
            size="lg"
            className="rounded-full flex-1 shadow-lg bg-primary text-primary-foreground h-12 text-base font-semibold"
            onClick={toggle}
          >
            {corriendo ? (
              <>
                <Pause className="mr-2 h-4 w-4" /> Pausar
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" /> Iniciar foco
              </>
            )}
          </Button>
        </div>
        <p className="text-center text-[0.7rem] text-muted-foreground">
          El audio de trabajo profundo se activa automáticamente al iniciar.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ACTIVIDAD INDEPENDIENTE: REENCUADRE COGNITIVO IA
───────────────────────────────────────────────────────────── */

function ReencuadreIndependent({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const { signedIn } = useAuth();
  const reencuadrar = useServerFn(reencuadrarPensamiento);
  const [pensamiento, setPensamiento] = useState("");
  const [analisis, setAnalisis] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: async () => {
      if (pensamiento.trim().length < 8)
        throw new Error("Describe el pensamiento con algo más de detalle.");
      return reencuadrar({ data: { pensamiento: pensamiento.trim() } });
    },
    onSuccess: (res) => {
      setAnalisis(res.analisis);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!signedIn) {
    return (
      <div className="surface-panel p-6 text-center text-sm text-muted-foreground my-auto">
        <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
        <p className="font-display text-lg text-foreground mb-2">Acceso a Reestructuración IA</p>
        <p className="mb-4">
          Inicia sesión para usar la reestructuración cognitiva con IA y guardar tus notas.
        </p>
        <Link
          to="/auth"
          className="inline-block rounded-full bg-primary px-6 py-2.5 text-xs font-semibold text-primary-foreground"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col justify-between h-full w-full max-w-sm mx-auto py-2 touch-none select-none overflow-y-auto scrollbar-none"
      data-allow-scroll
    >
      <div className="space-y-4 my-auto">
        <div>
          <h3 className="font-display text-lg text-foreground">Reestructuración cognitiva</h3>
          <p className="text-xs text-muted-foreground">
            Escribe el pensamiento o momento de frustración y la IA te ofrecerá un reencuadre
            objetivo.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Pensamiento limitante o reactivo</Label>
          <Textarea
            rows={3}
            value={pensamiento}
            onChange={(e) => setPensamiento(e.target.value)}
            placeholder="Ej.: si esta decisión no sale bien, arruinaré todo mi progreso."
            className="rounded-2xl bg-secondary/50 border-border"
          />
        </div>

        <Button
          className="w-full rounded-full shadow-lg h-12 text-base font-semibold"
          disabled={run.isPending}
          onClick={() => run.mutate()}
        >
          {run.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analizando…
            </>
          ) : (
            "Reencuadrar con IA"
          )}
        </Button>

        {analisis ? (
          <div
            className="surface-panel p-4 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap max-h-44 overflow-y-auto"
            data-allow-scroll
          >
            {analisis}
          </div>
        ) : null}
      </div>
    </div>
  );
}
