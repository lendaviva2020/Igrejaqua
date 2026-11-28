import type { Metadata } from "next";
import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ChordSheet } from "@/components/music/chord-sheet";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { parseChordPro, transposeSong } from "@/lib/chords/chordpro";
import { semitonesBetween, transposeKey } from "@/lib/music-theory";
import { getDefaultVersionBySong } from "@/modules/repertoire/queries";
import { KEY_PATTERN } from "@/modules/repertoire/schemas";

export const metadata: Metadata = { title: "Música" };

/** Link de referência salvo com a música. Só https é exibido (o banco já recusa outros esquemas). */
function referenceLink(raw: string | null): { href: string; label: string; host: string } | null {
  if (raw === null || !raw.startsWith("https://")) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^(www|m|music)\./, "");
    const isVideo = host === "youtube.com" || host === "youtu.be";
    return { href: url.toString(), label: isVideo ? "Ouvir no YouTube" : "Ouvir referência", host: isVideo ? "" : host };
  } catch {
    return null;
  }
}

export default async function SongPage({ params, searchParams }: { params: Promise<{ songId: string }>; searchParams: Promise<{ tom?: string }> }) {
  const { songId } = await params;
  if (!z.string().uuid().safeParse(songId).success) notFound();
  const { tom } = await searchParams;
  const ctx = await resolveChurchContext();
  const version = await getDefaultVersionBySong(ctx.churchId, songId);
  if (version === null) notFound();

  const target = tom !== undefined && KEY_PATTERN.test(tom) ? tom : version.original_key;
  const song = transposeSong(parseChordPro(version.chordpro), version.original_key, target);
  const shift = semitonesBetween(version.original_key, target);
  const up = transposeKey(target, 1);
  const down = transposeKey(target, -1);

  const reference = referenceLink(version.songs.reference_url);
  return (
    <>
      <PageHeader
        title={version.songs.title}
        description={[version.songs.artist, `Tom original ${version.original_key}`, version.bpm ? `${version.bpm} BPM` : null].filter(Boolean).join(" · ")}
        actions={<Link className="inline-flex min-h-11 items-center rounded-controle bg-palco px-4 text-sm text-palco-txt" href={`/palco/${version.id}?tom=${encodeURIComponent(target)}`}>Abrir no Palco</Link>}
      />
      {reference !== null ? (
        <a href={reference.href} target="_blank" rel="noopener noreferrer" className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-borda px-4 text-sm font-semibold text-texto hover:border-ambar">
          <PlayCircle aria-hidden="true" size={18} className="text-ambar" />{reference.label}<span className="text-texto-2">{reference.host}</span><span className="sr-only"> (abre em nova aba)</span>
        </a>
      ) : null}
      <nav aria-label="Transposição" className="mb-6 flex items-center gap-3 text-sm">
        <Link className="inline-flex min-h-11 items-center border border-borda px-3" href={`?tom=${encodeURIComponent(down)}`} aria-label={`Descer meio tom para ${down}`}>−½</Link>
        <p aria-live="polite">Tom <strong className="font-mono">{target}</strong>{shift !== 0 ? ` (${shift > 0 ? "+" : ""}${shift})` : ""}</p>
        <Link className="inline-flex min-h-11 items-center border border-borda px-3" href={`?tom=${encodeURIComponent(up)}`} aria-label={`Subir meio tom para ${up}`}>+½</Link>
        {target !== version.original_key ? <Link className="text-ambar-claro underline" href="?">Voltar ao original</Link> : null}
      </nav>
      <ChordSheet song={song} tone="paper" />
      {version.songs.copyright_notice ? <p className="mt-8 text-xs text-texto-2">{version.songs.copyright_notice}</p> : null}
    </>
  );
}
