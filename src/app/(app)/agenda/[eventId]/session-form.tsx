"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { addSessionAction } from "@/modules/events/actions";
import { AddSessionSchema, type AddSessionInput } from "@/modules/events/schemas";

export function SessionForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AddSessionInput>({
    resolver: zodResolver(AddSessionSchema),
    defaultValues: { eventId, name: "", startsLocal: "", endsLocal: "" },
  });
  const onSubmit = handleSubmit((v) => {
    setError(null);
    start(async () => {
      const r = await addSessionAction(v);
      if (r.ok) { reset({ eventId, name: "", startsLocal: "", endsLocal: "" }); router.refresh(); } else setError(r.error.message);
    });
  });
  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4" noValidate>
      <FormField label="Nome da sessão" hint="Ex.: Ensaio, Culto da manhã" error={errors.name?.message} {...register("name")} />
      <FormField label="Início" type="datetime-local" error={errors.startsLocal?.message} {...register("startsLocal")} />
      <FormField label="Fim" type="datetime-local" error={errors.endsLocal?.message} {...register("endsLocal")} />
      {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Adicionar sessão"}</Button>
    </form>
  );
}
