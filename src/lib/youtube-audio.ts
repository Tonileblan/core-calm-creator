/**
 * Utilidades para detectar, extraer metadatos y descargar audio de YouTube
 * directamente a Supabase Storage con independencia de reproductores externos.
 */

export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // youtube.com/watch?v=ID
  const watchMatch = trimmed.match(
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  );
  if (watchMatch?.[1]) return watchMatch[1];

  // youtu.be/ID
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch?.[1]) return shortMatch[1];

  // music.youtube.com/watch?v=ID
  const musicMatch = trimmed.match(/music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
  if (musicMatch?.[1]) return musicMatch[1];

  // ID directo de 11 caracteres
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

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
 * Obtiene el título, autor y miniatura de un video de YouTube mediante oEmbed oficial
 */
export async function getYouTubeMetadata(url: string): Promise<YouTubeMetadata | null> {
  try {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) return null;

    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      title: data.title ?? `Canción (${videoId})`,
      author: data.author_name ?? "YouTube",
      thumbnailUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch (err) {
    console.warn("No se pudo obtener metadata de YouTube:", err);
    return null;
  }
}

/**
 * Descarga y extrae el audio de un video de YouTube como un ArrayBuffer nativo (M4A/MP3)
 * utilizando descarga directa por chunks para máxima velocidad y fidelidad sonora.
 */
export async function downloadYouTubeAudioBuffer(
  urlOrVideoId: string,
  onProgress?: ((msg: string) => void) | undefined,
): Promise<{
  buffer: ArrayBuffer;
  title: string;
  author: string;
  mimeType: string;
  extension: string;
}> {
  const videoId = extractYouTubeVideoId(urlOrVideoId) || urlOrVideoId.trim();
  if (!videoId || videoId.length !== 11) {
    throw new Error("El enlace o identificador de YouTube no es válido.");
  }

  onProgress?.("Conectando con YouTube y analizando pistas de audio...");

  // 1. Clientes de YouTube Innertube para obtención de streams directos sin descifrado
  const clients = [
    {
      clientName: "ANDROID_VR",
      clientVersion: "1.60.19",
      deviceMake: "Oculus",
      deviceModel: "Quest 3",
      osName: "Android",
      osVersion: "12",
    },
    {
      clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
      clientVersion: "2.0",
    },
    {
      clientName: "WEB_EMBEDDED_PLAYER",
      clientVersion: "1.20240313.01.00",
    },
  ];

  let playerData: any = null;
  for (const c of clients) {
    try {
      const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        body: JSON.stringify({
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
          context: { client: { ...c, hl: "es", gl: "ES" } },
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (
          json.streamingData?.adaptiveFormats?.some(
            (f: any) => f.mimeType?.includes("audio") && f.url,
          )
        ) {
          playerData = json;
          break;
        }
      }
    } catch {
      continue;
    }
  }

  if (playerData) {
    const title = playerData.videoDetails?.title || "Audio de YouTube";
    const author = playerData.videoDetails?.author || "YouTube";
    const audioFormats = (playerData.streamingData.adaptiveFormats as any[]).filter(
      (f) => f.mimeType?.includes("audio") && f.url,
    );

    const bestFormat =
      audioFormats.find((f) => f.mimeType?.includes("audio/mp4")) || audioFormats[0];

    if (bestFormat?.url) {
      onProgress?.(`Descargando audio de "${title.slice(0, 25)}..." a alta velocidad...`);
      let fullBuffer: Uint8Array | null = null;
      try {
        const contentLength = Number(bestFormat.contentLength);
        if (contentLength && contentLength > 0) {
          const chunkSize = 2 * 1024 * 1024; // Trozos de 2MB en paralelo
          const numChunks = Math.ceil(contentLength / chunkSize);
          const promises: Promise<ArrayBuffer>[] = [];

          for (let i = 0; i < numChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(contentLength - 1, (i + 1) * chunkSize - 1);
            promises.push(
              fetch(bestFormat.url, {
                headers: {
                  Range: `bytes=${start}-${end}`,
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                },
              }).then((r) => {
                if (!r.ok && r.status !== 206) throw new Error("Chunk download failed");
                return r.arrayBuffer();
              }),
            );
          }

          const buffers = await Promise.all(promises);
          const totalLength = buffers.reduce((acc, b) => acc + b.byteLength, 0);
          fullBuffer = new Uint8Array(totalLength);
          let offset = 0;
          for (const buf of buffers) {
            fullBuffer.set(new Uint8Array(buf), offset);
            offset += buf.byteLength;
          }
        }
      } catch {
        fullBuffer = null;
      }

      if (!fullBuffer || fullBuffer.byteLength < 20000) {
        // Descarga directa completa como fallback
        try {
          const directRes = await fetch(bestFormat.url, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          });
          if (directRes.ok) {
            const arr = await directRes.arrayBuffer();
            fullBuffer = new Uint8Array(arr);
          }
        } catch {
          fullBuffer = null;
        }
      }

      if (fullBuffer && fullBuffer.byteLength > 20000) {
        return {
          buffer: fullBuffer.buffer as ArrayBuffer,
          title,
          author,
          mimeType: bestFormat.mimeType?.split(";")[0] || "audio/mp4",
          extension: bestFormat.mimeType?.includes("webm") ? "webm" : "m4a",
        };
      }
    }
  }

  // 2. Fallback a ytdl-core si está disponible en el servidor
  try {
    const ytdlMod = await import("@distube/ytdl-core");
    const ytdl = (ytdlMod as any).default || ytdlMod;
    if (typeof ytdl.getInfo === "function") {
      onProgress?.("Analizando flujo de audio con extractor de seguridad...");
      const info = await ytdl.getInfo(videoId);
      const formats = ytdl.filterFormats(info.formats, "audioonly");
      const best = formats.find((f: any) => f.mimeType?.includes("mp4")) || formats[0];
      if (best?.url) {
        const res = await fetch(best.url, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          if (buf.byteLength > 20000) {
            return {
              buffer: buf,
              title: info.videoDetails?.title || "Audio de YouTube",
              author: info.videoDetails?.author?.name || "YouTube",
              mimeType: best.mimeType?.split(";")[0] || "audio/mp4",
              extension: best.mimeType?.includes("webm") ? "webm" : "m4a",
            };
          }
        }
      }
    }
  } catch {
    // Continuar a endpoints secundarios
  }

  // 3. Fallback a endpoints secundarios y proxies de alta disponibilidad
  onProgress?.("Descargando flujo de audio alternativo...");
  const proxyEndpoints = [
    `https://inv.tux.pizza/latest_version?id=${videoId}&itag=140`,
    `https://invidious.nerdvpn.de/latest_version?id=${videoId}&itag=140`,
    `https://yewtu.be/latest_version?id=${videoId}&itag=140`,
    `https://inv.tux.pizza/latest_version?id=${videoId}&itag=18`,
    `https://invidious.nerdvpn.de/latest_version?id=${videoId}&itag=18`,
    `https://yt-stream.deno.dev/audio/${videoId}`,
  ];

  for (const ep of proxyEndpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(ep, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0", Accept: "audio/*,video/mp4" },
      });
      clearTimeout(timeout);
      if (res.ok) {
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("text/html")) {
          const buf = await res.arrayBuffer();
          if (buf.byteLength > 20000) {
            const meta = await getYouTubeMetadata(urlOrVideoId);
            return {
              buffer: buf,
              title: meta?.title || `Audio YouTube (${videoId})`,
              author: meta?.author || "YouTube",
              mimeType: ct.includes("audio") ? ct : "audio/mp4",
              extension: ct.includes("audio/mpeg") ? "mp3" : "m4a",
            };
          }
        }
      }
    } catch {
      continue;
    }
  }

  throw new Error(
    "No se pudo extraer el audio de este video de YouTube. Te sugerimos subir el archivo de audio directamente.",
  );
}

export async function downloadYouTubeMedia(
  url: string,
  onProgress?: ((msg: string) => void) | undefined,
): Promise<{ blob: Blob; mimeType: string; filename: string }> {
  const result = await downloadYouTubeAudioBuffer(url, onProgress);
  const blob = new Blob([result.buffer], { type: result.mimeType });
  const cleanTitle = result.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  return {
    blob,
    mimeType: result.mimeType,
    filename: `${cleanTitle}.${result.extension}`,
  };
}

export const downloadYouTubeAudio = downloadYouTubeMedia;
