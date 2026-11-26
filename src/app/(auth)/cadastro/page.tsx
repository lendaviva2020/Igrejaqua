import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Criar conta" };
export default function SignUpPage() {
  return <SignUpForm googleEnabled={siteConfig().googleLogin} />;
}
