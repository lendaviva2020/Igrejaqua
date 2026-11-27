import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";
import { safeNextPath } from "@/lib/security/safe-redirect";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string; caminho?: string }> }) {
  const { next, caminho } = await searchParams;
  const safeNext = next ? safeNextPath(next, "") || undefined : undefined;
  // Quem chega pelo link da igreja (/entrar/...) já vem marcado como membro.
  const defaultIntent = caminho === "lideranca" ? "leader" : caminho === "membro" || safeNext?.startsWith("/entrar/") ? "member" : undefined;
  return <SignUpForm googleEnabled={siteConfig().googleLogin} next={safeNext} defaultIntent={defaultIntent} />;
}
