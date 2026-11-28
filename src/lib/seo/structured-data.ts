import type { SiteConfig } from "@/lib/site";
import { absoluteUrl } from "@/lib/seo/routes";

/** Tipos mínimos de Schema.org usados pelo site (só propriedades com dados reais). */
interface ContactPoint { readonly "@type": "ContactPoint"; readonly contactType: "customer support"; readonly email: string; readonly availableLanguage: "pt-BR" }
interface OrganizationLd {
  readonly "@type": "Organization";
  readonly "@id": string;
  readonly name: "IGREJAQUA";
  readonly url: string;
  readonly logo: { readonly "@type": "ImageObject"; readonly url: string; readonly width: 512; readonly height: 512 };
  readonly sameAs?: readonly string[];
  readonly contactPoint?: readonly ContactPoint[];
}
interface WebSiteLd { readonly "@type": "WebSite"; readonly "@id": string; readonly name: "IGREJAQUA"; readonly url: string; readonly inLanguage: "pt-BR"; readonly publisher: { readonly "@id": string } }
export interface StructuredDataGraph { readonly "@context": "https://schema.org"; readonly "@graph": readonly [OrganizationLd, WebSiteLd] }

/**
 * Organization + WebSite da home. `sameAs` vem SOMENTE das redes oficiais configuradas por variável
 * de ambiente (NEXT_PUBLIC_SOCIAL_*, já validadas como https em siteConfig); sem configuração, a
 * propriedade é omitida. Nenhum endereço, telefone ou avaliação é declarado, porque não há dado verificado.
 */
export function buildHomeStructuredData(site: SiteConfig, env?: Readonly<Record<string, string | undefined>>): StructuredDataGraph {
  const home = absoluteUrl("/", env);
  const orgId = `${home}#organization`;
  const sameAs = site.socials.map((s) => s.url);
  const organization: OrganizationLd = {
    "@type": "Organization",
    "@id": orgId,
    name: "IGREJAQUA",
    url: home,
    logo: { "@type": "ImageObject", url: absoluteUrl("/icons/icon-512.png", env), width: 512, height: 512 },
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(site.contactEmail !== null ? { contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: site.contactEmail, availableLanguage: "pt-BR" }] } : {}),
  };
  const website: WebSiteLd = { "@type": "WebSite", "@id": `${home}#website`, name: "IGREJAQUA", url: home, inLanguage: "pt-BR", publisher: { "@id": orgId } };
  return { "@context": "https://schema.org", "@graph": [organization, website] };
}

/**
 * Serializa para <script type="application/ld+json">. Escapa "<", ">" e "&" para que nenhum valor
 * (ex.: URL configurada) consiga fechar a tag e injetar HTML/JS.
 */
export function serializeJsonLd(data: StructuredDataGraph): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
