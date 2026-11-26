"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { signUpAction } from "@/modules/identity/actions";
import { SignUpSchema, type SignUpInput } from "@/modules/identity/schemas";

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
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
        <p className="text-texto-2">Se o endereço puder ser cadastrado, enviamos um link de confirmação. Depois de confirmar, entre para começar.</p>
        <Link className="text-ambar-claro underline" href="/login">Ir para o login</Link>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <h1 className="text-3xl">Criar conta</h1>
      {googleEnabled ? <><GoogleButton label="Cadastrar com o Google" /><OrDivider /></> : null}
      <FormField label="Nome completo" autoComplete="name" error={errors.fullName?.message} {...register("fullName")} />
      <FormField label="E-mail" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
      <FormField label="Senha" type="password" autoComplete="new-password" hint="Mínimo de 12 caracteres, com letras e números." error={errors.password?.message} {...register("password")} />
      <p className="text-xs text-texto-2">Ao criar a conta você aceita os <Link className="underline" href="/termos">Termos de Uso</Link> e declara ter lido a <Link className="underline" href="/privacidade">Política de Privacidade</Link>.</p>
      {formError ? <p role="alert" className="text-sm text-perigo">{formError}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar conta"}</Button>
      <Link className="text-sm text-ambar-claro underline" href="/login">Já tenho conta</Link>
    </form>
  );
}
