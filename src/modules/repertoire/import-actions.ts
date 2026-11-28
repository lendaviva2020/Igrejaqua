"use server";

import { z } from "zod";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { fail, ok, type Result } from "@/lib/result";
import { allow } from "@/lib/security/rate-limit";
import { parseChordPro, ChordProError } from "@/lib/chords/chordpro";
import { extractSongFromHtml, extractSongFromText, type ImportedSong } from "./import/extract";
import { fetchPublicPage, PageFetchError, type FetchFailure } from "./import/safe-fetch";
import { splitVideoTitle, youTubeOEmbedUrl, youTubeVideoId, youTubeWatchUrl } from "./import/youtube";

const ImportFromLinkSchema = z.object({ url: z.string().trim().min(8, "Cole o link da música").max(2048, "Link longo demais") }).strict();

export interface SongImportResult extends ImportedSong {
  /** Domínio de onde os dados vieram (exibido para a revisão); null quando a cifra foi colada. */
  readonly sourceHost: string | null;
  /** Link de referência para salvar com a música (vídeo); null quando não se aplica. */
  readonly referenceUrl: string | null;
}

const OEmbedSchema = z.object({ title: z.string().min(1).max(500), author_name: z.string().max(200).optional() });

/** Vídeo do YouTube: título e canal pelo oEmbed oficial. Vídeo não tem cifra; o link fica como referência. */
async function importFromYouTube(videoId: string): Promise<Result<SongImportResult>> {
  let page;
  try {
    page = await fetchPublicPage(youTubeOEmbedUrl(videoId), { allowJson: true });
  } catch (e) {
    if (e instanceof PageFetchError && (e.reason === "refused" || e.reason === "http-error")) {
      return fail("NOT_FOUND", "Não conseguimos ler esse vídeo (pode ser privado, removido ou sem permissão de incorporação). Confira o link.");
    }
    if (e instanceof PageFetchError) return fail("UNAVAILABLE", FAILURE_MESSAGE[e.reason]);
    console.error("song_import_youtube_unexpected", e instanceof Error ? e.name : "unknown");
    return fail("INTERNAL", FAILURE_MESSAGE.network);
  }
  let json: unknown;
  try {
    json = JSON.parse(page.body);
  } catch {
    return fail("UNAVAILABLE", FAILURE_MESSAGE.network);
  }
  const data = OEmbedSchema.safeParse(json);
  if (!data.success) return fail("UNAVAILABLE", FAILURE_MESSAGE.network);
  const { title, artist } = splitVideoTitle(data.data.title, data.data.author_name ?? null);
  const warnings: ImportedSong["warnings"] = ["video-no-chords", ...(artist === null ? (["artist-missing"] as const) : [])];
  return ok({ title, artist, key: null, bpm: null, capo: null, chordpro: "", warnings, sourceHost: "youtube.com", referenceUrl: youTubeWatchUrl(videoId) });
}

const FAILURE_MESSAGE: Readonly<Record<FetchFailure, string>> = {
  "invalid-url": "Use um link completo que comece com https://.",
  "blocked-address": "Esse endereço não pode ser acessado. Use o link público da página da música.",
  refused: "Esse site não permite importação automática. Abra a página, copie a cifra e use Colar cifra.",
  timeout: "A página demorou demais para responder. Tente de novo em instantes.",
  "too-large": "A página é grande demais para ser importada.",
  "unsupported-type": "Esse link não é uma página de texto. Use o link da página da cifra.",
  "http-error": "A página não abriu (o site respondeu com erro). Confira o link.",
  "too-many-redirects": "O link redireciona vezes demais. Use o endereço final da página.",
  network: "Não foi possível abrir a página. Confira o link e tente de novo.",
};

/**
 * Busca uma página de cifra pelo link e devolve os dados para PREENCHER o formulário.
 * Não grava nada: a pessoa revisa e salva (createSongAction valida tudo de novo).
 */
export async function importSongFromLinkAction(input: unknown): Promise<Result<SongImportResult>> {
  const parsed = ImportFromLinkSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", parsed.error.issues[0]?.message ?? "Link inválido.", { url: parsed.error.issues.map((i) => i.message) });
  const ctx = await resolveChurchContext();
  if (!can(ctx, "repertoire.manage")) return fail("FORBIDDEN", "Você não pode gerenciar o repertório.");
  // Cada importação abre uma página externa a partir do servidor: limite por pessoa.
  if (!(await allow(`song-import:${ctx.userId}`, 30, 3600))) return fail("RATE_LIMITED", "Muitas importações seguidas. Aguarde alguns minutos.");

  const videoId = youTubeVideoId(parsed.data.url);
  if (videoId !== null) return importFromYouTube(videoId);

  let page;
  try {
    page = await fetchPublicPage(parsed.data.url);
  } catch (e) {
    if (e instanceof PageFetchError) {
      if (e.reason === "invalid-url") return fail("VALIDATION", FAILURE_MESSAGE[e.reason], { url: [FAILURE_MESSAGE[e.reason]] });
      // "fallback: paste" orienta a tela a abrir a opção Colar cifra, que funciona com qualquer site.
      return fail("UNAVAILABLE", FAILURE_MESSAGE[e.reason], e.reason === "refused" || e.reason === "http-error" || e.reason === "unsupported-type" ? { fallback: ["paste"] } : undefined);
    }
    console.error("song_import_unexpected", e instanceof Error ? e.name : "unknown");
    return fail("INTERNAL", FAILURE_MESSAGE.network);
  }

  const isHtml = page.contentType === "" || page.contentType.includes("html") || /^\s*<(!doctype|html)/i.test(page.body);
  const song = isHtml ? extractSongFromHtml(page.body) : extractSongFromText(page.body);
  if (song.title === null && song.chordpro === "") return fail("NOT_FOUND", "Não encontramos uma música nessa página. Confira se o link é da página da cifra.");

  // A cifra importada precisa passar no mesmo validador do salvamento.
  try {
    parseChordPro(song.chordpro);
  } catch (e) {
    if (e instanceof ChordProError) return fail("VALIDATION", "A cifra dessa página é grande demais para o repertório.");
    throw e;
  }
  return ok({ ...song, sourceHost: new URL(page.url).hostname.replace(/^www\./, ""), referenceUrl: null });
}
