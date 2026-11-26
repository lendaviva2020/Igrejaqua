"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { updatePasswordAction } from "@/modules/identity/actions";
import { NewPasswordSchema, type NewPasswordInput } from "@/modules/identity/schemas";

export function NewPasswordForm() {
  const [pending, start] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<NewPasswordInput>({ resolver: zodResolver(NewPasswordSchema), defaultValues: { password: "", confirm: "" } });
  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    start(async () => {
      const r = await updatePasswordAction(v);
      if (r.ok) setDone(true); else setFormError(r.error.message);
    });
  });
  if (done) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <h1 className="text-3xl">Senha alterada</h1>
        <p className="text-texto-2">As outras sessões abertas foram encerradas por segurança.</p>
        <Link className="text-ambar-claro underline" href="/dashboard">Ir para o painel</Link>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <h1 className="text-3xl">Nova senha</h1>
      <FormField label="Nova senha" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
      <FormField label="Repita a nova senha" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
      {formError ? <p role="alert" className="text-sm text-perigo">{formError} <Link className="underline" href="/recuperar-senha">Pedir novo link</Link></p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar nova senha"}</Button>
    </form>
  );
}
