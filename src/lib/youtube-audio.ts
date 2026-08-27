/**
 * Utilidades para detectar, extraer metadatos y descargar audio de YouTube
 */

export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // youtube.com/watch?v=ID
  const watchMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (watchMatch?.[1]) return watchMatch[1];

  // youtu.be/ID
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch?.[1]) return shortMatch[1];

  // music.youtube.com/watch?v=ID
  const musicMatch = trimmed.match(/music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
  if (musicMatch?.[1]) return musicMatch[1];

  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}

export type YouTubeMetadata = {
  title: string;
  author: string;
  thumbnailUrl?: string | undefined;
};

/**
 * Obtiene el título y autor de un video de YouTube mediante oEmbed oficial
 */
export async function getYouTubeMetadata(url: string): Promise<YouTubeMetadata | null> {
  try {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) return null;

    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return null;

    const data = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    return {
      title: data.title ?? `Canción (${videoId})`,
      author: data.author_name ?? "YouTube",
      thumbnailUrl: data.thumbnail_url,
    };
  } catch (err) {
    console.warn("No se pudo obtener metadata de YouTube:", err);
    return null;
  }
}

/**
 * Descarga el audio de un video de YouTube como un Blob
 * Utiliza múltiples endpoints de extracción de audio redundantes y seguros
 */
export async function downloadYouTubeAudio(
  url: string,
  onProgress?: (msg: string) => void,
): Promise<{ blob: Blob; mimeType: string; filename: string }> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw new Error("El enlace proporcionado no es un video de YouTube válido.");
  }

  onProgress?.("Conectando con el servidor de audio...");

  // Lista de fuentes redundantes para extraer el stream de audio
  const audioEndpoints = [
    `https://inv.tux.pizza/latest_version?id=${videoId}&itag=140`,
    `https://invidious.nerdvpn.de/latest_version?id=${videoId}&itag=140`,
    `https://yewtu.be/latest_version?id=${videoId}&itag=140`,
    `https://invidious.privacydev.net/latest_version?id=${videoId}&itag=140`,
    `https://yt-stream.deno.dev/audio/${videoId}`,
  ];

  for (let i = 0; i < audioEndpoints.length; i++) {
    const endpoint = audioEndpoints[i]!;
    try {
      onProgress?.(`Descargando pista de audio (${i + 1}/${audioEndpoints.length})...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      const response = await fetch(endpoint, {
        signal: controller.signal,
        headers: {
          Accept: "audio/*,video/mp4,application/octet-stream",
        },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const contentType = response.headers.get("content-type") || "audio/mp4";
        if (
          contentType.includes("audio") ||
          contentType.includes("video/mp4") ||
          contentType.includes("application/octet-stream")
        ) {
          const blob = await response.blob();
          if (blob.size > 10000) {
            return {
              blob,
              mimeType: contentType.includes("audio") ? contentType : "audio/mp4",
              filename: `youtube_${videoId}.m4a`,
            };
          }
        }
      }
    } catch {
      continue;
    }
  }

  // Fallback con servicio de conversión
  try {
    onProgress?.("Procesando pista de audio...");
    const cobaltRes = await fetch("https://api.cobalt.tools", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        downloadMode: "audio",
        audioFormat: "mp3",
      }),
    });

    if (cobaltRes.ok) {
      const data = (await cobaltRes.json()) as { url?: string; status?: string };
      if (data.url) {
        const audioFetch = await fetch(data.url);
        if (audioFetch.ok) {
          const blob = await audioFetch.blob();
          return {
            blob,
            mimeType: "audio/mpeg",
            filename: `youtube_${videoId}.mp3`,
          };
        }
      }
    }
  } catch (err) {
    console.warn("Cobalt fallback:", err);
  }

  throw new Error(
    "No se pudo descargar el audio de YouTube en este momento. Puedes subir el archivo de audio (.mp3 o .m4a) directamente.",
  );
}
