"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { normalizePixKey, PIX_KEY_TYPES, sanitizeMerchantText } from "@/lib/payments/pix-key";
import { fail, fromPostgrestError, ok, type Result } from "@/lib/result";
import { allow } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteMercadoPagoAccount } from "./mp-accounts-store";

const PixKeySchema = z.object({
  type: z.enum(PIX_KEY_TYPES),
  key: z.string().trim().min(3, "Informe a chave Pix").max(120),
  recipientName: z.string().trim().min(2, "Informe o nome do recebedor").max(80),
  recipientCity: z.string().trim().min(2, "Informe a cidade").max(60),
}).strict();

/**
 * Cadastra/troca a chave Pix DA IGREJA (o dinheiro cai direto no banco dela). Só a administração.
 * O banco avisa toda a administração a cada troca e registra na auditoria (antifraude).
 */
export async function savePixKeyAction(input: unknown): Promise<Result<{ saved: true }>> {
  const parsed = PixKeySchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) { const k = String(issue.path[0] ?? "form"); (fields[k] ??= []).push(issue.message); }
    return fail("VALIDATION", "Confira os dados da chave Pix.", fields);
  }
  const ctx = await resolveChurchContext();
  if (!can(ctx, "finance.manage")) return fail("FORBIDDEN", "Apenas a administração altera a chave Pix da igreja.");

  const key = normalizePixKey(parsed.data.type, parsed.data.key);
  if (!key.ok) return fail("VALIDATION", key.message, { key: [key.message] });
  // Limites do Pix (BR Code): nome até 25 e cidade até 15 caracteres, sem acento.
  const recipientName = sanitizeMerchantText(parsed.data.recipientName, 25);
  const recipientCity = sanitizeMerchantText(parsed.data.recipientCity, 15);
  if (recipientName.length < 2) return fail("VALIDATION", "Nome do recebedor inválido.", { recipientName: ["Use letras e números."] });
  if (recipientCity.length < 2) return fail("VALIDATION", "Cidade inválida.", { recipientCity: ["Use letras e números."] });
  // O limite conta só tentativas válidas: erro de digitação não gasta a cota da administração.
  if (!(await allow(`pixkey:${ctx.userId}`, 10, 3600))) return fail("RATE_LIMITED", "Muitas alterações seguidas. Aguarde alguns minutos.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("church_pix_keys").upsert({
    church_id: ctx.churchId, key_type: parsed.data.type, pix_key: key.key, recipient_name: recipientName, recipient_city: recipientCity, updated_by: ctx.userId,
  });
  if (error) return fromPostgrestError(error);
  revalidatePath("/configuracoes");
  revalidatePath("/contribuir");
  return ok({ saved: true });
}

export async function removePixKeyAction(): Promise<Result<{ removed: true }>> {
  const ctx = await resolveChurchContext();
  if (!can(ctx, "finance.manage")) return fail("FORBIDDEN", "Apenas a administração altera a chave Pix da igreja.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("church_pix_keys").delete().eq("church_id", ctx.churchId);
  if (error) return fromPostgrestError(error);
  revalidatePath("/configuracoes");
  revalidatePath("/contribuir");
  return ok({ removed: true });
}

/** Desconecta o Mercado Pago da igreja (apaga as credenciais cifradas). As contribuições voltam para a chave Pix. */
export async function disconnectMercadoPagoAction(): Promise<Result<{ disconnected: true }>> {
  const ctx = await resolveChurchContext();
  if (!can(ctx, "finance.manage")) return fail("FORBIDDEN", "Apenas a administração conecta ou desconecta o Mercado Pago.");
  try {
    await deleteMercadoPagoAccount(ctx.churchId);
  } catch (cause) {
    console.error("mp_disconnect_failed", cause instanceof Error ? cause.message : "erro interno");
    return fail("UNAVAILABLE", "Não foi possível desconectar agora. Tente novamente.");
  }
  revalidatePath("/configuracoes");
  revalidatePath("/contribuir");
  return ok({ disconnected: true });
}
