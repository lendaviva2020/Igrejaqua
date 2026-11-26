"use client";

import { useState, useTransition } from "react";
import { signInWithGoogleAction } from "@/modules/identity/actions";

/** Segue as diretrizes de marca do Google (tema escuro, pílula, "G" colorido, texto localizado). Não usa a cor âmbar. */
export function GoogleButton({ next, label = "Continuar com o Google" }: { next?: string | undefined; label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const click = () => {
    setError(null);
    start(async () => {
      const r = await signInWithGoogleAction(next === undefined ? {} : { next });
      if (r.ok) window.location.assign(r.data.url);
      else setError(r.error.message);
    });
  };
  return (
    <div>
      <button type="button" onClick={click} disabled={pending} className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-full border border-[#8e918f] bg-[#131314] px-4 text-sm font-medium text-[#e3e3e3] transition-colors hover:bg-[#1e1f20] disabled:opacity-60">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.9 7.35 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        {pending ? "Conectando…" : label}
      </button>
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-perigo">{error}</p>
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-sm text-texto-2" role="separator" aria-label="ou">
      <span className="h-px flex-1 bg-linha" />ou<span className="h-px flex-1 bg-linha" />
    </div>
  );
}
