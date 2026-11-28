import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/routes";

/**
 * robots.txt: libera o rastreamento do site (inclusive CSS/JS em /_next) e bloqueia só as APIs.
 * Áreas privadas NÃO são bloqueadas aqui de propósito: o buscador precisa conseguir ler o
 * redirecionamento/`noindex` delas. Quem protege os dados é a autenticação e a RLS, não este arquivo.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
