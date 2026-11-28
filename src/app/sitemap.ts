import type { MetadataRoute } from "next";
import { LEGAL_UPDATED_AT } from "@/lib/seo/content-dates";
import { absoluteUrl, INDEXABLE_PATHS, type IndexablePath } from "@/lib/seo/routes";

const LAST_MODIFIED: Readonly<Partial<Record<IndexablePath, string>>> = {
  "/privacidade": LEGAL_UPDATED_AT.privacidade,
  "/termos": LEGAL_UPDATED_AT.termos,
};

/** Sitemap só com URLs públicas, canônicas e indexáveis (mesma lista do proxy e das canônicas). */
export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_PATHS.map((path) => {
    const lastModified = LAST_MODIFIED[path];
    return lastModified === undefined ? { url: absoluteUrl(path) } : { url: absoluteUrl(path), lastModified };
  });
}
