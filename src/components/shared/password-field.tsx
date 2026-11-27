"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { FormFieldProps } from "./form-field";

/** Campo de senha com botão "olho" para mostrar/ocultar o que foi digitado. Mesma acessibilidade do FormField. */
export function PasswordField({ label, error, hint, id, className, ...props }: Omit<FormFieldProps, "type">) {
  const [visible, setVisible] = useState(false);
  const fieldId = id ?? `f-${props.name ?? label}`;
  const errorId = `${fieldId}-err`;
  const hintId = `${fieldId}-hint`;
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-texto">{label}</label>
      <div className="relative">
        <input
          id={fieldId}
          type={visible ? "text" : "password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined}
          className={cn("min-h-11 w-full rounded-controle border border-borda bg-fundo pl-3 pr-12 text-base text-texto", error && "border-perigo", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          aria-controls={fieldId}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-controle text-texto-2 hover:text-texto"
        >
          <Icon aria-hidden="true" className="size-5" />
        </button>
      </div>
      {hint ? <p id={hintId} className="text-xs text-texto-2">{hint}</p> : null}
      {error ? <p id={errorId} role="alert" className="text-sm text-perigo">{error}</p> : null}
    </div>
  );
}
