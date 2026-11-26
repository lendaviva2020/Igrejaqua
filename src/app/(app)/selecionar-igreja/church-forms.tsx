"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { acceptInvitationAction, createChurchAction, switchChurchAction } from "@/modules/churches/actions";

const CreateSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,48})[a-z0-9]$/, "Use 3–50 letras minúsculas, números ou hífen"),
});
type CreateValues = z.infer<typeof CreateSchema>;
const InviteSchema = z.object({ token: z.string().trim().min(16, "Código muito curto").max(200) });
type InviteValues = z.infer<typeof InviteSchema>;

export function SwitchChurchButton({ churchId, label }: { churchId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await switchChurchAction({ churchId }); if (r.ok) { router.replace("/dashboard"); router.refresh(); } })}>
      {label}
    </Button>
  );
}

export function CreateChurchForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, setError: setFieldError, formState: { errors } } = useForm<CreateValues>({ resolver: zodResolver(CreateSchema), defaultValues: { name: "", slug: "" } });
  const onSubmit = handleSubmit((v) => {
    setError(null);
    start(async () => {
      const r = await createChurchAction(v);
      if (r.ok) { router.replace("/dashboard"); router.refresh(); return; }
      if (r.error.fields?.["slug"]) setFieldError("slug", { message: r.error.fields["slug"][0] ?? "Inválido" });
      else setError(r.error.message);
    });
  });
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormField label="Nome da igreja" error={errors.name?.message} {...register("name")} />
      <FormField label="Endereço (identificador único)" hint="Exemplo: igreja-central" error={errors.slug?.message} {...register("slug")} />
      {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar igreja"}</Button>
    </form>
  );
}

export function AcceptInvitationForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<InviteValues>({ resolver: zodResolver(InviteSchema), defaultValues: { token: "" } });
  const onSubmit = handleSubmit((v) => {
    setError(null);
    start(async () => {
      const r = await acceptInvitationAction(v);
      if (r.ok) { router.replace("/dashboard"); router.refresh(); } else setError(r.error.message);
    });
  });
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormField label="Código do convite" autoComplete="off" error={errors.token?.message} {...register("token")} />
      {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
      <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Verificando…" : "Entrar com convite"}</Button>
    </form>
  );
}
