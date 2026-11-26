"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { requestPasswordResetAction } from "@/modules/identity/actions";
import { ResetRequestSchema, type ResetRequestInput } from "@/modules/identity/schemas";

export function ResetForm() {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<ResetRequestInput>({ resolver: zodResolver(ResetRequestSchema), defaultValues: { email: "" } });
  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction(values);
      if (!result.ok) return setFormError(result.error.message);
      setSent(true);
    });
  });
  if (sent) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <h1 className="text-3xl">Verifique seu e-mail</h1>
        <p className="text-tinta-2">Se houver uma conta com esse endereço, enviamos as instruções para redefinir a senha.</p>
        <Link className="text-nanquim underline" href="/login">Voltar ao login</Link>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <h1 className="text-3xl">Recuperar senha</h1>
      <FormField label="E-mail" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
      {formError ? <p role="alert" className="text-sm text-vinho">{formError}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar instruções"}</Button>
      <Link className="text-sm text-nanquim underline" href="/login">Voltar</Link>
    </form>
  );
}
