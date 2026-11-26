"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createPrayerAction } from "@/modules/prayer/actions";
import { CreatePrayerSchema } from "@/modules/prayer/schemas";

export function PrayerForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = CreatePrayerSchema.safeParse({ body, anonymous });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Dados inválidos."); return; }
    setError(null);
    start(async () => {
      const r = await createPrayerAction(parsed.data);
      if (r.ok) { setBody(""); setAnonymous(false); router.refresh(); } else setError(r.error.message);
    });
  };
  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1.5 text-sm font-medium">Seu pedido de oração
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000} className="rounded-controle border border-tinta-2 bg-superficie p-3 text-base font-normal" />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        Publicar de forma anônima (seu nome não aparece para ninguém, nem para a liderança)
      </label>
      {error ? <p role="alert" className="text-sm text-vinho">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar pedido"}</Button>
    </form>
  );
}
