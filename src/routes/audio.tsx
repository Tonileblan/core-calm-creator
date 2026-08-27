import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pause, Play, Timer, Trash2, Music4, ExternalLink } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SOUND_PRESETS, getAudioEngine, type SoundId } from "@/lib/audio-engine";

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
    <div className="mx-auto max-w-2xl touch-lock">
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

function BandaSonora() {
  const { user, signedIn } = useAuth();
  const queryClient = useQueryClient();
  const [categoria, setCategoria] = useState<string>("celebrar");
  const [nombre, setNombre] = useState("");
  const [artista, setArtista] = useState("");
  const [url, setUrl] = useState("");

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
      if (!nombre.trim() || !url.trim()) throw new Error("Falta el nombre o el enlace.");
      const { error } = await supabase.from("vital_soundtrack").insert({
        user_id: user.id,
        nombre_cancion: nombre.trim(),
        artista: artista.trim() || null,
        categoria_momento: categoria,
        url_enlace: url.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNombre("");
      setArtista("");
      setUrl("");
      void queryClient.invalidateQueries({ queryKey: ["soundtrack"] });
      toast.success("Canción añadida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vital_soundtrack").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["soundtrack"] }),
  });

  if (!signedIn) {
    return (
      <p className="surface-panel p-6 text-center text-sm text-muted-foreground">
        <Link to="/auth" className="text-primary underline">
          Inicia sesión
        </Link>{" "}
        para crear tu diario musical de estados de ánimo.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="surface-panel space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoria(c.id)}
              className={
                "rounded-full border px-3 py-1.5 text-xs transition-colors " +
                (categoria === c.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground")
              }
            >
              {c.label}
            </button>
          ))}
        </div>
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre de la canción"
        />
        <Input
          value={artista}
          onChange={(e) => setArtista(e.target.value)}
          placeholder="Artista (opcional)"
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enlace de Spotify o YouTube"
        />
        <Button
          className="w-full rounded-full"
          disabled={add.isPending}
          onClick={() => add.mutate()}
        >
          Añadir a {CATEGORIAS.find((c) => c.id === categoria)?.label}
        </Button>
      </div>

      {CATEGORIAS.map((c) => {
        const lista = canciones.filter((s) => s.categoria_momento === c.id);
        if (!lista.length) return null;
        return (
          <div key={c.id}>
            <h3 className="mb-2 font-display text-lg">{c.label}</h3>
            <div className="space-y-2">
              {lista.map((s) => (
                <div
                  key={s.id}
                  className="surface-panel flex items-center gap-3 px-4 py-3"
                >
                  <Music4 className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.nombre_cancion}</p>
                    {s.artista ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {s.artista}
                      </p>
                    ) : null}
                  </div>
                  <a
                    href={s.url_enlace}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground transition-colors hover:text-primary"
                    aria-label={`Abrir ${s.nombre_cancion}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => del.mutate(s.id)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
