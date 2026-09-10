import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  AlarmClock,
  LogOut,
  Trash2,
  Plus,
  Play,
  Volume2,
  Music4,
  Heart,
  PenTool,
  Wind,
  Brain,
  Sparkles,
  Sun,
  Moon,
  Timer,
  CheckCircle,
  BellRing,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getAudioEngine } from "@/lib/audio-engine";
import {
  ACTIVIDADES_ALARMA,
  PRESETS_SONIDO_ALARMA,
  parseAlarmaConfig,
  serializeAlarmaConfig,
  type AlarmaConfig,
  type ActividadAlarmaDef,
} from "@/lib/alarm-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil y Sistema de Alarmas · Blowmind" },
      {
        name: "description",
        content:
          "Configura tus alarmas con actividades de gratitud, escritura, respiración, gimnasio mental y tu música o sonidos preferidos.",
      },
      { property: "og:title", content: "Alarmas y Compromiso · Blowmind" },
      {
        property: "og:description",
        content:
          "Alarmas personalizadas con actividades vinculadas y música de tu banda sonora o frecuencias.",
      },
    ],
  }),
  component: Perfil,
});

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

type Alarma = {
  id: string;
  tipo_alarma: string;
  hora_programada: string;
  dias_semana: string[];
  accion_vinculada: string | null;
  activa: boolean;
};

type Cancion = {
  id: string;
  nombre_cancion: string;
  artista: string | null;
  categoria_momento: string;
  url_enlace: string;
};

function Perfil() {
  const { user, signedIn } = useAuth();
  const queryClient = useQueryClient();

  const [nombre, setNombre] = useState("");
  const [permiso, setPermiso] = useState<NotificationPermission>("default");

  // Estado del creador de alarmas
  const [mostrarCreador, setMostrarCreador] = useState(false);
  const [hora, setHora] = useState("07:00");
  const [dias, setDias] = useState<string[]>(["L", "M", "X", "J", "V"]);
  const [tipoAlarmaLabel, setTipoAlarmaLabel] = useState("Despertar consciente");

  // Configuración de sonido
  const [tabSonido, setTabSonido] = useState<"preset" | "musica">("preset");
  const [presetSeleccionado, setPresetSeleccionado] = useState(PRESETS_SONIDO_ALARMA[0]!.id);
  const [cancionSeleccionada, setCancionSeleccionada] = useState<Cancion | null>(null);

  // Configuración de actividad
  const [actividadSeleccionada, setActividadSeleccionada] = useState<ActividadAlarmaDef>(
    ACTIVIDADES_ALARMA[0]!,
  );

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

  const { data: canciones = [] } = useQuery({
    queryKey: ["soundtrack", user?.id],
    enabled: signedIn,
    queryFn: async (): Promise<Cancion[]> => {
      const { data, error } = await supabase
        .from("vital_soundtrack")
        .select("id, nombre_cancion, artista, categoria_momento, url_enlace")
        .order("created_at", { ascending: false });
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

  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-seleccionar primera canción si está disponible
  useEffect(() => {
    if (canciones.length > 0 && !cancionSeleccionada) {
      setCancionSeleccionada(canciones[0] ?? null);
    }
  }, [canciones, cancionSeleccionada]);

  const crearAlarma = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sin sesión");
      if (!dias.length) throw new Error("Selecciona al menos un día de la semana.");

      let sonidoConfig: AlarmaConfig;
      if (tabSonido === "musica") {
        const cancion = cancionSeleccionada || canciones[0];
        if (!cancion) {
          throw new Error("No tienes canciones en tu Banda Sonora. Guarda una primero en la sección de Audio.");
        }
        sonidoConfig = {
          sonidoTipo: "musica",
          sonidoId: cancion.id,
          sonidoTitulo: `${cancion.nombre_cancion}${cancion.artista ? ` · ${cancion.artista}` : ""}`,
          sonidoUrl: cancion.url_enlace,
          actividadId: actividadSeleccionada.id,
          actividadTitulo: actividadSeleccionada.titulo,
          actividadCategoria: actividadSeleccionada.categoria,
        };
      } else {
        const p = PRESETS_SONIDO_ALARMA.find((x) => x.id === presetSeleccionado) ?? PRESETS_SONIDO_ALARMA[0]!;
        sonidoConfig = {
          sonidoTipo: "preset",
          sonidoId: p.id,
          sonidoTitulo: p.nombre,
          actividadId: actividadSeleccionada.id,
          actividadTitulo: actividadSeleccionada.titulo,
          actividadCategoria: actividadSeleccionada.categoria,
        };
      }

      const { error } = await supabase.from("alarms_settings").insert({
        user_id: user.id,
        tipo_alarma: tipoAlarmaLabel.trim() || actividadSeleccionada.titulo,
        hora_programada: hora,
        dias_semana: dias,
        accion_vinculada: serializeAlarmaConfig(sonidoConfig),
        activa: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["alarms"] });
      setMostrarCreador(false);
      toast.success("Alarma configurada y activada");
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["alarms"] });
      toast.success("Alarma eliminada");
    },
  });

  // Probar sonido antes de guardar
  const probarSonido = (presetId: string) => {
    if (presetId === "brown") {
      getAudioEngine().progressiveWake("brown", 20);
    } else if (presetId === "chime") {
      getAudioEngine().chime(528, 1.5);
    } else {
      getAudioEngine().play(presetId as any);
    }
    toast.info("Reproduciendo vista previa de sonido (10s)");
    setTimeout(() => getAudioEngine().stop(), 8000);
  };

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
    <div className="mx-auto max-w-2xl pb-24 touch-lock">
      <AppHeader titulo="Perfil & Ajustes" subtitulo={user?.email ?? ""} />

      <div className="space-y-8 px-5">
        {/* Información personal */}
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

        {/* ── SECCIÓN DE ALARMAS Y RECORDATORIOS ── */}
        <div className="surface-panel space-y-6 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold flex items-center gap-2">
                <AlarmClock className="h-5 w-5 text-primary" />
                Sistema de Alarmas
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Elige la música/sonido y la actividad de bienestar que comenzará al sonar.
              </p>
            </div>
            <Button
              size="sm"
              className="rounded-full gap-1 text-xs"
              onClick={() => setMostrarCreador(!mostrarCreador)}
            >
              {mostrarCreador ? (
                <>
                  <ChevronUp className="h-4 w-4" /> Cancelar
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Nueva Alarma
                </>
              )}
            </Button>
          </div>

          {/* Formulario Creador de Alarma */}
          {mostrarCreador && (
            <div className="rounded-2xl border border-primary/40 bg-secondary/30 p-5 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <h3 className="font-display text-base font-semibold text-foreground">
                Configurar Nueva Alarma
              </h3>

              {/* 1. Hora y Días */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  1. Horario y Repetición
                </Label>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="hora-alarma" className="text-xs text-muted-foreground">
                      Hora
                    </Label>
                    <Input
                      id="hora-alarma"
                      type="time"
                      value={hora}
                      onChange={(e) => setHora(e.target.value)}
                      className="w-32 text-base font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-[200px]">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Días</Label>
                      <button
                        type="button"
                        onClick={() =>
                          setDias(dias.length === 7 ? ["L", "M", "X", "J", "V"] : ["L", "M", "X", "J", "V", "S", "D"])
                        }
                        className="text-[0.7rem] text-primary hover:underline cursor-pointer"
                      >
                        {dias.length === 7 ? "Lun-Vie" : "Todos los días"}
                      </button>
                    </div>
                    <div className="flex gap-1">
                      {DIAS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() =>
                            setDias((prev) =>
                              prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                            )
                          }
                          className={cn(
                            "h-8 w-8 rounded-full border text-xs font-medium transition-colors cursor-pointer",
                            dias.includes(d)
                              ? "border-primary bg-primary text-primary-foreground font-semibold shadow-sm"
                              : "border-border text-muted-foreground hover:border-primary/40",
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <Input
                  value={tipoAlarmaLabel}
                  onChange={(e) => setTipoAlarmaLabel(e.target.value)}
                  placeholder="Etiqueta (ej. Despertar enérgico, Pausa de gratitud)"
                  className="text-xs"
                />
              </div>

              {/* 2. Selección de Música o Sonido */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  2. Música o Sonido de la Alarma
                </Label>
                <Tabs
                  value={tabSonido}
                  onValueChange={(v) => setTabSonido(v as "preset" | "musica")}
                >
                  <TabsList className="grid grid-cols-2 rounded-full h-9">
                    <TabsTrigger value="preset" className="text-xs rounded-full">
                      <Volume2 className="h-3.5 w-3.5 mr-1.5" /> Sonidos de la App
                    </TabsTrigger>
                    <TabsTrigger value="musica" className="text-xs rounded-full">
                      <Music4 className="h-3.5 w-3.5 mr-1.5" /> Mi Música (Banda Sonora)
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="preset" className="space-y-2 mt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PRESETS_SONIDO_ALARMA.map((p) => {
                        const isSel = presetSeleccionado === p.id;
                        return (
                          <div
                            key={p.id}
                            onClick={() => setPresetSeleccionado(p.id)}
                            className={cn(
                              "flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer text-left",
                              isSel
                                ? "border-primary bg-primary/10 text-primary font-medium"
                                : "border-border/60 hover:border-primary/40",
                            )}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="text-xs font-medium truncate">{p.nombre}</p>
                              <p className="text-[0.65rem] text-muted-foreground truncate">
                                {p.descripcion}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                probarSonido(p.id);
                              }}
                              className="h-6 w-6 shrink-0 flex items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-primary"
                              title="Probar sonido"
                            >
                              <Play className="h-3 w-3 ml-0.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>

                  <TabsContent value="musica" className="space-y-2 mt-3">
                    {canciones.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed text-center space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Aún no has guardado canciones en tu Banda Sonora Vital.
                        </p>
                        <Link to="/audio" className="text-xs text-primary underline">
                          Ir a Audio y añadir canciones
                        </Link>
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        <audio ref={previewAudioRef} />
                        {canciones.map((c) => {
                          const isSel = cancionSeleccionada?.id === c.id;
                          const isPreviewing = audioPreviewUrl === c.url_enlace;
                          return (
                            <div
                              key={c.id}
                              onClick={() => setCancionSeleccionada(c)}
                              className={cn(
                                "flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer",
                                isSel
                                  ? "border-primary bg-primary/10 text-primary font-medium"
                                  : "border-border/60 hover:border-primary/40",
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate">{c.nombre_cancion}</p>
                                <p className="text-[0.65rem] text-muted-foreground truncate">
                                  {c.artista ?? "Pista"} · <span className="capitalize">{c.categoria_momento}</span>
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isPreviewing) {
                                      if (previewAudioRef.current) previewAudioRef.current.pause();
                                      setAudioPreviewUrl(null);
                                    } else {
                                      setCancionSeleccionada(c);
                                      setAudioPreviewUrl(c.url_enlace);
                                      if (previewAudioRef.current) {
                                        previewAudioRef.current.src = c.url_enlace;
                                        previewAudioRef.current.play().catch(() => toast.info(`Seleccionada: ${c.nombre_cancion}`));
                                      }
                                    }
                                  }}
                                  className="h-6 w-6 flex items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-primary"
                                  title="Escuchar vista previa"
                                >
                                  <Play className="h-3 w-3 ml-0.5" />
                                </button>
                                {isSel && <CheckCircle className="h-4 w-4 text-primary shrink-0" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* 3. Selección de Actividad Vinculada */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  3. Actividad al Sonar la Alarma
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {ACTIVIDADES_ALARMA.map((act) => {
                    const isSel = actividadSeleccionada.id === act.id;
                    const IconComponent = act.icon;
                    return (
                      <div
                        key={act.id}
                        onClick={() => setActividadSeleccionada(act)}
                        className={cn(
                          "flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer text-left",
                          isSel
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border/60 hover:border-primary/40",
                        )}
                      >
                        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5", act.bgClass, act.colorClass)}>
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-xs font-medium truncate", isSel ? "text-primary font-semibold" : "")}>
                            {act.titulo}
                          </p>
                          <p className="text-[0.65rem] text-muted-foreground line-clamp-1">
                            {act.subtitulo}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Botón de Confirmación */}
              <Button
                className="w-full rounded-full h-11 text-sm font-semibold shadow-md"
                onClick={() => crearAlarma.mutate()}
                disabled={crearAlarma.isPending || !dias.length}
              >
                Guardar y Activar Alarma
              </Button>
            </div>
          )}

          {/* Estado de segundo plano y permisos de notificación */}
          <div className="rounded-2xl border border-border/80 bg-secondary/20 p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                  permiso === "granted" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                )}>
                  {permiso === "granted" ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <BellRing className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    {permiso === "granted"
                      ? "Modo Segundo Plano & Notificaciones Activo"
                      : "Avisos con Pantalla Bloqueada"}
                  </h4>
                  <p className="text-[0.7rem] text-muted-foreground mt-0.5 leading-relaxed">
                    {permiso === "granted"
                      ? "Las alarmas y frecuencias continuarán activas en segundo plano con controles en pantalla de bloqueo y vibración."
                      : "Para que las alarmas suenen puntuales y vibren cuando el móvil esté en reposo o con la pantalla apagada, activa las notificaciones."}
                  </p>
                </div>
              </div>
              {permiso !== "granted" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (typeof Notification !== "undefined") {
                      void Notification.requestPermission().then((res) => {
                        setPermiso(res);
                        if (res === "granted") {
                          toast.success("Notificaciones en segundo plano activadas");
                        }
                      });
                    }
                  }}
                  className="rounded-full shrink-0 text-xs h-8 border-primary/40 text-primary hover:bg-primary/10"
                >
                  Activar
                </Button>
              )}
            </div>
          </div>

          {/* Lista de Alarmas Guardadas */}
          <div className="space-y-3">
            {alarmas.length === 0 ? (
              <p className="text-xs text-center text-muted-foreground py-6 border border-dashed rounded-2xl">
                No tienes ninguna alarma configurada. Pulsa &quot;Nueva Alarma&quot; para crear una.
              </p>
            ) : (
              alarmas.map((a) => {
                const config = parseAlarmaConfig(a.accion_vinculada);
                const act = ACTIVIDADES_ALARMA.find((x) => x.id === config.actividadId);
                const ActIcon = act?.icon ?? AlarmClock;

                return (
                  <div
                    key={a.id}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4 transition-all duration-200",
                      a.activa ? "border-primary/40 bg-surface shadow-sm" : "border-border/60 opacity-60",
                    )}
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-display text-2xl font-bold tracking-tight text-foreground">
                          {a.hora_programada.slice(0, 5)}
                        </span>
                        <span className="text-xs font-semibold text-foreground/80 truncate">
                          {a.tipo_alarma}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Chip de Actividad */}
                        <span className={cn("inline-flex items-center gap-1 text-[0.65rem] px-2 py-0.5 rounded-full font-medium", act?.bgClass ?? "bg-secondary", act?.colorClass ?? "text-muted-foreground")}>
                          <ActIcon className="h-3 w-3" />
                          {config.actividadTitulo}
                        </span>

                        {/* Chip de Sonido / Música */}
                        <span className="inline-flex items-center gap-1 text-[0.65rem] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          {config.sonidoTipo === "musica" ? (
                            <Music4 className="h-3 w-3 text-primary" />
                          ) : (
                            <Volume2 className="h-3 w-3 text-primary" />
                          )}
                          <span className="truncate max-w-[150px]">{config.sonidoTitulo}</span>
                        </span>

                        {/* Días */}
                        <span className="text-[0.65rem] text-muted-foreground">
                          {a.dias_semana.join(" · ")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("blowmind-test-alarm", { detail: a }));
                        }}
                        className="rounded-full h-8 text-[0.7rem] gap-1 cursor-pointer border-primary/30 text-primary hover:bg-primary/10"
                        title="Probar alarma ahora"
                      >
                        <BellRing className="h-3 w-3" /> Probar
                      </Button>
                      <Switch
                        checked={a.activa}
                        onCheckedChange={() => toggleAlarma.mutate(a)}
                        aria-label="Activar alarma"
                      />
                      <button
                        onClick={() => borrarAlarma.mutate(a.id)}
                        className="text-muted-foreground/60 transition-colors hover:text-destructive p-1.5 cursor-pointer"
                        aria-label="Eliminar alarma"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Cerrar sesión */}
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
