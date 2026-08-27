import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brain, Grid3x3, Palette, Calculator, Eye, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getAudioEngine } from "@/lib/audio-engine";

type Registrar = (ejercicio: string, minutos: number, detalle: Record<string, unknown>) => void;

const JUEGOS = [
  { id: "secuencia", label: "Secuencia", icon: Grid3x3, desc: "Memoria de trabajo" },
  { id: "parejas", label: "Parejas", icon: Eye, desc: "Memoria visual" },
  { id: "stroop", label: "Stroop", icon: Palette, desc: "Control inhibitorio" },
  { id: "calculo", label: "Cálculo", icon: Calculator, desc: "Agilidad mental" },
] as const;

type JuegoId = (typeof JUEGOS)[number]["id"];

export function MindGames({ registrar }: { registrar: Registrar }) {
  const [juego, setJuego] = useState<JuegoId>("secuencia");

  return (
    <div className="surface-panel space-y-5 p-5">
      <div>
        <h2 className="font-display text-xl">Ejercicios mentales</h2>
        <p className="text-xs text-muted-foreground">
          Entrenamientos visuales y breves: memoria, atención y agilidad.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {JUEGOS.map((j) => {
          const activo = j.id === juego;
          return (
            <button
              key={j.id}
              onClick={() => setJuego(j.id)}
              className={
                "flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition-colors " +
                (activo
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground")
              }
            >
              <j.icon className="h-4 w-4" />
              <span className="text-[0.65rem] font-medium">{j.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[0.7rem] text-muted-foreground">
        {JUEGOS.find((j) => j.id === juego)?.desc}
      </p>

      {juego === "secuencia" ? <Secuencia registrar={registrar} /> : null}
      {juego === "parejas" ? <Parejas registrar={registrar} /> : null}
      {juego === "stroop" ? <Stroop registrar={registrar} /> : null}
      {juego === "calculo" ? <Calculo registrar={registrar} /> : null}
    </div>
  );
}

function Marcador({ items }: { items: [string, string][] }) {
  return (
    <div className="flex justify-center gap-6">
      {items.map(([label, value]) => (
        <div key={label} className="text-center">
          <p className="font-display text-2xl tabular-nums">{value}</p>
          <p className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

/* ── 1. Secuencia (Simon) ───────────────────────────────── */

const CELDAS = [
  { bg: "bg-primary/70", on: "bg-primary", tono: 523 },
  { bg: "bg-accent/60", on: "bg-accent", tono: 659 },
  { bg: "bg-secondary", on: "bg-primary/60", tono: 784 },
  { bg: "bg-muted", on: "bg-accent/80", tono: 880 },
];

function Secuencia({ registrar }: { registrar: Registrar }) {
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
        }, i * 700),
      );
      timers.current.push(window.setTimeout(() => setActiva(null), i * 700 + 420));
    });
    timers.current.push(
      window.setTimeout(() => {
        setFase("jugar");
        setPaso(0);
      }, s.length * 700 + 200),
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
    <div className="space-y-4">
      <Marcador
        items={[
          ["Nivel", String(seq.length)],
          ["Mejor", String(mejor)],
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        {CELDAS.map((c, i) => (
          <button
            key={i}
            onClick={() => pulsar(i)}
            disabled={fase !== "jugar"}
            className={
              "aspect-square rounded-3xl border border-border/60 transition-all duration-150 " +
              (activa === i ? `${c.on} scale-95 shadow-lg` : c.bg) +
              (fase === "jugar" ? " cursor-pointer" : " opacity-80")
            }
          />
        ))}
      </div>
      {fase === "fin" ? (
        <p className="text-center text-sm text-muted-foreground">
          Fallaste en el nivel {seq.length}. Buen intento.
        </p>
      ) : null}
      <Button
        className="w-full rounded-full"
        variant={fase === "idle" || fase === "fin" ? "default" : "secondary"}
        onClick={() => {
          setMejor((m) => Math.max(m, 0));
          setSeq([]);
          siguienteRonda([]);
        }}
      >
        {fase === "idle" ? "Empezar" : fase === "fin" ? "Reintentar" : "Reiniciar"}
      </Button>
      <p className="text-center text-[0.7rem] text-muted-foreground">
        Observa la secuencia y repítela en el mismo orden.
      </p>
    </div>
  );
}

/* ── 2. Parejas ─────────────────────────────────────────── */

const EMOJIS = ["🌊", "🌙", "🔥", "🌿", "⭐", "🪷", "☁️", "🌀"];

function nuevoTablero(pares: number) {
  const base = EMOJIS.slice(0, pares);
  return [...base, ...base]
    .map((v) => ({ v, k: Math.random() }))
    .sort((a, b) => a.k - b.k)
    .map((c, i) => ({ id: i, v: c.v }));
}

function Parejas({ registrar }: { registrar: Registrar }) {
  const [pares] = useState(6);
  const [cartas, setCartas] = useState(() => nuevoTablero(pares));
  const [abiertas, setAbiertas] = useState<number[]>([]);
  const [hechas, setHechas] = useState<number[]>([]);
  const [movs, setMovs] = useState(0);

  const completo = hechas.length === cartas.length;

  useEffect(() => {
    if (completo && cartas.length) {
      getAudioEngine().chime(880, 0.6);
      registrar("memoria_parejas", 3, { movimientos: movs, pares });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completo]);

  const voltear = (id: number) => {
    if (abiertas.includes(id) || hechas.includes(id) || abiertas.length === 2) return;
    const nuevas = [...abiertas, id];
    setAbiertas(nuevas);
    getAudioEngine().chime(600, 0.15);
    if (nuevas.length === 2) {
      setMovs((m) => m + 1);
      const [a, b] = nuevas;
      const va = cartas.find((c) => c.id === a)!.v;
      const vb = cartas.find((c) => c.id === b)!.v;
      if (va === vb) {
        setHechas((h) => [...h, a!, b!]);
        setAbiertas([]);
        getAudioEngine().chime(784, 0.3);
      } else {
        window.setTimeout(() => setAbiertas([]), 750);
      }
    }
  };

  const reiniciar = () => {
    setCartas(nuevoTablero(pares));
    setAbiertas([]);
    setHechas([]);
    setMovs(0);
  };

  return (
    <div className="space-y-4">
      <Marcador
        items={[
          ["Movimientos", String(movs)],
          ["Pares", `${hechas.length / 2}/${pares}`],
        ]}
      />
      <div className="grid grid-cols-4 gap-2">
        {cartas.map((c) => {
          const visible = abiertas.includes(c.id) || hechas.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => voltear(c.id)}
              className={
                "flex aspect-square items-center justify-center rounded-2xl border text-2xl transition-all duration-200 " +
                (visible
                  ? "border-primary/50 bg-primary/10"
                  : "border-border bg-secondary text-transparent")
              }
            >
              <span className={visible ? "" : "opacity-0"}>{c.v}</span>
            </button>
          );
        })}
      </div>
      {completo ? (
        <p className="text-center text-sm text-primary">
          ¡Completado en {movs} movimientos!
        </p>
      ) : null}
      <Button variant="secondary" className="w-full rounded-full" onClick={reiniciar}>
        <RotateCcw className="mr-2 h-4 w-4" /> Nuevo tablero
      </Button>
      <p className="text-center text-[0.7rem] text-muted-foreground">
        Encuentra todas las parejas con el menor número de movimientos.
      </p>
    </div>
  );
}

/* ── 3. Stroop ──────────────────────────────────────────── */

const COLORES = [
  { nombre: "ROJO", clase: "text-[oklch(0.65_0.2_25)]" },
  { nombre: "VERDE", clase: "text-[oklch(0.7_0.16_150)]" },
  { nombre: "AZUL", clase: "text-[oklch(0.66_0.16_255)]" },
  { nombre: "AMARILLO", clase: "text-[oklch(0.82_0.15_95)]" },
];

function rondaStroop() {
  const palabra = Math.floor(Math.random() * 4);
  let tinta = Math.floor(Math.random() * 4);
  if (Math.random() > 0.25 && tinta === palabra) tinta = (tinta + 1) % 4;
  return { palabra, tinta };
}

function Stroop({ registrar }: { registrar: Registrar }) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segundos, corriendo]);

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
    <div className="space-y-4">
      <Marcador
        items={[
          ["Aciertos", String(aciertos)],
          ["Fallos", String(fallos)],
          ["Tiempo", String(segundos)],
        ]}
      />
      <Progress value={(segundos / 45) * 100} />
      <div className="flex h-28 items-center justify-center rounded-3xl border border-border bg-secondary/40">
        <span className={`font-display text-4xl ${COLORES[ronda.tinta]!.clase}`}>
          {COLORES[ronda.palabra]!.nombre}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {COLORES.map((c, i) => (
          <button
            key={c.nombre}
            onClick={() => responder(i)}
            disabled={!corriendo}
            className={
              "rounded-2xl border border-border py-3 text-sm font-medium transition-colors " +
              c.clase +
              (corriendo ? " hover:bg-secondary" : " opacity-50")
            }
          >
            {c.nombre}
          </button>
        ))}
      </div>
      <Button
        className="w-full rounded-full"
        onClick={() => {
          setAciertos(0);
          setFallos(0);
          setSegundos(45);
          setRonda(rondaStroop());
          setCorriendo(true);
        }}
      >
        {corriendo ? "Reiniciar ronda" : "Empezar 45 s"}
      </Button>
      <p className="text-center text-[0.7rem] text-muted-foreground">
        Pulsa el <strong>color de la tinta</strong>, no la palabra escrita.
      </p>
    </div>
  );
}

/* ── 4. Cálculo rápido ──────────────────────────────────── */

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

function Calculo({ registrar }: { registrar: Registrar }) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segundos, corriendo]);

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
    <div className="space-y-4">
      <Marcador
        items={[
          ["Aciertos", String(aciertos)],
          ["Precisión", `${precision}%`],
          ["Tiempo", String(segundos)],
        ]}
      />
      <Progress value={(segundos / 60) * 100} />
      <div className="flex h-28 items-center justify-center rounded-3xl border border-border bg-secondary/40">
        <span className="font-display text-4xl tabular-nums">{op.texto}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {op.opciones.map((v) => (
          <button
            key={v}
            onClick={() => responder(v)}
            disabled={!corriendo}
            className={
              "rounded-2xl border border-border py-3 font-display text-lg tabular-nums transition-colors " +
              (corriendo ? "hover:border-primary hover:bg-primary/10" : "opacity-50")
            }
          >
            {v}
          </button>
        ))}
      </div>
      <Button
        className="w-full rounded-full"
        onClick={() => {
          setAciertos(0);
          setFallos(0);
          setSegundos(60);
          setOp(nuevaOperacion());
          setCorriendo(true);
        }}
      >
        {corriendo ? "Reiniciar ronda" : "Empezar 60 s"}
      </Button>
      <p className="text-center text-[0.7rem] text-muted-foreground">
        Resuelve mentalmente y elige el resultado correcto.
      </p>
    </div>
  );
}

export const MindGamesIcon = Brain;
