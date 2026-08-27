import type { ElementType } from "react";
import {
  Heart,
  PenTool,
  Wind,
  Brain,
  Sparkles,
  Sun,
  Moon,
  Timer,
  Grid3x3,
  Eye,
  Palette,
  Calculator,
  Bell,
  Volume2,
} from "lucide-react";

export type SonidoTipo = "preset" | "musica";

export type AlarmaConfig = {
  sonidoTipo: SonidoTipo;
  sonidoId: string; // ej. 'brown', 'alpha', o id de vital_soundtrack
  sonidoTitulo: string;
  sonidoUrl?: string | null | undefined;
  actividadId: string;
  actividadTitulo: string;
  actividadCategoria: "gratitud" | "escritura" | "respiracion" | "gimnasio" | "checkin" | "reencuadre" | "meditacion" | "ninguna";
};

export type ActividadAlarmaDef = {
  id: string;
  titulo: string;
  subtitulo: string;
  categoria: AlarmaConfig["actividadCategoria"];
  icon: ElementType;
  colorClass: string;
  bgClass: string;
  ruta?: string | undefined;
  search?: Record<string, string> | undefined;
};

export const ACTIVIDADES_ALARMA: ActividadAlarmaDef[] = [
  {
    id: "gratitud",
    titulo: "Agradecimientos",
    subtitulo: "Registra 1 a 3 motivos de gratitud",
    categoria: "gratitud",
    icon: Heart,
    colorClass: "text-rose-400",
    bgClass: "bg-rose-500/15",
  },
  {
    id: "escritura",
    titulo: "Escritura reflexiva / Diario",
    subtitulo: "Descarga mental y claridad de pensamientos",
    categoria: "escritura",
    icon: PenTool,
    colorClass: "text-amber-400",
    bgClass: "bg-amber-500/15",
  },
  {
    id: "respiracion_triangular",
    titulo: "Respiración Triangular",
    subtitulo: "Calma en 3 tiempos (Inhala 4 · Retén 4 · Exhala 4)",
    categoria: "respiracion",
    icon: Wind,
    colorClass: "text-teal-400",
    bgClass: "bg-teal-500/15",
    ruta: "/respiracion",
    search: { p: "triangular" },
  },
  {
    id: "respiracion_antitilt",
    titulo: "Respiración Anti-tilt",
    subtitulo: "Corta la frustración y el estrés inmediato",
    categoria: "respiracion",
    icon: Wind,
    colorClass: "text-teal-400",
    bgClass: "bg-teal-500/15",
    ruta: "/respiracion",
    search: { p: "antitilt" },
  },
  {
    id: "respiracion_478",
    titulo: "Método 4-7-8",
    subtitulo: "Relajación profunda e inductor de sueño",
    categoria: "respiracion",
    icon: Wind,
    colorClass: "text-teal-400",
    bgClass: "bg-teal-500/15",
    ruta: "/respiracion",
    search: { p: "478" },
  },
  {
    id: "respiracion_coherente",
    titulo: "Respiración Coherente",
    subtitulo: "Equilibrio 5-5 del sistema nervioso",
    categoria: "respiracion",
    icon: Wind,
    colorClass: "text-teal-400",
    bgClass: "bg-teal-500/15",
    ruta: "/respiracion",
    search: { p: "coherente" },
  },
  {
    id: "gym_secuencia",
    titulo: "Memoria de Trabajo (Secuencia)",
    subtitulo: "Repite la secuencia de luces y tonos",
    categoria: "gimnasio",
    icon: Grid3x3,
    colorClass: "text-amber-400",
    bgClass: "bg-amber-500/15",
    ruta: "/gimnasio",
  },
  {
    id: "gym_parejas",
    titulo: "Memoria Visual (Parejas)",
    subtitulo: "Encuentra parejas de símbolos luminosos",
    categoria: "gimnasio",
    icon: Eye,
    colorClass: "text-teal-400",
    bgClass: "bg-teal-500/15",
    ruta: "/gimnasio",
  },
  {
    id: "gym_stroop",
    titulo: "Control Inhibitorio (Stroop)",
    subtitulo: "Pulsa el color de la tinta, ignora la palabra",
    categoria: "gimnasio",
    icon: Palette,
    colorClass: "text-purple-400",
    bgClass: "bg-purple-500/15",
    ruta: "/gimnasio",
  },
  {
    id: "gym_calculo",
    titulo: "Agilidad Mental (Cálculo)",
    subtitulo: "Operaciones contrarreloj para activar la mente",
    categoria: "gimnasio",
    icon: Calculator,
    colorClass: "text-sky-400",
    bgClass: "bg-sky-500/15",
    ruta: "/gimnasio",
  },
  {
    id: "gym_foco",
    titulo: "Bloque de Foco",
    subtitulo: "Temporizador con audio binaural",
    categoria: "gimnasio",
    icon: Timer,
    colorClass: "text-primary",
    bgClass: "bg-primary/15",
    ruta: "/gimnasio",
  },
  {
    id: "checkin_manana",
    titulo: "Check-in de la Mañana",
    subtitulo: "Intención, energía y foco del día",
    categoria: "checkin",
    icon: Sun,
    colorClass: "text-amber-400",
    bgClass: "bg-amber-500/15",
    ruta: "/",
  },
  {
    id: "checkin_noche",
    titulo: "Check-in de la Noche",
    subtitulo: "Descarga mental y gratitud del día",
    categoria: "checkin",
    icon: Moon,
    colorClass: "text-indigo-400",
    bgClass: "bg-indigo-500/15",
    ruta: "/",
  },
  {
    id: "reencuadre",
    titulo: "Reestructuración Cognitiva IA",
    subtitulo: "Analiza y reencuadra pensamientos de estrés",
    categoria: "reencuadre",
    icon: Sparkles,
    colorClass: "text-rose-400",
    bgClass: "bg-rose-500/15",
    ruta: "/gimnasio",
  },
  {
    id: "meditacion",
    titulo: "Laboratorio de Meditación IA",
    subtitulo: "Meditación guiada personalizada",
    categoria: "meditacion",
    icon: Sparkles,
    colorClass: "text-purple-400",
    bgClass: "bg-purple-500/15",
    ruta: "/laboratorio",
  },
  {
    id: "ninguna",
    titulo: "Solo sonido / Despertador",
    subtitulo: "Sin actividad posterior vinculada",
    categoria: "ninguna",
    icon: Bell,
    colorClass: "text-muted-foreground",
    bgClass: "bg-secondary",
  },
];

export const PRESETS_SONIDO_ALARMA = [
  {
    id: "brown",
    nombre: "Ruido Marrón (Despertar Progresivo)",
    descripcion: "Sube de volumen gradualmente de forma suave y envolvente.",
    tipo: "ruido",
  },
  {
    id: "alpha",
    nombre: "Ondas Alpha (10 Hz)",
    descripcion: "Foco relajado y claridad mental matutina.",
    tipo: "binaural",
  },
  {
    id: "theta",
    nombre: "Ondas Theta (6 Hz)",
    descripcion: "Meditación profunda, relajación e intuición.",
    tipo: "binaural",
  },
  {
    id: "delta",
    nombre: "Ondas Delta (2.5 Hz)",
    descripcion: "Frecuencia para descanso y relajación profunda.",
    tipo: "binaural",
  },
  {
    id: "white",
    nombre: "Ruido Blanco",
    descripcion: "Aislamiento acústico constante.",
    tipo: "ruido",
  },
  {
    id: "pink",
    nombre: "Ruido Rosa",
    descripcion: "Equilibrado y natural, ideal para pausas.",
    tipo: "ruido",
  },
  {
    id: "chime",
    nombre: "Campana Chime 528 Hz",
    descripcion: "Tono armónico de frecuencia de transformación.",
    tipo: "chime",
  },
];

export function parseAlarmaConfig(accionVinculada: string | null): AlarmaConfig {
  if (!accionVinculada) {
    return {
      sonidoTipo: "preset",
      sonidoId: "brown",
      sonidoTitulo: "Ruido Marrón (Despertar Progresivo)",
      actividadId: "gratitud",
      actividadTitulo: "Agradecimientos",
      actividadCategoria: "gratitud",
    };
  }

  try {
    const parsed = JSON.parse(accionVinculada) as Partial<AlarmaConfig>;
    return {
      sonidoTipo: parsed.sonidoTipo ?? "preset",
      sonidoId: parsed.sonidoId ?? "brown",
      sonidoTitulo: parsed.sonidoTitulo ?? "Ruido Marrón",
      sonidoUrl: parsed.sonidoUrl ?? null,
      actividadId: parsed.actividadId ?? "gratitud",
      actividadTitulo: parsed.actividadTitulo ?? "Agradecimientos",
      actividadCategoria: parsed.actividadCategoria ?? "gratitud",
    };
  } catch {
    // Si era un string simple como 'brown' o 'respiracion'
    if (accionVinculada === "respiracion") {
      return {
        sonidoTipo: "preset",
        sonidoId: "alpha",
        sonidoTitulo: "Ondas Alpha",
        actividadId: "respiracion_triangular",
        actividadTitulo: "Respiración Triangular",
        actividadCategoria: "respiracion",
      };
    }
    return {
      sonidoTipo: "preset",
      sonidoId: accionVinculada,
      sonidoTitulo: accionVinculada,
      actividadId: "gratitud",
      actividadTitulo: "Agradecimientos",
      actividadCategoria: "gratitud",
    };
  }
}

export function serializeAlarmaConfig(config: AlarmaConfig): string {
  return JSON.stringify(config);
}
