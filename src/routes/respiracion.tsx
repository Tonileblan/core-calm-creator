import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Wind } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { BreathSession, PROTOCOLS } from "@/components/BreathSession";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useScrollLock } from "@/hooks/useScrollLock";
import { cn } from "@/lib/utils";

const searchSchema = z.object({ p: z.string().optional() });

export const Route = createFileRoute("/respiracion")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Respiración guiada · Blowmind" },
      {
        name: "description",
        content:
          "Protocolos de respiración guiada con animación fluida: triangular, ciclo anti-tilt, método 4-7-8 y respiración coherente.",
      },
      { property: "og:title", content: "Laboratorio de respiración · Blowmind" },
      {
        property: "og:description",
        content:
          "Interrumpe la frustración, recupera la calma o induce el sueño con protocolos guiados de respiración.",
      },
    ],
  }),
  component: Respiracion,
});

function Respiracion() {
  const { p } = Route.useSearch();
  const { user } = useAuth();
  const [activo, setActivo] = useState(
    () => PROTOCOLS.find((x) => x.id === p) ?? PROTOCOLS[0]!,
  );

  // Lock scroll so the respiration view is fixed in the device screen
  useScrollLock(true);

  useEffect(() => {
    const found = PROTOCOLS.find((x) => x.id === p);
    if (found) setActivo(found);
  }, [p]);

  const onComplete = async (minutos: number) => {
    toast.success("Sesión completada", { description: `${minutos} min de respiración` });
    if (!user) return;
    await supabase.from("mental_gym_stats").insert({
      user_id: user.id,
      tipo_ejercicio: `respiracion_${activo.id}`,
      duracion_minutos: minutos,
      completado: true,
    });
  };

  return (
    <div className="mx-auto max-w-2xl flex flex-col justify-between h-full px-5 touch-none select-none overscroll-none overflow-hidden">
      <div>
        <AppHeader titulo="Respira" subtitulo={activo.claim} />

        {/* Selector horizontal de protocolos */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" data-allow-scroll>
          {PROTOCOLS.map((prot) => (
            <button
              key={prot.id}
              onClick={() => setActivo(prot)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                activo.id === prot.id
                  ? "border-primary bg-primary/20 text-primary shadow-sm font-semibold"
                  : "border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              {prot.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Orbe central y sesión */}
      <div className="my-auto py-2">
        <BreathSession protocol={activo} onComplete={onComplete} />
      </div>

      {/* Nota descriptiva inferior compacta */}
      <div className="surface-panel p-3.5 text-center mb-1">
        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-primary font-semibold">
          {activo.claim}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{activo.descripcion}</p>
      </div>
    </div>
  );
}
