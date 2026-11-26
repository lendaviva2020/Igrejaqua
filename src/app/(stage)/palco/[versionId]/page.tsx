import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ChordSheet } from "@/components/music/chord-sheet";
import { resolveChurchContext } from "@/lib/auth/context";
import { parseChordPro, transposeSong } from "@/lib/chords/chordpro";
import { transposeKey } from "@/lib/music-theory";
import { getVersion } from "@/modules/repertoire/queries";
import { KEY_PATTERN } from "@/modules/repertoire/schemas";
import { WakeLock } from "./wake-lock";

export const metadata: Metadata = { title: "Palco" };

const SIZES = [1.5, 2, 2.5, 3, 3.5] as const;

export default async function StagePage({ params, searchParams }: { params: Promise<{ versionId: string }>; searchParams: Promise<{ tom?: string; t?: string }> }) {
  const { versionId } = await params;
  if (!z.string().uuid().safeParse(versionId).success) notFound();
  const { tom, t } = await searchParams;
  const ctx = await resolveChurchContext();
  const version = await getVersion(ctx.churchId, versionId);
  if (version === null) notFound();

  const target = tom !== undefined && KEY_PATTERN.test(tom) ? tom : version.original_key;
  const sizeIndex = Math.min(Math.max(Number.parseInt(t ?? "1", 10) || 0, 0), SIZES.length - 1);
  const size = SIZES[sizeIndex] ?? 2;
  const song = transposeSong(parseChordPro(version.chordpro), version.original_key, target);
  const link = (nextTom: string, nextSize: number): string => `?tom=${encodeURIComponent(nextTom)}&t=${nextSize}`;
  const ctl = "inline-flex min-h-12 min-w-12 items-center justify-center border border-palco-mudo px-4 text-palco-txt";

  return (
    <div style={{ ["--stage-size" as string]: `${size}rem` }} className="mx-auto max-w-5xl px-6 pb-24 pt-6">
      <WakeLock />
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-palco-mudo pb-4">
        <div>
          <h1 className="font-display text-4xl">{version.songs.title}</h1>
          <p className="text-palco-mudo">Tom <span className="font-mono text-palco-acorde">{target}</span>{version.capo ? ` · Capo ${version.capo}` : ""}{version.bpm ? ` · ${version.bpm} BPM` : ""}</p>
        </div>
        <nav aria-label="Controles do palco" className="flex flex-wrap items-center gap-2">
          <Link className={ctl} href={link(transposeKey(target, -1), sizeIndex)} aria-label="Descer meio tom">−½</Link>
          <Link className={ctl} href={link(transposeKey(target, 1), sizeIndex)} aria-label="Subir meio tom">+½</Link>
          <Link className={ctl} href={link(target, Math.max(sizeIndex - 1, 0))} aria-label="Diminuir letra">A−</Link>
          <Link className={ctl} href={link(target, Math.min(sizeIndex + 1, SIZES.length - 1))} aria-label="Aumentar letra">A+</Link>
          <Link className={ctl} href={`/repertorio/${version.song_id}?tom=${encodeURIComponent(target)}`}>Sair</Link>
        </nav>
      </header>
      <ChordSheet song={song} tone="stage" />
      {version.songs.copyright_notice ? <p className="mt-10 text-sm text-palco-mudo">{version.songs.copyright_notice}</p> : null}
    </div>
  );
}
