import { supabase } from "@/integrations/supabase/client";
import {
  downloadYouTubeMedia,
  getYouTubeMetadata,
  isYouTubeUrl,
  extractYouTubeVideoId,
} from "./youtube-audio";
import { resolverUrlAudioServerFn } from "./soundtrack.functions";

export const BUCKET_NAME = "soundtrack";

/**
 * Sube un archivo de audio (Blob o File) a Supabase Storage
 */
export async function uploadAudioToSupabase(
  userId: string,
  audioBlob: Blob,
  filename: string,
): Promise<string> {
  const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${userId}/${Date.now()}_${cleanFilename}`;

  const contentType = audioBlob.type || (filename.endsWith(".mp4") ? "video/mp4" : "audio/mpeg");

  // Intentar subir al bucket de Supabase
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, audioBlob, {
      cacheControl: "3600",
      upsert: true,
      contentType,
    });

  if (error) {
    // Si el bucket principal falla, intentar con bucket fallback 'media'
    const fallback = await supabase.storage
      .from("media")
      .upload(filePath, audioBlob, {
        cacheControl: "3600",
        upsert: true,
        contentType,
      });

    if (fallback.error) {
      console.warn("Error subiendo a Supabase Storage:", error.message);
      throw new Error(`Error al guardar en Supabase Storage: ${error.message}`);
    }

    const { data: publicData } = supabase.storage.from("media").getPublicUrl(fallback.data.path);
    return publicData.publicUrl;
  }

  const { data: publicData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path);
  return publicData.publicUrl;
}

export type AddCancionParams = {
  userId: string;
  nombre: string;
  artista?: string | null | undefined;
  categoria: string;
  urlOrFile: string | File;
  onProgress?: ((status: string) => void) | undefined;
};

/**
 * Procesa una canción: si es YouTube, descarga el video/audio y lo sube a Supabase; si es archivo local, lo sube; luego guarda el registro en `vital_soundtrack`.
 */
export async function procesarYGuardarCancion({
  userId,
  nombre,
  artista,
  categoria,
  urlOrFile,
  onProgress,
}: AddCancionParams): Promise<{
  id: string;
  nombre_cancion: string;
  artista: string | null;
  categoria_momento: string;
  url_enlace: string;
}> {
  let finalAudioUrl = "";
  let finalNombre = nombre.trim();
  let finalArtista = artista?.trim() || null;

  if (typeof urlOrFile === "string") {
    const inputUrl = urlOrFile.trim();

    if (isYouTubeUrl(inputUrl)) {
      onProgress?.("Detectado enlace de YouTube. Obteniendo datos...");

      // Auto-completar título y artista si están vacíos
      if (!finalNombre || !finalArtista) {
        const meta = await getYouTubeMetadata(inputUrl);
        if (meta) {
          if (!finalNombre) finalNombre = meta.title;
          if (!finalArtista && meta.author) finalArtista = meta.author;
        }
      }

      onProgress?.("Descargando video/audio de YouTube...");
      const { blob, filename } = await downloadYouTubeMedia(inputUrl, onProgress);

      onProgress?.("Guardando archivo en Supabase Storage...");
      finalAudioUrl = await uploadAudioToSupabase(userId, blob, filename);
    } else {
      // Es una URL directa o enlace general
      finalAudioUrl = inputUrl;
    }
  } else if (urlOrFile instanceof File) {
    // Archivo de audio/video local seleccionado por el usuario
    onProgress?.("Subiendo archivo local a Supabase...");
    finalAudioUrl = await uploadAudioToSupabase(userId, urlOrFile, urlOrFile.name);
    if (!finalNombre) {
      finalNombre = urlOrFile.name.replace(/\.[^/.]+$/, "");
    }
  }

  if (!finalNombre) {
    throw new Error("Por favor introduce el nombre de la canción.");
  }
  if (!finalAudioUrl) {
    throw new Error("No se pudo obtener la URL de audio.");
  }

  onProgress?.("Registrando en la base de datos...");
  const { data, error } = await supabase
    .from("vital_soundtrack")
    .insert({
      user_id: userId,
      nombre_cancion: finalNombre,
      artista: finalArtista,
      categoria_momento: categoria,
      url_enlace: finalAudioUrl,
    })
    .select("id, nombre_cancion, artista, categoria_momento, url_enlace")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Extrae bucket y ruta de una URL de Supabase Storage (formato público o firmado)
 */
export function parseStorageRef(url: string): { bucket: string; path: string } | null {
  if (!url || typeof url !== "string") return null;
  const marker = url.includes("/storage/v1/object/public/")
    ? "/storage/v1/object/public/"
    : url.includes("/storage/v1/object/sign/")
      ? "/storage/v1/object/sign/"
      : null;
  if (!marker) return null;
  const rest = url.split(marker)[1];
  if (!rest) return null;
  const clean = rest.split("?")[0] ?? rest;
  const slashIndex = clean.indexOf("/");
  if (slashIndex < 1) return null;
  return {
    bucket: clean.substring(0, slashIndex),
    path: decodeURIComponent(clean.substring(slashIndex + 1)),
  };
}

/**
 * Resuelve síncronamente una URL reproducible inmediata sin pausas de red.
 */
export function resolvePlayableUrlSync(url: string): string {
  if (!url) return "";
  let trimmed = url.trim();

  // Si es un audio local .wav, migrarlo a .m4a inmediatamente para soporte total de iOS
  if (trimmed.endsWith(".wav")) {
    trimmed = trimmed.replace(/\.wav$/, ".m4a");
  }

  // Si es un audio local bundled en la app
  if (trimmed.startsWith("/") || trimmed.startsWith("./")) {
    return trimmed;
  }

  // Si es una URL de Supabase Storage o directa
  if (!isYouTubeUrl(trimmed)) {
    return trimmed;
  }

  return "";
}

/**
 * Resuelve una URL reproducible 100% válida.
 * 1. Si es audio local bundled (/audio/...), se reproduce inmediatamente en formato AAC .m4a.
 * 2. Si ya es una URL pública de Supabase Storage, se devuelve directamente sin demoras.
 * 3. Si es un enlace de YouTube que no se había procesado, el servidor lo descarga y lo migra automáticamente a Supabase Storage.
 * 4. Si es de Supabase Storage privado, genera una URL firmada autorizada.
 */
export async function resolvePlayableUrl(url: string, trackId?: string, expiresIn = 7200): Promise<string> {
  if (!url) return "";
  let trimmed = url.trim();

  if (trimmed.endsWith(".wav")) {
    trimmed = trimmed.replace(/\.wav$/, ".m4a");
  }

  // 1. Audio local
  if (trimmed.startsWith("/") || trimmed.startsWith("./")) {
    return trimmed;
  }

  // 2. Si es YouTube legacy no procesado, migrar a Supabase Storage automáticamente en servidor
  if (isYouTubeUrl(trimmed)) {
    try {
      const res = await resolverUrlAudioServerFn({ data: { id: trackId, url: trimmed } });
      if (res?.playableUrl && !isYouTubeUrl(res.playableUrl)) {
        return res.playableUrl;
      }
    } catch (e) {
      console.warn("No se pudo migrar URL de YouTube:", e);
    }
  }

  // 3. Si ya es una URL pública directa de Supabase
  if (trimmed.includes("/storage/v1/object/public/")) {
    return trimmed;
  }

  // 4. Si es de Supabase Storage privado, generar URL firmada autorizada
  const ref = parseStorageRef(trimmed);
  if (ref) {
    try {
      const { data, error } = await supabase.storage
        .from(ref.bucket)
        .createSignedUrl(ref.path, expiresIn);
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    } catch (e) {
      console.warn("No se pudo obtener URL firmada de Supabase Storage:", e);
    }
  }

  return trimmed;
}

/**
 * Elimina una canción de Supabase (registro y archivo si está en Supabase Storage)
 */
export async function eliminarCancionDeSupabase(id: string, urlEnlace?: string): Promise<void> {
  // Intentar eliminar del storage si es un archivo de Supabase
  if (urlEnlace && (urlEnlace.includes("/storage/v1/object/public/") || urlEnlace.includes("/storage/v1/object/sign/"))) {
    try {
      const ref = parseStorageRef(urlEnlace);
      if (ref) {
        await supabase.storage.from(ref.bucket).remove([ref.path]);
      }
    } catch (e) {
      console.warn("No se pudo eliminar el archivo físico del storage:", e);
    }
  }

  const { error } = await supabase.from("vital_soundtrack").delete().eq("id", id);
  if (error) throw error;
}
