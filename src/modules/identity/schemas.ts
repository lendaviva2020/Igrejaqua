import { z } from "zod";

const email = z.string().trim().toLowerCase().email("E-mail inválido").max(254);
const password = z
  .string()
  .min(12, "Use ao menos 12 caracteres")
  .max(128, "Máximo de 128 caracteres")
  // Igual à política do Supabase Auth do projeto (minúscula, maiúscula, número e símbolo):
  // se o app aceitar menos, o Supabase recusa a senha no cadastro.
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v),
    "Use letra minúscula, letra maiúscula, número e símbolo");

export const SignInSchema = z.object({ email, password: z.string().min(1, "Informe a senha").max(128), next: z.string().max(300).optional() }).strict();
export const SignUpSchema = z.object({ fullName: z.string().trim().min(2, "Informe seu nome").max(160), email, password }).strict();
export const NewPasswordSchema = z
  .object({ password, confirm: z.string().max(128) })
  .strict()
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não conferem" });
export const GoogleSignInSchema = z.object({ next: z.string().max(300).optional() }).strict();
export const ResetRequestSchema = z.object({ email }).strict();

export type SignInInput = z.infer<typeof SignInSchema>;
export type SignUpInput = z.infer<typeof SignUpSchema>;
export type ResetRequestInput = z.infer<typeof ResetRequestSchema>;
export type NewPasswordInput = z.infer<typeof NewPasswordSchema>;
