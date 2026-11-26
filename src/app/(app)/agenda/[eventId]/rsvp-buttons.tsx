"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setRsvpAction } from "@/modules/rsvp/actions";
import { RSVP_LABEL, RSVP_STATUSES } from "@/modules/rsvp/schemas";

export function RsvpButtons({ sessionId, current, goingCount }: { sessionId: string; current: (typeof RSVP_STATUSES)[number] | undefined; goingCount: number | undefined }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div role="group" aria-label="Sua presença" className="mt-2 flex flex-wrap items-center gap-2">
      {RSVP_STATUSES.map((s) => (
        <Button key={s} type="button" variant={current === s ? "primary" : "secondary"} aria-pressed={current === s} disabled={pending}
          onClick={() => { setError(null); start(async () => { const r = await setRsvpAction({ sessionId, status: s }); if (r.ok) router.refresh(); else setError(r.error.message); }); }}>
          {RSVP_LABEL[s]}
        </Button>
      ))}
      {goingCount !== undefined ? <span className="tabular text-sm text-texto-2">{goingCount} confirmado(s)</span> : null}
      {error ? <p role="alert" className="w-full text-sm text-perigo">{error}</p> : null}
    </div>
  );
}
