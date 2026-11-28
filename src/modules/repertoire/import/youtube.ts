/**
 * Links do YouTube no importador: reconhecimento do vídeo e limpeza do título para separar
 * música e artista. Funções puras. Os dados vêm do oEmbed oficial do YouTube (endpoint público
 * feito para isso), nunca de raspagem da página.
 */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"]);

/** Id do vídeo para watch, youtu.be, shorts, live e embed; null se não for vídeo do YouTube. */
export function youTubeVideoId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;
  const parts = url.pathname.split("/").filter((p) => p !== "");
  let id: string | null = null;
  if (host.endsWith("youtu.be")) id = parts[0] ?? null;
  else if (parts[0] === "watch") id = url.searchParams.get("v");
  else if (parts[0] === "shorts" || parts[0] === "live" || parts[0] === "embed" || parts[0] === "v") id = parts[1] ?? null;
  return id !== null && VIDEO_ID.test(id) ? id : null;
}

/** Endereço canônico do vídeo (o que fica salvo como referência). */
export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youTubeOEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youTubeWatchUrl(videoId))}`;
}

/** Trechos de título que descrevem o vídeo, não a música. */
const NOISE = /\b(ao vivo|live|clipe|clip|oficial|official|v[ií]deo|video ?clip|lyrics?|letra|legendad[oa]|[aá]udio|audio|visualizer|playback|cover|hd|4k|dvd|cd|ep|álbum|album|session|sess[aã]o|feat\.?|ft\.?)\b/i;

const NOISE_SEGMENT = /^(ao vivo|live|clipe|clip|v[ií]deo|video|lyrics?|letra|legendad[oa]|dvd|cd|ep|[aá]lbum|album|playback|oficial|official|[aá]udio|audio|visualizer|session|sess[aã]o)\b/i;

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Nome do canal sem sufixos automáticos ("Artista - Topic", "ArtistaVEVO", "Artista Oficial"). */
export function cleanChannelName(author: string): string {
  return author.replace(/\s*-\s*topic$/i, "").replace(/vevo$/i, "").replace(/\s+(oficial|official|tv|channel|canal)$/i, "").trim();
}

/**
 * Separa música e artista do título do vídeo.
 * Convenção do YouTube: "Artista - Música (Ao Vivo)". Quando um dos lados coincide com o canal,
 * esse lado é o artista (cobre "Música | Artista"). Sem separador: título = música, artista = canal.
 */
export function splitVideoTitle(rawTitle: string, rawAuthor: string | null): { title: string | null; artist: string | null } {
  const author = rawAuthor === null ? null : cleanChannelName(rawAuthor);
  let t = rawTitle
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/[([{][^)\]}]*[)\]}]/g, (seg) => (NOISE.test(seg) ? " " : seg))
    .replace(/\s+/g, " ")
    .trim();
  // Segmentos inteiros que só descrevem o vídeo ("Ao Vivo", "Clipe Oficial", "DVD Nome do DVD") saem.
  const meaningful = t.split(/\s+[-–—|]\s+|\s*\|\s*/).map((p) => p.trim()).filter((p) => p !== "" && !NOISE_SEGMENT.test(p));
  if (meaningful.length >= 2) {
    const authorKey = author === null ? "" : normalizeName(author);
    const artistIndex = authorKey === "" ? -1 : meaningful.findIndex((p) => { const k = normalizeName(p); return k !== "" && (k === authorKey || k.includes(authorKey) || authorKey.includes(k)); });
    if (artistIndex >= 0) {
      const title = meaningful.find((_, i) => i !== artistIndex) ?? null;
      return { title: title === null ? null : title.slice(0, 200), artist: (meaningful[artistIndex] ?? "").slice(0, 200) };
    }
    return { title: (meaningful[1] ?? "").slice(0, 200), artist: (meaningful[0] ?? "").slice(0, 200) };
  }
  t = (meaningful[0] ?? t).slice(0, 200);
  return { title: t === "" ? null : t, artist: author === null || author === "" ? null : author.slice(0, 200) };
}
