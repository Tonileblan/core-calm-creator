import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  Heart,
  RotateCcw,
  Play,
  Pause,
  Award,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getAudioEngine } from "@/lib/audio-engine";
import { cn } from "@/lib/utils";
import type { Registrar } from "./MindGames";

/* ─────────────────────────────────────────────────────────────
   DEFINICIÓN DE COLORES Y ESTACIONES (ESTILO LUMOSITY)
───────────────────────────────────────────────────────────── */

export type TrainColorId = "verde" | "azul" | "rosa" | "amarillo" | "negro";
export type DifficultyLevel = "facil" | "medio" | "dificil" | "experto";

export interface ColorDef {
  id: TrainColorId;
  nombre: string;
  fill: string;
  fillDark: string;
  accent: string;
}

export const COLORES_LUMOSITY: Record<TrainColorId, ColorDef> = {
  verde: {
    id: "verde",
    nombre: "Verde",
    fill: "#4ade80",
    fillDark: "#16a34a",
    accent: "#bbf7d0",
  },
  azul: {
    id: "azul",
    nombre: "Azul",
    fill: "#38bdf8",
    fillDark: "#0284c7",
    accent: "#bae6fd",
  },
  rosa: {
    id: "rosa",
    nombre: "Rosa",
    fill: "#f43f5e",
    fillDark: "#be123c",
    accent: "#fecdd3",
  },
  amarillo: {
    id: "amarillo",
    nombre: "Amarillo",
    fill: "#facc15",
    fillDark: "#ca8a04",
    accent: "#fef08a",
  },
  negro: {
    id: "negro",
    nombre: "Negro",
    fill: "#3f3f46",
    fillDark: "#18181b",
    accent: "#71717a",
  },
};

export interface TrainItem {
  id: string;
  color: TrainColorId;
  progress: number;
  speed: number;
  passedS0?: boolean;
  passedS1?: boolean;
  passedS2?: boolean;
  passedS3?: boolean;
  passedS4?: boolean;
  routeS0?: 0 | 1;
  routeS1?: 0 | 1;
  routeS2?: 0 | 1;
  routeS3?: 0 | 1;
  routeS4?: 0 | 1;
}

export interface FloatingScore {
  id: string;
  x: number;
  y: number;
  text: string;
  isSuccess: boolean;
}

/* ─────────────────────────────────────────────────────────────
   CONFIGURACIONES DE DIFICULTAD Y METAS FINITAS
───────────────────────────────────────────────────────────── */

interface DifficultyConfig {
  name: string;
  description: string;
  colors: TrainColorId[];
  speedBase: number;
  spawnIntervalMs: number;
  targetTrains: number; // Meta finita de trenes para completar el nivel
  nextLevel?: DifficultyLevel;
}

const DIFICULTADES: Record<DifficultyLevel, DifficultyConfig> = {
  facil: {
    name: "Nivel 1 · Fácil",
    description: "2 estaciones · Guía 6 trenes a su estación",
    colors: ["verde", "azul"],
    speedBase: 0.14,
    spawnIntervalMs: 4600,
    targetTrains: 6,
    nextLevel: "medio",
  },
  medio: {
    name: "Nivel 2 · Medio",
    description: "3 estaciones · Guía 8 trenes a mayor ritmo",
    colors: ["verde", "azul", "rosa"],
    speedBase: 0.17,
    spawnIntervalMs: 3900,
    targetTrains: 8,
    nextLevel: "dificil",
  },
  dificil: {
    name: "Nivel 3 · Difícil",
    description: "4 estaciones · Guía 10 trenes en red de 4 vías",
    colors: ["verde", "azul", "rosa", "amarillo"],
    speedBase: 0.2,
    spawnIntervalMs: 3300,
    targetTrains: 10,
    nextLevel: "experto",
  },
  experto: {
    name: "Nivel 4 · Experto",
    description: "5 estaciones · Guía 12 trenes en la red maestra",
    colors: ["verde", "azul", "rosa", "amarillo", "negro"],
    speedBase: 0.24,
    spawnIntervalMs: 2700,
    targetTrains: 12,
  },
};

const VIEW_W = 400;
const VIEW_H = 540;

function bezier(p0: number, p1: number, p2: number, p3: number, t: number) {
  const cX = 3 * (p1 - p0);
  const bX = 3 * (p2 - p1) - cX;
  const aX = p3 - p0 - cX - bX;
  return aX * t * t * t + bX * t * t + cX * t + p0;
}

function getPointOnCurve(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  t: number,
) {
  const x = bezier(x0, x1, x2, x3, t);
  const y = bezier(y0, y1, y2, y3, t);
  const tNext = Math.min(1, t + 0.01);
  const nx = bezier(x0, x1, x2, x3, tNext);
  const ny = bezier(y0, y1, y2, y3, tNext);
  const angle = (Math.atan2(ny - y, nx - x) * 180) / Math.PI;
  return { x, y, angle };
}

/* ─────────────────────────────────────────────────────────────
   CÁLCULO EXACTO DE TRAYECTORIA
───────────────────────────────────────────────────────────── */

function calculateTrainPosition(
  train: TrainItem,
  level: DifficultyLevel,
  switches: Record<number, 0 | 1>,
): { x: number; y: number; angle: number; destColor?: TrainColorId } {
  const p = Math.min(1, Math.max(0, train.progress));

  // 1. MODO FÁCIL
  if (level === "facil") {
    const pS1 = 0.45;
    if (p <= pS1) {
      const t = p / pS1;
      return getPointOnCurve(250, 480, 250, 380, 250, 280, 250, 200, t);
    }

    const pS3 = 0.75;
    if (p <= pS3) {
      const t = (p - pS1) / (pS3 - pS1);
      return getPointOnCurve(250, 200, 250, 140, 210, 95, 165, 95, t);
    }

    const r3 = train.routeS3 ?? switches[3] ?? 0;
    const t = (p - pS3) / (1 - pS3);

    if (r3 === 0) {
      const pt = getPointOnCurve(165, 95, 135, 95, 115, 65, 95, 65, t);
      return { ...pt, destColor: "verde" };
    } else {
      const pt = getPointOnCurve(165, 95, 135, 95, 115, 150, 95, 150, t);
      return { ...pt, destColor: "azul" };
    }
  }

  // 2. MODO MEDIO
  if (level === "medio") {
    const pS0 = 0.28;
    if (p <= pS0) {
      const t = p / pS0;
      return getPointOnCurve(250, 480, 250, 420, 250, 360, 250, 310, t);
    }

    const pS1 = 0.52;
    if (p <= pS1) {
      const t = (p - pS0) / (pS1 - pS0);
      return getPointOnCurve(250, 310, 250, 270, 250, 240, 250, 200, t);
    }

    const r1 = train.routeS1 ?? switches[1] ?? 0;

    if (r1 === 1) {
      const t = (p - pS1) / (1 - pS1);
      const pt = getPointOnCurve(250, 200, 250, 220, 200, 220, 165, 220, t);
      return { ...pt, destColor: "rosa" };
    }

    const pS3 = 0.78;
    if (p <= pS3) {
      const t = (p - pS1) / (pS3 - pS1);
      return getPointOnCurve(250, 200, 250, 140, 210, 95, 165, 95, t);
    }

    const r3 = train.routeS3 ?? switches[3] ?? 0;
    const t = (p - pS3) / (1 - pS3);

    if (r3 === 0) {
      const pt = getPointOnCurve(165, 95, 135, 95, 115, 65, 95, 65, t);
      return { ...pt, destColor: "verde" };
    } else {
      const pt = getPointOnCurve(165, 95, 135, 95, 115, 150, 95, 150, t);
      return { ...pt, destColor: "azul" };
    }
  }

  // 3. MODO DIFÍCIL & EXPERTO
  const pS0 = 0.28;
  if (p <= pS0) {
    const t = p / pS0;
    return getPointOnCurve(250, 480, 250, 420, 250, 360, 250, 310, t);
  }

  const r0 = train.routeS0 ?? switches[0] ?? 0;

  if (r0 === 1) {
    const t = (p - pS0) / (1 - pS0);
    const pt = getPointOnCurve(250, 310, 250, 290, 290, 280, 290, 240, t);
    return { ...pt, destColor: "amarillo" };
  }

  const pS1 = 0.5;
  if (p <= pS1) {
    const t = (p - pS0) / (pS1 - pS0);
    return getPointOnCurve(250, 310, 250, 270, 250, 240, 250, 200, t);
  }

  const r1 = train.routeS1 ?? switches[1] ?? 0;

  if (r1 === 1) {
    const pRosa = 0.76;
    if (p <= pRosa) {
      const t = (p - pS1) / (pRosa - pS1);
      return getPointOnCurve(250, 200, 250, 220, 200, 220, 165, 220, t);
    }

    if (level === "experto") {
      const r4 = train.routeS4 ?? switches[4] ?? 0;
      if (r4 === 1) {
        const t = (p - pRosa) / (1 - pRosa);
        const pt = getPointOnCurve(165, 220, 165, 300, 95, 340, 95, 410, t);
        return { ...pt, destColor: "negro" };
      }
    }

    const pt = { x: 165, y: 220, angle: 180 };
    return { ...pt, destColor: "rosa" };
  }

  const pS2 = 0.68;
  if (p <= pS2) {
    const t = (p - pS1) / (pS2 - pS1);
    return getPointOnCurve(250, 200, 250, 160, 250, 130, 250, 95, t);
  }

  const pS3 = 0.82;
  if (p <= pS3) {
    const t = (p - pS2) / (pS3 - pS2);
    return getPointOnCurve(250, 95, 230, 95, 190, 95, 165, 95, t);
  }

  const r3 = train.routeS3 ?? switches[3] ?? 0;
  const t = (p - pS3) / (1 - pS3);

  if (r3 === 0) {
    const pt = getPointOnCurve(165, 95, 135, 95, 115, 65, 95, 65, t);
    return { ...pt, destColor: "verde" };
  } else {
    const pt = getPointOnCurve(165, 95, 135, 95, 115, 150, 95, 150, t);
    return { ...pt, destColor: "azul" };
  }
}

/* ─────────────────────────────────────────────────────────────
   COMPONENTES GRÁFICOS SVG DE CASAS / ESTACIONES STICKER
───────────────────────────────────────────────────────────── */

function CasaSticker({
  x,
  y,
  colorId,
  label,
}: {
  x: number;
  y: number;
  colorId: TrainColorId;
  label: string;
}) {
  const col = COLORES_LUMOSITY[colorId];

  return (
    <g transform={`translate(${x - 22}, ${y - 24})`} className="select-none pointer-events-none">
      <rect
        x="2"
        y="4"
        width="44"
        height="48"
        rx="10"
        fill="#000000"
        opacity="0.3"
        filter="blur(3px)"
      />
      <rect
        x="0"
        y="0"
        width="44"
        height="48"
        rx="10"
        fill="#ffffff"
        stroke="#ffffff"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <rect
        x="3"
        y="12"
        width="38"
        height="33"
        rx="6"
        fill={col.fill}
        stroke={col.fillDark}
        strokeWidth="1.5"
      />
      <polygon points="3,14 22,2 41,14" fill={col.fillDark} stroke="#ffffff" strokeWidth="1" />
      <rect x="31" y="2" width="6" height="8" fill={col.fillDark} rx="1" />
      <polygon points="34,2 38,0 34,-2" fill={col.accent} />
      <rect x="16" y="22" width="12" height="18" rx="3" fill="#ffffff" opacity="0.9" />
      <rect x="18" y="25" width="8" height="14" rx="2" fill={col.fillDark} opacity="0.85" />
      <line x1="22" y1="25" x2="22" y2="39" stroke="#ffffff" strokeWidth="1" />
      <circle cx="22" cy="10" r="3" fill="#ffffff" />
      <circle cx="22" cy="10" r="2" fill={col.fillDark} />
      <text
        x="22"
        y="42"
        textAnchor="middle"
        fontSize="7"
        fontWeight="bold"
        fill="#ffffff"
        className="tracking-wider uppercase"
      >
        {label}
      </text>
    </g>
  );
}

function TrenVapor({
  x,
  y,
  angle,
  colorId,
}: {
  x: number;
  y: number;
  angle: number;
  colorId: TrainColorId;
}) {
  const col = COLORES_LUMOSITY[colorId];

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${angle + 90})`}
      className="select-none pointer-events-none"
    >
      <rect
        x="-11"
        y="-17"
        width="22"
        height="34"
        rx="7"
        fill="#000000"
        opacity="0.35"
        filter="blur(2px)"
      />
      <rect
        x="-12"
        y="-18"
        width="24"
        height="36"
        rx="8"
        fill="#ffffff"
        stroke="#ffffff"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <rect
        x="-10"
        y="-16"
        width="20"
        height="32"
        rx="6"
        fill={col.fill}
        stroke={col.fillDark}
        strokeWidth="1.5"
      />
      <rect x="-9" y="2" width="18" height="12" rx="3" fill={col.fillDark} />
      <rect x="-6" y="5" width="12" height="6" rx="2" fill="#ffffff" />
      <circle cx="0" cy="-10" r="3.5" fill={col.fillDark} />
      <circle cx="0" cy="-10" r="2" fill="#ffffff" />
      <polygon points="-4,-16 0,-19 4,-16" fill="#ffffff" />
      <circle cx="0" cy="-16" r="2.5" fill="#fef08a" />
      <circle cx="0" cy="18" r="3.5" fill="#ffffff" opacity="0.8" />
      <circle cx="3" cy="22" r="2.5" fill="#ffffff" opacity="0.5" />
    </g>
  );
}

function SwitchTurntable({
  x,
  y,
  state,
  path0,
  path1,
  onClick,
}: {
  x: number;
  y: number;
  state: 0 | 1;
  path0: string;
  path1: string;
  onClick: () => void;
}) {
  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      className="cursor-pointer group select-none"
    >
      <circle r="36" fill="transparent" />
      <circle cx="0" cy="3" r="22" fill="#1a351f" opacity="0.6" />
      <circle r="22" fill="#3c7940" stroke="#27532a" strokeWidth="2.5" />
      <circle
        r="19"
        fill="#529e55"
        stroke="#79c97d"
        strokeWidth="1.2"
        className="transition-transform duration-200 group-hover:scale-105"
      />
      <path
        d={state === 0 ? path1 : path0}
        fill="none"
        stroke="#27532a"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d={state === 0 ? path0 : path1}
        fill="none"
        stroke="#1a261c"
        strokeWidth="8"
        strokeLinecap="round"
        className="transition-all duration-250 ease-out"
      />
      <path
        d={state === 0 ? path0 : path1}
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        className="transition-all duration-250 ease-out drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]"
      />
      <circle cx="0" cy="0" r="3.5" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
      <circle
        r="23"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.5"
        opacity="0"
        className="transition-opacity duration-200 group-hover:opacity-40"
      />
    </g>
  );
}

/* ─────────────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL CON NIVELES FINITOS Y CIRCUITO
───────────────────────────────────────────────────────────── */

export function TrainSwitchGame({
  registrar,
  dificultadInicial = "facil",
  onGameComplete,
}: {
  registrar: Registrar;
  dificultadInicial?: DifficultyLevel;
  onGameComplete?: (stats: { puntos: number; aciertos: number; tiempoSegundos: number }) => void;
}) {
  const [dificultad, setDificultad] = useState<DifficultyLevel>(dificultadInicial);
  const [fase, setFase] = useState<
    "idle" | "jugando" | "pausado" | "nivel_completado" | "victoria_total" | "gameover"
  >("idle");

  const [puntos, setPuntos] = useState(0);
  const [racha, setRacha] = useState(0);
  const [mejorRacha, setMejorRacha] = useState(0);
  const [aciertosNivel, setAciertosNivel] = useState(0);
  const [totalAciertos, setTotalAciertos] = useState(0);
  const [fallos, setFallos] = useState(0);
  const [vidas, setVidas] = useState(3);
  const [segundos, setSegundos] = useState(0);

  // Control de trenes generados en el nivel actual
  const [trenesGenerados, setTrenesGenerados] = useState(0);

  const [switches, setSwitches] = useState<Record<number, 0 | 1>>({
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  });

  const [trains, setTrains] = useState<TrainItem[]>([]);
  const [floatingScores, setFloatingScores] = useState<FloatingScore[]>([]);

  const switchesRef = useRef(switches);
  switchesRef.current = switches;

  const reqRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);

  const config = DIFICULTADES[dificultad];

  /* ── Cronómetro de partida ── */
  useEffect(() => {
    if (fase !== "jugando") return;
    const interval = window.setInterval(() => {
      setSegundos((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [fase]);

  /* ── Alternar desvío circular con clic ── */
  const toggleSwitch = (id: number) => {
    if (fase !== "jugando") return;
    setSwitches((prev) => ({
      ...prev,
      [id]: prev[id] === 0 ? 1 : 0,
    }));
    getAudioEngine().chime(id === 0 ? 680 : id === 1 ? 780 : id === 2 ? 880 : 940, 0.08);
  };

  /* ── Spawning controlado de trenes (Hasta la meta del nivel) ── */
  const spawnTrain = useCallback(() => {
    if (trenesGenerados >= config.targetTrains) return;

    const availableColors = config.colors;
    const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)]!;
    const newTrain: TrainItem = {
      id: `${Date.now()}-${Math.random()}`,
      color: randomColor,
      progress: 0,
      speed: config.speedBase,
    };
    setTrains((prev) => [...prev, newTrain]);
    setTrenesGenerados((g) => g + 1);
  }, [config, trenesGenerados]);

  /* ── Iniciar Nivel o Partida ── */
  const iniciarNivel = (nivel = dificultad) => {
    setDificultad(nivel);
    setAciertosNivel(0);
    setTrenesGenerados(0);
    setTrains([]);
    setFloatingScores([]);
    setSwitches({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 });
    setFase("jugando");
    spawnTimerRef.current = Date.now() + 600;
    lastTimeRef.current = performance.now();
    getAudioEngine().chime(587, 0.25);
  };

  const reiniciarCompleto = () => {
    setPuntos(0);
    setRacha(0);
    setMejorRacha(0);
    setTotalAciertos(0);
    setFallos(0);
    setVidas(3);
    setSegundos(0);
    iniciarNivel(dificultadInicial);
  };

  /* ── Manejo de llegada a la casita correspondiente ── */
  const handleArrival = useCallback(
    (train: TrainItem) => {
      const pos = calculateTrainPosition(train, dificultad, switchesRef.current);
      const isSuccess = train.color === pos.destColor;

      if (isSuccess) {
        setAciertosNivel((a) => a + 1);
        setTotalAciertos((t) => t + 1);
        setRacha((r) => {
          const nr = r + 1;
          setMejorRacha((m) => Math.max(m, nr));
          return nr;
        });
        const pts = 100 + racha * 25;
        setPuntos((p) => p + pts);

        getAudioEngine().chime(784, 0.12);
        window.setTimeout(() => getAudioEngine().chime(1046, 0.2), 80);

        const scoreId = Math.random().toString();
        setFloatingScores((prev) => [
          ...prev,
          { id: scoreId, x: pos.x, y: pos.y - 15, text: `+${pts}`, isSuccess: true },
        ]);
        window.setTimeout(() => {
          setFloatingScores((prev) => prev.filter((s) => s.id !== scoreId));
        }, 750);
      } else {
        setFallos((f) => f + 1);
        setRacha(0);
        setVidas((v) => {
          const nv = v - 1;
          if (nv <= 0) {
            setFase("gameover");
            getAudioEngine().chime(200, 0.5);
            registrar("atencion_trenes", Math.max(1, Math.round(segundos / 60)), {
              dificultad,
              puntos,
              aciertos: totalAciertos,
              fallos: fallos + 1,
              mejorRacha,
            });
          }
          return Math.max(0, nv);
        });

        getAudioEngine().chime(220, 0.3);

        const scoreId = Math.random().toString();
        setFloatingScores((prev) => [
          ...prev,
          { id: scoreId, x: pos.x, y: pos.y - 15, text: "❌ Error", isSuccess: false },
        ]);
        window.setTimeout(() => {
          setFloatingScores((prev) => prev.filter((s) => s.id !== scoreId));
        }, 800);
      }
    },
    [dificultad, fallos, mejorRacha, puntos, racha, registrar, segundos, totalAciertos],
  );

  /* ── Comprobación de fin de nivel (cuando todos los trenes terminan) ── */
  useEffect(() => {
    if (fase === "jugando" && trenesGenerados >= config.targetTrains && trains.length === 0) {
      // Nivel completado
      const bonusNivel = 300 + vidas * 100;
      setPuntos((p) => p + bonusNivel);
      getAudioEngine().chime(880, 0.3);
      window.setTimeout(() => getAudioEngine().chime(1175, 0.4), 150);

      if (config.nextLevel) {
        setFase("nivel_completado");
      } else {
        setFase("victoria_total");
        registrar("atencion_trenes", Math.max(1, Math.round(segundos / 60)), {
          dificultad: "victoria_completa",
          puntos: puntos + bonusNivel,
          aciertos: totalAciertos,
          fallos,
          mejorRacha,
        });
        if (onGameComplete) {
          onGameComplete({
            puntos: puntos + bonusNivel,
            aciertos: totalAciertos,
            tiempoSegundos: segundos,
          });
        }
      }
    }
  }, [
    fase,
    trenesGenerados,
    config,
    trains.length,
    vidas,
    puntos,
    totalAciertos,
    fallos,
    mejorRacha,
    segundos,
    registrar,
    onGameComplete,
  ]);

  /* ── Bucle de Animación a 60 FPS ── */
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

      // Spawning periódico si no se ha alcanzado la meta
      const now = Date.now();
      if (now >= spawnTimerRef.current && trenesGenerados < config.targetTrains) {
        spawnTrain();
        spawnTimerRef.current = now + config.spawnIntervalMs;
      }

      // Actualización de trenes
      setTrains((prev) => {
        const remaining: TrainItem[] = [];
        const currentSw = switchesRef.current;

        for (const tr of prev) {
          const nextP = tr.progress + tr.speed * dt;
          const updated = { ...tr, progress: nextP };

          if (dificultad === "facil") {
            if (nextP >= 0.45 && !tr.passedS1) {
              updated.passedS1 = true;
              updated.routeS1 = currentSw[1];
            }
            if (nextP >= 0.75 && !tr.passedS3) {
              updated.passedS3 = true;
              updated.routeS3 = currentSw[3];
            }
          } else if (dificultad === "medio") {
            if (nextP >= 0.28 && !tr.passedS0) {
              updated.passedS0 = true;
              updated.routeS0 = currentSw[0];
            }
            if (nextP >= 0.52 && !tr.passedS1) {
              updated.passedS1 = true;
              updated.routeS1 = currentSw[1];
            }
            if (nextP >= 0.78 && !tr.passedS3 && updated.routeS1 === 0) {
              updated.passedS3 = true;
              updated.routeS3 = currentSw[3];
            }
          } else {
            if (nextP >= 0.28 && !tr.passedS0) {
              updated.passedS0 = true;
              updated.routeS0 = currentSw[0];
            }
            if (nextP >= 0.5 && !tr.passedS1 && updated.routeS0 === 0) {
              updated.passedS1 = true;
              updated.routeS1 = currentSw[1];
            }
            if (nextP >= 0.68 && !tr.passedS2 && updated.routeS1 === 0) {
              updated.passedS2 = true;
              updated.routeS2 = currentSw[2];
            }
            if (nextP >= 0.82 && !tr.passedS3 && updated.routeS1 === 0) {
              updated.passedS3 = true;
              updated.routeS3 = currentSw[3];
            }
            if (nextP >= 0.76 && !tr.passedS4 && updated.routeS1 === 1) {
              updated.passedS4 = true;
              updated.routeS4 = currentSw[4];
            }
          }

          if (nextP >= 1) {
            handleArrival(updated);
          } else {
            remaining.push(updated);
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
  }, [fase, config, spawnTrain, handleArrival, dificultad, trenesGenerados]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="flex flex-col items-center justify-between h-full w-full max-w-sm sm:max-w-md mx-auto py-1 touch-none select-none">
      {/* ── HUD SUPERIOR ESTILO LUMOSITY CON META FINITA ── */}
      <div className="w-full space-y-1">
        <div className="w-full flex items-center justify-between px-3 py-1.5 bg-zinc-900/90 rounded-2xl border border-border/80 shadow-md">
          <button
            onClick={() =>
              setFase((f) => (f === "jugando" ? "pausado" : f === "pausado" ? "jugando" : f))
            }
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            {fase === "pausado" ? (
              <Play className="h-4 w-4 fill-current" />
            ) : (
              <Pause className="h-4 w-4 fill-current" />
            )}
          </button>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="text-center">
              <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground block font-sans">
                Nivel
              </span>
              <span className="font-bold text-foreground capitalize">{dificultad}</span>
            </div>

            <div className="h-5 w-px bg-border/60" />

            <div className="text-center">
              <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground block font-sans">
                Meta Trenes
              </span>
              <span className="font-bold text-emerald-400">
                {aciertosNivel} / {config.targetTrains}
              </span>
            </div>

            <div className="h-5 w-px bg-border/60" />

            <div className="text-center">
              <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground block font-sans">
                Puntos
              </span>
              <span className="font-bold text-amber-400">{puntos}</span>
            </div>
          </div>

          {/* Vidas */}
          <div className="flex items-center gap-0.5">
            {[1, 2, 3].map((heartIndex) => (
              <Heart
                key={heartIndex}
                className={cn(
                  "h-4 w-4 transition-transform",
                  heartIndex <= vidas
                    ? "text-rose-500 fill-rose-500"
                    : "text-zinc-600 fill-zinc-800 opacity-40",
                )}
              />
            ))}
          </div>
        </div>

        {/* Barra de progreso de la meta del nivel */}
        <Progress
          value={(aciertosNivel / config.targetTrains) * 100}
          className="h-1.5 bg-zinc-800"
        />
      </div>

      {/* ── SELECTOR DE NIVEL RÁPIDO ── */}
      <div className="flex items-center justify-center gap-1 my-1 bg-zinc-900/60 p-1 rounded-full border border-border/50 w-full max-w-[340px]">
        {(["facil", "medio", "dificil", "experto"] as DifficultyLevel[]).map((lvl) => (
          <button
            key={lvl}
            onClick={() => {
              setDificultad(lvl);
              iniciarNivel(lvl);
            }}
            className={cn(
              "flex-1 text-[0.7rem] py-1 rounded-full font-medium transition-all cursor-pointer capitalize",
              dificultad === lvl
                ? "bg-emerald-600 text-white shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {lvl}
          </button>
        ))}
      </div>

      {/* ── ESCENARIO SVG CON VÍAS Y PLATAFORMAS GIRATORIAS ── */}
      <div className="relative w-full max-w-[360px] aspect-[4/5.4] rounded-3xl border-2 border-border/90 bg-[#264e2d] shadow-2xl overflow-hidden my-auto flex items-center justify-center">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <radialGradient id="forest-ground" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#32633a" />
              <stop offset="60%" stopColor="#28522f" />
              <stop offset="100%" stopColor="#1e3e23" />
            </radialGradient>
          </defs>

          <rect width={VIEW_W} height={VIEW_H} fill="url(#forest-ground)" />

          {/* Pinos decorativos */}
          <g opacity="0.35" fill="#18361c">
            <polygon points="50,110 58,130 42,130" />
            <polygon points="40,240 48,260 32,260" />
            <polygon points="340,90 348,110 332,110" />
            <polygon points="350,190 358,210 342,210" />
            <polygon points="310,340 318,360 302,360" />
            <polygon points="180,450 188,470 172,470" />
            <polygon points="60,350 68,370 52,370" />
          </g>

          {/* Vías de tren fijas */}
          <g className="rails-group" fill="none" strokeLinecap="round">
            {dificultad === "facil" && (
              <>
                <path d="M 250,480 L 250,220" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,480 L 250,220"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
                <path d="M 250,180 C 250,140 210,95 185,95" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,180 C 250,140 210,95 185,95"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
                <path d="M 145,85 C 130,80 115,65 95,65" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 145,85 C 130,80 115,65 95,65"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
                <path d="M 145,110 C 130,125 115,150 95,150" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 145,110 C 130,125 115,150 95,150"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
              </>
            )}

            {dificultad === "medio" && (
              <>
                <path d="M 250,480 L 250,330" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,480 L 250,330"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
                <path d="M 250,290 L 250,220" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,290 L 250,220"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
                <path d="M 230,205 C 205,215 185,220 165,220" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 230,205 C 205,215 185,220 165,220"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
                <path d="M 250,180 C 250,140 210,95 185,95" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,180 C 250,140 210,95 185,95"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
                <path d="M 145,85 C 130,80 115,65 95,65" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 145,85 C 130,80 115,65 95,65"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
                <path d="M 145,110 C 130,125 115,150 95,150" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 145,110 C 130,125 115,150 95,150"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
              </>
            )}

            {(dificultad === "dificil" || dificultad === "experto") && (
              <>
                <path d="M 250,480 L 250,330" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,480 L 250,330"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
                <path d="M 270,305 C 280,300 290,280 290,240" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 270,305 C 280,300 290,280 290,240"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
                <path d="M 250,290 L 250,220" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,290 L 250,220"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
                <path d="M 230,205 C 205,215 185,220 165,220" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 230,205 C 205,215 185,220 165,220"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
                <path d="M 250,180 L 250,115" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,180 L 250,115"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
                <path d="M 230,95 L 185,95" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 230,95 L 185,95"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
                <path d="M 145,85 C 130,80 115,65 95,65" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 145,85 C 130,80 115,65 95,65"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
                <path d="M 145,110 C 130,125 115,150 95,150" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 145,110 C 130,125 115,150 95,150"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
                {dificultad === "experto" && (
                  <>
                    <path d="M 145,305 C 125,320 95,350 95,410" stroke="#1a2b1c" strokeWidth="9" />
                    <path
                      d="M 145,305 C 125,320 95,350 95,410"
                      stroke="#d4d4d8"
                      strokeWidth="1.8"
                      strokeDasharray="4,4"
                    />
                  </>
                )}
              </>
            )}
          </g>

          {/* Desvíos giratorios */}
          {dificultad === "facil" && (
            <>
              <SwitchTurntable
                x={250}
                y={200}
                state={switches[1] ?? 0}
                path0="M 0,20 C 0,5 -5,-10 -20,-20"
                path1="M 0,20 C 0,5 -5,-10 -20,-20"
                onClick={() => toggleSwitch(1)}
              />
              <SwitchTurntable
                x={165}
                y={95}
                state={switches[3] ?? 0}
                path0="M 20,0 C 5,0 -5,-5 -20,-10"
                path1="M 20,0 C 5,0 -5,10 -20,15"
                onClick={() => toggleSwitch(3)}
              />
            </>
          )}

          {dificultad === "medio" && (
            <>
              <SwitchTurntable
                x={250}
                y={310}
                state={switches[0] ?? 0}
                path0="M 0,20 L 0,-20"
                path1="M 0,20 L 0,-20"
                onClick={() => toggleSwitch(0)}
              />
              <SwitchTurntable
                x={250}
                y={200}
                state={switches[1] ?? 0}
                path0="M 0,20 L 0,-20"
                path1="M 0,20 C 0,5 -8,5 -20,5"
                onClick={() => toggleSwitch(1)}
              />
              <SwitchTurntable
                x={165}
                y={95}
                state={switches[3] ?? 0}
                path0="M 20,0 C 5,0 -5,-5 -20,-10"
                path1="M 20,0 C 5,0 -5,10 -20,15"
                onClick={() => toggleSwitch(3)}
              />
            </>
          )}

          {(dificultad === "dificil" || dificultad === "experto") && (
            <>
              <SwitchTurntable
                x={250}
                y={310}
                state={switches[0] ?? 0}
                path0="M 0,20 L 0,-20"
                path1="M 0,20 C 0,5 8,-2 20,-5"
                onClick={() => toggleSwitch(0)}
              />
              <SwitchTurntable
                x={250}
                y={200}
                state={switches[1] ?? 0}
                path0="M 0,20 L 0,-20"
                path1="M 0,20 C 0,5 -8,5 -20,5"
                onClick={() => toggleSwitch(1)}
              />
              <SwitchTurntable
                x={250}
                y={95}
                state={switches[2] ?? 0}
                path0="M 0,20 C 0,5 -5,0 -20,0"
                path1="M 0,20 L 0,-20"
                onClick={() => toggleSwitch(2)}
              />
              <SwitchTurntable
                x={165}
                y={95}
                state={switches[3] ?? 0}
                path0="M 20,0 C 5,0 -5,-5 -20,-10"
                path1="M 20,0 C 5,0 -5,10 -20,15"
                onClick={() => toggleSwitch(3)}
              />
              {dificultad === "experto" && (
                <SwitchTurntable
                  x={165}
                  y={290}
                  state={switches[4] ?? 0}
                  path0="M 0,-20 L 0,0"
                  path1="M 0,-20 C 0,0 -10,10 -20,15"
                  onClick={() => toggleSwitch(4)}
                />
              )}
            </>
          )}

          {/* Casitas / Estaciones */}
          <CasaSticker x={95} y={65} colorId="verde" label="Verde" />
          <CasaSticker x={95} y={150} colorId="azul" label="Azul" />
          {dificultad !== "facil" && <CasaSticker x={165} y={220} colorId="rosa" label="Rosa" />}
          {(dificultad === "dificil" || dificultad === "experto") && (
            <CasaSticker x={290} y={240} colorId="amarillo" label="Amarillo" />
          )}
          {dificultad === "experto" && <CasaSticker x={95} y={410} colorId="negro" label="Negro" />}

          {/* Montañas y Túnel */}
          <g className="mountains-origin select-none pointer-events-none">
            <polygon points="210,540 250,440 290,540" fill="#2d5935" />
            <polygon points="250,440 290,540 270,540" fill="#224729" />
            <polygon points="260,540 310,410 360,540" fill="#3f7547" />
            <polygon points="310,410 360,540 335,540" fill="#2c5733" />
            <polygon points="310,410 325,445 295,445" fill="#86efac" opacity="0.85" />
            <polygon points="310,540 355,430 400,540" fill="#4d8856" />
            <polygon points="355,430 400,540 380,540" fill="#336139" />
            <polygon points="355,430 370,460 340,460" fill="#bbf7d0" opacity="0.8" />
            <rect
              x="238"
              y="470"
              width="24"
              height="26"
              rx="10"
              fill="#18181b"
              stroke="#3f3f46"
              strokeWidth="2"
            />
          </g>

          {/* Trenes en movimiento */}
          {trains.map((train) => {
            const pos = calculateTrainPosition(train, dificultad, switchesRef.current);
            return (
              <TrenVapor
                key={train.id}
                x={pos.x}
                y={pos.y}
                angle={pos.angle}
                colorId={train.color}
              />
            );
          })}

          {/* Notificaciones flotantes */}
          {floatingScores.map((score) => (
            <text
              key={score.id}
              x={score.x}
              y={score.y}
              textAnchor="middle"
              className={cn(
                "font-display text-sm font-bold animate-out fade-out slide-out-to-top duration-700 select-none pointer-events-none",
                score.isSuccess
                  ? "fill-emerald-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                  : "fill-rose-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]",
              )}
            >
              {score.text}
            </text>
          ))}
        </svg>

        {/* ── MODALES DE SUBIDA DE NIVEL, VICTORIA O GAMEOVER ── */}
        {fase !== "jugando" && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-200 z-20">
            {fase === "nivel_completado" ? (
              <div className="space-y-4 max-w-xs">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg">
                  <Sparkles className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold text-foreground">
                    ¡Nivel Superado!
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Guiaste todos los {config.targetTrains} trenes del nivel con éxito.
                  </p>
                </div>

                <div className="bg-secondary/70 p-3.5 rounded-2xl border border-border/80 text-center space-y-1">
                  <p className="text-[0.65rem] uppercase text-muted-foreground font-semibold">
                    Puntos Acumulados
                  </p>
                  <p className="font-display text-2xl font-bold text-primary">{puntos}</p>
                </div>

                <Button
                  onClick={() => {
                    if (config.nextLevel) {
                      iniciarNivel(config.nextLevel);
                    }
                  }}
                  className="w-full rounded-full h-12 text-base font-semibold shadow-lg cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <ArrowRight className="h-5 w-5 mr-2" /> Siguiente Nivel (
                  {config.nextLevel ? DIFICULTADES[config.nextLevel].name : ""})
                </Button>
              </div>
            ) : fase === "victoria_total" ? (
              <div className="space-y-4 max-w-xs">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg">
                  <Award className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold text-foreground">
                    ¡Victoria Total!
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Completaste todos los niveles y dominaste la red de vías.
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
                    <p className="font-display text-xl font-bold text-emerald-400">
                      {totalAciertos}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={reiniciarCompleto}
                  className="w-full rounded-full h-11 font-semibold text-sm shadow-lg cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4 mr-2" /> Jugar de nuevo
                </Button>
              </div>
            ) : fase === "gameover" ? (
              <div className="space-y-4 max-w-xs">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-lg">
                  <Award className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold text-foreground">¡Sin vidas!</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Fallaste 3 desvíos. ¡Buen entrenamiento de foco!
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
                      Trenes Guiados
                    </p>
                    <p className="font-display text-xl font-bold text-emerald-400">
                      {totalAciertos}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => iniciarNivel(dificultad)}
                  className="w-full rounded-full h-11 font-semibold text-sm shadow-lg cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4 mr-2" /> Reintentar nivel
                </Button>
              </div>
            ) : fase === "pausado" ? (
              <div className="space-y-4 max-w-xs">
                <h3 className="font-display text-2xl font-bold text-foreground">Pausa</h3>
                <p className="text-xs text-muted-foreground">
                  Tómate un respiro antes de continuar coordinando las vías.
                </p>
                <Button
                  onClick={() => setFase("jugando")}
                  className="w-full rounded-full h-11 font-semibold text-sm shadow-lg cursor-pointer"
                >
                  <Play className="h-4 w-4 mr-2 fill-current" /> Continuar
                </Button>
              </div>
            ) : (
              <div className="space-y-4 max-w-xs">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg">
                  <Play className="h-8 w-8 fill-current ml-1" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-foreground">Cruce de Vías</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Meta: Guía <strong>{config.targetTrains} trenes</strong> a su color para superar
                    el nivel.
                  </p>
                </div>

                <Button
                  onClick={() => iniciarNivel(dificultad)}
                  className="w-full rounded-full h-12 text-base font-semibold shadow-lg cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Play className="h-5 w-5 mr-2 fill-current" /> Empezar ({config.name})
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-center text-[0.68rem] text-muted-foreground mt-1">
        Toca las plataformas verdes circulares para cambiar la dirección de las vías antes de que el
        tren llegue.
      </p>
    </div>
  );
}
