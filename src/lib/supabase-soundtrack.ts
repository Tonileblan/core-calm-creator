import { supabase } from "@/integrations/supabase/client";
import { downloadYouTubeAudio, getYouTubeMetadata, isYouTubeUrl } from "./youtube-audio";

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

  // Intentar subir al bucket de Supabase
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, audioBlob, {
      cacheControl: "3600",
      upsert: true,
      contentType: audioBlob.type || "audio/mpeg",
    });

  if (error) {
    // Si el bucket principal falla, intentar con bucket fallback 'media'
    const fallback = await supabase.storage
      .from("media")
      .upload(filePath, audioBlob, {
        cacheControl: "3600",
        upsert: true,
        contentType: audioBlob.type || "audio/mpeg",
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
 * Procesa una canción: si es YouTube, la descarga y la sube a Supabase; si es archivo local, lo sube; luego guarda el registro en `vital_soundtrack`.
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

      onProgress?.("Descargando pista de audio de YouTube...");
      const { blob, filename } = await downloadYouTubeAudio(inputUrl, onProgress);

      onProgress?.("Guardando archivo de audio en Supabase...");
      finalAudioUrl = await uploadAudioToSupabase(userId, blob, filename);
    } else {
      // Es una URL directa o enlace general
      finalAudioUrl = inputUrl;
    }
  } else if (urlOrFile instanceof File) {
    // Archivo de audio local seleccionado por el usuario
    onProgress?.("Subiendo archivo de audio local a Supabase...");
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
 * Elimina una canción de Supabase (registro y archivo si está en Supabase Storage)
 */
export async function eliminarCancionDeSupabase(id: string, urlEnlace?: string): Promise<void> {
  // Intentar eliminar del storage si es un archivo de Supabase
  if (urlEnlace && urlEnlace.includes("/storage/v1/object/public/")) {
    try {
      const parts = urlEnlace.split("/storage/v1/object/public/")[1];
      if (parts) {
        const slashIndex = parts.indexOf("/");
        const bucket = parts.substring(0, slashIndex);
        const path = decodeURIComponent(parts.substring(slashIndex + 1));
        if (bucket && path) {
          await supabase.storage.from(bucket).remove([path]);
        }
      }
    } catch (e) {
      console.warn("No se pudo eliminar el archivo físico del storage:", e);
    }
  }

  const { error } = await supabase.from("vital_soundtrack").delete().eq("id", id);
  if (error) throw error;
}
