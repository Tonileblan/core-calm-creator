const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export async function chat(opts: {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Falta la configuración de IA (LOVABLE_API_KEY).");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: opts.model ?? "google/gemini-3.7-flash",
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      max_tokens: opts.maxTokens ?? 4000,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429)
      throw new Error("Demasiadas peticiones a la IA. Prueba de nuevo en un momento.");
    if (res.status === 402)
      throw new Error("Se han agotado los créditos de IA del espacio de trabajo.");
    if (res.status === 403)
      throw new Error("La IA está desactivada para este espacio de trabajo.");
    throw new Error(`Error de la IA (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("La IA devolvió una respuesta vacía.");
  return text;
}
