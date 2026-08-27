import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractYouTubeVideoId, getYouTubeMetadata } from "./youtube-audio";

const BUCKET_NAME = "soundtrack";

/**
 * Asegura que el bucket 'soundtrack' exista en Supabase Storage con acceso público
 */
async function asegurarBucketSoundtrack() {
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const existe = buckets?.some((b) => b.name === BUCKET_NAME || b.id === BUCKET_NAME);
    if (!existe) {
      await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 104857600, // 100MB
      });
    }
  } catch (err) {
    console.warn("No se pudo verificar/crear bucket en Supabase:", err);
  }
}

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
      // 1. Obtener metadata de YouTube si falta el nombre
      if (!nombre || !artista) {
        const meta = await getYouTubeMetadata(url);
        if (meta) {
          if (!nombre) nombre = meta.title;
          if (!artista && meta.author) artista = meta.author;
        }
      }

      if (!nombre) {
        nombre = `Canción YouTube (${videoId})`;
      }

      // 2. Intentar descargar el stream desde el servidor (sin CORS) y subir a Supabase
      try {
        await asegurarBucketSoundtrack();

        // Endpoints de descarga desde el servidor
        const endpoints = [
          `https://inv.tux.pizza/latest_version?id=${videoId}&itag=18`,
          `https://invidious.nerdvpn.de/latest_version?id=${videoId}&itag=18`,
          `https://yewtu.be/latest_version?id=${videoId}&itag=18`,
          `https://inv.tux.pizza/latest_version?id=${videoId}&itag=140`,
          `https://invidious.nerdvpn.de/latest_version?id=${videoId}&itag=140`,
          `https://yt-stream.deno.dev/audio/${videoId}`,
        ];

        let bufferDescargado: ArrayBuffer | null = null;
        let mimeType = "video/mp4";
        let extension = "mp4";

        for (const ep of endpoints) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const res = await fetch(ep, {
              signal: controller.signal,
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                Accept: "video/mp4,audio/*,*/*",
              },
            });
            clearTimeout(timeout);

            if (res.ok) {
              const ct = res.headers.get("content-type") || "";
              const buf = await res.arrayBuffer();
              if (buf.byteLength > 20000) {
                bufferDescargado = buf;
                mimeType = ct.includes("audio") ? ct : "video/mp4";
                extension = ct.includes("audio") ? "m4a" : "mp4";
                break;
              }
            }
          } catch {
            continue;
          }
        }

        // Si se descargó correctamente, subir a Supabase Storage con supabaseAdmin
        if (bufferDescargado) {
          const fileName = `${context.userId}/${Date.now()}_youtube_${videoId}.${extension}`;
          const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .upload(fileName, bufferDescargado, {
              contentType: mimeType,
              cacheControl: "3600",
              upsert: true,
            });

          if (!uploadErr && uploadData) {
            const { data: pub } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(uploadData.path);
            finalAudioUrl = pub.publicUrl;
          }
        }
      } catch (err) {
        console.warn("Fallo en descarga a Supabase Storage, guardando URL original:", err);
      }
    }

    if (!nombre) {
      nombre = "Canción sin título";
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
