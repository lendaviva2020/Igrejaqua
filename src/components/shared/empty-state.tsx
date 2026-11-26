import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-superficie border border-dashed border-borda bg-fundo/40 px-6 py-10 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-prose text-sm text-texto-2">{children}</div> : null}
    </div>
  );
}
