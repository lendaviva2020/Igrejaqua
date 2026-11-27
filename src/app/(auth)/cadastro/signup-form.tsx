"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { PasswordField } from "@/components/shared/password-field";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { signUpAction } from "@/modules/identity/actions";
import { SignUpSchema, type SignUpInput, type SignupIntent } from "@/modules/identity/schemas";
import { INTENT_OPTIONS } from "@/components/auth/intent-options";

export function SignUpForm({ googleEnabled, next, defaultIntent }: { googleEnabled: boolean; next: string | undefined; defaultIntent: SignupIntent | undefined }) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<SignUpInput>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: { fullName: "", email: "", password: "", ...(defaultIntent ? { intent: defaultIntent } : {}), ...(next ? { next } : {}) },
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
        <Link className="text-ambar-claro underline" href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Ir para o login</Link>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <h1 className="text-3xl">Criar conta</h1>
      <fieldset className="flex flex-col gap-3" aria-describedby={errors.intent ? "intent-err" : undefined}>
        <legend className="mb-1 text-sm font-medium text-texto">Como você vai usar o IGREJAQUA?</legend>
        {INTENT_OPTIONS.map(({ value, title, description, Icon }) => (
          <label key={value} className="cursor-pointer">
            <input type="radio" value={value} className="peer sr-only" {...register("intent")} />
            <span className="flex items-start gap-3 rounded-superficie border border-borda bg-fundo p-4 transition-colors peer-checked:border-ambar peer-checked:bg-superficie-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ambar">
              <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ambar" />
              <span><span className="block font-medium text-texto">{title}</span><span className="block text-sm text-texto-2">{description}</span></span>
            </span>
          </label>
        ))}
        {errors.intent ? <p id="intent-err" role="alert" className="text-sm text-perigo">{errors.intent.message}</p> : null}
      </fieldset>
      {googleEnabled ? <><GoogleButton label="Cadastrar com o Google" /><OrDivider /></> : null}
      <FormField label="Nome completo" autoComplete="name" error={errors.fullName?.message} {...register("fullName")} />
      <FormField label="E-mail" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
      <PasswordField label="Senha" autoComplete="new-password" hint="Mínimo de 12 caracteres, com letra minúscula, letra maiúscula, número e símbolo." error={errors.password?.message} {...register("password")} />
      <p className="text-xs text-texto-2">Ao criar a conta você aceita os <Link className="underline" href="/termos">Termos de Uso</Link> e declara ter lido a <Link className="underline" href="/privacidade">Política de Privacidade</Link>.</p>
      {formError ? <p role="alert" className="text-sm text-perigo">{formError}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar conta"}</Button>
      <Link className="text-sm text-ambar-claro underline" href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Já tenho conta</Link>
    </form>
  );
}
