import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getAudioEngine } from "@/lib/audio-engine";
import { cn } from "@/lib/utils";

export type Phase = { label: string; seconds: number; scale: number };

export type Protocol = {
  id: string;
  nombre: string;
  claim: string;
  descripcion: string;
  phases: Phase[];
  ciclos: number;
};

export const PROTOCOLS: Protocol[] = [
  {
    id: "triangular",
    nombre: "Respiración Triangular",
    claim: "Calma en 3 tiempos",
    descripcion: "Inhala 4 · Retén 4 · Exhala 4. Recuperación rápida de la calma.",
    ciclos: 8,
    phases: [
      { label: "Inhala", seconds: 4, scale: 1 },
      { label: "Retén", seconds: 4, scale: 1 },
      { label: "Exhala", seconds: 4, scale: 0.55 },
    ],
  },
  {
    id: "antitilt",
    nombre: "Ciclo Anti-tilt",
    claim: "Corta la frustración",
    descripcion:
      "Exhalación larga para interrumpir el pico reactivo de frustración o pánico.",
    ciclos: 6,
    phases: [
      { label: "Inhala corto", seconds: 3, scale: 1 },
      { label: "Retén", seconds: 2, scale: 1 },
      { label: "Exhala largo", seconds: 8, scale: 0.5 },
    ],
  },
  {
    id: "478",
    nombre: "Método 4-7-8",
    claim: "Inductor de sueño",
    descripcion: "Inhala 4 · Retén 7 · Exhala 8. Relajación profunda y sueño.",
    ciclos: 6,
    phases: [
      { label: "Inhala", seconds: 4, scale: 1 },
      { label: "Retén", seconds: 7, scale: 1 },
      { label: "Exhala", seconds: 8, scale: 0.5 },
    ],
  },
  {
    id: "coherente",
    nombre: "Respiración Coherente",
    claim: "Equilibrio 5-5",
    descripcion: "Inhala 5 · Exhala 5. Reequilibrio del sistema nervioso.",
    ciclos: 10,
    phases: [
      { label: "Inhala", seconds: 5, scale: 1 },
      { label: "Exhala", seconds: 5, scale: 0.55 },
    ],
  },
];

export function BreathSession({
  protocol,
  onComplete,
}: {
  protocol: Protocol;
  onComplete?: (minutos: number) => void;
}) {
  const [running, setRunning] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [remaining, setRemaining] = useState(protocol.phases[0]!.seconds);
  const [cycle, setCycle] = useState(0);
  const [sonido, setSonido] = useState(true);
  const startedAt = useRef<number>(0);

  const phase = protocol.phases[phaseIndex]!;
  const totalSeconds = useMemo(
    () => protocol.phases.reduce((a, p) => a + p.seconds, 0) * protocol.ciclos,
    [protocol],
  );

  useEffect(() => {
    setRunning(false);
    setPhaseIndex(0);
    setCycle(0);
    setRemaining(protocol.phases[0]!.seconds);
  }, [protocol]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setRemaining((r) => {
        if (r > 1) return r - 1;
        setPhaseIndex((i) => {
          const next = (i + 1) % protocol.phases.length;
          if (next === 0) setCycle((c) => c + 1);
          if (sonido) getAudioEngine().chime(next === 0 ? 396 : 528, 0.35);
          setRemaining(protocol.phases[next]!.seconds);
          return next;
        });
        return protocol.phases[(phaseIndex + 1) % protocol.phases.length]!.seconds;
      });
      if (navigator.vibrate && remaining === 1) navigator.vibrate(25);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, protocol, sonido, phaseIndex, remaining]);

  useEffect(() => {
    if (running && cycle >= protocol.ciclos) {
      setRunning(false);
      if (sonido) getAudioEngine().chime(639, 1.1);
      onComplete?.(Math.max(1, Math.round((Date.now() - startedAt.current) / 60000)));
    }
  }, [cycle, running, protocol.ciclos, sonido, onComplete]);

  const toggle = () => {
    if (!running) {
      startedAt.current = Date.now();
      setCycle(0);
      setPhaseIndex(0);
      setRemaining(protocol.phases[0]!.seconds);
      if (sonido) getAudioEngine().chime(528, 0.4);
    }
    setRunning((r) => !r);
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative flex h-72 w-72 items-center justify-center">
        <span className="absolute h-40 w-40 rounded-full border border-primary/30 animate-pulse-ring" />
        <div
          className="breath-orb absolute"
          style={{
            height: "17rem",
            width: "17rem",
            transform: `scale(${running ? phase.scale : 0.7})`,
            transition: `transform ${running ? phase.seconds : 1}s cubic-bezier(.37,0,.63,1)`,
          }}
        />
        <div className="relative z-10 text-center">
          <p className="font-display text-3xl text-primary-foreground/90 mix-blend-luminosity">
            {running ? phase.label : "Listo"}
          </p>
          <p className="mt-1 font-display text-6xl tabular-nums text-foreground">
            {running ? remaining : protocol.phases[0]!.seconds}
          </p>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Ciclo {Math.min(cycle + (running ? 1 : 0), protocol.ciclos)} de {protocol.ciclos} ·{" "}
          {Math.round(totalSeconds / 60)} min aprox.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button size="lg" onClick={toggle} className="min-w-40 rounded-full">
          {running ? "Pausar" : "Empezar"}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className={cn("rounded-full", sonido && "text-primary")}
          onClick={() => setSonido((s) => !s)}
        >
          {sonido ? "Guía sonora on" : "Guía sonora off"}
        </Button>
      </div>
    </div>
  );
}
