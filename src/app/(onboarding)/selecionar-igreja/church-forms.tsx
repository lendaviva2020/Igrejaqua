"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { INTENT_OPTIONS } from "@/components/auth/intent-options";
import { createChurchAction, joinWithCodeAction, switchChurchAction } from "@/modules/churches/actions";
import { setSignupIntentAction } from "@/modules/identity/actions";
import type { SignupIntent } from "@/modules/identity/schemas";

const CreateSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,48})[a-z0-9]$/, "Use 3–50 letras minúsculas, números ou hífen"),
});
type CreateValues = z.infer<typeof CreateSchema>;
const JoinSchema = z.object({ code: z.string().trim().min(16, "Cole o link ou o código que você recebeu").max(500) });
type JoinValues = z.infer<typeof JoinSchema>;

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

export function JoinWithCodeForm({ initialCode = "", onDoneHref = "/dashboard" }: { initialCode?: string; onDoneHref?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<JoinValues>({ resolver: zodResolver(JoinSchema), defaultValues: { code: initialCode } });
  const onSubmit = handleSubmit((v) => {
    setError(null);
    start(async () => {
      const r = await joinWithCodeAction(v);
      if (!r.ok) { setError(r.error.message); return; }
      if (r.data.status === "active") { router.replace(onDoneHref); router.refresh(); return; }
      setRequested(r.data.churchName ?? "a igreja");
      router.refresh();
    });
  });
  if (requested !== null) {
    return (
      <div role="status" className="rounded-superficie border border-ambar bg-superficie-2 p-4">
        <p className="font-medium">Pedido enviado para {requested}.</p>
        <p className="mt-1 text-sm text-texto-2">Assim que a administração da igreja aprovar, ela aparece em “Suas igrejas” e você poderá entrar.</p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormField label="Link ou código da igreja" autoComplete="off" hint="Cole o link que o pastor ou a liderança enviou." error={errors.code?.message} {...register("code")} />
      {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Enviando…" : "Entrar na igreja"}</Button>
    </form>
  );
}

export function IntentChooser() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const choose = (intent: SignupIntent) => {
    setError(null);
    start(async () => {
      const r = await setSignupIntentAction({ intent });
      if (!r.ok) { setError(r.error.message); return; }
      router.replace(`/selecionar-igreja?caminho=${intent === "leader" ? "lideranca" : "membro"}`);
      router.refresh();
    });
  };
  return (
    <div className="flex flex-col gap-3">
      {INTENT_OPTIONS.map(({ value, title, description, Icon }) => (
        <button key={value} type="button" disabled={pending} onClick={() => choose(value)}
          className="flex items-start gap-3 rounded-superficie border border-borda bg-superficie p-4 text-left transition-colors hover:border-ambar disabled:opacity-60">
          <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ambar" />
          <span><span className="block font-medium text-texto">{title}</span><span className="block text-sm text-texto-2">{description}</span></span>
        </button>
      ))}
      {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
    </div>
  );
}
