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
import type { SongImportResult } from "@/modules/repertoire/import-actions";
import { SongImport } from "./song-import";

type FormValues = z.input<typeof CreateSongSchema>;

export function SongForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, getValues, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(CreateSongSchema),
    defaultValues: { title: "", artist: "", originalKey: "G", chordpro: "", referenceUrl: "" },
  });
  /**
   * Preenche o formulário com o que foi importado; o que não veio da página mantém o valor atual.
   * Sem rolagem automática: o resumo e os avisos da importação ficam à vista para a revisão.
   */
  const applyImport = (song: SongImportResult): void => {
    const current = getValues();
    reset({
      title: song.title ?? current.title,
      artist: song.artist ?? current.artist ?? "",
      originalKey: song.key ?? current.originalKey,
      chordpro: song.chordpro !== "" ? song.chordpro : current.chordpro,
      referenceUrl: song.referenceUrl ?? current.referenceUrl ?? "",
      ...(song.bpm !== null ? { bpm: song.bpm } : {}),
    });
  };
  const onSubmit = handleSubmit((values) => {
    setError(null);
    start(async () => {
      const r = await createSongAction(values);
      if (r.ok) { reset(); router.push(`/repertorio/${r.data.songId}`); } else setError(r.error.message);
    });
  });
  return (
    <>
    <SongImport onImported={applyImport} />
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4" noValidate>
      <FormField label="Título" error={errors.title?.message} {...register("title")} />
      <FormField label="Autor/Intérprete (opcional)" error={errors.artist?.message} {...register("artist")} />
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="originalKey" className="text-sm font-medium">Tom original</label>
          <select id="originalKey" className="min-h-11 rounded-controle border border-borda bg-fundo px-3" {...register("originalKey")}>
            {MUSICAL_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <FormField label="BPM (opcional)" type="number" inputMode="numeric" error={errors.bpm?.message} {...register("bpm")} />
      </div>
      <FormField label="Link de referência (opcional)" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://www.youtube.com/watch?v=…" hint="Vídeo ou áudio para a equipe ouvir antes do ensaio." error={errors.referenceUrl?.message} {...register("referenceUrl")} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="chordpro" className="text-sm font-medium">Cifra (ChordPro)</label>
        <textarea id="chordpro" rows={10} spellCheck={false} aria-describedby="chordpro-hint" className="rounded-controle border border-borda bg-fundo p-3 font-mono text-sm" {...register("chordpro")} />
        <p id="chordpro-hint" className="text-xs text-texto-2">Acordes entre colchetes, no tom original: [G]Grande é o [D]Senhor. Use {"{start_of_chorus}"} para marcar seções.</p>
        {errors.chordpro?.message ? <p role="alert" className="text-sm text-perigo">{errors.chordpro.message}</p> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar música"}</Button>
    </form>
    </>
  );
}
