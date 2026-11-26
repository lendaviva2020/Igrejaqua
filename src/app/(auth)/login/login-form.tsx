"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { signInAction } from "@/modules/identity/actions";
import { SignInSchema, type SignInInput } from "@/modules/identity/schemas";

export function LoginForm({ next }: { next: string | undefined }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<SignInInput>({
    resolver: zodResolver(SignInSchema),
    defaultValues: { email: "", password: "", ...(next === undefined ? {} : { next }) },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await signInAction(values);
      if (!result.ok) return setFormError(result.error.message);
      router.replace(result.data.redirectTo);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <h1 className="text-3xl">Entrar</h1>
      <FormField label="E-mail" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
      <FormField label="Senha" type="password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />
      {formError ? <p role="alert" className="text-sm text-perigo">{formError}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</Button>
      <div className="flex justify-between text-sm">
        <Link className="text-ambar-claro underline" href="/recuperar-senha">Esqueci a senha</Link>
        <Link className="text-ambar-claro underline" href="/cadastro">Criar conta</Link>
      </div>
    </form>
  );
}
