"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { moderatePrayerAction, setPrayingAction } from "@/modules/prayer/actions";

export function PrayerActions({ requestId, iPray, count, canModerate, status }: { requestId: string; iPray: boolean; count: number; canModerate: boolean; status: "open" | "answered" | "archived" | "removed" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (job: () => Promise<{ ok: true } | { ok: false; error: { message: string } }>) => {
    setError(null);
    start(async () => { const r = await job(); if (r.ok) router.refresh(); else setError(r.error.message); });
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button type="button" variant={iPray ? "primary" : "secondary"} aria-pressed={iPray} disabled={pending} onClick={() => run(() => setPrayingAction({ requestId, praying: !iPray }))}>
        {iPray ? "Estou orando" : "Vou orar"}
      </Button>
      <span className="tabular text-sm text-tinta-2">{count} {count === 1 ? "pessoa orando" : "pessoas orando"}</span>
      {canModerate ? (
        <>
          {status === "open" ? <Button type="button" variant="secondary" disabled={pending} onClick={() => run(() => moderatePrayerAction({ requestId, status: "answered" }))}>Marcar como respondido</Button> : null}
          <Button type="button" variant="secondary" disabled={pending} onClick={() => run(() => moderatePrayerAction({ requestId, status: "archived" }))}>Arquivar</Button>
        </>
      ) : null}
      {error ? <p role="alert" className="w-full text-sm text-vinho">{error}</p> : null}
    </div>
  );
}
