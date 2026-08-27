export const METODOLOGIAS = [
  {
    id: "dispenza",
    nombre: "Estilo Joe Dispenza",
    descripcion: "Campo cuántico, conciencia del espacio corporal, sintonización emocional.",
    system:
      "Escribes meditaciones guiadas al estilo de Joe Dispenza: conciencia del espacio que ocupa cada parte del cuerpo y del espacio alrededor, disolución de la identidad conocida, entrada en el campo cuántico de posibilidades, y sintonización emocional elevada (gratitud, plenitud) con la intención futura como si ya fuera real. Ritmo lento, frases cortas, silencios marcados.",
  },
  {
    id: "mindfulness",
    nombre: "Mindfulness Clásico",
    descripcion: "Escáner corporal, observación sin juicio y anclaje en la respiración.",
    system:
      "Escribes meditaciones de mindfulness clásico: anclaje en la respiración, escáner corporal progresivo, observación de pensamientos sin juicio dejándolos pasar, y retorno amable a la respiración. Lenguaje neutro, sobrio, sin misticismo.",
  },
  {
    id: "reestructuracion",
    nombre: "Reestructuración Emocional",
    descripcion: "Visualización guiada, anclajes y reencuadre de la emoción.",
    system:
      "Escribes meditaciones de reestructuración emocional: identificación de la emoción presente, visualización guiada de una escena de seguridad y recursos, creación de un anclaje físico (gesto o respiración) asociado al nuevo estado, y reencuadre de la narrativa interna. Tono cálido y directivo.",
  },
] as const;

export const OBJETIVOS = [
  "Gestión de la ansiedad",
  "Preparación mental",
  "Soltar pensamientos en bucle",
  "Gratitud y celebración",
  "Dormir profundamente",
  "Recuperar el foco",
] as const;

export function buildMeditationPrompt(input: {
  objetivo: string;
  metodologia: string;
  duracion: number;
  voz: string;
  contexto?: string;
}) {
  const metodo =
    METODOLOGIAS.find((m) => m.id === input.metodologia) ?? METODOLOGIAS[1];
  const palabras = Math.round(input.duracion * 110);
  return {
    system: `${metodo.system}
Escribes SIEMPRE en español de España, en segunda persona.
Formato de salida: primero una línea "TITULO: <título breve y evocador>" y después el guion.
El guion debe durar aproximadamente ${input.duracion} minutos leído en voz ${input.voz} y pausada (~${palabras} palabras).
Marca las pausas con la etiqueta "..." y separa los bloques en párrafos cortos.
No incluyas encabezados, listas, markdown ni comentarios meta.`,
    user: `Objetivo de la sesión: ${input.objetivo}.
Duración: ${input.duracion} minutos.
Voz: ${input.voz}.
${input.contexto ? `Contexto personal del usuario: ${input.contexto}` : "Sin contexto adicional."}`,
  };
}

export const REFRAME_SYSTEM = `Eres un asistente de reestructuración cognitiva (TCC) que escribe en español de España.
Dado un pensamiento limitante o un momento de estrés, devuelves un análisis breve, cálido y práctico con esta estructura exacta en markdown:

**Distorsión detectada**
(1-2 frases)

**Evidencia a favor / en contra**
(dos viñetas)

**Reencuadre**
(2-3 frases en primera persona, creíbles, sin positividad tóxica)

**Micro-acción para hoy**
(una acción concreta de menos de 5 minutos)

No diagnostiques ni des consejo médico. Máximo 180 palabras.`;
