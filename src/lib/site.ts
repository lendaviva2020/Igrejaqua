import { z } from "zod";

/** Informações públicas opcionais da igreja. Nada é exibido enquanto a variável não estiver definida (sem dados fictícios). */
const optionalUrl = z.string().url().optional();
const schema = z.object({
  NEXT_PUBLIC_CHURCH_NAME: z.string().trim().min(2).max(160).optional(),
  NEXT_PUBLIC_CONTACT_EMAIL: z.string().email().optional(),
  NEXT_PUBLIC_SOCIAL_INSTAGRAM: optionalUrl,
  NEXT_PUBLIC_SOCIAL_YOUTUBE: optionalUrl,
  NEXT_PUBLIC_SOCIAL_FACEBOOK: optionalUrl,
  NEXT_PUBLIC_SOCIAL_WHATSAPP: optionalUrl,
  NEXT_PUBLIC_AUTH_GOOGLE: z.enum(["true", "false"]).default("false"),
});

export type SocialNetwork = "instagram" | "youtube" | "facebook" | "whatsapp";
export interface SiteConfig {
  readonly churchName: string | null;
  readonly contactEmail: string | null;
  readonly socials: readonly { readonly network: SocialNetwork; readonly label: string; readonly url: string }[];
  readonly googleLogin: boolean;
}

const LABEL: Record<SocialNetwork, string> = { instagram: "Instagram", youtube: "YouTube", facebook: "Facebook", whatsapp: "WhatsApp" };

/** Valores inválidos são ignorados (nunca derrubam a página); só URLs https são aceitas. */
export function siteConfig(env: Readonly<Record<string, string | undefined>> = process.env): SiteConfig {
  const raw = Object.fromEntries(Object.keys(schema.shape).map((k) => [k, env[k] === "" ? undefined : env[k]]));
  const parsed = schema.safeParse(raw);
  const data = parsed.success ? parsed.data : schema.parse({});
  const candidates: readonly [SocialNetwork, string | undefined][] = [
    ["instagram", data.NEXT_PUBLIC_SOCIAL_INSTAGRAM],
    ["youtube", data.NEXT_PUBLIC_SOCIAL_YOUTUBE],
    ["facebook", data.NEXT_PUBLIC_SOCIAL_FACEBOOK],
    ["whatsapp", data.NEXT_PUBLIC_SOCIAL_WHATSAPP],
  ];
  const socials = candidates.flatMap(([network, url]) => (url !== undefined && url.startsWith("https://") ? [{ network, label: LABEL[network], url }] : []));
  return { churchName: data.NEXT_PUBLIC_CHURCH_NAME ?? null, contactEmail: data.NEXT_PUBLIC_CONTACT_EMAIL ?? null, socials, googleLogin: data.NEXT_PUBLIC_AUTH_GOOGLE === "true" };
}
