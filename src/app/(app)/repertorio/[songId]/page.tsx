import type { Metadata } from "next";
import Link from "next/link";
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

  return (
    <>
      <PageHeader
        title={version.songs.title}
        description={[version.songs.artist, `Tom original ${version.original_key}`, version.bpm ? `${version.bpm} BPM` : null].filter(Boolean).join(" · ")}
        actions={<Link className="inline-flex min-h-11 items-center rounded-controle bg-palco px-4 text-sm text-palco-txt" href={`/palco/${version.id}?tom=${encodeURIComponent(target)}`}>Abrir no Palco</Link>}
      />
      <nav aria-label="Transposição" className="mb-6 flex items-center gap-3 text-sm">
        <Link className="inline-flex min-h-11 items-center border border-tinta-2 px-3" href={`?tom=${encodeURIComponent(down)}`} aria-label={`Descer meio tom para ${down}`}>−½</Link>
        <p aria-live="polite">Tom <strong className="font-mono">{target}</strong>{shift !== 0 ? ` (${shift > 0 ? "+" : ""}${shift})` : ""}</p>
        <Link className="inline-flex min-h-11 items-center border border-tinta-2 px-3" href={`?tom=${encodeURIComponent(up)}`} aria-label={`Subir meio tom para ${up}`}>+½</Link>
        {target !== version.original_key ? <Link className="text-nanquim underline" href="?">Voltar ao original</Link> : null}
      </nav>
      <ChordSheet song={song} tone="paper" />
      {version.songs.copyright_notice ? <p className="mt-8 text-xs text-tinta-2">{version.songs.copyright_notice}</p> : null}
    </>
  );
}
