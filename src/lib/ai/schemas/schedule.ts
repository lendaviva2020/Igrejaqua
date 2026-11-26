import { z } from "zod";

/** Saída bruta esperada do LLM para escala. `.strict()`: campos extras invalidam. */
export const AiScheduleOutputSchema = z
  .object({
    assignments: z
      .array(
        z
          .object({
            token: z.string().regex(/^M\d{2,3}$/),
            function: z.string().min(1).max(60),
            rationale: z.string().max(280).optional(),
          })
          .strict(),
      )
      .max(60),
  })
  .strict();
export type AiScheduleOutput = z.infer<typeof AiScheduleOutputSchema>;

/** Tenta extrair e validar JSON do texto do modelo. Nunca confia no formato. */
export function parseAiScheduleOutput(rawText: string): { ok: true; data: AiScheduleOutput } | { ok: false; reason: string } {
  const trimmed = rawText.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return { ok: false, reason: "resposta não é JSON válido" };
  }
  const parsed = AiScheduleOutputSchema.safeParse(json);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, reason: parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ") };
}
