/**
 * Links do Spotify no importador. Funções puras: reconhecimento do link e leitura das meta tags
 * de prévia de link (as mesmas que WhatsApp e redes sociais usam) da página pública da faixa.
 * Formato conferido em respostas reais (2026-11-28):
 *   <meta property="og:title" content="Nome da música"/>
 *   <meta name="music:musician_description" content="Artista"/>
 *   <meta property="og:description" content="Artista · Álbum · Song · 1987"/>
 */

const TRACK_ID = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_HOSTS = new Set(["open.spotify.com", "play.spotify.com"]);
const SHORT_HOSTS = new Set(["spotify.link", "spoti.fi"]);

export type SpotifyLink =
  | { readonly kind: "track"; readonly id: string }
  | { readonly kind: "not-a-track" }   // álbum, playlist, artista, episódio
  | { readonly kind: "short-link" };    // spotify.link / spoti.fi: precisa seguir o redirecionamento

/** Reconhece links e URIs do Spotify; null se não for Spotify. */
export function parseSpotifyLink(raw: string): SpotifyLink | null {
  const value = raw.trim();
  const uri = /^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]+)$/.exec(value);
  if (uri !== null) return uri[1] === "track" && TRACK_ID.test(uri[2] ?? "") ? { kind: "track", id: uri[2] as string } : { kind: "not-a-track" };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (SHORT_HOSTS.has(host)) return { kind: "short-link" };
  if (!SPOTIFY_HOSTS.has(host)) return null;
  // /track/ID ou /intl-pt/track/ID (prefixo de idioma)
  const parts = url.pathname.split("/").filter((p) => p !== "" && !/^intl-[a-z]{2}(-[a-z]{2})?$/i.test(p));
  if (parts[0] === "track" && TRACK_ID.test(parts[1] ?? "")) return { kind: "track", id: parts[1] as string };
  return { kind: "not-a-track" };
}

/** Endereço canônico da faixa (o que fica salvo como referência). */
export function spotifyTrackUrl(id: string): string {
  return `https://open.spotify.com/track/${id}`;
}

export function spotifyOEmbedUrl(id: string): string {
  return `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyTrackUrl(id))}`;
}

/** Id da faixa dentro de um texto/HTML (página intermediária de link curto). */
export function findSpotifyTrackId(text: string): string | null {
  const m = /open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?track\/([A-Za-z0-9]{22})/i.exec(text);
  return m?.[1] ?? null;
}

function meta(html: string, key: string): string | null {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']*)["']`, "i").exec(html);
  const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`, "i").exec(html);
  const v = (a?.[1] ?? b?.[1] ?? "").trim();
  return v === "" ? null : v;
}

/** Música e artista a partir da página pública da faixa. */
export function readSpotifyTrackPage(html: string, decode: (s: string) => string): { title: string | null; artist: string | null } {
  const title = meta(html, "og:title") ?? meta(html, "twitter:title");
  // Preferência: campo próprio do artista; senão o 1º trecho de "Artista · Álbum · Song · Ano".
  const artist = meta(html, "music:musician_description") ?? (meta(html, "og:description")?.split(" · ")[0] ?? null);
  const clean = (v: string | null): string | null => {
    if (v === null) return null;
    const t = decode(v).replace(/\s+/g, " ").trim().slice(0, 200);
    return t === "" ? null : t;
  };
  return { title: clean(title), artist: clean(artist) };
}
