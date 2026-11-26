"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { createMinistryAction } from "@/modules/ministries/actions";

const Schema = z.object({ name: z.string().trim().min(2, "Informe o nome").max(120), description: z.string().trim().max(1000).optional() });
type Values = z.infer<typeof Schema>;

export function MinistryForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { name: "", description: "" } });
  const onSubmit = handleSubmit((v) => {
    setError(null);
    start(async () => {
      const r = await createMinistryAction(v);
      if (r.ok) { reset(); router.refresh(); } else setError(r.error.message);
    });
  });
  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4" noValidate>
      <FormField label="Nome do ministério" error={errors.name?.message} {...register("name")} />
      <FormField label="Descrição (opcional)" error={errors.description?.message} {...register("description")} />
      {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Criar ministério"}</Button>
    </form>
  );
}
