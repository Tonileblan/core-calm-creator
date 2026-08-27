import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Flame,
  Sparkles,
  Wind,
  Moon,
  Sun,
  Brain,
  PartyPopper,
  Scale,
  Zap,
  Target,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getAudioEngine } from "@/lib/audio-engine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Blowmind · Bienestar mental, foco y meditaciones con IA" },
      {
        name: "description",
        content:
          "Blowmind unifica respiración guiada, frecuencias binaurales, check-ins emocionales, bloques de foco y meditaciones generadas con IA en una sola app.",
      },
      { property: "og:title", content: "Blowmind · Autorregulación y foco" },
      {
        property: "og:description",
        content:
          "Alivio inmediato en dos clics: respiración anti-tilt, ruido marrón, check-ins y meditaciones ultrapersonalizadas.",
      },
    ],
  }),
  component: Inicio,
});

const EMERGENCIAS = [
  {
    id: "estresado",
    label: "Estresado",
    icon: Zap,
    accion: "Respiración anti-tilt",
    ruta: "/respiracion",
    search: { p: "antitilt" },
  },
  {
    id: "bloqueado",
    label: "Bloqueado",
    icon: Brain,
    accion: "Ruido marrón",
    sonido: "brown" as const,
  },
  {
    id: "foco",
    label: "Necesito foco",
    icon: Target,
    accion: "Ondas Alpha",
    sonido: "alpha" as const,
  },
  {
    id: "celebracion",
    label: "Celebración",
    icon: PartyPopper,
    accion: "Banda sonora",
    ruta: "/audio",
    search: {},
  },
  {
    id: "reequilibrio",
    label: "Reequilibrio",
    icon: Scale,
    accion: "Respiración 5-5",
    ruta: "/respiracion",
    search: { p: "coherente" },
  },
];

type CheckIn = {
  id: string;
  estado_emocional: string;
  tipo_checkin: string;
  energia: number | null;
  created_at: string;
};

function Inicio() {
  const { signedIn, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: checkIns = [] } = useQuery({
    queryKey: ["check_ins", user?.id],
    enabled: signedIn,
    queryFn: async (): Promise<CheckIn[]> => {
      const { data, error } = await supabase
        .from("check_ins")
        .select("id, estado_emocional, tipo_checkin, energia, created_at")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: gym = [] } = useQuery({
    queryKey: ["gym", user?.id],
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mental_gym_stats")
        .select("id, tipo_ejercicio, duracion_minutos, created_at")
        .order("created_at", { ascending: false })
        .limit(120);
      if (error) throw error;
      return data ?? [];
    },
  });

  const registrar = useMutation({
    mutationFn: async (payload: {
      estado_emocional: string;
      tipo_checkin: "emergencia" | "rutina_manana" | "rutina_noche";
      energia?: number;
      foco_dia?: string;
      gratitud?: string;
      notas?: string;
    }) => {
      if (!user) throw new Error("Necesitas iniciar sesión para guardar tu check-in.");
      const { error } = await supabase
        .from("check_ins")
        .insert({ ...payload, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["check_ins"] });
      toast.success("Check-in guardado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const streak = useMemo(() => {
    const dias = new Set(
      [...checkIns, ...gym].map((r) => new Date(r.created_at).toDateString()),
    );
    let count = 0;
    const cursor = new Date();
    while (dias.has(cursor.toDateString())) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [checkIns, gym]);

  const serie = useMemo(() => {
    const dias: { dia: string; energia: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toDateString();
      const delDia = checkIns.filter(
        (c) => new Date(c.created_at).toDateString() === key && c.energia != null,
      );
      const media = delDia.length
        ? delDia.reduce((a, c) => a + (c.energia ?? 0), 0) / delDia.length
        : 0;
      dias.push({
        dia: d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
        energia: Number(media.toFixed(1)),
      });
    }
    return dias;
  }, [checkIns]);

  const emergencia = (item: (typeof EMERGENCIAS)[number]) => {
    if (signedIn) {
      registrar.mutate({ estado_emocional: item.label, tipo_checkin: "emergencia" });
    }
    if (item.sonido) {
      getAudioEngine().play(item.sonido);
      toast.success(`${item.accion} en marcha`, { description: "Cierra los ojos 60 s." });
      return;
    }
    if (item.ruta === "/respiracion") {
      void navigate({ to: "/respiracion", search: item.search as { p?: string } });
    } else if (item.ruta === "/audio") {
      void navigate({ to: "/audio" });
    }
  };

  return (
    <div className="mx-auto max-w-2xl touch-lock">
      <AppHeader
        titulo="¿Qué necesitas ahora?"
        subtitulo="Alivio inmediato en un clic, o registra tu momento."
      />

      <section className="px-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {EMERGENCIAS.map((item) => (
            <button
              key={item.id}
              onClick={() => emergencia(item)}
              className="surface-panel group flex flex-col items-start gap-2 p-4 text-left transition-all hover:border-primary/60 hover:shadow-glow"
            >
              <item.icon className="h-5 w-5 text-primary" strokeWidth={1.8} />
              <span className="text-sm font-semibold">{item.label}</span>
              <span className="text-[0.7rem] text-muted-foreground">{item.accion}</span>
            </button>
          ))}
          <Link
            to="/laboratorio"
            className="surface-panel flex flex-col items-start gap-2 p-4 transition-all hover:border-primary/60"
          >
            <Sparkles className="h-5 w-5 text-[var(--warm)]" strokeWidth={1.8} />
            <span className="text-sm font-semibold">Meditación IA</span>
            <span className="text-[0.7rem] text-muted-foreground">A tu medida</span>
          </Link>
        </div>
      </section>

      <section className="mt-8 px-5">
        <div className="surface-panel flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <Flame className="h-7 w-7 text-[var(--warm)]" strokeWidth={1.6} />
            <div>
              <p className="font-display text-2xl">{streak} días</p>
              <p className="text-xs text-muted-foreground">Racha de consistencia</p>
            </div>
          </div>
          <Link
            to="/gimnasio"
            className="rounded-full bg-secondary px-4 py-2 text-xs font-medium text-secondary-foreground"
          >
            Gimnasio mental
          </Link>
        </div>
      </section>

      <section className="mt-8 px-5">
        <h2 className="mb-3 font-display text-xl">Rutina</h2>
        <div className="surface-panel p-5">
          <Tabs defaultValue="manana">
            <TabsList className="w-full bg-secondary/60">
              <TabsTrigger value="manana" className="flex-1 gap-2">
                <Sun className="h-4 w-4" /> Mañana
              </TabsTrigger>
              <TabsTrigger value="noche" className="flex-1 gap-2">
                <Moon className="h-4 w-4" /> Noche
              </TabsTrigger>
            </TabsList>
            <TabsContent value="manana" className="pt-5">
              <MorningForm
                onSubmit={(v) =>
                  registrar.mutate({
                    tipo_checkin: "rutina_manana",
                    estado_emocional: v.estado,
                    energia: v.energia,
                    foco_dia: v.foco,
                  })
                }
                pending={registrar.isPending}
                signedIn={signedIn}
              />
            </TabsContent>
            <TabsContent value="noche" className="pt-5">
              <EveningForm
                onSubmit={(v) =>
                  registrar.mutate({
                    tipo_checkin: "rutina_noche",
                    estado_emocional: v.estado,
                    notas: v.descarga,
                    gratitud: v.gratitud,
                  })
                }
                pending={registrar.isPending}
                signedIn={signedIn}
              />
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <section className="mt-8 px-5">
        <h2 className="mb-3 font-display text-xl">Evolución emocional</h2>
        <div className="surface-panel p-4">
          {signedIn ? (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serie}>
                    <defs>
                      <linearGradient id="e" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--calm)" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="var(--calm)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="dia"
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      interval={2}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis domain={[0, 10]} hide />
                    <ReTooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="energia"
                      stroke="var(--calm)"
                      strokeWidth={2}
                      fill="url(#e)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <Heatmap checkIns={checkIns} />
            </>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              <Link to="/auth" className="text-primary underline">
                Crea tu cuenta
              </Link>{" "}
              para guardar tu historial y ver tus gráficas.
            </p>
          )}
        </div>
      </section>

      <section className="mt-8 px-5">
        <Link
          to="/respiracion"
          className="surface-panel flex items-center gap-4 p-5 transition-all hover:border-primary/60"
        >
          <Wind className="h-6 w-6 text-primary" strokeWidth={1.7} />
          <div>
            <p className="font-semibold">Laboratorio de respiración</p>
            <p className="text-xs text-muted-foreground">
              Triangular · Anti-tilt · 4-7-8 · Coherente
            </p>
          </div>
        </Link>
      </section>
    </div>
  );
}

function Heatmap({ checkIns }: { checkIns: CheckIn[] }) {
  const dias = useMemo(() => {
    const map = new Map<string, number>();
    checkIns.forEach((c) => {
      const key = new Date(c.created_at).toDateString();
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from({ length: 70 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (69 - i));
      return { key: d.toDateString(), n: map.get(d.toDateString()) ?? 0 };
    });
  }, [checkIns]);

  return (
    <div className="mt-5">
      <p className="mb-2 text-xs text-muted-foreground">Últimas 10 semanas</p>
      <div className="grid grid-flow-col grid-rows-7 gap-1">
        {dias.map((d) => (
          <span
            key={d.key}
            title={`${d.key}: ${d.n} registros`}
            className="h-3 w-3 rounded-[3px] border border-border/50"
            style={{
              background:
                d.n === 0
                  ? "transparent"
                  : `color-mix(in oklab, var(--calm) ${Math.min(100, 30 + d.n * 25)}%, transparent)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

const ESTADOS = ["En calma", "Neutro", "Tenso", "Agotado", "Motivado"];

function MorningForm({
  onSubmit,
  pending,
  signedIn,
}: {
  onSubmit: (v: { estado: string; energia: number; foco: string }) => void;
  pending: boolean;
  signedIn: boolean;
}) {
  const [estado, setEstado] = useState("Neutro");
  const [energia, setEnergia] = useState(6);
  const [foco, setFoco] = useState("");

  return (
    <div className="space-y-5">
      <EstadoPicker value={estado} onChange={setEstado} />
      <div>
        <Label className="text-xs text-muted-foreground">Energía: {energia}/10</Label>
        <Slider
          className="mt-3"
          min={1}
          max={10}
          step={1}
          value={[energia]}
          onValueChange={(v) => setEnergia(v[0] ?? 6)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="foco" className="text-xs text-muted-foreground">
          Foco del día
        </Label>
        <Input
          id="foco"
          value={foco}
          onChange={(e) => setFoco(e.target.value)}
          placeholder="Una sola cosa que importa hoy"
        />
      </div>
      <Button
        className="w-full rounded-full"
        disabled={pending || !signedIn}
        onClick={() => onSubmit({ estado, energia, foco })}
      >
        {signedIn ? "Guardar intención" : "Inicia sesión para guardar"}
      </Button>
    </div>
  );
}

function EveningForm({
  onSubmit,
  pending,
  signedIn,
}: {
  onSubmit: (v: { estado: string; descarga: string; gratitud: string }) => void;
  pending: boolean;
  signedIn: boolean;
}) {
  const [estado, setEstado] = useState("En calma");
  const [descarga, setDescarga] = useState("");
  const [gratitud, setGratitud] = useState("");

  return (
    <div className="space-y-5">
      <EstadoPicker value={estado} onChange={setEstado} />
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Descarga mental</Label>
        <Textarea
          rows={3}
          value={descarga}
          onChange={(e) => setDescarga(e.target.value)}
          placeholder="Suelta aquí todo lo que te ronda"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Gratitud</Label>
        <Input
          value={gratitud}
          onChange={(e) => setGratitud(e.target.value)}
          placeholder="Algo que hoy ha ido bien"
        />
      </div>
      <Button
        className="w-full rounded-full"
        disabled={pending || !signedIn}
        onClick={() => onSubmit({ estado, descarga, gratitud })}
      >
        {signedIn ? "Cerrar el día" : "Inicia sesión para guardar"}
      </Button>
    </div>
  );
}

function EstadoPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ESTADOS.map((e) => (
        <button
          key={e}
          onClick={() => onChange(e)}
          className={
            "rounded-full border px-3 py-1.5 text-xs transition-colors " +
            (value === e
              ? "border-primary bg-primary/15 text-primary"
              : "border-border text-muted-foreground")
          }
        >
          {e}
        </button>
      ))}
    </div>
  );
}
