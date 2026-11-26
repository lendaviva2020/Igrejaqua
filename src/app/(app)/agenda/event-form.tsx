"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { createEventAction } from "@/modules/events/actions";
import { CreateEventSchema, EVENT_KINDS, EVENT_KIND_LABEL, type CreateEventInput } from "@/modules/events/schemas";

export function EventForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<CreateEventInput>({
    resolver: zodResolver(CreateEventSchema),
    defaultValues: { title: "", kind: "service", startsLocal: "", endsLocal: "", location: "" },
  });
  const onSubmit = handleSubmit((v) => {
    setError(null);
    start(async () => {
      const r = await createEventAction(v);
      if (r.ok) router.push(`/agenda/${r.data.eventId}`);
      else setError(r.error.message);
    });
  });
  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4" noValidate>
      <FormField label="Título" error={errors.title?.message} {...register("title")} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="kind" className="text-sm font-medium">Tipo</label>
        <select id="kind" className="min-h-11 rounded-controle border border-tinta-2 bg-superficie px-3" {...register("kind")}>
          {EVENT_KINDS.map((k) => <option key={k} value={k}>{EVENT_KIND_LABEL[k]}</option>)}
        </select>
      </div>
      <FormField label="Início" type="datetime-local" error={errors.startsLocal?.message} {...register("startsLocal")} />
      <FormField label="Fim" type="datetime-local" error={errors.endsLocal?.message} {...register("endsLocal")} />
      <FormField label="Local (opcional)" error={errors.location?.message} {...register("location")} />
      {error ? <p role="alert" className="text-sm text-vinho">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Criar evento"}</Button>
    </form>
  );
}
