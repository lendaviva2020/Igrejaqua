import { z } from "zod";

export const TotpCodeSchema = z.string().regex(/^\d{6}$/, "Digite os 6 números do aplicativo.");
export const VerifyChallengeSchema = z.object({ code: TotpCodeSchema }).strict();
export const VerifyEnrollmentSchema = z.object({ factorId: z.string().uuid(), code: TotpCodeSchema }).strict();
export const RemoveFactorSchema = z.object({ factorId: z.string().uuid() }).strict();
