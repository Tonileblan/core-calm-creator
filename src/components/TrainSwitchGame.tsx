import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Heart, RotateCcw, Play, Pause, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
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
   CONFIGURACIONES DE DIFICULTAD
───────────────────────────────────────────────────────────── */

interface DifficultyConfig {
  name: string;
  description: string;
  colors: TrainColorId[];
  speedBase: number;
  spawnIntervalMs: number;
}

const DIFICULTADES: Record<DifficultyLevel, DifficultyConfig> = {
  facil: {
    name: "Fácil",
    description: "2 estaciones · 2 desvíos",
    colors: ["verde", "azul"],
    speedBase: 0.14,
    spawnIntervalMs: 5000,
  },
  medio: {
    name: "Medio",
    description: "3 estaciones · 3 desvíos",
    colors: ["verde", "azul", "rosa"],
    speedBase: 0.17,
    spawnIntervalMs: 4200,
  },
  dificil: {
    name: "Difícil",
    description: "4 estaciones · 4 desvíos (Como captura)",
    colors: ["verde", "azul", "rosa", "amarillo"],
    speedBase: 0.2,
    spawnIntervalMs: 3400,
  },
  experto: {
    name: "Experto",
    description: "5 estaciones · 5 desvíos · Red completa",
    colors: ["verde", "azul", "rosa", "amarillo", "negro"],
    speedBase: 0.24,
    spawnIntervalMs: 2700,
  },
};

const VIEW_W = 400;
const VIEW_H = 540;

/* ─────────────────────────────────────────────────────────────
   COORDINADAS FIJAS DEL MAPA (LUMOSITY EXACTO)
   - Origen Montañas: (250, 480)
   - S0 (Desvío Amarillo/Arriba): (250, 310)
   - S1 (Desvío Rosa/Arriba): (250, 200)
   - S2 (Desvío Superior): (250, 95)
   - S3 (Desvío Verde/Azul): (165, 95)
   - S4 (Desvío Negro): (165, 290)
   - Estación Verde: (95, 65)
   - Estación Azul: (95, 150)
   - Estación Rosa: (165, 220)
   - Estación Amarilla: (290, 240)
   - Estación Negra: (95, 410)
───────────────────────────────────────────────────────────── */

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
   CÁLCULO EXACTO DE TRAYECTORIA SEGÚN EL ESTADO DE LOS DESVÍOS
───────────────────────────────────────────────────────────── */

function calculateTrainPosition(
  train: TrainItem,
  level: DifficultyLevel,
  switches: Record<number, 0 | 1>,
): { x: number; y: number; angle: number; destColor?: TrainColorId } {
  const p = Math.min(1, Math.max(0, train.progress));

  // 1. MODO FÁCIL: S1 (250, 200) -> S3 (165, 95) -> Verde (95, 65) o Azul (95, 150)
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
      // Hacia Verde (95, 65)
      const pt = getPointOnCurve(165, 95, 135, 95, 115, 65, 95, 65, t);
      return { ...pt, destColor: "verde" };
    } else {
      // Hacia Azul (95, 150)
      const pt = getPointOnCurve(165, 95, 135, 95, 115, 150, 95, 150, t);
      return { ...pt, destColor: "azul" };
    }
  }

  // 2. MODO MEDIO: S0 (250, 310) -> S1 (250, 200) [Rosa (165, 220)] -> S3 (165, 95) [Verde, Azul]
  if (level === "medio") {
    const pS0 = 0.3;
    if (p <= pS0) {
      const t = p / pS0;
      return getPointOnCurve(250, 480, 250, 420, 250, 360, 250, 310, t);
    }

    const pS1 = 0.55;
    if (p <= pS1) {
      const t = (p - pS0) / (pS1 - pS0);
      return getPointOnCurve(250, 310, 250, 270, 250, 240, 250, 200, t);
    }

    const r1 = train.routeS1 ?? switches[1] ?? 0;

    if (r1 === 1) {
      // Desvía a la Izquierda -> Casa Rosa (165, 220)
      const t = (p - pS1) / (1 - pS1);
      const pt = getPointOnCurve(250, 200, 250, 220, 200, 220, 165, 220, t);
      return { ...pt, destColor: "rosa" };
    }

    // Sigue hacia S3 en (165, 95)
    const pS3 = 0.8;
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

  // 3. MODO DIFÍCIL & EXPERTO (Fiel a la captura Lumosity)
  // S0(250, 310) -> Amarillo(290, 240) o Arriba hacia S1(250, 200)
  // S1(250, 200) -> Rosa(165, 220) o Arriba hacia S2(250, 95)
  // S2(250, 95) -> S3(165, 95)
  // S3(165, 95) -> Verde(95, 65) o Azul(95, 150)
  // S4(165, 290) -> Negro(95, 410) (Experto)
  const pS0 = 0.28;
  if (p <= pS0) {
    const t = p / pS0;
    return getPointOnCurve(250, 480, 250, 420, 250, 360, 250, 310, t);
  }

  const r0 = train.routeS0 ?? switches[0] ?? 0;

  // En S0: Si toma la DERECHA -> Casa Amarilla (290, 240)
  if (r0 === 1) {
    const t = (p - pS0) / (1 - pS0);
    const pt = getPointOnCurve(250, 310, 250, 290, 290, 280, 290, 240, t);
    return { ...pt, destColor: "amarillo" };
  }

  // En S0: Sigue recto hacia S1 (250, 200)
  const pS1 = 0.5;
  if (p <= pS1) {
    const t = (p - pS0) / (pS1 - pS0);
    return getPointOnCurve(250, 310, 250, 270, 250, 240, 250, 200, t);
  }

  const r1 = train.routeS1 ?? switches[1] ?? 0;

  // En S1: Si toma la IZQUIERDA -> Casa Rosa (165, 220) o S4 Negro
  if (r1 === 1) {
    const pRosa = 0.76;
    if (p <= pRosa) {
      const t = (p - pS1) / (pRosa - pS1);
      return getPointOnCurve(250, 200, 250, 220, 200, 220, 165, 220, t);
    }

    if (level === "experto") {
      const r4 = train.routeS4 ?? switches[4] ?? 0;
      if (r4 === 1) {
        // Hacia Casa Negra (95, 410)
        const t = (p - pRosa) / (1 - pRosa);
        const pt = getPointOnCurve(165, 220, 165, 300, 95, 340, 95, 410, t);
        return { ...pt, destColor: "negro" };
      }
    }

    const pt = { x: 165, y: 220, angle: 180 };
    return { ...pt, destColor: "rosa" };
  }

  // En S1: Sigue recto hacia S2 (250, 95)
  const pS2 = 0.68;
  if (p <= pS2) {
    const t = (p - pS1) / (pS2 - pS1);
    return getPointOnCurve(250, 200, 250, 160, 250, 130, 250, 95, t);
  }

  // En S2: Pasa hacia S3 (165, 95)
  const pS3 = 0.82;
  if (p <= pS3) {
    const t = (p - pS2) / (pS3 - pS2);
    return getPointOnCurve(250, 95, 230, 95, 190, 95, 165, 95, t);
  }

  // En S3: Elige entre Verde (95, 65) y Azul (95, 150)
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
    <g transform={`translate(${x - 22}, ${y - 24})`} className="select-none">
      {/* Sombra suave de pegatina */}
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

      {/* Contorno Blanco Grueso (Sticker Style) */}
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

      {/* Cuerpo de la casa */}
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

      {/* Tejado de la estación */}
      <polygon points="3,14 22,2 41,14" fill={col.fillDark} stroke="#ffffff" strokeWidth="1" />

      {/* Chimenea con banderita */}
      <rect x="31" y="2" width="6" height="8" fill={col.fillDark} rx="1" />
      <polygon points="34,2 38,0 34,-2" fill={col.accent} />

      {/* Ventana iluminada / puerta */}
      <rect x="16" y="22" width="12" height="18" rx="3" fill="#ffffff" opacity="0.9" />
      <rect x="18" y="25" width="8" height="14" rx="2" fill={col.fillDark} opacity="0.85" />
      <line x1="22" y1="25" x2="22" y2="39" stroke="#ffffff" strokeWidth="1" />

      {/* Ventana pequeña en buhardilla */}
      <circle cx="22" cy="10" r="3" fill="#ffffff" />
      <circle cx="22" cy="10" r="2" fill={col.fillDark} />

      {/* Texto miniatura identificador */}
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

/* ─────────────────────────────────────────────────────────────
   COMPONENTE DE TREN DE VAPOR CON SILUETA Y BORDE BLANCO
───────────────────────────────────────────────────────────── */

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
    <g transform={`translate(${x}, ${y}) rotate(${angle + 90})`} className="select-none">
      {/* Sombra de la locomotora */}
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

      {/* Borde exterior blanco sticker */}
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

      {/* Cuerpo principal de la locomotora */}
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

      {/* Cabina trasera */}
      <rect x="-9" y="2" width="18" height="12" rx="3" fill={col.fillDark} />
      {/* Ventanilla de cabina */}
      <rect x="-6" y="5" width="12" height="6" rx="2" fill="#ffffff" />

      {/* Chimenea de vapor delantera */}
      <circle cx="0" cy="-10" r="3.5" fill={col.fillDark} />
      <circle cx="0" cy="-10" r="2" fill="#ffffff" />

      {/* Faro delantero luminoso */}
      <polygon points="-4,-16 0,-19 4,-16" fill="#ffffff" />
      <circle cx="0" cy="-16" r="2.5" fill="#fef08a" />

      {/* Nube de vapor estilizada */}
      <circle cx="0" cy="18" r="3.5" fill="#ffffff" opacity="0.8" />
      <circle cx="3" cy="22" r="2.5" fill="#ffffff" opacity="0.5" />
    </g>
  );
}

/* ─────────────────────────────────────────────────────────────
   PLATAFORMA CIRCULAR VERDE GIRATORIA (DESVÍO CON GIRO EXACTO)
   - angle0: Rotación de la vía interior cuando state === 0
   - angle1: Rotación de la vía interior cuando state === 1
   - trackKind: "straight" (recto) o "curve" (curvado hacia la salida)
───────────────────────────────────────────────────────────── */

function CircularSwitchPlatform({
  x,
  y,
  state,
  angle0,
  angle1,
  trackKind = "straight",
  onClick,
}: {
  x: number;
  y: number;
  state: 0 | 1;
  angle0: number;
  angle1: number;
  trackKind?: "straight" | "curve";
  onClick: () => void;
}) {
  const currentAngle = state === 0 ? angle0 : angle1;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      className="cursor-pointer group select-none"
    >
      {/* Zona táctil expandida */}
      <circle r="34" fill="transparent" />

      {/* Sombra 3D de la plataforma circular */}
      <circle cx="0" cy="3" r="22" fill="#1a351f" opacity="0.6" />

      {/* Base cilíndrica verde oscuro */}
      <circle r="22" fill="#3c7940" stroke="#27532a" strokeWidth="2.5" />

      {/* Superficie superior verde brillante */}
      <circle
        r="19"
        fill="#529e55"
        stroke="#79c97d"
        strokeWidth="1.2"
        className="transition-transform duration-200 group-hover:scale-105"
      />

      {/* ── Vía interna giratoria que se alinea exactamente con la dirección activa ── */}
      <g
        transform={`rotate(${currentAngle})`}
        style={{
          transition: "transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1)",
          transformOrigin: "0 0",
        }}
      >
        {trackKind === "straight" ? (
          <>
            {/* Traviesas internas de madera */}
            <line
              x1="-12"
              y1="-8"
              x2="12"
              y2="-8"
              stroke="#234226"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <line
              x1="-12"
              y1="-2"
              x2="12"
              y2="-2"
              stroke="#234226"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <line
              x1="-12"
              y1="4"
              x2="12"
              y2="4"
              stroke="#234226"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <line
              x1="-12"
              y1="10"
              x2="12"
              y2="10"
              stroke="#234226"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Dos raíles metálicos paralelos */}
            <line
              x1="-6"
              y1="-18"
              x2="-6"
              y2="18"
              stroke="#1f2f22"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <line
              x1="6"
              y1="-18"
              x2="6"
              y2="18"
              stroke="#1f2f22"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <line
              x1="-6"
              y1="-18"
              x2="-6"
              y2="18"
              stroke="#e5e7eb"
              strokeWidth="0.8"
              strokeLinecap="round"
            />
            <line
              x1="6"
              y1="-18"
              x2="6"
              y2="18"
              stroke="#e5e7eb"
              strokeWidth="0.8"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            {/* Vía curvada hacia la salida */}
            <path
              d="M 0,18 C 0,5 -5,-5 -18,-5"
              fill="none"
              stroke="#1f2f22"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <path
              d="M 0,18 C 0,5 -5,-5 -18,-5"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Perno central dorado y flecha indicadora */}
        <circle cx="0" cy="0" r="4" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
        <polygon points="-2.5,-12 2.5,-12 0,-16" fill="#ffffff" />
      </g>

      {/* Anillo de feedback al pasar el ratón */}
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
   COMPONENTE PRINCIPAL
───────────────────────────────────────────────────────────── */

export function TrainSwitchGame({ registrar }: { registrar: Registrar }) {
  const [dificultad, setDificultad] = useState<DifficultyLevel>("dificil");
  const [fase, setFase] = useState<"idle" | "jugando" | "pausado" | "gameover">("idle");

  const [puntos, setPuntos] = useState(0);
  const [racha, setRacha] = useState(0);
  const [mejorRacha, setMejorRacha] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [fallos, setFallos] = useState(0);
  const [vidas, setVidas] = useState(3);
  const [segundos, setSegundos] = useState(0);

  // Estados de los desvíos giratorios (0 o 1)
  const [switches, setSwitches] = useState<Record<number, 0 | 1>>({
    0: 0, // S0 (Inferior): 0 = Recto Arriba, 1 = Derecha a Amarillo
    1: 0, // S1 (Medio): 0 = Recto Arriba, 1 = Izquierda a Rosa
    2: 0, // S2 (Superior): 0 = Izquierda a S3, 1 = Recto
    3: 0, // S3 (Top-Left): 0 = Arriba a Verde, 1 = Abajo a Azul
    4: 0, // S4 (Negro - Experto): 0 = Rosa, 1 = Negro
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
    // Sonido táctil de giro mecánico
    getAudioEngine().chime(id === 0 ? 680 : id === 1 ? 780 : id === 2 ? 880 : 940, 0.08);
  };

  /* ── Spawning de nuevo tren ── */
  const spawnTrain = useCallback(() => {
    const availableColors = config.colors;
    const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)]!;
    const newTrain: TrainItem = {
      id: `${Date.now()}-${Math.random()}`,
      color: randomColor,
      progress: 0,
      speed: config.speedBase,
    };
    setTrains((prev) => [...prev, newTrain]);
  }, [config]);

  /* ── Iniciar Partida ── */
  const iniciarJuego = (nivel = dificultad) => {
    setDificultad(nivel);
    setPuntos(0);
    setRacha(0);
    setMejorRacha(0);
    setAciertos(0);
    setFallos(0);
    setVidas(3);
    setSegundos(0);
    setTrains([]);
    setFloatingScores([]);
    setSwitches({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 });
    setFase("jugando");
    spawnTimerRef.current = Date.now() + 500;
    lastTimeRef.current = performance.now();
    getAudioEngine().chime(587, 0.25);
  };

  /* ── Manejo de llegada a la casita correspondiente ── */
  const handleArrival = useCallback(
    (train: TrainItem) => {
      const pos = calculateTrainPosition(train, dificultad, switchesRef.current);
      const isSuccess = train.color === pos.destColor;

      if (isSuccess) {
        setAciertos((a) => a + 1);
        setRacha((r) => {
          const nr = r + 1;
          setMejorRacha((m) => Math.max(m, nr));
          return nr;
        });
        const pts = 100 + racha * 20;
        setPuntos((p) => p + pts);

        // Sonido de llegada triunfal
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
              aciertos,
              fallos: fallos + 1,
              mejorRacha,
            });
          }
          return Math.max(0, nv);
        });

        // Sonido de error
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
    [aciertos, dificultad, fallos, mejorRacha, puntos, racha, registrar, segundos],
  );

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

      // Spawning periódico
      const now = Date.now();
      if (now >= spawnTimerRef.current) {
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

          // Bloqueo de rutas al cruzar cada nodo
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
            if (nextP >= 0.3 && !tr.passedS0) {
              updated.passedS0 = true;
              updated.routeS0 = currentSw[0];
            }
            if (nextP >= 0.55 && !tr.passedS1) {
              updated.passedS1 = true;
              updated.routeS1 = currentSw[1];
            }
            if (nextP >= 0.8 && !tr.passedS3 && updated.routeS1 === 0) {
              updated.passedS3 = true;
              updated.routeS3 = currentSw[3];
            }
          } else {
            // Difícil & Experto (Captura Lumosity)
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
  }, [fase, config, spawnTrain, handleArrival, dificultad]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="flex flex-col items-center justify-between h-full w-full max-w-sm sm:max-w-md mx-auto py-1 touch-none select-none">
      {/* ── HUD SUPERIOR ESTILO LUMOSITY ── */}
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

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-center">
            <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground block font-sans">
              Tiempo
            </span>
            <span className="font-bold text-foreground">{formatTime(segundos)}</span>
          </div>

          <div className="h-5 w-px bg-border/60" />

          <div className="text-center">
            <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground block font-sans">
              Aciertos
            </span>
            <span className="font-bold text-emerald-400">
              {aciertos} / {aciertos + fallos}
            </span>
          </div>

          <div className="h-5 w-px bg-border/60" />

          <div className="text-center">
            <span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground block font-sans">
              Racha
            </span>
            <span className="font-bold text-amber-400">🔥 {racha}</span>
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

      {/* ── SELECTOR DE DIFICULTAD (PÍLDORAS) ── */}
      <div className="flex items-center justify-center gap-1 my-1 bg-zinc-900/60 p-1 rounded-full border border-border/50 w-full max-w-[340px]">
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

      {/* ── ESCENARIO COMPLETO (SVG 400x540) CON BOSQUE, MONTAÑAS Y VÍAS ── */}
      <div className="relative w-full max-w-[360px] aspect-[4/5.4] rounded-3xl border-2 border-border/90 bg-[#264e2d] shadow-2xl overflow-hidden my-auto flex items-center justify-center">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Gradiente del Terreno de Bosque */}
            <radialGradient id="forest-ground" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#32633a" />
              <stop offset="60%" stopColor="#28522f" />
              <stop offset="100%" stopColor="#1e3e23" />
            </radialGradient>
          </defs>

          {/* 1. Fondo de Terreno */}
          <rect width={VIEW_W} height={VIEW_H} fill="url(#forest-ground)" />

          {/* Árboles y Pinos de Fondo Decorativos */}
          <g opacity="0.35" fill="#18361c">
            <polygon points="50,110 58,130 42,130" />
            <polygon points="40,240 48,260 32,260" />
            <polygon points="340,90 348,110 332,110" />
            <polygon points="350,190 358,210 342,210" />
            <polygon points="310,340 318,360 302,360" />
            <polygon points="180,450 188,470 172,470" />
            <polygon points="60,350 68,370 52,370" />
          </g>

          {/* 2. Red de Vías de Ferrocarril (Doble Riel con Traviesas) */}
          <g className="rails-group" fill="none" strokeLinecap="round">
            {/* ── MODO FÁCIL: 2 Estaciones ── */}
            {dificultad === "facil" && (
              <>
                {/* Origen a S1(250, 200) */}
                <path d="M 250,480 L 250,200" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,480 L 250,200"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />

                {/* S1 a S3(165, 95) */}
                <path d="M 250,200 C 250,140 210,95 165,95" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,200 C 250,140 210,95 165,95"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />

                {/* S3 a Verde(95, 65) */}
                <path d="M 165,95 C 135,95 115,65 95,65" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 165,95 C 135,95 115,65 95,65"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />

                {/* S3 a Azul(95, 150) */}
                <path d="M 165,95 C 135,95 115,150 95,150" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 165,95 C 135,95 115,150 95,150"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
              </>
            )}

            {/* ── MODO MEDIO: 3 Estaciones ── */}
            {dificultad === "medio" && (
              <>
                {/* Origen a S0(250, 310) */}
                <path d="M 250,480 L 250,310" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,480 L 250,310"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />

                {/* S0 a S1(250, 200) */}
                <path d="M 250,310 L 250,200" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,310 L 250,200"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />

                {/* S1 a Rosa(165, 220) */}
                <path d="M 250,200 C 250,220 200,220 165,220" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,200 C 250,220 200,220 165,220"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />

                {/* S1 a S3(165, 95) */}
                <path d="M 250,200 C 250,140 210,95 165,95" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,200 C 250,140 210,95 165,95"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />

                {/* S3 a Verde(95, 65) y Azul(95, 150) */}
                <path d="M 165,95 C 135,95 115,65 95,65" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 165,95 C 135,95 115,65 95,65"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
                <path d="M 165,95 C 135,95 115,150 95,150" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 165,95 C 135,95 115,150 95,150"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />
              </>
            )}

            {/* ── MODO DIFÍCIL & EXPERTO (Fiel a la captura Lumosity) ── */}
            {(dificultad === "dificil" || dificultad === "experto") && (
              <>
                {/* Origen a S0(250, 310) */}
                <path d="M 250,480 L 250,310" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,480 L 250,310"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />

                {/* De S0 a Amarillo(290, 240) (Derecha) */}
                <path d="M 250,310 C 250,290 290,280 290,240" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,310 C 250,290 290,280 290,240"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />

                {/* De S0 a S1(250, 200) (Arriba) */}
                <path d="M 250,310 L 250,200" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,310 L 250,200"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />

                {/* De S1 a Rosa(165, 220) (Izquierda) */}
                <path d="M 250,200 C 250,220 200,220 165,220" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,200 C 250,220 200,220 165,220"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />

                {/* De S1 a S2(250, 95) (Arriba) */}
                <path d="M 250,200 L 250,95" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,200 L 250,95"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />

                {/* De S2 a S3(165, 95) (Izquierda) */}
                <path d="M 250,95 L 165,95" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 250,95 L 165,95"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />

                {/* De S3 a Verde(95, 65) */}
                <path d="M 165,95 C 135,95 115,65 95,65" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 165,95 C 135,95 115,65 95,65"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />

                {/* De S3 a Azul(95, 150) */}
                <path d="M 165,95 C 135,95 115,150 95,150" stroke="#1a2b1c" strokeWidth="9" />
                <path
                  d="M 165,95 C 135,95 115,150 95,150"
                  stroke="#d4d4d8"
                  strokeWidth="1.8"
                  strokeDasharray="4,4"
                />

                {/* Modo Experto: Vía hacia Casa Negra */}
                {dificultad === "experto" && (
                  <>
                    <path d="M 165,220 C 165,300 95,340 95,410" stroke="#1a2b1c" strokeWidth="9" />
                    <path
                      d="M 165,220 C 165,300 95,340 95,410"
                      stroke="#d4d4d8"
                      strokeWidth="1.8"
                      strokeDasharray="4,4"
                    />
                  </>
                )}
              </>
            )}
          </g>

          {/* 3. Plataformas Circulares Verdes Giratorias (Desvíos con alineación exacta) */}
          {dificultad === "facil" && (
            <>
              {/* S1: Continúa hacia S3 */}
              <CircularSwitchPlatform
                x={250}
                y={200}
                state={switches[1] ?? 0}
                angle0={-35}
                angle1={-35}
                onClick={() => toggleSwitch(1)}
              />
              {/* S3: Elige entre Verde (-45°) y Azul (+45°) */}
              <CircularSwitchPlatform
                x={165}
                y={95}
                state={switches[3] ?? 0}
                angle0={-135}
                angle1={135}
                onClick={() => toggleSwitch(3)}
              />
            </>
          )}

          {dificultad === "medio" && (
            <>
              {/* S0: Sube hacia S1 */}
              <CircularSwitchPlatform
                x={250}
                y={310}
                state={switches[0] ?? 0}
                angle0={0}
                angle1={0}
                onClick={() => toggleSwitch(0)}
              />
              {/* S1: Recto Arriba (0°) vs Giro Izquierda a Rosa (-55°) */}
              <CircularSwitchPlatform
                x={250}
                y={200}
                state={switches[1] ?? 0}
                angle0={0}
                angle1={-55}
                onClick={() => toggleSwitch(1)}
              />
              {/* S3: Arriba a Verde (-135°) vs Abajo a Azul (135°) */}
              <CircularSwitchPlatform
                x={165}
                y={95}
                state={switches[3] ?? 0}
                angle0={-135}
                angle1={135}
                onClick={() => toggleSwitch(3)}
              />
            </>
          )}

          {(dificultad === "dificil" || dificultad === "experto") && (
            <>
              {/* S0: Desvío inferior: Recto Arriba (0°) vs Giro Derecha a Amarillo (+55°) */}
              <CircularSwitchPlatform
                x={250}
                y={310}
                state={switches[0] ?? 0}
                angle0={0}
                angle1={55}
                onClick={() => toggleSwitch(0)}
              />

              {/* S1: Desvío medio: Recto Arriba (0°) vs Giro Izquierda a Rosa (-55°) */}
              <CircularSwitchPlatform
                x={250}
                y={200}
                state={switches[1] ?? 0}
                angle0={0}
                angle1={-55}
                onClick={() => toggleSwitch(1)}
              />

              {/* S2: Desvío superior: Giro hacia S3 (-90°) vs Recto (0°) */}
              <CircularSwitchPlatform
                x={250}
                y={95}
                state={switches[2] ?? 0}
                angle0={-90}
                angle1={0}
                onClick={() => toggleSwitch(2)}
              />

              {/* S3: Desvío top-left: Arriba a Verde (-135°) vs Abajo a Azul (135°) */}
              <CircularSwitchPlatform
                x={165}
                y={95}
                state={switches[3] ?? 0}
                angle0={-135}
                angle1={135}
                onClick={() => toggleSwitch(3)}
              />

              {/* Experto: S4 hacia Casa Negra */}
              {dificultad === "experto" && (
                <CircularSwitchPlatform
                  x={165}
                  y={290}
                  state={switches[4] ?? 0}
                  angle0={0}
                  angle1={-140}
                  onClick={() => toggleSwitch(4)}
                />
              )}
            </>
          )}

          {/* 4. Estaciones / Casitas con Estilo Pegatina */}
          {/* Casa Verde */}
          <CasaSticker x={95} y={65} colorId="verde" label="Verde" />
          {/* Casa Azul */}
          <CasaSticker x={95} y={150} colorId="azul" label="Azul" />

          {/* Casa Rosa (Medio, Difícil, Experto) */}
          {dificultad !== "facil" && <CasaSticker x={165} y={220} colorId="rosa" label="Rosa" />}

          {/* Casa Amarilla (Difícil, Experto) */}
          {(dificultad === "dificil" || dificultad === "experto") && (
            <CasaSticker x={290} y={240} colorId="amarillo" label="Amarillo" />
          )}

          {/* Casa Negra (Experto) */}
          {dificultad === "experto" && <CasaSticker x={95} y={410} colorId="negro" label="Negro" />}

          {/* 5. Montañas Low-Poly 3D en la Esquina Inferior Derecha (Origen de Trenes) */}
          <g className="mountains-origin select-none">
            {/* Montaña trasera */}
            <polygon points="210,540 250,440 290,540" fill="#2d5935" />
            <polygon points="250,440 290,540 270,540" fill="#224729" />

            {/* Montaña central con cumbre iluminada */}
            <polygon points="260,540 310,410 360,540" fill="#3f7547" />
            <polygon points="310,410 360,540 335,540" fill="#2c5733" />
            <polygon points="310,410 325,445 295,445" fill="#86efac" opacity="0.85" />

            {/* Montaña delantera */}
            <polygon points="310,540 355,430 400,540" fill="#4d8856" />
            <polygon points="355,430 400,540 380,540" fill="#336139" />
            <polygon points="355,430 370,460 340,460" fill="#bbf7d0" opacity="0.8" />

            {/* Boca del túnel de salida del tren */}
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

          {/* 6. Trenes en Circulación */}
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

          {/* 7. Notificaciones Flotantes de Puntos / Fallos */}
          {floatingScores.map((score) => (
            <text
              key={score.id}
              x={score.x}
              y={score.y}
              textAnchor="middle"
              className={cn(
                "font-display text-sm font-bold animate-out fade-out slide-out-to-top duration-700 select-none",
                score.isSuccess
                  ? "fill-emerald-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                  : "fill-rose-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]",
              )}
            >
              {score.text}
            </text>
          ))}
        </svg>

        {/* ── MODAL OVERLAY CUANDO NO ESTÁ JUGANDO ── */}
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
                    Gran ejercicio de atención selectiva y orientación de vías.
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
                      Tiempo
                    </p>
                    <p className="font-display text-sm font-bold text-foreground">
                      {formatTime(segundos)}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => iniciarJuego(dificultad)}
                  className="w-full rounded-full h-11 font-semibold text-sm shadow-lg cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4 mr-2" /> Jugar de nuevo
                </Button>
              </div>
            ) : fase === "pausado" ? (
              <div className="space-y-4 max-w-xs">
                <h3 className="font-display text-2xl font-bold text-foreground">
                  Partida en Pausa
                </h3>
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
                    Toca las <strong>plataformas circulares verdes</strong> para girar las vías
                    hacia la casa de cada tren.
                  </p>
                </div>

                <Button
                  onClick={() => iniciarJuego(dificultad)}
                  className="w-full rounded-full h-12 text-base font-semibold shadow-lg cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Play className="h-5 w-5 mr-2 fill-current" /> Empezar ({config.name})
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── PIE INFORMATIVO ── */}
      <p className="text-center text-[0.68rem] text-muted-foreground mt-1">
        Toca las plataformas verdes circulares para cambiar la dirección de las vías antes de que el
        tren llegue.
      </p>
    </div>
  );
}
