"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { signUpAction } from "@/modules/identity/actions";
import { SignUpSchema, type SignUpInput } from "@/modules/identity/schemas";

export function SignUpForm() {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<SignUpInput>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await signUpAction(values);
      if (!result.ok) return setFormError(result.error.message);
      setDone(true);
    });
  });

  if (done) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <h1 className="text-3xl">Confira seu e-mail</h1>
        <p className="text-tinta-2">Se o endereço puder ser cadastrado, enviamos um link de confirmação. Depois de confirmar, entre para começar.</p>
        <Link className="text-nanquim underline" href="/login">Ir para o login</Link>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <h1 className="text-3xl">Criar conta</h1>
      <FormField label="Nome completo" autoComplete="name" error={errors.fullName?.message} {...register("fullName")} />
      <FormField label="E-mail" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
      <FormField label="Senha" type="password" autoComplete="new-password" hint="Mínimo de 12 caracteres, com letras e números." error={errors.password?.message} {...register("password")} />
      <p className="text-xs text-tinta-2">Ao criar a conta você concorda com o tratamento dos seus dados para a gestão da sua igreja, conforme a LGPD.</p>
      {formError ? <p role="alert" className="text-sm text-vinho">{formError}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar conta"}</Button>
      <Link className="text-sm text-nanquim underline" href="/login">Já tenho conta</Link>
    </form>
  );
}
