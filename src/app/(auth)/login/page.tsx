import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next, erro } = await searchParams;
  return <LoginForm next={next} googleEnabled={siteConfig().googleLogin} linkExpired={erro === "link"} />;
}
