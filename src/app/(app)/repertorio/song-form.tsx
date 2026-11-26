"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { createSongAction } from "@/modules/repertoire/actions";
import { CreateSongSchema, MUSICAL_KEYS } from "@/modules/repertoire/schemas";
import type { z } from "zod";

type FormValues = z.input<typeof CreateSongSchema>;

export function SongForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(CreateSongSchema),
    defaultValues: { title: "", artist: "", originalKey: "G", chordpro: "" },
  });
  const onSubmit = handleSubmit((values) => {
    setError(null);
    start(async () => {
      const r = await createSongAction(values);
      if (r.ok) { reset(); router.push(`/repertorio/${r.data.songId}`); } else setError(r.error.message);
    });
  });
  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4" noValidate>
      <FormField label="Título" error={errors.title?.message} {...register("title")} />
      <FormField label="Autor/Intérprete (opcional)" error={errors.artist?.message} {...register("artist")} />
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="originalKey" className="text-sm font-medium">Tom original</label>
          <select id="originalKey" className="min-h-11 rounded-controle border border-tinta-2 bg-superficie px-3" {...register("originalKey")}>
            {MUSICAL_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <FormField label="BPM (opcional)" type="number" inputMode="numeric" error={errors.bpm?.message} {...register("bpm")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="chordpro" className="text-sm font-medium">Cifra (ChordPro)</label>
        <textarea id="chordpro" rows={10} spellCheck={false} aria-describedby="chordpro-hint" className="rounded-controle border border-tinta-2 bg-superficie p-3 font-mono text-sm" {...register("chordpro")} />
        <p id="chordpro-hint" className="text-xs text-tinta-2">Acordes entre colchetes, no tom original: [G]Grande é o [D]Senhor. Use {"{start_of_chorus}"} para marcar seções.</p>
        {errors.chordpro?.message ? <p role="alert" className="text-sm text-vinho">{errors.chordpro.message}</p> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-vinho">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar música"}</Button>
    </form>
  );
}
