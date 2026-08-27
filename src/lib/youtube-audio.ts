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
 * Descarga el video/audio de YouTube como un archivo Blob (MP4 o M4A).
 * Da prioridad a streams combinados (itag 18 / 22 MP4) que contienen video + audio
 * integrados y se reproducen nativamente en cualquier navegador.
 */
export async function downloadYouTubeMedia(
  url: string,
  onProgress?: ((msg: string) => void) | undefined,
): Promise<{ blob: Blob; mimeType: string; filename: string }> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw new Error("El enlace proporcionado no es un video de YouTube válido.");
  }

  onProgress?.("Conectando con el servidor de medios...");

  // Endpoints redundantes para extraer video MP4 o audio directo
  // itag 18: MP4 360p con audio AAC integrado (muy ligero y rápido de descargar)
  // itag 140: M4A audio AAC 128kbps
  // itag 22: MP4 720p con audio integrado
  const mediaEndpoints = [
    // 1. Instancias Invidious (itag 18: video+audio MP4, itag 140: audio)
    `https://inv.tux.pizza/latest_version?id=${videoId}&itag=18`,
    `https://invidious.nerdvpn.de/latest_version?id=${videoId}&itag=18`,
    `https://yewtu.be/latest_version?id=${videoId}&itag=18`,
    `https://invidious.privacydev.net/latest_version?id=${videoId}&itag=18`,
    `https://inv.tux.pizza/latest_version?id=${videoId}&itag=140`,
    `https://invidious.nerdvpn.de/latest_version?id=${videoId}&itag=140`,
    `https://yewtu.be/latest_version?id=${videoId}&itag=140`,
    // 2. Proxies de stream directo
    `https://yt-stream.deno.dev/audio/${videoId}`,
  ];

  for (let i = 0; i < mediaEndpoints.length; i++) {
    const endpoint = mediaEndpoints[i]!;
    try {
      onProgress?.(`Descargando video/audio (${i + 1}/${mediaEndpoints.length})...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(endpoint, {
        signal: controller.signal,
        headers: {
          Accept: "video/mp4,audio/*,application/octet-stream",
        },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const contentType = response.headers.get("content-type") || "video/mp4";
        if (
          contentType.includes("video") ||
          contentType.includes("audio") ||
          contentType.includes("application/octet-stream")
        ) {
          const blob = await response.blob();
          if (blob.size > 15000) {
            const isVideo = contentType.includes("video") || endpoint.includes("itag=18") || endpoint.includes("itag=22");
            return {
              blob,
              mimeType: isVideo ? "video/mp4" : "audio/mp4",
              filename: `youtube_${videoId}.${isVideo ? "mp4" : "m4a"}`,
            };
          }
        }
      }
    } catch {
      continue;
    }
  }

  // Fallback con servicio Cobalt (descarga directa)
  try {
    onProgress?.("Procesando descarga de alta fidelidad...");
    const cobaltRes = await fetch("https://api.cobalt.tools", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        videoQuality: "360",
        downloadMode: "auto",
      }),
    });

    if (cobaltRes.ok) {
      const data = (await cobaltRes.json()) as { url?: string; status?: string };
      if (data.url) {
        const fetchRes = await fetch(data.url);
        if (fetchRes.ok) {
          const blob = await fetchRes.blob();
          return {
            blob,
            mimeType: "video/mp4",
            filename: `youtube_${videoId}.mp4`,
          };
        }
      }
    }
  } catch (err) {
    console.warn("Cobalt fallback falló:", err);
  }

  throw new Error(
    "No se pudo descargar el video/audio de YouTube en este momento. Puedes subir el archivo de audio o video directamente.",
  );
}

export const downloadYouTubeAudio = downloadYouTubeMedia;

