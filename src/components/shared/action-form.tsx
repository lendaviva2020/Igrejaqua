"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useRef, useState, useTransition, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { FormField, type FormFieldProps } from "@/components/shared/form-field";
import type { Result } from "@/lib/result";

type Action = (input: unknown) => Promise<Result<unknown>>;

interface ActionFormProps {
  readonly action: Action;
  readonly submitLabel: string;
  readonly children: ReactNode;
  /** Campos de checkbox: viram boolean (marcado = true). */
  readonly booleans?: readonly string[];
  /** Campos com vários valores (ex.: vários checkboxes de mesmo nome): viram array de strings. */
  readonly multi?: readonly string[];
  /** Valores fixos enviados junto (ids de contexto vindos do servidor, nunca church_id). */
  readonly extra?: Readonly<Record<string, string>>;
  readonly className?: string;
}

/** Formulário genérico: monta o objeto a partir do FormData, chama a Server Action e mostra o erro por campo. */
export function ActionForm({ action, submitLabel, children, booleans = [], multi = [], extra = {}, className }: ActionFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, readonly string[]>>>({});

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input: Record<string, unknown> = { ...extra };
    for (const [key, value] of data.entries()) {
      if (typeof value === "string" && value.trim() !== "" && !booleans.includes(key) && !multi.includes(key)) input[key] = value.trim();
    }
    for (const key of multi) input[key] = data.getAll(key).filter((v): v is string => typeof v === "string");
    for (const key of booleans) input[key] = data.has(key);
    setError(null);
    setFieldErrors({});
    start(async () => {
      const result = await action(input);
      if (result.ok) { form.reset(); router.refresh(); return; }
      setError(result.error.message);
      setFieldErrors(result.error.fields ?? {});
    });
  };
  const fieldError = (name: string): string | undefined => fieldErrors[name]?.[0];

  return (
    <form ref={formRef} onSubmit={submit} className={className ?? "flex max-w-md flex-col gap-4"} noValidate>
      <FieldErrorsContext value={fieldError}>{children}</FieldErrorsContext>
      {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Salvando…" : submitLabel}</Button>
    </form>
  );
}

const FieldErrorsContext = createContext<(name: string) => string | undefined>(() => undefined);

export function Field(props: FormFieldProps & { readonly name: string }) {
  const lookup = useContext(FieldErrorsContext);
  return <FormField {...props} error={props.error ?? lookup(props.name)} />;
}

export function SelectField({ label, name, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { readonly label: string; readonly name: string }) {
  const lookup = useContext(FieldErrorsContext);
  const error = lookup(name);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`f-${name}`} className="text-sm font-medium text-texto">{label}</label>
      <select id={`f-${name}`} name={name} aria-invalid={error ? true : undefined} className="min-h-11 rounded-controle border border-borda bg-fundo px-3 text-base text-texto" {...props}>{children}</select>
      {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
    </div>
  );
}

export function TextAreaField({ label, name, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { readonly label: string; readonly name: string }) {
  const lookup = useContext(FieldErrorsContext);
  const error = lookup(name);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`f-${name}`} className="text-sm font-medium text-texto">{label}</label>
      <textarea id={`f-${name}`} name={name} rows={3} aria-invalid={error ? true : undefined} className="rounded-controle border border-borda bg-fundo px-3 py-2 text-base text-texto" {...props} />
      {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
    </div>
  );
}

export function CheckField({ label, name, ...props }: { readonly label: string; readonly name: string; readonly defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
      <input type="checkbox" name={name} className="size-5 accent-ambar" {...props} />{label}
    </label>
  );
}

interface ActionButtonProps extends Omit<ButtonProps, "onClick"> {
  readonly action: Action;
  readonly input: unknown;
  readonly label: string;
  readonly confirmMessage?: string;
}

/** Botão que dispara uma Server Action (com confirmação opcional) e atualiza a página. */
export function ActionButton({ action, input, label, confirmMessage, variant = "secondary", ...props }: ActionButtonProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        {...props}
        variant={variant}
        disabled={pending || props.disabled}
        onClick={() => {
          if (confirmMessage !== undefined && !window.confirm(confirmMessage)) return;
          setError(null);
          start(async () => {
            const result = await action(input);
            if (result.ok) router.refresh(); else setError(result.error.message);
          });
        }}
      >{pending ? "Aguarde…" : label}</Button>
      {error ? <span role="alert" className="text-xs text-perigo">{error}</span> : null}
    </span>
  );
}
