"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { joinWithCodeAction } from "@/modules/churches/actions";

export function JoinByLinkButton({ code }: { code: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState<string | null>(null);

  const request = () => {
    setError(null);
    start(async () => {
      const r = await joinWithCodeAction({ code });
      if (!r.ok) { setError(r.error.message); return; }
      if (r.data.status === "active") { router.replace("/dashboard"); router.refresh(); return; }
      setRequested(r.data.churchName ?? "a igreja");
    });
  };

  if (requested !== null) {
    return (
      <div role="status" className="rounded-superficie border border-ambar bg-superficie-2 p-4">
        <p className="font-medium">Pedido enviado para {requested}.</p>
        <p className="mt-1 text-sm text-texto-2">Assim que a administração aprovar, a igreja aparece em <Link className="underline" href="/selecionar-igreja">Sua igreja</Link> e você já pode entrar.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <Button type="button" onClick={request} disabled={pending}>{pending ? "Enviando pedido…" : "Pedir para entrar"}</Button>
      {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
    </div>
  );
}
