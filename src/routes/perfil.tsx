import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlarmClock, LogOut, Sunrise, Trash2 } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getAudioEngine } from "@/lib/audio-engine";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil, alarmas y recordatorios · Blowmind" },
      {
        name: "description",
        content:
          "Configura tu despertar progresivo con ruido marrón o binaurales, recordatorios de pausa y tus preferencias de voz en Blowmind.",
      },
      { property: "og:title", content: "Perfil y compromiso · Blowmind" },
      {
        property: "og:description",
        content:
          "Alarmas de despertar progresivo y recordatorios de pausa para mantener tus hábitos de bienestar.",
      },
    ],
  }),
  component: Perfil,
});

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

const TIPOS = [
  { id: "despertar_progresivo", label: "Despertar progresivo", icon: Sunrise },
  { id: "pausa_respiracion", label: "Pausa de respiración", icon: AlarmClock },
  { id: "checkin_rapido", label: "Check-in rápido", icon: AlarmClock },
];

type Alarma = {
  id: string;
  tipo_alarma: string;
  hora_programada: string;
  dias_semana: string[];
  accion_vinculada: string | null;
  activa: boolean;
};

function Perfil() {
  const { user, signedIn } = useAuth();
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState(TIPOS[0]!.id);
  const [hora, setHora] = useState("07:00");
  const [dias, setDias] = useState<string[]>(["L", "M", "X", "J", "V"]);
  const [permiso, setPermiso] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermiso(Notification.permission);
  }, []);

  const { data: perfil } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: signedIn,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, voz_preferida")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (perfil?.display_name) setNombre(perfil.display_name);
  }, [perfil?.display_name]);

  const { data: alarmas = [] } = useQuery({
    queryKey: ["alarms", user?.id],
    enabled: signedIn,
    queryFn: async (): Promise<Alarma[]> => {
      const { data, error } = await supabase
        .from("alarms_settings")
        .select("id, tipo_alarma, hora_programada, dias_semana, accion_vinculada, activa")
        .order("hora_programada");
      if (error) throw error;
      return data ?? [];
    },
  });

  const guardarPerfil = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sin sesión");
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, display_name: nombre, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Perfil actualizado"),
    onError: (e: Error) => toast.error(e.message),
  });

  const crearAlarma = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sin sesión");
      const { error } = await supabase.from("alarms_settings").insert({
        user_id: user.id,
        tipo_alarma: tipo,
        hora_programada: hora,
        dias_semana: dias,
        accion_vinculada: tipo === "despertar_progresivo" ? "brown" : "respiracion",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["alarms"] });
      toast.success("Alarma creada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAlarma = useMutation({
    mutationFn: async (a: Alarma) => {
      const { error } = await supabase
        .from("alarms_settings")
        .update({ activa: !a.activa })
        .eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["alarms"] }),
  });

  const borrarAlarma = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alarms_settings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["alarms"] }),
  });

  // Comprobación local de alarmas (mientras la app está abierta).
  useEffect(() => {
    if (!alarmas.length) return;
    const disparadas = new Set<string>();
    const t = window.setInterval(() => {
      const now = new Date();
      const hhmm = now.toTimeString().slice(0, 5);
      const dia = DIAS[(now.getDay() + 6) % 7]!;
      alarmas.forEach((a) => {
        const key = `${a.id}-${now.toDateString()}-${hhmm}`;
        if (
          a.activa &&
          a.hora_programada.slice(0, 5) === hhmm &&
          a.dias_semana.includes(dia) &&
          !disparadas.has(key)
        ) {
          disparadas.add(key);
          if (a.tipo_alarma === "despertar_progresivo") {
            getAudioEngine().progressiveWake("brown", 120);
          } else {
            getAudioEngine().chime(528, 1.2);
          }
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("Blowmind", {
              body:
                a.tipo_alarma === "despertar_progresivo"
                  ? "Despertar progresivo en marcha"
                  : "Momento de pausa: respira o registra tu check-in",
            });
          }
          toast("Blowmind", { description: TIPOS.find((x) => x.id === a.tipo_alarma)?.label });
        }
      });
    }, 20000);
    return () => window.clearInterval(t);
  }, [alarmas]);

  if (!signedIn) {
    return (
      <div className="mx-auto max-w-2xl">
        <AppHeader titulo="Perfil" subtitulo="Ajustes, alarmas y compromiso." />
        <p className="surface-panel mx-5 p-6 text-center text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary underline">
            Inicia sesión
          </Link>{" "}
          para configurar tus alarmas y preferencias.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <AppHeader titulo="Perfil & Ajustes" subtitulo={user?.email ?? undefined} />

      <div className="space-y-8 px-5">
        <div className="surface-panel space-y-4 p-5">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Cómo quieres que te llame"
            />
          </div>
          <Button
            className="rounded-full"
            onClick={() => guardarPerfil.mutate()}
            disabled={guardarPerfil.isPending}
          >
            Guardar
          </Button>
        </div>

        <div className="surface-panel space-y-5 p-5">
          <div>
            <h2 className="font-display text-xl">Alarmas y recordatorios</h2>
            <p className="text-xs text-muted-foreground">
              Gestor de compromiso: despertar progresivo y pausas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {TIPOS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTipo(t.id)}
                className={
                  "rounded-full border px-3 py-1.5 text-xs transition-colors " +
                  (tipo === t.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground")
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="hora">Hora</Label>
              <Input
                id="hora"
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="space-y-2">
              <Label>Días</Label>
              <div className="flex gap-1">
                {DIAS.map((d) => (
                  <button
                    key={d}
                    onClick={() =>
                      setDias((prev) =>
                        prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                      )
                    }
                    className={
                      "h-8 w-8 rounded-full border text-xs transition-colors " +
                      (dias.includes(d)
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground")
                    }
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            className="rounded-full"
            onClick={() => crearAlarma.mutate()}
            disabled={crearAlarma.isPending || !dias.length}
          >
            Crear alarma
          </Button>

          {permiso !== "granted" ? (
            <button
              className="text-xs text-primary underline"
              onClick={() => void Notification.requestPermission().then(setPermiso)}
            >
              Activar notificaciones del navegador
            </button>
          ) : null}

          <div className="space-y-2">
            {alarmas.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {a.hora_programada.slice(0, 5)} ·{" "}
                    {TIPOS.find((t) => t.id === a.tipo_alarma)?.label ?? a.tipo_alarma}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.dias_semana.join(" · ")}
                  </p>
                </div>
                <Switch
                  checked={a.activa}
                  onCheckedChange={() => toggleAlarma.mutate(a)}
                  aria-label="Activar alarma"
                />
                <button
                  onClick={() => borrarAlarma.mutate(a.id)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label="Eliminar alarma"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">
              Prueba el despertar progresivo: el ruido marrón sube de volumen poco a poco.
            </p>
            <Button
              variant="secondary"
              className="mt-3 rounded-full"
              onClick={() => getAudioEngine().progressiveWake("brown", 60)}
            >
              Probar 1 min
            </Button>
          </div>
        </div>

        <Button
          variant="secondary"
          className="w-full rounded-full"
          onClick={async () => {
            getAudioEngine().stop();
            await supabase.auth.signOut();
            queryClient.clear();
            toast.success("Sesión cerrada");
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
