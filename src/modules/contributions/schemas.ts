import { z } from "zod";
import { parseBrlToCents } from "@/lib/payments/money";

export const PURPOSES = ["oferta", "dizimo", "missoes", "outro"] as const;
export const PURPOSE_LABEL: Record<(typeof PURPOSES)[number], string> = { oferta: "Oferta", dizimo: "Dízimo", missoes: "Missões", outro: "Outro" };
export const MIN_CENTS = 100;
export const MAX_CENTS = 5_000_000;

export const CreateChargeSchema = z
  .object({
    amount: z.string().trim().min(1, "Informe o valor"),
    purpose: z.enum(PURPOSES),
  })
  .strict()
  .transform((v, ctx) => {
    const cents = parseBrlToCents(v.amount);
    if (cents === null || cents < MIN_CENTS || cents > MAX_CENTS) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Informe um valor entre R$ 1,00 e R$ 50.000,00" });
      return z.NEVER;
    }
    return { amountCents: cents, purpose: v.purpose };
  });
export type CreateChargeInput = z.input<typeof CreateChargeSchema>;

export const ChargeIdSchema = z.object({ chargeId: z.string().uuid() }).strict();
