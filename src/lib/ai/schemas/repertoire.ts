import { z } from "zod";

/** Saída bruta esperada do LLM para repertório. `.strict()`: campos extras invalidam. */
export const AiRepertoireOutputSchema = z
  .object({
    setlist: z.array(z.object({ song: z.string().regex(/^S\d{2,3}$/), reason: z.string().max(280).optional() }).strict()).max(20),
    new_songs: z
      .array(z.object({ title: z.string().min(1).max(160), artist: z.string().max(160).optional(), reason: z.string().max(280).optional() }).strict())
      .max(10)
      .default([]),
  })
  .strict();
export type AiRepertoireOutput = z.infer<typeof AiRepertoireOutputSchema>;

/** Extrai e valida o JSON do texto do modelo. Nunca confia no formato. */
export function parseAiRepertoireOutput(rawText: string): { ok: true; data: AiRepertoireOutput } | { ok: false; reason: string } {
  const trimmed = rawText.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return { ok: false, reason: "resposta não é JSON válido" };
  }
  const parsed = AiRepertoireOutputSchema.safeParse(json);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, reason: parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ") };
}
