"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addLibrarySongAction } from "@/modules/repertoire/library-actions";

/** Adiciona a música ao repertório e abre a página dela (cifra, tom, Modo Palco). */
export function AddLibrarySong({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const add = (): void => {
    setError(null);
    start(async () => {
      const r = await addLibrarySongAction({ id });
      if (r.ok) router.push(`/repertorio/${r.data.songId}`);
      else setError(r.error.message);
    });
  };
  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="secondary" onClick={add} disabled={pending} aria-label={`Adicionar ${title} ao repertório`}>
        <Plus aria-hidden="true" size={16} />{pending ? "Adicionando…" : "Adicionar ao repertório"}
      </Button>
      {error !== null ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
    </div>
  );
}
