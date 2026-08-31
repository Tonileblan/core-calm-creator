import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Flame, Moon, Leaf, Sun, Heart, RotateCcw, Play, Award, GitFork } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAudioEngine } from "@/lib/audio-engine";
import { cn } from "@/lib/utils";
import { Marcador, CuadroFlotanteTurno, type Registrar } from "./MindGames";

/* ─────────────────────────────────────────────────────────────
   TIPOS Y CONFIGURACIONES DE COLOR
───────────────────────────────────────────────────────────── */

export type TrainColorId = "rojo" | "azul" | "verde" | "amarillo";

export type DifficultyLevel = "facil" | "medio" | "dificil" | "experto";

export interface ColorDef {
  id: TrainColorId;
  nombre: string;
  hex: string;
  glow: string;
  trackColor: string;
  icon: typeof Flame;
  badgeBg: string;
  borderClass: string;
}

export const COLORES_TRENES: Record<TrainColorId, ColorDef> = {
  rojo: {
    id: "rojo",
    nombre: "Rojo",
    hex: "#f87171",
    glow: "rgba(248, 113, 113, 0.6)",
    trackColor: "#ef4444",
    icon: Flame,
    badgeBg: "bg-red-500/20 text-red-400 border-red-500/40",
    borderClass: "border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.35)]",
  },
  azul: {
    id: "azul",
    nombre: "Azul",
    hex: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.6)",
    trackColor: "#0ea5e9",
    icon: Moon,
    badgeBg: "bg-sky-500/20 text-sky-400 border-sky-500/40",
    borderClass: "border-sky-500/60 shadow-[0_0_15px_rgba(14,165,233,0.35)]",
  },
  verde: {
    id: "verde",
    nombre: "Verde",
    hex: "#34d399",
    glow: "rgba(52, 211, 153, 0.6)",
    trackColor: "#10b981",
    icon: Leaf,
    badgeBg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    borderClass: "border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.35)]",
  },
  amarillo: {
    id: "amarillo",
    nombre: "Amarillo",
    hex: "#fbbf24",
    glow: "rgba(251, 191, 36, 0.6)",
    trackColor: "#f59e0b",
    icon: Sun,
    badgeBg: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    borderClass: "border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.35)]",
  },
};

export interface StationDef {
  id: number;
  color: TrainColorId;
  x: number;
  y: number;
  label: string;
}

export interface SwitchDef {
  id: number;
  x: number;
  y: number;
  name: string;
  // 0: Izquierda / Principal, 1: Derecha / Alternativa
  dir: 0 | 1;
}

export interface TrainInstance {
  id: string;
  color: TrainColorId;
  // Progreso general en la red de 0 a 1
  progress: number;
  speed: number;
  // Para controlar si ya atravesó desvíos
  passedSwitch0?: boolean;
  passedSwitchMid?: boolean;
  // Ruta fijada al pasar cada nodo
  chosenRouteS0?: 0 | 1;
  chosenRouteS1?: 0 | 1;
  chosenRouteS2?: 0 | 1;
}

export interface FloatingNotification {
  id: string;
  x: number;
  y: number;
  text: string;
  type: "success" | "error";
}

/* ─────────────────────────────────────────────────────────────
   CONFIGURACIONES DE DIFICULTAD
───────────────────────────────────────────────────────────── */

interface DifficultyConfig {
  name: string;
  description: string;
  colors: TrainColorId[];
  speedBase: number;
  spawnIntervalMs: number;
  switchesCount: number;
  stationsCount: number;
}

const NIVELES: Record<DifficultyLevel, DifficultyConfig> = {
  facil: {
    name: "Fácil",
    description: "2 colores · 1 desvío · Ritmo pausado",
    colors: ["rojo", "azul"],
    speedBase: 0.13, // % progreso por segundo
    spawnIntervalMs: 5000,
    switchesCount: 1,
    stationsCount: 2,
  },
  medio: {
    name: "Medio",
    description: "3 colores · 2 desvíos · Ritmo activo",
    colors: ["rojo", "azul", "verde"],
    speedBase: 0.16,
    spawnIntervalMs: 4200,
    switchesCount: 2,
    stationsCount: 3,
  },
  dificil: {
    name: "Difícil",
    description: "4 colores · 3 desvíos · Múltiples trenes",
    colors: ["rojo", "azul", "verde", "amarillo"],
    speedBase: 0.19,
    spawnIntervalMs: 3500,
    switchesCount: 3,
    stationsCount: 4,
  },
  experto: {
    name: "Experto",
    description: "4 colores · Alta velocidad · Máxima atención",
    colors: ["rojo", "azul", "verde", "amarillo"],
    speedBase: 0.24,
    spawnIntervalMs: 2700,
    switchesCount: 3,
    stationsCount: 4,
  },
};

/* ─────────────────────────────────────────────────────────────
   GEOMETRÍA Y CÁLCULO DE POSICIONES EN LAS VÍAS (SVG 400x480)
───────────────────────────────────────────────────────────── */

const VIEW_W = 400;
const VIEW_H = 480;

function bezierPoint(p0: number, p1: number, p2: number, p3: number, t: number) {
  const cX = 3 * (p1 - p0);
  const bX = 3 * (p2 - p1) - cX;
  const aX = p3 - p0 - cX - bX;
  return aX * t * t * t + bX * t * t + cX * t + p0;
}

function calculateTrainCoords(
  train: TrainInstance,
  level: DifficultyLevel,
  switches: Record<number, 0 | 1>,
): { x: number; y: number; angle: number; currentStationColor?: TrainColorId } {
  const p = Math.min(1, Math.max(0, train.progress));

  // 1. MODO FÁCIL: 2 Estaciones (S0 en Y=160, bifurca a Estación Izq x=110, Der x=290)
  if (level === "facil") {
    const s0Y = 160;
    const startP = 0.32; // de 0 a 0.32 baja vertical hasta S0

    if (p <= startP) {
      const localT = p / startP;
      return { x: 200, y: 20 + localT * (s0Y - 20), angle: 90 };
    }

    // Ruta elegida en S0
    const route = train.chosenRouteS0 ?? switches[0] ?? 0;
    const localT = (p - startP) / (1 - startP);

    const targetX = route === 0 ? 110 : 290;
    const targetY = 440;

    // Curva cúbica desde (200, s0Y) hasta (targetX, targetY)
    const x0 = 200,
      y0 = s0Y;
    const cp1x = 200,
      cp1y = s0Y + 80;
    const cp2x = targetX,
      cp2y = targetY - 90;
    const x1 = targetX,
      y1 = targetY;

    const x = bezierPoint(x0, cp1x, cp2x, x1, localT);
    const y = bezierPoint(y0, cp1y, cp2y, y1, localT);

    // Calcular ángulo de orientación del tren
    const tNext = Math.min(1, localT + 0.01);
    const nx = bezierPoint(x0, cp1x, cp2x, x1, tNext);
    const ny = bezierPoint(y0, cp1y, cp2y, y1, tNext);
    const angle = (Math.atan2(ny - y, nx - x) * 180) / Math.PI;

    return { x, y, angle, currentStationColor: route === 0 ? "rojo" : "azul" };
  }

  // 2. MODO MEDIO: 3 Estaciones (S0 en Y=130 -> Izq a S1 Y=240, Der a Estación 2 Verde x=320)
  if (level === "medio") {
    const s0Y = 130;
    const pS0 = 0.25;

    if (p <= pS0) {
      const localT = p / pS0;
      return { x: 200, y: 20 + localT * (s0Y - 20), angle: 90 };
    }

    const route0 = train.chosenRouteS0 ?? switches[0] ?? 0;

    if (route0 === 1) {
      // Rama Derecha directa a Estación Verde (x=320, y=440)
      const localT = (p - pS0) / (1 - pS0);
      const x0 = 200,
        y0 = s0Y;
      const cp1x = 200,
        cp1y = s0Y + 80;
      const cp2x = 320,
        cp2y = 350;
      const x1 = 320,
        y1 = 440;

      const x = bezierPoint(x0, cp1x, cp2x, x1, localT);
      const y = bezierPoint(y0, cp1y, cp2y, y1, localT);
      const tNext = Math.min(1, localT + 0.01);
      const nx = bezierPoint(x0, cp1x, cp2x, x1, tNext);
      const ny = bezierPoint(y0, cp1y, cp2y, y1, tNext);
      const angle = (Math.atan2(ny - y, nx - x) * 180) / Math.PI;
      return { x, y, angle, currentStationColor: "verde" };
    } else {
      // Rama Izquierda hacia S1 (x=130, y=240)
      const s1Y = 240;
      const s1X = 130;
      const pS1 = 0.52;

      if (p <= pS1) {
        const localT = (p - pS0) / (pS1 - pS0);
        const x0 = 200,
          y0 = s0Y;
        const cp1x = 200,
          cp1y = s0Y + 40;
        const cp2x = s1X,
          cp2y = s1Y - 40;
        const x1 = s1X,
          y1 = s1Y;

        const x = bezierPoint(x0, cp1x, cp2x, x1, localT);
        const y = bezierPoint(y0, cp1y, cp2y, y1, localT);
        const tNext = Math.min(1, localT + 0.01);
        const nx = bezierPoint(x0, cp1x, cp2x, x1, tNext);
        const ny = bezierPoint(y0, cp1y, cp2y, y1, tNext);
        const angle = (Math.atan2(ny - y, nx - x) * 180) / Math.PI;
        return { x, y, angle };
      }

      // De S1 a Estación Rojo (x=70) o Azul (x=190)
      const route1 = train.chosenRouteS1 ?? switches[1] ?? 0;
      const localT = (p - pS1) / (1 - pS1);
      const targetX = route1 === 0 ? 70 : 190;
      const targetY = 440;

      const x0 = s1X,
        y0 = s1Y;
      const cp1x = s1X,
        cp1y = s1Y + 60;
      const cp2x = targetX,
        cp2y = targetY - 60;
      const x1 = targetX,
        y1 = targetY;

      const x = bezierPoint(x0, cp1x, cp2x, x1, localT);
      const y = bezierPoint(y0, cp1y, cp2y, y1, localT);
      const tNext = Math.min(1, localT + 0.01);
      const nx = bezierPoint(x0, cp1x, cp2x, x1, tNext);
      const ny = bezierPoint(y0, cp1y, cp2y, y1, tNext);
      const angle = (Math.atan2(ny - y, nx - x) * 180) / Math.PI;
      return { x, y, angle, currentStationColor: route1 === 0 ? "rojo" : "azul" };
    }
  }

  // 3. MODO DIFÍCIL / EXPERTO: 4 Estaciones (S0 Y=115 -> S1 izq x=125 Y=225, S2 der x=275 Y=225)
  const s0Y = 115;
  const pS0 = 0.22;

  if (p <= pS0) {
    const localT = p / pS0;
    return { x: 200, y: 20 + localT * (s0Y - 20), angle: 90 };
  }

  const route0 = train.chosenRouteS0 ?? switches[0] ?? 0;
  const pMid = 0.5;

  if (route0 === 0) {
    // Rama Izquierda hacia S1 (x=125, y=225)
    const s1X = 125,
      s1Y = 225;
    if (p <= pMid) {
      const localT = (p - pS0) / (pMid - pS0);
      const x0 = 200,
        y0 = s0Y;
      const cp1x = 200,
        cp1y = s0Y + 40;
      const cp2x = s1X,
        cp2y = s1Y - 40;
      const x1 = s1X,
        y1 = s1Y;

      const x = bezierPoint(x0, cp1x, cp2x, x1, localT);
      const y = bezierPoint(y0, cp1y, cp2y, y1, localT);
      const tNext = Math.min(1, localT + 0.01);
      const nx = bezierPoint(x0, cp1x, cp2x, x1, tNext);
      const ny = bezierPoint(y0, cp1y, cp2y, y1, tNext);
      const angle = (Math.atan2(ny - y, nx - x) * 180) / Math.PI;
      return { x, y, angle };
    }

    const route1 = train.chosenRouteS1 ?? switches[1] ?? 0;
    const localT = (p - pMid) / (1 - pMid);
    const targetX = route1 === 0 ? 55 : 145;
    const targetY = 440;

    const x0 = s1X,
      y0 = s1Y;
    const cp1x = s1X,
      cp1y = s1Y + 60;
    const cp2x = targetX,
      cp2y = targetY - 60;
    const x1 = targetX,
      y1 = targetY;

    const x = bezierPoint(x0, cp1x, cp2x, x1, localT);
    const y = bezierPoint(y0, cp1y, cp2y, y1, localT);
    const tNext = Math.min(1, localT + 0.01);
    const nx = bezierPoint(x0, cp1x, cp2x, x1, tNext);
    const ny = bezierPoint(y0, cp1y, cp2y, y1, tNext);
    const angle = (Math.atan2(ny - y, nx - x) * 180) / Math.PI;
    return { x, y, angle, currentStationColor: route1 === 0 ? "rojo" : "azul" };
  } else {
    // Rama Derecha hacia S2 (x=275, y=225)
    const s2X = 275,
      s2Y = 225;
    if (p <= pMid) {
      const localT = (p - pS0) / (pMid - pS0);
      const x0 = 200,
        y0 = s0Y;
      const cp1x = 200,
        cp1y = s0Y + 40;
      const cp2x = s2X,
        cp2y = s2Y - 40;
      const x1 = s2X,
        y1 = s2Y;

      const x = bezierPoint(x0, cp1x, cp2x, x1, localT);
      const y = bezierPoint(y0, cp1y, cp2y, y1, localT);
      const tNext = Math.min(1, localT + 0.01);
      const nx = bezierPoint(x0, cp1x, cp2x, x1, tNext);
      const ny = bezierPoint(y0, cp1y, cp2y, y1, tNext);
      const angle = (Math.atan2(ny - y, nx - x) * 180) / Math.PI;
      return { x, y, angle };
    }

    const route2 = train.chosenRouteS2 ?? switches[2] ?? 0;
    const localT = (p - pMid) / (1 - pMid);
    const targetX = route2 === 0 ? 255 : 345;
    const targetY = 440;

    const x0 = s2X,
      y0 = s2Y;
    const cp1x = s2X,
      cp1y = s2Y + 60;
    const cp2x = targetX,
      cp2y = targetY - 60;
    const x1 = targetX,
      y1 = targetY;

    const x = bezierPoint(x0, cp1x, cp2x, x1, localT);
    const y = bezierPoint(y0, cp1y, cp2y, y1, localT);
    const tNext = Math.min(1, localT + 0.01);
    const nx = bezierPoint(x0, cp1x, cp2x, x1, tNext);
    const ny = bezierPoint(y0, cp1y, cp2y, y1, tNext);
    const angle = (Math.atan2(ny - y, nx - x) * 180) / Math.PI;
    return { x, y, angle, currentStationColor: route2 === 0 ? "verde" : "amarillo" };
  }
}

/* ─────────────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL DEL JUEGO
───────────────────────────────────────────────────────────── */

export function TrainSwitchGame({ registrar }: { registrar: Registrar }) {
  const [dificultad, setDificultad] = useState<DifficultyLevel>("facil");
  const [fase, setFase] = useState<"idle" | "jugando" | "pausado" | "gameover">("idle");

  const [puntos, setPuntos] = useState(0);
  const [racha, setRacha] = useState(0);
  const [mejorRacha, setMejorRacha] = useState(0);
  const [vidas, setVidas] = useState(3);
  const [aciertos, setAciertos] = useState(0);
  const [fallos, setFallos] = useState(0);

  // Estado de los desvíos (0: Izq, 1: Der)
  const [switches, setSwitches] = useState<Record<number, 0 | 1>>({
    0: 0,
    1: 0,
    2: 0,
  });

  // Lista de trenes activos en circulación
  const [trains, setTrains] = useState<TrainInstance[]>([]);
  const [notifications, setNotifications] = useState<FloatingNotification[]>([]);

  // Referencias para el loop de animación
  const reqRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const switchesRef = useRef(switches);
  switchesRef.current = switches;

  const config = NIVELES[dificultad];

  /* ── Estaciones según la dificultad ── */
  const estaciones: StationDef[] = useMemo(() => {
    if (dificultad === "facil") {
      return [
        { id: 0, color: "rojo", x: 110, y: 440, label: "Rojo" },
        { id: 1, color: "azul", x: 290, y: 440, label: "Azul" },
      ];
    }
    if (dificultad === "medio") {
      return [
        { id: 0, color: "rojo", x: 70, y: 440, label: "Rojo" },
        { id: 1, color: "azul", x: 190, y: 440, label: "Azul" },
        { id: 2, color: "verde", x: 320, y: 440, label: "Verde" },
      ];
    }
    // Dificil & Experto
    return [
      { id: 0, color: "rojo", x: 55, y: 440, label: "Rojo" },
      { id: 1, color: "azul", x: 145, y: 440, label: "Azul" },
      { id: 2, color: "verde", x: 255, y: 440, label: "Verde" },
      { id: 3, color: "amarillo", x: 345, y: 440, label: "Amarillo" },
    ];
  }, [dificultad]);

  /* ── Desvíos presentes según dificultad ── */
  const listaDesvios: SwitchDef[] = useMemo(() => {
    if (dificultad === "facil") {
      return [{ id: 0, x: 200, y: 160, name: "Desvío Principal", dir: switches[0] ?? 0 }];
    }
    if (dificultad === "medio") {
      return [
        { id: 0, x: 200, y: 130, name: "Desvío Superior", dir: switches[0] ?? 0 },
        { id: 1, x: 130, y: 240, name: "Desvío Izquierdo", dir: switches[1] ?? 0 },
      ];
    }
    return [
      { id: 0, x: 200, y: 115, name: "Desvío Central", dir: switches[0] ?? 0 },
      { id: 1, x: 125, y: 225, name: "Desvío Izquierdo", dir: switches[1] ?? 0 },
      { id: 2, x: 275, y: 225, name: "Desvío Derecho", dir: switches[2] ?? 0 },
    ];
  }, [dificultad, switches]);

  /* ── Alternar desvío ── */
  const toggleSwitch = (switchId: number) => {
    if (fase !== "jugando") return;
    setSwitches((prev) => {
      const nextDir: 0 | 1 = prev[switchId] === 0 ? 1 : 0;
      return { ...prev, [switchId]: nextDir };
    });
    // Sonido táctil de palanca mecánica
    getAudioEngine().chime(switchId === 0 ? 720 : switchId === 1 ? 840 : 640, 0.08);
  };

  /* ── Crear un nuevo tren ── */
  const spawnTrain = useCallback(() => {
    const availableColors = config.colors;
    const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)]!;
    const newTrain: TrainInstance = {
      id: `${Date.now()}-${Math.random()}`,
      color: randomColor,
      progress: 0,
      speed: config.speedBase,
    };
    setTrains((prev) => [...prev, newTrain]);
  }, [config]);

  /* ── Iniciar o Reiniciar Partida ── */
  const iniciarJuego = (nivel = dificultad) => {
    setDificultad(nivel);
    setPuntos(0);
    setRacha(0);
    setMejorRacha(0);
    setVidas(3);
    setAciertos(0);
    setFallos(0);
    setTrains([]);
    setNotifications([]);
    setSwitches({ 0: 0, 1: 0, 2: 0 });
    setFase("jugando");
    spawnTimerRef.current = Date.now() + 400;
    lastTimeRef.current = performance.now();
    getAudioEngine().chime(528, 0.3);
  };

  /* ── Manejo de llegada a estación ── */
  const handleTrainArrival = useCallback(
    (train: TrainInstance, stationColor?: TrainColorId) => {
      const coords = calculateTrainCoords(train, dificultad, switchesRef.current);
      const isCorrect = train.color === (stationColor || coords.currentStationColor);

      if (isCorrect) {
        // Acierto
        setAciertos((a) => a + 1);
        setRacha((r) => {
          const nuevaRacha = r + 1;
          setMejorRacha((m) => Math.max(m, nuevaRacha));
          return nuevaRacha;
        });
        const ptsGanados = 100 + racha * 15;
        setPuntos((p) => p + ptsGanados);

        // Feedback sonoro armónico ascendente
        getAudioEngine().chime(784, 0.15);
        window.setTimeout(() => getAudioEngine().chime(988, 0.2), 90);

        // Notificación flotante
        const notifId = Math.random().toString();
        setNotifications((prev) => [
          ...prev,
          { id: notifId, x: coords.x, y: coords.y - 20, text: `+${ptsGanados}`, type: "success" },
        ]);
        window.setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== notifId));
        }, 800);
      } else {
        // Fallo
        setFallos((f) => f + 1);
        setRacha(0);
        setVidas((v) => {
          const nuevasVidas = v - 1;
          if (nuevasVidas <= 0) {
            setFase("gameover");
            getAudioEngine().chime(196, 0.6);
            registrar("atencion_trenes", 2, {
              dificultad,
              puntuacion: puntos,
              aciertos: aciertos,
              fallos: fallos + 1,
              mejorRacha,
            });
          }
          return Math.max(0, nuevasVidas);
        });

        // Tono grave de error
        getAudioEngine().chime(220, 0.35);

        const notifId = Math.random().toString();
        setNotifications((prev) => [
          ...prev,
          { id: notifId, x: coords.x, y: coords.y - 20, text: "❌ Desvío erróneo", type: "error" },
        ]);
        window.setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== notifId));
        }, 900);
      }
    },
    [aciertos, fallos, dificultad, mejorRacha, puntos, racha, registrar],
  );

  /* ── Bucle principal del juego (60 FPS) ── */
  useEffect(() => {
    if (fase !== "jugando") {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      return;
    }

    let isRunning = true;

    const gameLoop = (time: number) => {
      if (!isRunning) return;

      if (!lastTimeRef.current) lastTimeRef.current = time;
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;

      // 1. Spawning periódico de trenes
      const now = Date.now();
      if (now >= spawnTimerRef.current) {
        spawnTrain();
        spawnTimerRef.current = now + config.spawnIntervalMs;
      }

      // 2. Actualizar posiciones de trenes
      setTrains((prevTrains) => {
        const remaining: TrainInstance[] = [];

        for (const train of prevTrains) {
          const nextProgress = train.progress + train.speed * dt;

          // Fijar decisiones de ruta en los cruces
          const currentSwitches = switchesRef.current;
          const updatedTrain = { ...train, progress: nextProgress };

          if (dificultad === "facil") {
            if (nextProgress >= 0.32 && !train.passedSwitch0) {
              updatedTrain.passedSwitch0 = true;
              updatedTrain.chosenRouteS0 = currentSwitches[0];
            }
          } else if (dificultad === "medio") {
            if (nextProgress >= 0.25 && !train.passedSwitch0) {
              updatedTrain.passedSwitch0 = true;
              updatedTrain.chosenRouteS0 = currentSwitches[0];
            }
            if (
              nextProgress >= 0.52 &&
              !train.passedSwitchMid &&
              updatedTrain.chosenRouteS0 === 0
            ) {
              updatedTrain.passedSwitchMid = true;
              updatedTrain.chosenRouteS1 = currentSwitches[1];
            }
          } else {
            // Dificil / Experto
            if (nextProgress >= 0.22 && !train.passedSwitch0) {
              updatedTrain.passedSwitch0 = true;
              updatedTrain.chosenRouteS0 = currentSwitches[0];
            }
            if (nextProgress >= 0.5 && !train.passedSwitchMid) {
              updatedTrain.passedSwitchMid = true;
              if (updatedTrain.chosenRouteS0 === 0) {
                updatedTrain.chosenRouteS1 = currentSwitches[1];
              } else {
                updatedTrain.chosenRouteS2 = currentSwitches[2];
              }
            }
          }

          // ¿Llegó al final de la vía?
          if (nextProgress >= 1) {
            handleTrainArrival(updatedTrain);
          } else {
            remaining.push(updatedTrain);
          }
        }

        return remaining;
      });

      reqRef.current = requestAnimationFrame(gameLoop);
    };

    reqRef.current = requestAnimationFrame(gameLoop);

    return () => {
      isRunning = false;
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [fase, config, spawnTrain, handleTrainArrival, dificultad]);

  return (
    <div className="flex flex-col items-center justify-between h-full w-full max-w-sm sm:max-w-md mx-auto py-1.5 touch-none select-none">
      {/* ── Marcador Superior ── */}
      <div className="w-full flex items-center justify-between px-2">
        <Marcador
          items={[
            ["Puntos", String(puntos)],
            ["Racha", `🔥 ${racha}`],
            ["Aciertos", `${aciertos}`],
          ]}
        />
        {/* Vidas / Corazones */}
        <div className="flex items-center gap-1 bg-secondary/80 px-3 py-1.5 rounded-full border border-border/60">
          {[1, 2, 3].map((heartIndex) => (
            <Heart
              key={heartIndex}
              className={cn(
                "h-4 w-4 transition-all duration-300",
                heartIndex <= vidas
                  ? "text-rose-500 fill-rose-500 scale-100"
                  : "text-muted-foreground/30 fill-transparent scale-90",
              )}
            />
          ))}
        </div>
      </div>

      {/* ── Selector de Dificultad Rápido (Tabs en píldora) ── */}
      <div className="flex items-center justify-center gap-1.5 my-1.5 bg-secondary/60 p-1 rounded-full border border-border/60 w-full max-w-[340px]">
        {(["facil", "medio", "dificil", "experto"] as DifficultyLevel[]).map((lvl) => (
          <button
            key={lvl}
            onClick={() => {
              if (fase === "jugando") {
                iniciarJuego(lvl);
              } else {
                setDificultad(lvl);
              }
            }}
            className={cn(
              "flex-1 text-xs py-1 rounded-full font-medium transition-all cursor-pointer capitalize",
              dificultad === lvl
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {lvl}
          </button>
        ))}
      </div>

      {/* ── Estado / Cuadro Flotante ── */}
      <div className="h-8 flex items-center justify-center my-0.5">
        {fase === "idle" && (
          <CuadroFlotanteTurno
            variante="info"
            texto="Planificación y Rutas"
            subtexto={config.description}
          />
        )}
        {fase === "jugando" && (
          <CuadroFlotanteTurno
            variante="turno"
            texto="🚦 Toca los desvíos para cambiar las vías"
            subtexto={`Modo ${config.name}`}
          />
        )}
        {fase === "gameover" && (
          <CuadroFlotanteTurno
            variante="error"
            texto="🛑 Fin de la partida"
            subtexto={`${puntos} puntos`}
          />
        )}
      </div>

      {/* ── Canvas / Circuito Ferroviario Vectorial (SVG) ── */}
      <div className="relative w-full max-w-[360px] aspect-[4/5] rounded-3xl border-2 border-border/80 bg-zinc-950/70 backdrop-blur-md shadow-2xl overflow-hidden my-auto flex items-center justify-center">
        {/* Glow de fondo ambiental */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/10 pointer-events-none" />

        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Filtro de brillo neón para las vías y trenes */}
            <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Patrón de durmientes de ferrocarril */}
            <pattern id="ties-pattern" width="10" height="10" patternUnits="userSpaceOnUse">
              <line
                x1="0"
                y1="5"
                x2="10"
                y2="5"
                stroke="#3f3f46"
                strokeWidth="1.5"
                strokeDasharray="3,3"
              />
            </pattern>
          </defs>

          {/* 1. Vías Principales de Fondo */}
          {dificultad === "facil" && (
            <g className="tracks-layer" strokeLinecap="round">
              {/* Vía Vertical Inicial */}
              <path d="M 200,20 L 200,160" stroke="#3f3f46" strokeWidth="8" fill="none" />
              <path
                d="M 200,20 L 200,160"
                stroke="#71717a"
                strokeWidth="2.5"
                strokeDasharray="5,4"
                fill="none"
              />

              {/* Vía Izquierda -> Rojo */}
              <path
                d="M 200,160 C 200,240 110,350 110,440"
                stroke={switches[0] === 0 ? "#ef4444" : "#3f3f46"}
                strokeWidth={switches[0] === 0 ? "7" : "5"}
                strokeOpacity={switches[0] === 0 ? "0.9" : "0.4"}
                fill="none"
                className="transition-all duration-300"
              />
              {/* Vía Derecha -> Azul */}
              <path
                d="M 200,160 C 200,240 290,350 290,440"
                stroke={switches[0] === 1 ? "#0ea5e9" : "#3f3f46"}
                strokeWidth={switches[0] === 1 ? "7" : "5"}
                strokeOpacity={switches[0] === 1 ? "0.9" : "0.4"}
                fill="none"
                className="transition-all duration-300"
              />
            </g>
          )}

          {dificultad === "medio" && (
            <g className="tracks-layer" strokeLinecap="round">
              {/* Origen a S0 */}
              <path d="M 200,20 L 200,130" stroke="#3f3f46" strokeWidth="8" fill="none" />
              <path
                d="M 200,20 L 200,130"
                stroke="#71717a"
                strokeWidth="2.5"
                strokeDasharray="5,4"
                fill="none"
              />

              {/* S0 Derecha directa a Verde */}
              <path
                d="M 200,130 C 200,210 320,350 320,440"
                stroke={switches[0] === 1 ? "#10b981" : "#3f3f46"}
                strokeWidth={switches[0] === 1 ? "7" : "5"}
                strokeOpacity={switches[0] === 1 ? "0.9" : "0.4"}
                fill="none"
                className="transition-all duration-300"
              />

              {/* S0 Izquierda hacia S1 */}
              <path
                d="M 200,130 C 200,170 130,200 130,240"
                stroke={switches[0] === 0 ? "#a1a1aa" : "#3f3f46"}
                strokeWidth={switches[0] === 0 ? "7" : "5"}
                strokeOpacity={switches[0] === 0 ? "0.9" : "0.4"}
                fill="none"
                className="transition-all duration-300"
              />

              {/* S1 Izquierda -> Rojo */}
              <path
                d="M 130,240 C 130,300 70,380 70,440"
                stroke={switches[0] === 0 && switches[1] === 0 ? "#ef4444" : "#3f3f46"}
                strokeWidth={switches[0] === 0 && switches[1] === 0 ? "7" : "5"}
                strokeOpacity={switches[0] === 0 && switches[1] === 0 ? "0.9" : "0.4"}
                fill="none"
                className="transition-all duration-300"
              />

              {/* S1 Derecha -> Azul */}
              <path
                d="M 130,240 C 130,300 190,380 190,440"
                stroke={switches[0] === 0 && switches[1] === 1 ? "#0ea5e9" : "#3f3f46"}
                strokeWidth={switches[0] === 0 && switches[1] === 1 ? "7" : "5"}
                strokeOpacity={switches[0] === 0 && switches[1] === 1 ? "0.9" : "0.4"}
                fill="none"
                className="transition-all duration-300"
              />
            </g>
          )}

          {(dificultad === "dificil" || dificultad === "experto") && (
            <g className="tracks-layer" strokeLinecap="round">
              {/* Origen a S0 */}
              <path d="M 200,20 L 200,115" stroke="#3f3f46" strokeWidth="8" fill="none" />
              <path
                d="M 200,20 L 200,115"
                stroke="#71717a"
                strokeWidth="2.5"
                strokeDasharray="5,4"
                fill="none"
              />

              {/* S0 Izquierda hacia S1 */}
              <path
                d="M 200,115 C 200,155 125,185 125,225"
                stroke={switches[0] === 0 ? "#a1a1aa" : "#3f3f46"}
                strokeWidth={switches[0] === 0 ? "7" : "5"}
                strokeOpacity={switches[0] === 0 ? "0.9" : "0.4"}
                fill="none"
                className="transition-all duration-300"
              />

              {/* S0 Derecha hacia S2 */}
              <path
                d="M 200,115 C 200,155 275,185 275,225"
                stroke={switches[0] === 1 ? "#a1a1aa" : "#3f3f46"}
                strokeWidth={switches[0] === 1 ? "7" : "5"}
                strokeOpacity={switches[0] === 1 ? "0.9" : "0.4"}
                fill="none"
                className="transition-all duration-300"
              />

              {/* S1 Izq -> Rojo */}
              <path
                d="M 125,225 C 125,285 55,380 55,440"
                stroke={switches[0] === 0 && switches[1] === 0 ? "#ef4444" : "#3f3f46"}
                strokeWidth={switches[0] === 0 && switches[1] === 0 ? "7" : "5"}
                strokeOpacity={switches[0] === 0 && switches[1] === 0 ? "0.9" : "0.4"}
                fill="none"
                className="transition-all duration-300"
              />

              {/* S1 Der -> Azul */}
              <path
                d="M 125,225 C 125,285 145,380 145,440"
                stroke={switches[0] === 0 && switches[1] === 1 ? "#0ea5e9" : "#3f3f46"}
                strokeWidth={switches[0] === 0 && switches[1] === 1 ? "7" : "5"}
                strokeOpacity={switches[0] === 0 && switches[1] === 1 ? "0.9" : "0.4"}
                fill="none"
                className="transition-all duration-300"
              />

              {/* S2 Izq -> Verde */}
              <path
                d="M 275,225 C 275,285 255,380 255,440"
                stroke={switches[0] === 1 && switches[2] === 0 ? "#10b981" : "#3f3f46"}
                strokeWidth={switches[0] === 1 && switches[2] === 0 ? "7" : "5"}
                strokeOpacity={switches[0] === 1 && switches[2] === 0 ? "0.9" : "0.4"}
                fill="none"
                className="transition-all duration-300"
              />

              {/* S2 Der -> Amarillo */}
              <path
                d="M 275,225 C 275,285 345,380 345,440"
                stroke={switches[0] === 1 && switches[2] === 1 ? "#f59e0b" : "#3f3f46"}
                strokeWidth={switches[0] === 1 && switches[2] === 1 ? "7" : "5"}
                strokeOpacity={switches[0] === 1 && switches[2] === 1 ? "0.9" : "0.4"}
                fill="none"
                className="transition-all duration-300"
              />
            </g>
          )}

          {/* 2. Estaciones Terminales en la Base */}
          {estaciones.map((est) => {
            const col = COLORES_TRENES[est.color];
            const IconComponent = col.icon;
            return (
              <g key={est.id} transform={`translate(${est.x - 22}, ${est.y - 20})`}>
                {/* Caja de la estación con resplandor */}
                <rect
                  x="0"
                  y="0"
                  width="44"
                  height="44"
                  rx="12"
                  fill="#18181b"
                  stroke={col.hex}
                  strokeWidth="2.5"
                  className="filter drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]"
                />
                {/* Halo de color */}
                <rect x="3" y="3" width="38" height="38" rx="9" fill={col.glow} opacity="0.25" />
                {/* Icono de la estación */}
                <foreignObject x="6" y="6" width="32" height="32">
                  <div className="w-full h-full flex items-center justify-center">
                    <IconComponent
                      className="h-6 w-6"
                      style={{ color: col.hex }}
                      strokeWidth={2.4}
                    />
                  </div>
                </foreignObject>
              </g>
            );
          })}

          {/* 3. Desvíos Interactivos (Nodos con botones táctiles y flechas) */}
          {listaDesvios.map((sw) => {
            const isLeft = sw.dir === 0;
            return (
              <g
                key={sw.id}
                transform={`translate(${sw.x}, ${sw.y})`}
                onClick={() => toggleSwitch(sw.id)}
                className="cursor-pointer group"
              >
                {/* Zona de pulsación ampliada */}
                <circle r="30" fill="transparent" />

                {/* Resplandor del botón del desvío */}
                <circle
                  r="18"
                  fill="#18181b"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  className="transition-transform duration-200 group-hover:scale-110 shadow-lg"
                  filter="url(#neon-glow)"
                />

                {/* Núcleo iluminado */}
                <circle r="12" fill="#1e293b" />

                {/* Flecha indicadora de dirección que rota según el estado */}
                <path
                  d="M -4,-5 L 4,0 L -4,5"
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform={`rotate(${isLeft ? -45 : 45})`}
                  className="transition-transform duration-200"
                />

                {/* Pulso de atención si el juego está activo */}
                {fase === "jugando" && (
                  <circle
                    r="22"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.5"
                    opacity="0.3"
                    className="animate-ping"
                  />
                )}
              </g>
            );
          })}

          {/* 4. Trenes en Marcha */}
          {trains.map((train) => {
            const col = COLORES_TRENES[train.color];
            const coords = calculateTrainCoords(train, dificultad, switchesRef.current);
            const IconComp = col.icon;

            return (
              <g
                key={train.id}
                transform={`translate(${coords.x}, ${coords.y}) rotate(${coords.angle + 90})`}
                className="transition-transform duration-75"
              >
                {/* Resplandor neón del tren */}
                <rect
                  x="-14"
                  y="-20"
                  width="28"
                  height="40"
                  rx="10"
                  fill={col.glow}
                  opacity="0.5"
                  filter="url(#neon-glow)"
                />

                {/* Cuerpo del Vagón / Tren */}
                <rect
                  x="-12"
                  y="-18"
                  width="24"
                  height="36"
                  rx="8"
                  fill="#09090b"
                  stroke={col.hex}
                  strokeWidth="2.5"
                />

                {/* Faro delantero del tren */}
                <circle
                  cx="0"
                  cy="-14"
                  r="3.5"
                  fill="#ffffff"
                  filter="drop-shadow(0 0 4px #ffffff)"
                />

                {/* Icono identificador en el vagón */}
                <foreignObject x="-9" y="-6" width="18" height="18">
                  <div className="w-full h-full flex items-center justify-center">
                    <IconComp className="h-4 w-4" style={{ color: col.hex }} strokeWidth={2.5} />
                  </div>
                </foreignObject>

                {/* Luces traseras */}
                <circle cx="-6" cy="14" r="2" fill="#ef4444" opacity="0.8" />
                <circle cx="6" cy="14" r="2" fill="#ef4444" opacity="0.8" />
              </g>
            );
          })}

          {/* 5. Notificaciones Flotantes de Puntos / Errores */}
          {notifications.map((n) => (
            <text
              key={n.id}
              x={n.x}
              y={n.y}
              textAnchor="middle"
              className={cn(
                "font-display text-sm font-bold animate-out fade-out slide-out-to-top duration-700 select-none",
                n.type === "success" ? "fill-emerald-400" : "fill-rose-400",
              )}
            >
              {n.text}
            </text>
          ))}
        </svg>

        {/* Overlay cuando no está jugando (Intro o Game Over) */}
        {fase !== "jugando" && (
          <div className="absolute inset-0 bg-background/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            {fase === "gameover" ? (
              <div className="space-y-4 max-w-xs">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-lg">
                  <Award className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold text-foreground">
                    ¡Juego Terminado!
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Condujiste los trenes con atención y agilidad espacial.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-secondary/70 p-3 rounded-2xl border border-border/80 text-left">
                  <div>
                    <p className="text-[0.65rem] uppercase text-muted-foreground font-semibold">
                      Puntos
                    </p>
                    <p className="font-display text-xl font-bold text-primary">{puntos}</p>
                  </div>
                  <div>
                    <p className="text-[0.65rem] uppercase text-muted-foreground font-semibold">
                      Aciertos
                    </p>
                    <p className="font-display text-xl font-bold text-emerald-400">{aciertos}</p>
                  </div>
                  <div>
                    <p className="text-[0.65rem] uppercase text-muted-foreground font-semibold">
                      Mejor Racha
                    </p>
                    <p className="font-display text-xl font-bold text-amber-400">🔥 {mejorRacha}</p>
                  </div>
                  <div>
                    <p className="text-[0.65rem] uppercase text-muted-foreground font-semibold">
                      Dificultad
                    </p>
                    <p className="font-display text-sm font-bold capitalize text-foreground">
                      {dificultad}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => iniciarJuego(dificultad)}
                  className="w-full rounded-full h-11 font-semibold text-sm shadow-lg"
                >
                  <RotateCcw className="h-4 w-4 mr-2" /> Jugar de nuevo
                </Button>
              </div>
            ) : (
              <div className="space-y-4 max-w-xs">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary border border-primary/30 shadow-lg">
                  <GitFork className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-foreground">Cruce de Vías</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Cambia las vías tocando los desvíos iluminados para llevar cada tren a la
                    estación de su mismo color.
                  </p>
                </div>

                <Button
                  onClick={() => iniciarJuego(dificultad)}
                  className="w-full rounded-full h-12 text-base font-semibold shadow-lg cursor-pointer"
                >
                  <Play className="h-5 w-5 mr-2 fill-current" /> Iniciar ({config.name})
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Barra de Botones Inferior ── */}
      <div className="w-full space-y-2 mt-1">
        {fase === "jugando" ? (
          <Button
            variant="secondary"
            className="w-full rounded-full h-10 shadow-md font-medium text-xs cursor-pointer"
            onClick={() => iniciarJuego(dificultad)}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reiniciar circuito ({config.name})
          </Button>
        ) : null}

        <p className="text-center text-[0.68rem] text-muted-foreground">
          Anticípate a los trenes y coordina los desvíos antes de que pasen por cada cruce.
        </p>
      </div>
    </div>
  );
}
