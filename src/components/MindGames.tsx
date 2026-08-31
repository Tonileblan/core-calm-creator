import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from "react";
import {
  Brain,
  Grid3x3,
  Palette,
  Calculator,
  Eye,
  RotateCcw,
  Sparkles,
  Flame,
  Moon,
  Sun,
  Leaf,
  Zap,
  Flower2,
  HelpCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getAudioEngine } from "@/lib/audio-engine";
import { cn } from "@/lib/utils";

export type Registrar = (
  ejercicio: string,
  minutos: number,
  detalle: Record<string, unknown>,
) => void;

export function Marcador({ items }: { items: [string, string][] }) {
  return (
    <div className="flex justify-center gap-6 select-none">
      {items.map(([label, value]) => (
        <div key={label} className="text-center">
          <p className="font-display text-2xl tabular-nums text-foreground">{value}</p>
          <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CUADRO FLOTANTE DE TURNO / ESTADO
───────────────────────────────────────────────────────────── */

export function CuadroFlotanteTurno({
  texto,
  subtexto,
  variante = "turno",
}: {
  texto: string;
  subtexto?: string;
  variante?: "turno" | "observa" | "exito" | "error" | "info";
}) {
  const estilos = {
    turno:
      "bg-primary/20 border-primary/50 text-primary shadow-[0_0_30px_rgba(var(--primary),0.3)] ring-1 ring-primary/40",
    observa:
      "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_25px_rgba(251,191,36,0.25)]",
    exito:
      "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_25px_rgba(52,211,153,0.25)]",
    error:
      "bg-destructive/20 border-destructive/40 text-destructive shadow-[0_0_25px_rgba(239,68,68,0.25)]",
    info: "bg-secondary/80 border-border/80 text-foreground/90",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-1.5 border backdrop-blur-xl transition-all duration-300 transform animate-in fade-in zoom-in-95 slide-in-from-top-2 select-none shadow-md",
        estilos[variante],
      )}
    >
      {variante === "turno" && (
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
        </span>
      )}
      {variante === "observa" && (
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
        </span>
      )}
      <span className="text-xs sm:text-sm font-semibold tracking-wide">{texto}</span>
      {subtexto && <span className="text-[0.7rem] opacity-80 font-normal">· {subtexto}</span>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   1. SECUENCIA (Simon)
───────────────────────────────────────────────────────────── */

const CELDAS = [
  {
    bg: "bg-primary/60 border-primary/40",
    on: "bg-primary shadow-[0_0_35px_rgba(var(--primary),0.8)]",
    tono: 523,
  },
  {
    bg: "bg-amber-500/50 border-amber-500/40",
    on: "bg-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.8)]",
    tono: 659,
  },
  {
    bg: "bg-indigo-600/50 border-indigo-500/40",
    on: "bg-indigo-400 shadow-[0_0_35px_rgba(129,140,248,0.8)]",
    tono: 784,
  },
  {
    bg: "bg-emerald-600/50 border-emerald-500/40",
    on: "bg-emerald-400 shadow-[0_0_35px_rgba(52,211,153,0.8)]",
    tono: 880,
  },
];

export function SecuenciaGame({ registrar }: { registrar: Registrar }) {
  const [seq, setSeq] = useState<number[]>([]);
  const [paso, setPaso] = useState(0);
  const [activa, setActiva] = useState<number | null>(null);
  const [fase, setFase] = useState<"idle" | "ver" | "jugar" | "fin">("idle");
  const [mejor, setMejor] = useState(0);
  const timers = useRef<number[]>([]);

  const limpiar = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => limpiar, []);

  const mostrar = useCallback((s: number[]) => {
    setFase("ver");
    limpiar();
    s.forEach((c, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setActiva(c);
          getAudioEngine().chime(CELDAS[c]!.tono, 0.25);
        }, i * 650),
      );
      timers.current.push(window.setTimeout(() => setActiva(null), i * 650 + 400));
    });
    timers.current.push(
      window.setTimeout(
        () => {
          setFase("jugar");
          setPaso(0);
        },
        s.length * 650 + 200,
      ),
    );
  }, []);

  const siguienteRonda = (base: number[]) => {
    const s = [...base, Math.floor(Math.random() * 4)];
    setSeq(s);
    mostrar(s);
  };

  const pulsar = (i: number) => {
    if (fase !== "jugar") return;
    getAudioEngine().chime(CELDAS[i]!.tono, 0.2);
    setActiva(i);
    window.setTimeout(() => setActiva(null), 180);

    if (seq[paso] === i) {
      if (paso + 1 === seq.length) {
        setMejor((m) => Math.max(m, seq.length));
        window.setTimeout(() => siguienteRonda(seq), 600);
      } else {
        setPaso(paso + 1);
      }
    } else {
      setFase("fin");
      getAudioEngine().chime(180, 0.5);
      registrar("memoria_secuencia", 2, { nivel: seq.length - 1, mejor });
    }
  };

  return (
    <div className="flex flex-col items-center justify-between h-full w-full max-w-sm mx-auto py-2 touch-none select-none">
      <Marcador
        items={[
          ["Nivel", String(seq.length)],
          ["Mejor", String(mejor)],
          ["Estado", fase === "ver" ? "Observa" : fase === "jugar" ? "Tu turno" : "Listo"],
        ]}
      />

      <div className="relative my-auto flex flex-col items-center justify-center w-full">
        {/* Cuadro flotante de aviso de turno y estado */}
        <div className="h-10 mb-3 flex items-center justify-center">
          {fase === "ver" && (
            <CuadroFlotanteTurno
              variante="observa"
              texto="👀 Observa la secuencia..."
              subtexto={`Nivel ${seq.length}`}
            />
          )}
          {fase === "jugar" && (
            <CuadroFlotanteTurno
              variante="turno"
              texto="👉 ¡Te toca a ti!"
              subtexto={`Paso ${paso + 1} de ${seq.length}`}
            />
          )}
          {fase === "fin" && (
            <CuadroFlotanteTurno
              variante="error"
              texto="❌ Fin de la secuencia"
              subtexto={`Nivel ${Math.max(0, seq.length - 1)}`}
            />
          )}
          {fase === "idle" && (
            <CuadroFlotanteTurno variante="info" texto="Memoria de Trabajo" subtexto="Simon Dice" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3.5 w-full max-w-[280px] sm:max-w-[320px] aspect-square">
          {CELDAS.map((c, i) => (
            <button
              key={i}
              onClick={() => pulsar(i)}
              disabled={fase !== "jugar"}
              className={
                "aspect-square rounded-3xl border-2 transition-all duration-150 active:scale-95 cursor-pointer " +
                (activa === i ? `${c.on} scale-95 ring-4 ring-foreground/20` : c.bg) +
                (fase === "jugar" ? " hover:opacity-90" : " opacity-75 cursor-default")
              }
            />
          ))}
        </div>
      </div>

      {fase === "fin" ? (
        <p className="text-center text-sm text-primary font-medium mb-2">
          Fallaste en el nivel {seq.length}. ¡Buen entrenamiento!
        </p>
      ) : null}

      <div className="w-full space-y-2">
        <Button
          className="w-full rounded-full shadow-lg h-12 text-base font-semibold"
          variant={fase === "idle" || fase === "fin" ? "default" : "secondary"}
          onClick={() => {
            setMejor((m) => Math.max(m, 0));
            setSeq([]);
            siguienteRonda([]);
          }}
        >
          {fase === "idle" ? "Empezar entrenamiento" : fase === "fin" ? "Reintentar" : "Reiniciar"}
        </Button>
        <p className="text-center text-[0.7rem] text-muted-foreground">
          Observa la secuencia de luces y sonidos y repítela en el mismo orden.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   2. PAREJAS (Memoria Visual con SVG Icons de Alto Contraste)
───────────────────────────────────────────────────────────── */

export type MemoryCardDef = {
  id: string;
  label: string;
  icon: ElementType;
  colorClass: string;
  bgClass: string;
  borderClass: string;
};

const ICON_PAIRS: MemoryCardDef[] = [
  {
    id: "flame",
    label: "Fuego",
    icon: Flame,
    colorClass: "text-orange-400",
    bgClass: "bg-orange-500/25",
    borderClass: "border-orange-500/60",
  },
  {
    id: "moon",
    label: "Luna",
    icon: Moon,
    colorClass: "text-indigo-300",
    bgClass: "bg-indigo-500/25",
    borderClass: "border-indigo-500/60",
  },
  {
    id: "sun",
    label: "Sol",
    icon: Sun,
    colorClass: "text-amber-300",
    bgClass: "bg-amber-500/25",
    borderClass: "border-amber-500/60",
  },
  {
    id: "sparkles",
    label: "Estrella",
    icon: Sparkles,
    colorClass: "text-teal-300",
    bgClass: "bg-teal-500/25",
    borderClass: "border-teal-500/60",
  },
  {
    id: "leaf",
    label: "Hoja",
    icon: Leaf,
    colorClass: "text-emerald-400",
    bgClass: "bg-emerald-500/25",
    borderClass: "border-emerald-500/60",
  },
  {
    id: "zap",
    label: "Rayo",
    icon: Zap,
    colorClass: "text-purple-300",
    bgClass: "bg-purple-500/25",
    borderClass: "border-purple-500/60",
  },
];

function crearTablero(pares: number) {
  const elegidos = ICON_PAIRS.slice(0, pares);
  return [...elegidos, ...elegidos]
    .map((item) => ({ item, sortKey: Math.random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((c, i) => ({ id: i, item: c.item }));
}

export function ParejasGame({ registrar }: { registrar: Registrar }) {
  const pares = 6; // 12 cartas en cuadrícula 4x3 o 3x4
  const [cartas, setCartas] = useState(() => crearTablero(pares));
  const [abiertas, setAbiertas] = useState<number[]>([]);
  const [hechas, setHechas] = useState<number[]>([]);
  const [movs, setMovs] = useState(0);

  const completo = hechas.length === cartas.length;

  useEffect(() => {
    if (completo && cartas.length) {
      getAudioEngine().chime(880, 0.6);
      registrar("memoria_parejas", 3, { movimientos: movs, pares });
    }
  }, [completo, cartas.length, movs, pares, registrar]);

  const voltear = (id: number) => {
    if (abiertas.includes(id) || hechas.includes(id) || abiertas.length === 2) return;
    const nuevas = [...abiertas, id];
    setAbiertas(nuevas);
    getAudioEngine().chime(600, 0.15);

    if (nuevas.length === 2) {
      setMovs((m) => m + 1);
      const [a, b] = nuevas;
      const cardA = cartas.find((c) => c.id === a)!.item;
      const cardB = cartas.find((c) => c.id === b)!.item;

      if (cardA.id === cardB.id) {
        setHechas((h) => [...h, a!, b!]);
        setAbiertas([]);
        getAudioEngine().chime(784, 0.3);
      } else {
        window.setTimeout(() => setAbiertas([]), 750);
      }
    }
  };

  const reiniciar = () => {
    setCartas(crearTablero(pares));
    setAbiertas([]);
    setHechas([]);
    setMovs(0);
  };

  return (
    <div className="flex flex-col items-center justify-between h-full w-full max-w-sm mx-auto py-2 touch-none select-none">
      <Marcador
        items={[
          ["Movimientos", String(movs)],
          ["Parejas", `${hechas.length / 2}/${pares}`],
        ]}
      />

      <div className="relative my-auto flex flex-col items-center justify-center w-full">
        {/* Cuadro flotante de turno y estado */}
        <div className="h-10 mb-2 flex items-center justify-center">
          {completo ? (
            <CuadroFlotanteTurno
              variante="exito"
              texto="🎉 ¡Completado!"
              subtexto={`${movs} movimientos`}
            />
          ) : (
            <CuadroFlotanteTurno
              variante="turno"
              texto="✨ ¡Te toca a ti!"
              subtexto="Encuentra las parejas"
            />
          )}
        </div>

        {/* Cuadrícula 4x3 de cartas con gráficos SVG nítidos */}
        <div className="grid grid-cols-4 gap-2.5 w-full">
          {cartas.map((c) => {
            const isFlipped = abiertas.includes(c.id) || hechas.includes(c.id);
            const isMatched = hechas.includes(c.id);
            const IconComp = c.item.icon;

            return (
              <button
                key={c.id}
                onClick={() => voltear(c.id)}
                disabled={isMatched}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-2xl border-2 transition-all duration-300 active:scale-95 shadow-sm",
                  isFlipped
                    ? cn(
                        c.item.bgClass,
                        c.item.borderClass,
                        "shadow-[0_0_20px_rgba(255,255,255,0.15)]",
                        isMatched ? "opacity-90 ring-2 ring-primary/40" : "",
                      )
                    : "border-border/80 bg-secondary/80 hover:bg-secondary hover:border-primary/40",
                )}
              >
                {isFlipped ? (
                  <div className="flex items-center justify-center transition-all transform scale-100 animate-in fade-in zoom-in duration-200">
                    <IconComp
                      className={cn("h-7 w-7 sm:h-8 sm:w-8", c.item.colorClass)}
                      strokeWidth={2.2}
                    />
                  </div>
                ) : (
                  <HelpCircle className="h-5 w-5 text-muted-foreground/40" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full space-y-2">
        <Button
          variant={completo ? "default" : "secondary"}
          className="w-full rounded-full shadow-md h-11"
          onClick={reiniciar}
        >
          <RotateCcw className="mr-2 h-4 w-4" /> Nuevo tablero
        </Button>
        <p className="text-center text-[0.7rem] text-muted-foreground">
          Voltea las cartas y encuentra todos los símbolos iguales.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   3. STROOP (Control Inhibitorio)
───────────────────────────────────────────────────────────── */

const COLORES_STROOP = [
  { nombre: "ROJO", clase: "text-red-400", bg: "hover:bg-red-500/15 border-red-500/30" },
  {
    nombre: "VERDE",
    clase: "text-emerald-400",
    bg: "hover:bg-emerald-500/15 border-emerald-500/30",
  },
  { nombre: "AZUL", clase: "text-sky-400", bg: "hover:bg-sky-500/15 border-sky-500/30" },
  { nombre: "AMARILLO", clase: "text-amber-300", bg: "hover:bg-amber-500/15 border-amber-500/30" },
];

function rondaStroop() {
  const palabra = Math.floor(Math.random() * 4);
  let tinta = Math.floor(Math.random() * 4);
  if (Math.random() > 0.25 && tinta === palabra) tinta = (tinta + 1) % 4;
  return { palabra, tinta };
}

export function StroopGame({ registrar }: { registrar: Registrar }) {
  const [ronda, setRonda] = useState(rondaStroop);
  const [aciertos, setAciertos] = useState(0);
  const [fallos, setFallos] = useState(0);
  const [segundos, setSegundos] = useState(45);
  const [corriendo, setCorriendo] = useState(false);

  useEffect(() => {
    if (!corriendo) return;
    const t = window.setInterval(() => setSegundos((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [corriendo]);

  useEffect(() => {
    if (corriendo && segundos === 0) {
      setCorriendo(false);
      getAudioEngine().chime(660, 0.5);
      registrar("atencion_stroop", 1, { aciertos, fallos });
    }
  }, [segundos, corriendo, aciertos, fallos, registrar]);

  const responder = (i: number) => {
    if (!corriendo) return;
    if (i === ronda.tinta) {
      setAciertos((a) => a + 1);
      getAudioEngine().chime(784, 0.12);
    } else {
      setFallos((f) => f + 1);
      getAudioEngine().chime(200, 0.2);
    }
    setRonda(rondaStroop());
  };

  return (
    <div className="flex flex-col items-center justify-between h-full w-full max-w-sm mx-auto py-2 touch-none select-none">
      <Marcador
        items={[
          ["Aciertos", String(aciertos)],
          ["Fallos", String(fallos)],
          ["Tiempo", `${segundos}s`],
        ]}
      />

      <div className="w-full my-auto space-y-3">
        {/* Cuadro flotante de aviso de turno */}
        <div className="h-10 flex items-center justify-center">
          {corriendo ? (
            <CuadroFlotanteTurno
              variante="turno"
              texto="⚡ ¡Te toca a ti!"
              subtexto="Color de la tinta"
            />
          ) : segundos === 0 ? (
            <CuadroFlotanteTurno
              variante="exito"
              texto="⏱️ ¡Tiempo finalizado!"
              subtexto={`${aciertos} aciertos`}
            />
          ) : (
            <CuadroFlotanteTurno
              variante="info"
              texto="Control Inhibitorio"
              subtexto="45 segundos"
            />
          )}
        </div>

        <Progress value={(segundos / 45) * 100} className="h-1.5" />

        <div className="flex h-28 items-center justify-center rounded-3xl border-2 border-border/80 bg-secondary/40 shadow-inner">
          <span
            className={cn(
              "font-display text-4xl sm:text-5xl font-bold tracking-wide",
              COLORES_STROOP[ronda.tinta]!.clase,
            )}
          >
            {COLORES_STROOP[ronda.palabra]!.nombre}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {COLORES_STROOP.map((c, i) => (
            <button
              key={c.nombre}
              onClick={() => responder(i)}
              disabled={!corriendo}
              className={cn(
                "rounded-2xl border-2 py-3.5 text-base font-bold transition-all active:scale-95 shadow-sm",
                c.clase,
                c.bg,
                corriendo ? "cursor-pointer" : "opacity-40 cursor-default",
              )}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full space-y-2">
        <Button
          className="w-full rounded-full shadow-lg h-12 text-base font-semibold"
          onClick={() => {
            setAciertos(0);
            setFallos(0);
            setSegundos(45);
            setRonda(rondaStroop());
            setCorriendo(true);
          }}
        >
          {corriendo ? "Reiniciar ronda" : "Empezar (45 s)"}
        </Button>
        <p className="text-center text-[0.7rem] text-muted-foreground">
          Pulsa el <strong>color de la tinta</strong>, no la palabra escrita.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   4. CÁLCULO RÁPIDO (Agilidad Mental)
───────────────────────────────────────────────────────────── */

function nuevaOperacion() {
  const ops = ["+", "−", "×"] as const;
  const op = ops[Math.floor(Math.random() * ops.length)]!;
  const a = op === "×" ? 2 + Math.floor(Math.random() * 11) : 5 + Math.floor(Math.random() * 45);
  const b = op === "×" ? 2 + Math.floor(Math.random() * 9) : 2 + Math.floor(Math.random() * 40);
  const res = op === "+" ? a + b : op === "−" ? a - b : a * b;
  const opciones = new Set<number>([res]);
  while (opciones.size < 4) {
    const delta = Math.floor(Math.random() * 12) - 6;
    if (delta !== 0) opciones.add(res + delta);
  }
  return {
    texto: `${a} ${op} ${b}`,
    res,
    opciones: [...opciones].sort(() => Math.random() - 0.5),
  };
}

export function CalculoGame({ registrar }: { registrar: Registrar }) {
  const [op, setOp] = useState(nuevaOperacion);
  const [aciertos, setAciertos] = useState(0);
  const [fallos, setFallos] = useState(0);
  const [segundos, setSegundos] = useState(60);
  const [corriendo, setCorriendo] = useState(false);

  useEffect(() => {
    if (!corriendo) return;
    const t = window.setInterval(() => setSegundos((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [corriendo]);

  useEffect(() => {
    if (corriendo && segundos === 0) {
      setCorriendo(false);
      getAudioEngine().chime(660, 0.5);
      registrar("agilidad_calculo", 1, { aciertos, fallos });
    }
  }, [segundos, corriendo, aciertos, fallos, registrar]);

  const precision = useMemo(
    () => (aciertos + fallos ? Math.round((aciertos / (aciertos + fallos)) * 100) : 0),
    [aciertos, fallos],
  );

  const responder = (v: number) => {
    if (!corriendo) return;
    if (v === op.res) {
      setAciertos((a) => a + 1);
      getAudioEngine().chime(784, 0.12);
    } else {
      setFallos((f) => f + 1);
      getAudioEngine().chime(200, 0.2);
    }
    setOp(nuevaOperacion());
  };

  return (
    <div className="flex flex-col items-center justify-between h-full w-full max-w-sm mx-auto py-2 touch-none select-none">
      <Marcador
        items={[
          ["Aciertos", String(aciertos)],
          ["Precisión", `${precision}%`],
          ["Tiempo", `${segundos}s`],
        ]}
      />

      <div className="w-full my-auto space-y-3">
        {/* Cuadro flotante de aviso de turno */}
        <div className="h-10 flex items-center justify-center">
          {corriendo ? (
            <CuadroFlotanteTurno
              variante="turno"
              texto="🧠 ¡Te toca a ti!"
              subtexto="Calcula rápido"
            />
          ) : segundos === 0 ? (
            <CuadroFlotanteTurno
              variante="exito"
              texto="⏱️ ¡Ronda finalizada!"
              subtexto={`${aciertos} aciertos (${precision}%)`}
            />
          ) : (
            <CuadroFlotanteTurno
              variante="info"
              texto="Agilidad de Cálculo"
              subtexto="60 segundos"
            />
          )}
        </div>

        <Progress value={(segundos / 60) * 100} className="h-1.5" />

        <div className="flex h-28 items-center justify-center rounded-3xl border-2 border-border/80 bg-secondary/40 shadow-inner">
          <span className="font-display text-5xl font-bold tabular-nums text-foreground">
            {op.texto}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {op.opciones.map((v) => (
            <button
              key={v}
              onClick={() => responder(v)}
              disabled={!corriendo}
              className={cn(
                "rounded-2xl border-2 border-border bg-secondary/70 py-3.5 font-display text-2xl font-bold tabular-nums transition-all active:scale-95 shadow-sm",
                corriendo
                  ? "hover:border-primary hover:bg-primary/10 cursor-pointer"
                  : "opacity-40 cursor-default",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full space-y-2">
        <Button
          className="w-full rounded-full shadow-lg h-12 text-base font-semibold"
          onClick={() => {
            setAciertos(0);
            setFallos(0);
            setSegundos(60);
            setOp(nuevaOperacion());
            setCorriendo(true);
          }}
        >
          {corriendo ? "Reiniciar ronda" : "Empezar (60 s)"}
        </Button>
        <p className="text-center text-[0.7rem] text-muted-foreground">
          Calcula mentalmente y pulsa el resultado correcto a gran velocidad.
        </p>
      </div>
    </div>
  );
}

export const MindGamesIcon = Brain;

export { TrainSwitchGame, TrainSwitchGame as TrenesGame } from "./TrainSwitchGame";
