import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppHeader } from "@/components/AppHeader";
import { BreathSession, PROTOCOLS } from "@/components/BreathSession";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
    <div className="mx-auto max-w-2xl touch-lock">
      <AppHeader titulo="Respira" subtitulo={activo.descripcion} />

      <div className="px-5">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none" data-allow-scroll>
          {PROTOCOLS.map((prot) => (
            <button
              key={prot.id}
              onClick={() => setActivo(prot)}
              className={
                "shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-colors " +
                (activo.id === prot.id
                  ? "border-primary bg-primary/15 text-primary shadow-sm"
                  : "border-border text-muted-foreground")
              }
            >
              {prot.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 px-5">
        <BreathSession protocol={activo} onComplete={onComplete} />
      </div>

      <div className="mt-8 px-5">
        <div className="surface-panel p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">
            {activo.claim}
          </p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{activo.descripcion}</p>
        </div>
      </div>
    </div>
  );
}
