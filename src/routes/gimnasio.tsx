import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Brain, Flame, Loader2, Timer } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getAudioEngine, type SoundId } from "@/lib/audio-engine";
import { reencuadrarPensamiento } from "@/lib/wellness.functions";

export const Route = createFileRoute("/gimnasio")({
  head: () => ({
    meta: [
      { title: "Gimnasio mental · Foco y reencuadre · Blowmind" },
      {
        name: "description",
        content:
          "Bloques de foco tipo Pomodoro con audio para trabajo profundo, reestructuración cognitiva asistida por IA y rachas de consistencia.",
      },
      { property: "og:title", content: "Gimnasio mental · Blowmind" },
      {
        property: "og:description",
        content:
          "Entrena tu foco con bloques cronometrados y reencuadra pensamientos limitantes con ayuda de la IA.",
      },
    ],
  }),
  component: Gimnasio,
});

const BLOQUES = [
  { minutos: 25, pausa: 5, sonido: "alpha" as SoundId, label: "Clásico 25/5" },
  { minutos: 50, pausa: 10, sonido: "white" as SoundId, label: "Profundo 50/10" },
  { minutos: 15, pausa: 3, sonido: "brown" as SoundId, label: "Arranque 15/3" },
];

function Gimnasio() {
  const { user, signedIn } = useAuth();
  const queryClient = useQueryClient();

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

  return (
    <div className="mx-auto max-w-2xl">
      <AppHeader titulo="Gimnasio mental" subtitulo="Foco profundo y reencuadre." />

      <div className="space-y-8 px-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Bloques hoy" value={String(bloquesHoy)} icon={Timer} />
          <Stat label="Minutos totales" value={String(minutosTotales)} icon={Flame} />
          <Stat label="Sesiones" value={String(stats.length)} icon={Brain} />
        </div>

        <FocusTimer
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

        <MindGames
          registrar={(ejercicio, minutos, detalle) => {
            if (!user) return;
            void supabase
              .from("mental_gym_stats")
              .insert({
                user_id: user.id,
                tipo_ejercicio: ejercicio,
                duracion_minutos: minutos,
                completado: true,
                detalle,
              })
              .then(() => queryClient.invalidateQueries({ queryKey: ["gym"] }));
          }}
        />

        {signedIn ? (
          <Reencuadre onSaved={() => queryClient.invalidateQueries({ queryKey: ["gym"] })} />
        ) : (
          <p className="surface-panel p-6 text-center text-sm text-muted-foreground">
            <Link to="/auth" className="text-primary underline">
              Inicia sesión
            </Link>{" "}
            para usar la reestructuración cognitiva con IA y guardar tus rachas.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Timer;
}) {
  return (
    <div className="surface-panel p-4">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 font-display text-2xl">{value}</p>
      <p className="text-[0.65rem] text-muted-foreground">{label}</p>
    </div>
  );
}

function FocusTimer({
  onDone,
}: {
  onDone: (minutos: number, sonido: SoundId) => void;
}) {
  const [bloque, setBloque] = useState(BLOQUES[0]!);
  const [segundos, setSegundos] = useState(BLOQUES[0]!.minutos * 60);
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

  return (
    <div className="surface-panel space-y-5 p-5">
      <div className="flex flex-wrap gap-2">
        {BLOQUES.map((b) => (
          <button
            key={b.label}
            onClick={() => setBloque(b)}
            className={
              "rounded-full border px-3 py-1.5 text-xs transition-colors " +
              (bloque.label === b.label
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground")
            }
          >
            {b.label}
          </button>
        ))}
      </div>
      <p className="text-center font-display text-6xl tabular-nums">
        {String(Math.floor(segundos / 60)).padStart(2, "0")}:
        {String(segundos % 60).padStart(2, "0")}
      </p>
      <Progress value={pct} />
      <div className="flex gap-2">
        <Button className="flex-1 rounded-full" onClick={toggle}>
          {corriendo ? "Pausar bloque" : "Iniciar bloque"}
        </Button>
        <Button
          variant="secondary"
          className="rounded-full"
          onClick={() => {
            getAudioEngine().stop();
            setCorriendo(false);
            setSegundos(bloque.minutos * 60);
          }}
        >
          Reiniciar
        </Button>
      </div>
      <p className="text-[0.7rem] text-muted-foreground">
        El audio de trabajo profundo se activa automáticamente con el bloque.
      </p>
    </div>
  );
}

function Reencuadre({ onSaved }: { onSaved: () => void }) {
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

  return (
    <div className="surface-panel space-y-4 p-5">
      <div>
        <h2 className="font-display text-xl">Reestructuración cognitiva</h2>
        <p className="text-xs text-muted-foreground">
          Escribe el pensamiento limitante o el momento de estrés y la IA lo desglosa.
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Pensamiento</Label>
        <Textarea
          rows={4}
          value={pensamiento}
          onChange={(e) => setPensamiento(e.target.value)}
          placeholder="Ej.: si esta presentación sale mal, se acabó mi credibilidad."
        />
      </div>
      <Button
        className="w-full rounded-full"
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
        <div className="whitespace-pre-wrap border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
          {analisis}
        </div>
      ) : null}
    </div>
  );
}
