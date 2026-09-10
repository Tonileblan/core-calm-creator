import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  extractYouTubeVideoId,
  getYouTubeMetadata,
  downloadYouTubeAudioBuffer,
} from "./youtube-audio";

const BUCKET_NAME = "soundtrack";

/**
 * Función de servidor para obtener metadatos de YouTube rápidamente para la UI
 */
export const obtenerMetadataYouTubeServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => input)
  .handler(async ({ data }) => {
    const { url } = data;
    const meta = await getYouTubeMetadata(url);
    return meta;
  });

/**
 * Función de servidor para procesar y descargar audio/video de YouTube directamente a Supabase Storage
 */
export const procesarCancionServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      nombre?: string | undefined;
      artista?: string | undefined;
      categoria: string;
      url: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { categoria, url } = data;
    let nombre = data.nombre?.trim() || "";
    let artista = data.artista?.trim() || null;
    let finalAudioUrl = url.trim();

    const videoId = extractYouTubeVideoId(url);

    if (videoId) {
      // 1. Descargar audio directamente de YouTube a alta velocidad
      try {
        const result = await downloadYouTubeAudioBuffer(url);
        if (!nombre) nombre = result.title;
        if (!artista && result.author) artista = result.author;

        const cleanName = (nombre || `audio_${videoId}`).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
        const fileName = `${context.userId}/${Date.now()}_${cleanName}.${result.extension}`;

        // Subir con el cliente autenticado del usuario (o admin si estuviera configurado)
        let uploadData: { path: string } | null = null;
        let uploadErr: any = null;

        const upRes = await context.supabase.storage
          .from(BUCKET_NAME)
          .upload(fileName, result.buffer, {
            contentType: result.mimeType,
            cacheControl: "3600",
            upsert: true,
          });

        uploadData = upRes.data;
        uploadErr = upRes.error;

        if (uploadErr || !uploadData) {
          // Intentar en bucket fallback 'media' si soundtrack no estuviera listo
          const upFallback = await context.supabase.storage
            .from("media")
            .upload(fileName, result.buffer, {
              contentType: result.mimeType,
              cacheControl: "3600",
              upsert: true,
            });
          if (!upFallback.error && upFallback.data) {
            const { data: pubFallback } = context.supabase.storage.from("media").getPublicUrl(upFallback.data.path);
            finalAudioUrl = pubFallback.publicUrl;
          } else {
            throw new Error(uploadErr?.message || "Error al subir archivo de audio a Supabase Storage.");
          }
        } else {
          const { data: pub } = context.supabase.storage.from(BUCKET_NAME).getPublicUrl(uploadData.path);
          finalAudioUrl = pub.publicUrl;
        }
      } catch (err: any) {
        // YouTube puede bloquear la descarga desde el servidor: guardamos el enlace
        // original para que la canción quede registrada y sea reproducible por enlace.
        console.warn("Descarga de YouTube no disponible, se guarda el enlace:", err?.message);
        if (!nombre || !artista) {
          const meta = await getYouTubeMetadata(url);
          if (meta) {
            if (!nombre) nombre = meta.title;
            if (!artista && meta.author) artista = meta.author;
          }
        }
        finalAudioUrl = url.trim();
      }
    } else if (url.startsWith("http://") || url.startsWith("https://")) {
      // Si es un enlace de audio directo (ej. MP3 o WAV), intentar descargarlo al storage para independencia total
      try {
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (res.ok) {
          const ct = res.headers.get("content-type") || "audio/mpeg";
          const buf = await res.arrayBuffer();
          if (buf.byteLength > 1000) {
            const ext = ct.includes("wav") ? "wav" : ct.includes("mp4") || ct.includes("m4a") ? "m4a" : "mp3";
            const fileName = `${context.userId}/${Date.now()}_imported.${ext}`;
            const { data: upData, error: upErr } = await context.supabase.storage
              .from(BUCKET_NAME)
              .upload(fileName, buf, { contentType: ct, cacheControl: "3600", upsert: true });
            if (!upErr && upData) {
              const { data: pub } = context.supabase.storage.from(BUCKET_NAME).getPublicUrl(upData.path);
              finalAudioUrl = pub.publicUrl;
            }
          }
        }
      } catch {
        // Fallback a URL original si es directa
      }
    }

    if (!nombre) {
      nombre = "Canción de Banda Sonora";
    }

    // 3. Guardar en la base de datos `vital_soundtrack`
    const { data: row, error } = await context.supabase
      .from("vital_soundtrack")
      .insert({
        user_id: context.userId,
        nombre_cancion: nombre,
        artista,
        categoria_momento: categoria,
        url_enlace: finalAudioUrl,
      })
      .select("id, nombre_cancion, artista, categoria_momento, url_enlace")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });
