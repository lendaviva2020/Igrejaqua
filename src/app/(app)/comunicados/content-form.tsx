"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { createContentAction } from "@/modules/content/actions";
import { CONTENT_KINDS, CONTENT_KIND_LABEL, CreateContentSchema } from "@/modules/content/schemas";

export interface AudienceOption { readonly value: string; readonly label: string }

export function ContentForm({ audiences }: { audiences: readonly AudienceOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<(typeof CONTENT_KINDS)[number]>("announcement");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scripture, setScripture] = useState("");
  const [audience, setAudience] = useState(audiences[0]?.value ?? "church");

  const submit = (publish: boolean) => {
    const parsed = CreateContentSchema.safeParse({
      kind, title, body, publish,
      ...(kind === "devotional" && scripture.trim() ? { scriptureRef: scripture } : {}),
      ...(audience !== "church" ? { ministryId: audience } : {}),
    });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Dados inválidos."); return; }
    setError(null);
    start(async () => {
      const r = await createContentAction(parsed.data);
      if (r.ok) { setTitle(""); setBody(""); setScripture(""); router.refresh(); } else setError(r.error.message);
    });
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(true); }} className="flex max-w-xl flex-col gap-4" noValidate>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">Tipo
          <select value={kind} onChange={(e) => setKind(e.target.value as (typeof CONTENT_KINDS)[number])} className="min-h-11 rounded-controle border border-borda bg-fundo px-3 font-normal">
            {CONTENT_KINDS.map((k) => <option key={k} value={k}>{CONTENT_KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">Público
          <select value={audience} onChange={(e) => setAudience(e.target.value)} className="min-h-11 rounded-controle border border-borda bg-fundo px-3 font-normal">
            {audiences.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </label>
      </div>
      <FormField label="Título" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      {kind === "devotional" ? <FormField label="Referência bíblica (opcional)" value={scripture} onChange={(e) => setScripture(e.target.value)} maxLength={120} /> : null}
      <label className="flex flex-col gap-1.5 text-sm font-medium">Conteúdo
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={20000} className="rounded-controle border border-borda bg-fundo p-3 text-base font-normal" />
      </label>
      {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Publicar agora"}</Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => submit(false)}>Salvar rascunho</Button>
      </div>
    </form>
  );
}
