import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: ReactNode;
}

/** Campo acessível: rótulo associado, erro anunciado (aria-describedby + role=alert). */
export function FormField({ label, error, hint, id, className, ...props }: FormFieldProps) {
  const fieldId = id ?? `f-${props.name ?? label}`;
  const errorId = `${fieldId}-err`;
  const hintId = `${fieldId}-hint`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-texto">{label}</label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined}
        className={cn("min-h-11 rounded-controle border border-borda bg-fundo px-3 text-base text-texto", error && "border-perigo", className)}
        {...props}
      />
      {hint ? <p id={hintId} className="text-xs text-texto-2">{hint}</p> : null}
      {error ? <p id={errorId} role="alert" className="text-sm text-perigo">{error}</p> : null}
    </div>
  );
}
