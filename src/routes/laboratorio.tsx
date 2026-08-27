import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, Sparkles, Square, Trash2 } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { METODOLOGIAS, OBJETIVOS } from "@/lib/meditation-prompts";
import { generarMeditacion } from "@/lib/wellness.functions";

export const Route = createFileRoute("/laboratorio")({
  head: () => ({
    meta: [
      { title: "Laboratorio IA · Meditaciones a la carta · Blowmind" },
      {
        name: "description",
        content:
          "Genera meditaciones guiadas ultrapersonalizadas con IA: estilo Joe Dispenza, mindfulness clásico o reestructuración emocional, de 5, 10 o 20 minutos.",
      },
      { property: "og:title", content: "Meditaciones a la carta con IA · Blowmind" },
      {
        property: "og:description",
        content:
          "Elige objetivo, metodología, voz y duración. La IA escribe tu meditación y te la lee en voz alta.",
      },
    ],
  }),
  component: Laboratorio,
});

const VOCES = [
  { id: "femenina serena", label: "Serena (fem.)" },
  { id: "masculina profunda", label: "Profunda (masc.)" },
  { id: "neutra susurrada", label: "Susurrada" },
];

const DURACIONES = [5, 10, 20];

type Meditacion = {
  id: string;
  titulo: string;
  metodologia: string;
  duracion_minutos: number;
  guion_texto: string | null;
  created_at: string;
};

function Laboratorio() {
  const { signedIn, user } = useAuth();
  const queryClient = useQueryClient();
  const generar = useServerFn(generarMeditacion);

  const [objetivo, setObjetivo] = useState<string>(OBJETIVOS[0]);
  const [metodologia, setMetodologia] = useState<string>(METODOLOGIAS[0].id);
  const [voz, setVoz] = useState(VOCES[0]!.id);
  const [duracion, setDuracion] = useState(10);
  const [contexto, setContexto] = useState("");
  const [actual, setActual] = useState<Meditacion | null>(null);

  const { data: guardadas = [] } = useQuery({
    queryKey: ["meditations", user?.id],
    enabled: signedIn,
    queryFn: async (): Promise<Meditacion[]> => {
      const { data, error } = await supabase
        .from("saved_meditations")
        .select("id, titulo, metodologia, duracion_minutos, guion_texto, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const crear = useMutation({
    mutationFn: async () => {
      const res = await generar({
        data: { objetivo, metodologia, duracion, voz, contexto: contexto || undefined },
      });
      return res as Meditacion;
    },
    onSuccess: (res) => {
      setActual(res);
      void queryClient.invalidateQueries({ queryKey: ["meditations"] });
      toast.success("Meditación lista", { description: res.titulo });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const borrar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_meditations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["meditations"] }),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <AppHeader
        titulo="Laboratorio IA"
        subtitulo="Meditaciones escritas y narradas para tu momento exacto."
      />

      <div className="px-5">
        {!signedIn ? (
          <p className="surface-panel p-6 text-center text-sm text-muted-foreground">
            <Link to="/auth" className="text-primary underline">
              Inicia sesión
            </Link>{" "}
            para generar y guardar tus meditaciones personalizadas.
          </p>
        ) : (
          <div className="surface-panel space-y-6 p-5">
            <Campo titulo="Objetivo / foco">
              <Chips
                options={OBJETIVOS.map((o) => ({ id: o, label: o }))}
                value={objetivo}
                onChange={setObjetivo}
              />
            </Campo>

            <Campo titulo="Metodología">
              <div className="grid gap-2">
                {METODOLOGIAS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMetodologia(m.id)}
                    className={
                      "rounded-xl border p-3 text-left transition-colors " +
                      (metodologia === m.id
                        ? "border-primary bg-primary/10"
                        : "border-border")
                    }
                  >
                    <p className="text-sm font-semibold">{m.nombre}</p>
                    <p className="text-xs text-muted-foreground">{m.descripcion}</p>
                  </button>
                ))}
              </div>
            </Campo>

            <Campo titulo="Voz">
              <Chips options={VOCES} value={voz} onChange={setVoz} />
            </Campo>

            <Campo titulo="Duración">
              <Chips
                options={DURACIONES.map((d) => ({ id: String(d), label: `${d} min` }))}
                value={String(duracion)}
                onChange={(v) => setDuracion(Number(v))}
              />
            </Campo>

            <Campo titulo="Contexto personal (opcional)">
              <Textarea
                rows={3}
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
                placeholder="Qué te está pasando ahora mismo…"
              />
            </Campo>

            <Button
              className="w-full rounded-full"
              size="lg"
              disabled={crear.isPending}
              onClick={() => crear.mutate()}
            >
              {crear.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Escribiendo tu
                  meditación…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Generar meditación
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {actual ? (
        <div className="mt-6 px-5">
          <Reproductor meditacion={actual} voz={voz} />
        </div>
      ) : null}

      {guardadas.length ? (
        <div className="mt-8 px-5">
          <h2 className="mb-3 font-display text-xl">Tus meditaciones</h2>
          <div className="space-y-2">
            {guardadas.map((m) => (
              <div key={m.id} className="surface-panel flex items-center gap-3 px-4 py-3">
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setActual(m)}
                >
                  <p className="truncate text-sm font-medium">{m.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.duracion_minutos} min ·{" "}
                    {METODOLOGIAS.find((x) => x.id === m.metodologia)?.nombre ??
                      m.metodologia}
                  </p>
                </button>
                <button
                  onClick={() => borrar.mutate(m.id)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label="Eliminar meditación"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <Label className="text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground">
        {titulo}
      </Label>
      {children}
    </div>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={
            "rounded-full border px-3 py-1.5 text-xs transition-colors " +
            (value === o.id
              ? "border-primary bg-primary/15 text-primary"
              : "border-border text-muted-foreground")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Reproductor({ meditacion, voz }: { meditacion: Meditacion; voz: string }) {
  const [hablando, setHablando] = useState(false);
  const soportado = useRef(false);

  useEffect(() => {
    soportado.current =
      typeof window !== "undefined" && "speechSynthesis" in window;
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const leer = () => {
    if (!("speechSynthesis" in window)) {
      toast.error("Tu navegador no soporta la narración por voz.");
      return;
    }
    if (hablando) {
      window.speechSynthesis.cancel();
      setHablando(false);
      return;
    }
    const texto = (meditacion.guion_texto ?? "").replace(/\.\.\./g, ". . .");
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "es-ES";
    u.rate = voz.includes("susurrada") ? 0.72 : 0.8;
    u.pitch = voz.includes("masculina") ? 0.8 : 1;
    const vozEs = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.startsWith("es"));
    if (vozEs) u.voice = vozEs;
    u.onend = () => setHablando(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setHablando(true);
  };

  return (
    <div className="surface-panel p-5">
      <p className="font-display text-xl">{meditacion.titulo}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {meditacion.duracion_minutos} min · voz {voz}
      </p>
      <Button className="mt-4 rounded-full" onClick={leer}>
        {hablando ? (
          <>
            <Square className="mr-2 h-4 w-4" /> Detener narración
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" /> Escuchar
          </>
        )}
      </Button>
      <div className="mt-5 max-h-96 overflow-y-auto whitespace-pre-wrap border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
        {meditacion.guion_texto}
      </div>
    </div>
  );
}
