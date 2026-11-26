"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setContentStatusAction } from "@/modules/content/actions";

export function ContentActions({ id, status }: { id: string; status: "draft" | "scheduled" | "published" | "archived" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (next: "published" | "archived" | "draft") => {
    setError(null);
    start(async () => { const r = await setContentStatusAction({ id, status: next }); if (r.ok) router.refresh(); else setError(r.error.message); });
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {status === "draft" || status === "scheduled" ? <Button type="button" disabled={pending} onClick={() => run("published")}>Publicar agora</Button> : null}
      {status === "scheduled" ? <Button type="button" variant="secondary" disabled={pending} onClick={() => run("draft")}>Cancelar agendamento</Button> : null}
      <Button type="button" variant="secondary" disabled={pending} onClick={() => run("archived")}>Arquivar</Button>
      {error ? <p role="alert" className="w-full text-sm text-perigo">{error}</p> : null}
    </div>
  );
}
