"use client";

import type { ReactNode } from "react";
import { clearOfflineCaches } from "@/components/pwa/clear-caches";

/** Formulário de logout que também limpa os caches offline do aparelho antes de enviar. */
export function SignOutForm({ action, className, children }: { action: () => Promise<never>; className?: string; children: ReactNode }) {
  return <form action={action} className={className} onSubmit={clearOfflineCaches}>{children}</form>;
}
