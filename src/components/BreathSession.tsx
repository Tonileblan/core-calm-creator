import { useEffect, useMemo, useRef, useState } from "react";
import { X, Volume2, VolumeX, RotateCcw, Play, Pause, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAudioEngine } from "@/lib/audio-engine";
import { getBackgroundTimer } from "@/lib/background-timer";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useWakeLock } from "@/hooks/useWakeLock";

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

  // Lock scrolling when breathing is active
  useScrollLock(running);
  // Mantener la pantalla encendida durante la respiración
  useWakeLock(running);

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
    const bgTimer = getBackgroundTimer();

    const tick = () => {
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
      if (typeof navigator !== "undefined" && navigator.vibrate && remaining === 1) {
        navigator.vibrate(25);
      }
    };

    bgTimer.setInterval("breath-session-timer", tick, 1000);
    return () => bgTimer.clearInterval("breath-session-timer");
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

  const reiniciar = () => {
    setCycle(0);
    setPhaseIndex(0);
    setRemaining(protocol.phases[0]!.seconds);
  };

  const detener = () => {
    setRunning(false);
    reiniciar();
  };

  return (
    <>
      {/* Normal compact card view */}
      <div className="flex flex-col items-center gap-6 touch-lock">
        <div className="relative flex h-64 w-64 items-center justify-center">
          <span className="absolute h-36 w-36 rounded-full border border-primary/30 animate-pulse-ring" />
          <div
            className="breath-orb absolute"
            style={{
              height: "15rem",
              width: "15rem",
              transform: `scale(0.7)`,
              transition: `transform 1s cubic-bezier(.37,0,.63,1)`,
            }}
          />
          <div className="relative z-10 text-center">
            <p className="font-display text-2xl text-primary-foreground/90 mix-blend-luminosity">
              Listo
            </p>
            <p className="mt-1 font-display text-5xl tabular-nums text-foreground">
              {protocol.phases[0]!.seconds}s
            </p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            {protocol.ciclos} ciclos · {Math.round(totalSeconds / 60)} min aprox.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button size="lg" onClick={toggle} className="min-w-44 rounded-full shadow-lg">
            <Play className="mr-2 h-4 w-4" /> Empezar sesión
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className={cn("rounded-full", sonido && "text-primary")}
            onClick={() => setSonido((s) => !s)}
          >
            {sonido ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Immersive locked full-viewport screen during active breathing */}
      {running && (
        <div
          className="fixed inset-0 z-50 flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col justify-between bg-background/95 backdrop-blur-2xl px-6 py-6 touch-lock select-none overscroll-none overflow-hidden"
          style={{ overscrollBehavior: "none" }}
        >
          {/* Top Bar */}
          <div className="mx-auto flex w-full max-w-md items-center justify-between pt-[env(safe-area-inset-top)]">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary">
                Sesión de respiración
              </p>
              <h2 className="font-display text-lg text-foreground">{protocol.nombre}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => setSonido((s) => !s)}
              >
                {sonido ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                onClick={detener}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Centered Orb with dynamic animation */}
          <div className="relative flex flex-1 items-center justify-center my-auto">
            <span className="absolute h-48 w-48 sm:h-56 sm:w-56 rounded-full border border-primary/30 animate-pulse-ring" />
            <div
              className="breath-orb absolute"
              style={{
                height: "18rem",
                width: "18rem",
                maxWidth: "68vw",
                maxHeight: "68vw",
                transform: `scale(${phase.scale})`,
                transition: `transform ${phase.seconds}s cubic-bezier(.37,0,.63,1)`,
              }}
            />
            <div className="relative z-10 text-center select-none pointer-events-none">
              <p className="font-display text-3xl sm:text-4xl text-primary-foreground/90 mix-blend-luminosity drop-shadow">
                {phase.label}
              </p>
              <p className="mt-2 font-display text-6xl sm:text-7xl tabular-nums text-foreground drop-shadow-md">
                {remaining}
              </p>
            </div>
          </div>

          {/* Bottom Controls & Progress */}
          <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 pb-[env(safe-area-inset-bottom)]">
            <div className="w-full text-center">
              <p className="text-xs text-muted-foreground font-medium">
                Ciclo {Math.min(cycle + 1, protocol.ciclos)} de {protocol.ciclos}
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.min(100, ((cycle + (protocol.phases.length - phaseIndex) / protocol.phases.length) / protocol.ciclos) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex w-full items-center justify-center gap-3">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full flex-1 border-border/80"
                onClick={reiniciar}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
              </Button>

              <Button
                size="lg"
                className="rounded-full flex-1 shadow-lg bg-primary text-primary-foreground"
                onClick={() => setRunning((r) => !r)}
              >
                {running ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" /> Pausar
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" /> Reanudar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
