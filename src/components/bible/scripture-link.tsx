import Link from "next/link";
import { parseReference } from "@/lib/bible/reference";

/** Referência bíblica com link para a leitura; se não for reconhecida, aparece como texto simples. */
export function ScriptureLink({ reference }: { readonly reference: string }) {
  const parsed = parseReference(reference);
  if (parsed === null) return <p className="text-sm text-texto-2">{reference}</p>;
  const verse = parsed.verseStart === null ? "" : `&v=${parsed.verseStart}${parsed.verseEnd !== null ? `-${parsed.verseEnd}` : ""}`;
  return (
    <p className="text-sm">
      <Link href={`/biblia/${parsed.book.slug}/${parsed.chapter}?t=livre${verse}`} className="font-medium text-ambar-claro underline">{reference}</Link>
    </p>
  );
}
