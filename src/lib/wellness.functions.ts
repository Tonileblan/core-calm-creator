import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildMeditationPrompt, REFRAME_SYSTEM } from "@/lib/meditation-prompts";
import { chat } from "@/lib/ai.server";

export const generarMeditacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      objetivo: string;
      metodologia: string;
      duracion: number;
      voz: string;
      contexto?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { system, user } = buildMeditationPrompt(data);
    const raw = await chat({ system, user, maxTokens: 6000 });

    const match = raw.match(/^\s*TITULO:\s*(.+)$/im);
    const titulo = (match?.[1] ?? `${data.objetivo} · ${data.duracion} min`).trim();
    const guion = raw.replace(/^\s*TITULO:\s*.+$/im, "").trim();

    const { data: row, error } = await context.supabase
      .from("saved_meditations")
      .insert({
        user_id: context.userId,
        titulo,
        objetivo: data.objetivo,
        metodologia: data.metodologia,
        duracion_minutos: data.duracion,
        guion_texto: guion,
      })
      .select("id, titulo, guion_texto, duracion_minutos, metodologia, created_at")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const reencuadrarPensamiento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pensamiento: string }) => input)
  .handler(async ({ data, context }) => {
    const analisis = await chat({
      system: REFRAME_SYSTEM,
      user: data.pensamiento,
      maxTokens: 1200,
    });

    await context.supabase.from("mental_gym_stats").insert({
      user_id: context.userId,
      tipo_ejercicio: "reestructuracion_cognitiva",
      duracion_minutos: 3,
      completado: true,
      detalle: { pensamiento: data.pensamiento, analisis },
    });

    return { analisis };
  });
