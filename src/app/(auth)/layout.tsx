import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <p className="font-display text-3xl">IGREJAQUA</p>
      <div className="mt-2 mb-8 filete-duplo" aria-hidden="true" />
      {children}
    </main>
  );
}
