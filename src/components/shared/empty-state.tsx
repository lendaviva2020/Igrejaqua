import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-linha px-6 py-10 text-center">
      <p className="font-display text-xl">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-prose text-sm text-tinta-2">{children}</div> : null}
    </div>
  );
}
