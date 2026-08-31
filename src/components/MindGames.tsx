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
  HelpCircle,
  Play,
  ArrowRight,
  Award,
  CheckCircle2,
  GitFork,
  Timer,
  Shuffle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getAudioEngine } from "@/lib/audio-engine";
import { cn } from "@/lib/utils";
import { TrainSwitchGame } from "./TrainSwitchGame";

export type Registrar = (
  ejercicio: string,
  minutos: number,
  detalle: Record<string, unknown>,
) => void;

export function Marcador({ items }: { items: [string, string][] }) {
  return (
    <div className="flex justify-center gap-5 select-none">
      {items.map(([label, value]) => (
        <div key={label} className="text-center">
          <p className="font-display text-xl sm:text-2xl tabular-nums text-foreground font-bold">
            {value}
          </p>
          <p className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">{label}</p>
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
   1. SECUENCIA (Simon - Con Niveles Finitos)
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

export function SecuenciaGame({
  registrar,
  onGameComplete,
}: {
  registrar: Registrar;
  onGameComplete?: (stats: { puntos: number; aciertos: number; tiempoSegundos: number }) => void;
}) {
  const [nivel, setNivel] = useState(1);
  const [seq, setSeq] = useState<number[]>([]);
  const [paso, setPaso] = useState(0);
  const [activa, setActiva] = useState<number | null>(null);
  const [fase, setFase] = useState<
    "idle" | "ver" | "jugar" | "nivel_superado" | "victoria" | "fin"
  >("idle");
  const [puntos, setPuntos] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const timers = useRef<number[]>([]);
  const startRef = useRef(Date.now());

  // Metas de longitud según el nivel
  const metaLongitud = nivel === 1 ? 4 : nivel === 2 ? 6 : 8;

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
        }, i * 600),
      );
      timers.current.push(window.setTimeout(() => setActiva(null), i * 600 + 380));
    });
    timers.current.push(
      window.setTimeout(
        () => {
          setFase("jugar");
          setPaso(0);
        },
        s.length * 600 + 200,
      ),
    );
  }, []);

  const siguienteRonda = (base: number[]) => {
    const s = [...base, Math.floor(Math.random() * 4)];
    setSeq(s);
    mostrar(s);
  };

  const iniciarNivel = (n = nivel) => {
    setNivel(n);
    setPaso(0);
    setSeq([]);
    siguienteRonda([]);
  };

  const pulsar = (i: number) => {
    if (fase !== "jugar") return;
    getAudioEngine().chime(CELDAS[i]!.tono, 0.2);
    setActiva(i);
    window.setTimeout(() => setActiva(null), 180);

    if (seq[paso] === i) {
      if (paso + 1 === seq.length) {
        // Ronda superada
        const nuevosAciertos = aciertos + 1;
        setAciertos(nuevosAciertos);
        const pts = puntos + seq.length * 50;
        setPuntos(pts);

        if (seq.length >= metaLongitud) {
          // Meta del nivel alcanzada
          getAudioEngine().chime(880, 0.3);
          window.setTimeout(() => getAudioEngine().chime(1175, 0.4), 150);

          if (nivel < 3) {
            setFase("nivel_superado");
          } else {
            setFase("victoria");
            const tiempo = Math.round((Date.now() - startRef.current) / 1000);
            registrar("memoria_secuencia", Math.max(1, Math.round(tiempo / 60)), {
              puntos: pts + 500,
              aciertos: nuevosAciertos,
              nivel,
            });
            if (onGameComplete) {
              onGameComplete({
                puntos: pts + 500,
                aciertos: nuevosAciertos,
                tiempoSegundos: tiempo,
              });
            }
          }
        } else {
          window.setTimeout(() => siguienteRonda(seq), 600);
        }
      } else {
        setPaso(paso + 1);
      }
    } else {
      setFase("fin");
      getAudioEngine().chime(180, 0.5);
      registrar("memoria_secuencia", 1, { nivel, puntos, fallado: seq.length });
    }
  };

  return (
    <div className="flex flex-col items-center justify-between h-full w-full max-w-sm mx-auto py-2 touch-none select-none">
      <Marcador
        items={[
          ["Nivel", `${nivel}/3`],
          ["Secuencia", `${seq.length}/${metaLongitud}`],
          ["Puntos", String(puntos)],
        ]}
      />

      <div className="w-full px-4">
        <Progress value={(seq.length / metaLongitud) * 100} className="h-1.5" />
      </div>

      <div className="relative my-auto flex flex-col items-center justify-center w-full">
        <div className="h-10 mb-3 flex items-center justify-center">
          {fase === "ver" && (
            <CuadroFlotanteTurno
              variante="observa"
              texto="👀 Observa la secuencia..."
              subtexto={`Paso ${seq.length}`}
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
              texto="❌ Fin del intento"
              subtexto={`Puntos: ${puntos}`}
            />
          )}
          {fase === "idle" && (
            <CuadroFlotanteTurno
              variante="info"
              texto="Memoria de Trabajo"
              subtexto={`Meta: Secuencia de ${metaLongitud}`}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3.5 w-full max-w-[280px] sm:max-w-[320px] aspect-square">
          {CELDAS.map((c, i) => (
            <button
              key={i}
              onClick={() => pulsar(i)}
              disabled={fase !== "jugar"}
              className={cn(
                "aspect-square rounded-3xl border-2 transition-all duration-150 active:scale-95 cursor-pointer",
                activa === i ? `${c.on} scale-95 ring-4 ring-foreground/20` : c.bg,
                fase === "jugar" ? "hover:opacity-90" : "opacity-75 cursor-default",
              )}
            />
          ))}
        </div>

        {/* Modal de Nivel Superado / Victoria */}
        {(fase === "nivel_superado" || fase === "victoria") && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 z-20 space-y-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-display text-2xl font-bold text-foreground">
                {fase === "victoria" ? "¡Sesión Completada!" : `¡Nivel ${nivel} Superado!`}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Completaste la secuencia de {metaLongitud} pasos con precisión.
              </p>
            </div>
            <div className="bg-secondary/70 p-3 rounded-2xl border border-border/80 w-full text-center">
              <p className="text-[0.65rem] uppercase text-muted-foreground font-semibold">Puntos</p>
              <p className="font-display text-2xl font-bold text-primary">{puntos}</p>
            </div>
            {fase === "nivel_superado" ? (
              <Button
                onClick={() => iniciarNivel(nivel + 1)}
                className="w-full rounded-full h-11 font-semibold"
              >
                <ArrowRight className="h-4 w-4 mr-2" /> Avanzar a Nivel {nivel + 1}
              </Button>
            ) : (
              <Button
                onClick={() => iniciarNivel(1)}
                className="w-full rounded-full h-11 font-semibold"
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Jugar de nuevo
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="w-full space-y-2">
        <Button
          className="w-full rounded-full shadow-lg h-12 text-base font-semibold"
          variant={fase === "idle" || fase === "fin" ? "default" : "secondary"}
          onClick={() => {
            setPuntos(0);
            setAciertos(0);
            startRef.current = Date.now();
            iniciarNivel(1);
          }}
        >
          {fase === "idle" ? "Empezar entrenamiento" : "Reiniciar nivel"}
        </Button>
        <p className="text-center text-[0.7rem] text-muted-foreground">
          Memoriza y repite secuencias crecientes para subir de nivel.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   2. PAREJAS (Memoria Visual - Con Niveles Finitos)
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

export function ParejasGame({
  registrar,
  onGameComplete,
}: {
  registrar: Registrar;
  onGameComplete?: (stats: { puntos: number; aciertos: number; tiempoSegundos: number }) => void;
}) {
  const [nivel, setNivel] = useState(1);
  const pares = nivel === 1 ? 4 : nivel === 2 ? 6 : 6;
  const [cartas, setCartas] = useState(() => crearTablero(pares));
  const [abiertas, setAbiertas] = useState<number[]>([]);
  const [hechas, setHechas] = useState<number[]>([]);
  const [movs, setMovs] = useState(0);
  const [puntos, setPuntos] = useState(0);
  const startRef = useRef(Date.now());

  const completo = hechas.length === cartas.length && cartas.length > 0;

  useEffect(() => {
    if (completo) {
      getAudioEngine().chime(880, 0.4);
      const bonusPts = Math.max(100, 500 - movs * 25);
      const ptsTotales = puntos + bonusPts;
      setPuntos(ptsTotales);

      const tiempo = Math.round((Date.now() - startRef.current) / 1000);
      registrar("memoria_parejas", Math.max(1, Math.round(tiempo / 60)), {
        movimientos: movs,
        nivel,
        puntos: ptsTotales,
      });

      if (nivel >= 2 && onGameComplete) {
        onGameComplete({ puntos: ptsTotales, aciertos: pares, tiempoSegundos: tiempo });
      }
    }
  }, [completo]);

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
        window.setTimeout(() => setAbiertas([]), 700);
      }
    }
  };

  const iniciarNivel = (n: number) => {
    setNivel(n);
    const p = n === 1 ? 4 : 6;
    setCartas(crearTablero(p));
    setAbiertas([]);
    setHechas([]);
    setMovs(0);
  };

  return (
    <div className="flex flex-col items-center justify-between h-full w-full max-w-sm mx-auto py-2 touch-none select-none">
      <Marcador
        items={[
          ["Nivel", `${nivel}/2`],
          ["Movimientos", String(movs)],
          ["Parejas", `${hechas.length / 2}/${pares}`],
        ]}
      />

      <div className="relative my-auto flex flex-col items-center justify-center w-full">
        <div className="h-10 mb-2 flex items-center justify-center">
          {completo ? (
            <CuadroFlotanteTurno
              variante="exito"
              texto="🎉 ¡Tablero Completado!"
              subtexto={`${movs} movimientos`}
            />
          ) : (
            <CuadroFlotanteTurno
              variante="turno"
              texto="✨ ¡Te toca a ti!"
              subtexto={`Encuentra ${pares} parejas`}
            />
          )}
        </div>

        <div className={cn("grid gap-2.5 w-full", pares === 4 ? "grid-cols-4" : "grid-cols-4")}>
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
                  "flex aspect-square items-center justify-center rounded-2xl border-2 transition-all duration-300 active:scale-95 shadow-sm cursor-pointer",
                  isFlipped
                    ? cn(
                        c.item.bgClass,
                        c.item.borderClass,
                        isMatched ? "opacity-90 ring-2 ring-primary/40" : "",
                      )
                    : "border-border/80 bg-secondary/80 hover:bg-secondary hover:border-primary/40",
                )}
              >
                {isFlipped ? (
                  <IconComp className={cn("h-7 w-7", c.item.colorClass)} strokeWidth={2.2} />
                ) : (
                  <HelpCircle className="h-5 w-5 text-muted-foreground/40" />
                )}
              </button>
            );
          })}
        </div>

        {/* Modal de Nivel Superado */}
        {completo && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 z-20 space-y-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-display text-2xl font-bold text-foreground">
                {nivel === 1 ? "¡Nivel 1 Completado!" : "¡Victoria de Memoria!"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">{movs} movimientos realizados.</p>
            </div>
            {nivel === 1 ? (
              <Button
                onClick={() => iniciarNivel(2)}
                className="w-full rounded-full h-11 font-semibold"
              >
                <ArrowRight className="h-4 w-4 mr-2" /> Avanzar a Nivel 2 (12 cartas)
              </Button>
            ) : (
              <Button
                onClick={() => iniciarNivel(1)}
                className="w-full rounded-full h-11 font-semibold"
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Jugar de nuevo
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="w-full space-y-2">
        <Button
          variant="secondary"
          className="w-full rounded-full shadow-md h-11"
          onClick={() => iniciarNivel(nivel)}
        >
          <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar nivel
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   3. STROOP (Control Inhibitorio - Con Meta Finita de Aciertos)
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

export function StroopGame({
  registrar,
  onGameComplete,
}: {
  registrar: Registrar;
  onGameComplete?: (stats: { puntos: number; aciertos: number; tiempoSegundos: number }) => void;
}) {
  const metaAciertos = 15;
  const [ronda, setRonda] = useState(rondaStroop);
  const [aciertos, setAciertos] = useState(0);
  const [fallos, setFallos] = useState(0);
  const [segundos, setSegundos] = useState(35);
  const [corriendo, setCorriendo] = useState(false);
  const [completado, setCompletado] = useState(false);

  useEffect(() => {
    if (!corriendo || completado) return;
    const t = window.setInterval(() => {
      setSegundos((s) => {
        if (s <= 1) {
          setCorriendo(false);
          getAudioEngine().chime(200, 0.4);
          registrar("atencion_stroop", 1, { aciertos, fallos });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [corriendo, completado, aciertos, fallos, registrar]);

  const responder = (i: number) => {
    if (!corriendo || completado) return;
    if (i === ronda.tinta) {
      const nuevosAciertos = aciertos + 1;
      setAciertos(nuevosAciertos);
      getAudioEngine().chime(784, 0.12);

      if (nuevosAciertos >= metaAciertos) {
        setCompletado(true);
        setCorriendo(false);
        getAudioEngine().chime(880, 0.3);
        const pts = nuevosAciertos * 80 + segundos * 15;
        registrar("atencion_stroop", 1, { aciertos: nuevosAciertos, fallos, puntos: pts });
        if (onGameComplete) {
          onGameComplete({ puntos: pts, aciertos: nuevosAciertos, tiempoSegundos: 35 - segundos });
        }
      }
    } else {
      setFallos((f) => f + 1);
      getAudioEngine().chime(200, 0.2);
    }
    setRonda(rondaStroop());
  };

  const iniciar = () => {
    setAciertos(0);
    setFallos(0);
    setSegundos(35);
    setCompletado(false);
    setRonda(rondaStroop());
    setCorriendo(true);
  };

  return (
    <div className="flex flex-col items-center justify-between h-full w-full max-w-sm mx-auto py-2 touch-none select-none">
      <Marcador
        items={[
          ["Aciertos", `${aciertos}/${metaAciertos}`],
          ["Fallos", String(fallos)],
          ["Tiempo", `${segundos}s`],
        ]}
      />

      <div className="w-full px-4">
        <Progress value={(aciertos / metaAciertos) * 100} className="h-1.5" />
      </div>

      <div className="relative w-full my-auto space-y-3">
        <div className="h-10 flex items-center justify-center">
          {completado ? (
            <CuadroFlotanteTurno
              variante="exito"
              texto="🏆 ¡Meta Alcanzada!"
              subtexto={`${aciertos} aciertos`}
            />
          ) : corriendo ? (
            <CuadroFlotanteTurno
              variante="turno"
              texto="⚡ ¡Color de la TINTA!"
              subtexto={`Meta: ${metaAciertos}`}
            />
          ) : (
            <CuadroFlotanteTurno
              variante="info"
              texto="Control Inhibitorio"
              subtexto={`Llega a ${metaAciertos} aciertos`}
            />
          )}
        </div>

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
              disabled={!corriendo || completado}
              className={cn(
                "rounded-2xl border-2 py-3.5 text-base font-bold transition-all active:scale-95 shadow-sm",
                c.clase,
                c.bg,
                corriendo && !completado ? "cursor-pointer" : "opacity-40 cursor-default",
              )}
            >
              {c.nombre}
            </button>
          ))}
        </div>

        {completado && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 z-20 space-y-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Award className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-display text-2xl font-bold text-foreground">
                ¡Desafío Stroop Completado!
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Lograste los {metaAciertos} aciertos con {fallos} fallos.
              </p>
            </div>
            <Button onClick={iniciar} className="w-full rounded-full h-11 font-semibold">
              <RotateCcw className="h-4 w-4 mr-2" /> Jugar de nuevo
            </Button>
          </div>
        )}
      </div>

      <div className="w-full space-y-2">
        <Button
          className="w-full rounded-full shadow-lg h-12 text-base font-semibold"
          onClick={iniciar}
        >
          {corriendo ? "Reiniciar intento" : "Empezar desafío (15 aciertos)"}
        </Button>
        <p className="text-center text-[0.7rem] text-muted-foreground">
          Pulsa el <strong>color de la tinta</strong>, ignora la palabra.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   4. CÁLCULO RÁPIDO (Agilidad Mental - Con Meta Finita)
───────────────────────────────────────────────────────────── */

function nuevaOperacion(nivel: number) {
  const ops = nivel === 1 ? ["+", "−"] : ["+", "−", "×"];
  const op = ops[Math.floor(Math.random() * ops.length)]!;
  const a = op === "×" ? 2 + Math.floor(Math.random() * 9) : 5 + Math.floor(Math.random() * 40);
  const b = op === "×" ? 2 + Math.floor(Math.random() * 9) : 2 + Math.floor(Math.random() * 30);
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

export function CalculoGame({
  registrar,
  onGameComplete,
}: {
  registrar: Registrar;
  onGameComplete?: (stats: { puntos: number; aciertos: number; tiempoSegundos: number }) => void;
}) {
  const metaAciertos = 12;
  const [nivel, setNivel] = useState(1);
  const [op, setOp] = useState(() => nuevaOperacion(1));
  const [aciertos, setAciertos] = useState(0);
  const [fallos, setFallos] = useState(0);
  const [segundos, setSegundos] = useState(45);
  const [corriendo, setCorriendo] = useState(false);
  const [completado, setCompletado] = useState(false);

  useEffect(() => {
    if (!corriendo || completado) return;
    const t = window.setInterval(() => {
      setSegundos((s) => {
        if (s <= 1) {
          setCorriendo(false);
          getAudioEngine().chime(200, 0.4);
          registrar("agilidad_calculo", 1, { aciertos, fallos });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [corriendo, completado, aciertos, fallos, registrar]);

  const responder = (v: number) => {
    if (!corriendo || completado) return;
    if (v === op.res) {
      const nuevosAciertos = aciertos + 1;
      setAciertos(nuevosAciertos);
      getAudioEngine().chime(784, 0.12);

      if (nuevosAciertos >= metaAciertos) {
        setCompletado(true);
        setCorriendo(false);
        getAudioEngine().chime(880, 0.3);
        const pts = nuevosAciertos * 100 + segundos * 15;
        registrar("agilidad_calculo", 1, { aciertos: nuevosAciertos, fallos, puntos: pts });
        if (onGameComplete) {
          onGameComplete({ puntos: pts, aciertos: nuevosAciertos, tiempoSegundos: 45 - segundos });
        }
      }
    } else {
      setFallos((f) => f + 1);
      getAudioEngine().chime(200, 0.2);
    }
    setOp(nuevaOperacion(nivel));
  };

  const iniciar = () => {
    setAciertos(0);
    setFallos(0);
    setSegundos(45);
    setCompletado(false);
    setOp(nuevaOperacion(nivel));
    setCorriendo(true);
  };

  return (
    <div className="flex flex-col items-center justify-between h-full w-full max-w-sm mx-auto py-2 touch-none select-none">
      <Marcador
        items={[
          ["Aciertos", `${aciertos}/${metaAciertos}`],
          ["Fallos", String(fallos)],
          ["Tiempo", `${segundos}s`],
        ]}
      />

      <div className="w-full px-4">
        <Progress value={(aciertos / metaAciertos) * 100} className="h-1.5" />
      </div>

      <div className="relative w-full my-auto space-y-3">
        <div className="h-10 flex items-center justify-center">
          {completado ? (
            <CuadroFlotanteTurno
              variante="exito"
              texto="🧠 ¡Cálculo Superado!"
              subtexto={`${aciertos} aciertos`}
            />
          ) : corriendo ? (
            <CuadroFlotanteTurno
              variante="turno"
              texto="⚡ ¡Calcula rápido!"
              subtexto={`Meta: ${metaAciertos}`}
            />
          ) : (
            <CuadroFlotanteTurno
              variante="info"
              texto="Agilidad de Cálculo"
              subtexto={`Meta: ${metaAciertos} operaciones`}
            />
          )}
        </div>

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
              disabled={!corriendo || completado}
              className={cn(
                "rounded-2xl border-2 border-border bg-secondary/70 py-3.5 font-display text-2xl font-bold tabular-nums transition-all active:scale-95 shadow-sm",
                corriendo && !completado
                  ? "hover:border-primary hover:bg-primary/10 cursor-pointer"
                  : "opacity-40 cursor-default",
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {completado && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 z-20 space-y-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Award className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-display text-2xl font-bold text-foreground">
                ¡Cálculo Completado!
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {metaAciertos} operaciones en {45 - segundos}s.
              </p>
            </div>
            <Button onClick={iniciar} className="w-full rounded-full h-11 font-semibold">
              <RotateCcw className="h-4 w-4 mr-2" /> Jugar de nuevo
            </Button>
          </div>
        )}
      </div>

      <div className="w-full space-y-2">
        <Button
          className="w-full rounded-full shadow-lg h-12 text-base font-semibold"
          onClick={iniciar}
        >
          {corriendo ? "Reiniciar ronda" : "Empezar (12 operaciones)"}
        </Button>
        <p className="text-center text-[0.7rem] text-muted-foreground">
          Calcula mentalmente y pulsa el resultado a máxima velocidad.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   5. CIRCUITO MENTAL ALEATORIO (Entrenamiento Diario Completo)
───────────────────────────────────────────────────────────── */

type GameType = "trenes" | "parejas" | "secuencia" | "stroop" | "calculo";

const JUEGOS_DISPONIBLES: { id: GameType; titulo: string; icon: ElementType }[] = [
  { id: "trenes", titulo: "Cruce de Vías", icon: GitFork },
  { id: "secuencia", titulo: "Memoria de Secuencia", icon: Grid3x3 },
  { id: "parejas", titulo: "Memoria Visual", icon: Eye },
  { id: "stroop", titulo: "Control Stroop", icon: Palette },
  { id: "calculo", titulo: "Agilidad de Cálculo", icon: Calculator },
];

export function CircuitoMental({
  registrar,
  onFinalizar,
}: {
  registrar: Registrar;
  onFinalizar: () => void;
}) {
  // Elegir 3 juegos aleatorios distintos
  const [circuito] = useState<GameType[]>(() => {
    const barajados = [...JUEGOS_DISPONIBLES].sort(() => Math.random() - 0.5);
    return [barajados[0]!.id, barajados[1]!.id, barajados[2]!.id];
  });

  const [indiceActual, setIndiceActual] = useState(0);
  const [faseCircuito, setFaseCircuito] = useState<"jugando" | "transicion" | "resumen">("jugando");
  const [puntosTotales, setPuntosTotales] = useState(0);
  const [aciertosTotales, setAciertosTotales] = useState(0);
  const [ultimoResultado, setUltimoResultado] = useState<{
    puntos: number;
    aciertos: number;
  } | null>(null);
  const startCircuitRef = useRef(Date.now());

  const juegoActualId = circuito[indiceActual]!;
  const juegoActualInfo = JUEGOS_DISPONIBLES.find((j) => j.id === juegoActualId)!;

  const handleGameComplete = (stats: {
    puntos: number;
    aciertos: number;
    tiempoSegundos: number;
  }) => {
    setPuntosTotales((p) => p + stats.puntos);
    setAciertosTotales((a) => a + stats.aciertos);
    setUltimoResultado({ puntos: stats.puntos, aciertos: stats.aciertos });

    if (indiceActual + 1 < circuito.length) {
      setFaseCircuito("transicion");
    } else {
      setFaseCircuito("resumen");
      const duracionMin = Math.max(1, Math.round((Date.now() - startCircuitRef.current) / 60000));
      registrar("circuito_mental_diario", duracionMin, {
        puntos: puntosTotales + stats.puntos,
        aciertos: aciertosTotales + stats.aciertos,
        juegos: circuito,
      });
    }
  };

  const avanzarSiguiente = () => {
    setIndiceActual((i) => i + 1);
    setFaseCircuito("jugando");
  };

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto py-2 select-none">
      {/* Cabecera del Circuito */}
      <div className="w-full flex items-center justify-between px-4 py-2 bg-secondary/80 rounded-2xl border border-border/80 mb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <Shuffle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[0.62rem] uppercase tracking-wider text-muted-foreground font-semibold">
              Circuito Diario
            </p>
            <p className="font-display text-xs font-bold text-foreground">
              Desafío {indiceActual + 1} de {circuito.length}: {juegoActualInfo.titulo}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[0.62rem] uppercase tracking-wider text-muted-foreground font-semibold">
            Puntos Totales
          </p>
          <p className="font-display text-sm font-bold text-primary">{puntosTotales} pts</p>
        </div>
      </div>

      {/* Progreso del Circuito */}
      <div className="w-full px-1 mb-2">
        <Progress
          value={((indiceActual + (faseCircuito === "transicion" ? 1 : 0)) / circuito.length) * 100}
          className="h-1.5"
        />
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 overflow-hidden relative flex flex-col justify-center">
        {faseCircuito === "jugando" && (
          <>
            {juegoActualId === "trenes" && (
              <TrainSwitchGame
                registrar={registrar}
                dificultadInicial="facil"
                onGameComplete={handleGameComplete}
              />
            )}
            {juegoActualId === "secuencia" && (
              <SecuenciaGame registrar={registrar} onGameComplete={handleGameComplete} />
            )}
            {juegoActualId === "parejas" && (
              <ParejasGame registrar={registrar} onGameComplete={handleGameComplete} />
            )}
            {juegoActualId === "stroop" && (
              <StroopGame registrar={registrar} onGameComplete={handleGameComplete} />
            )}
            {juegoActualId === "calculo" && (
              <CalculoGame registrar={registrar} onGameComplete={handleGameComplete} />
            )}
          </>
        )}

        {/* Pantalla de Transición entre Juegos */}
        {faseCircuito === "transicion" && (
          <div className="flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 space-y-5">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <div>
              <h3 className="font-display text-2xl font-bold text-foreground">
                ¡Desafío {indiceActual + 1} Superado!
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                +{ultimoResultado?.puntos} puntos sumados al entrenamiento.
              </p>
            </div>

            <div className="bg-secondary/70 p-4 rounded-2xl border border-border/80 w-full max-w-xs text-left space-y-2">
              <p className="text-[0.68rem] uppercase text-muted-foreground font-semibold">
                Siguiente Desafío:
              </p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  {(() => {
                    const NextIcon = JUEGOS_DISPONIBLES.find(
                      (j) => j.id === circuito[indiceActual + 1],
                    )!.icon;
                    return <NextIcon className="h-5 w-5" />;
                  })()}
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-foreground">
                    {JUEGOS_DISPONIBLES.find((j) => j.id === circuito[indiceActual + 1])!.titulo}
                  </p>
                  <p className="text-[0.68rem] text-muted-foreground">
                    Fase {indiceActual + 2} de {circuito.length}
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={avanzarSiguiente}
              className="w-full max-w-xs rounded-full h-12 text-base font-semibold shadow-lg"
            >
              <ArrowRight className="h-5 w-5 mr-2" /> Continuar al Desafío {indiceActual + 2}
            </Button>
          </div>
        )}

        {/* Resumen Final del Circuito */}
        {faseCircuito === "resumen" && (
          <div className="flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 space-y-5">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg">
              <Award className="h-9 w-9" />
            </div>
            <div>
              <h3 className="font-display text-2xl font-bold text-foreground">
                ¡Circuito Diario Completado!
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Completaste los 3 desafíos cognitivos del día con éxito.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-secondary/70 p-4 rounded-2xl border border-border/80 w-full max-w-xs text-left">
              <div>
                <p className="text-[0.65rem] uppercase text-muted-foreground font-semibold">
                  Puntuación Total
                </p>
                <p className="font-display text-2xl font-bold text-primary">{puntosTotales}</p>
              </div>
              <div>
                <p className="text-[0.65rem] uppercase text-muted-foreground font-semibold">
                  Desafíos
                </p>
                <p className="font-display text-2xl font-bold text-emerald-400">3 de 3</p>
              </div>
            </div>

            <Button
              onClick={onFinalizar}
              className="w-full max-w-xs rounded-full h-12 text-base font-semibold shadow-lg"
            >
              <CheckCircle2 className="h-5 w-5 mr-2" /> Finalizar Entrenamiento
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export const MindGamesIcon = Brain;
export { TrainSwitchGame, TrainSwitchGame as TrenesGame } from "./TrainSwitchGame";
