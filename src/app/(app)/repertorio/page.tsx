import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { listSongs } from "@/modules/repertoire/queries";
import { SongForm } from "./song-form";

export const metadata: Metadata = { title: "Repertório" };

export default async function RepertoirePage() {
  const ctx = await resolveChurchContext();
  const songs = await listSongs(ctx.churchId);
  return (
    <>
      <PageHeader title="Repertório" description="Músicas e cifras da igreja." />
      {songs.length === 0 ? (
        <EmptyState title="Repertório vazio">{can(ctx, "repertoire.manage") ? "Cadastre a primeira música abaixo." : "A liderança ainda não cadastrou músicas."}</EmptyState>
      ) : (
        <ul className="divide-y divide-linha rounded-superficie border border-linha bg-superficie px-4">
          {songs.map((s) => (
            <li key={s.id}>
              <Link href={`/repertorio/${s.id}`} className="flex min-h-11 items-baseline justify-between gap-4 py-3 hover:bg-superficie">
                <span><span className="font-medium">{s.title}</span>{s.artist ? <span className="text-sm text-texto-2"> — {s.artist}</span> : null}</span>
                {s.default_key ? <span className="tabular font-mono text-sm text-ambar-claro">{s.default_key}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {can(ctx, "repertoire.manage") ? <section aria-labelledby="nova" className="mt-10"><h2 id="nova" className="mb-3 text-2xl">Nova música</h2><SongForm /></section> : null}
    </>
  );
}
