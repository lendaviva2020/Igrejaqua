"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { CHURCH_COOKIE, listMyChurches, requireUser } from "@/lib/auth/context";
import { fail, fromPostgrestError, ok, zodFieldErrors, type Result } from "@/lib/result";
import { allow, clientFingerprint } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractJoinCode } from "./join-code";

const CreateChurchSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome").max(160),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,48})[a-z0-9]$/, "Use 3–50 letras minúsculas, números ou hífen"),
  })
  .strict();
const AcceptInvitationSchema = z.object({ token: z.string().trim().min(16).max(200) }).strict();
const SwitchChurchSchema = z.object({ churchId: z.string().uuid() }).strict();

async function setChurchCookie(churchId: string): Promise<void> {
  (await cookies()).set(CHURCH_COOKIE, churchId, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90,
  });
}

export async function createChurchAction(input: unknown): Promise<Result<{ churchId: string }>> {
  const parsed = CreateChurchSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Dados inválidos.", zodFieldErrors(parsed.error.issues));
  const user = await requireUser();
  if (!(await allow(`create-church:${user.id}`, 3, 86400))) return fail("RATE_LIMITED", "Limite diário atingido.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_church", { p_name: parsed.data.name, p_slug: parsed.data.slug });
  if (error) return error.code === "23505" ? fail("CONFLICT", "Este endereço já está em uso.", { slug: ["Já em uso"] }) : fromPostgrestError(error);
  const churchId = z.string().uuid().parse(data);
  await setChurchCookie(churchId);
  return ok({ churchId });
}

export async function acceptInvitationAction(input: unknown): Promise<Result<{ churchId: string }>> {
  const parsed = AcceptInvitationSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Código de convite inválido.", zodFieldErrors(parsed.error.issues));
  const user = await requireUser();
  const fp = await clientFingerprint();
  if (!(await allow(`accept-invite:${user.id}:${fp}`, 10, 3600))) return fail("RATE_LIMITED", "Muitas tentativas.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: parsed.data.token });
  if (error) return fail("NOT_FOUND", "Convite inválido, expirado ou emitido para outro e-mail.");
  const churchId = z.string().uuid().parse(data);
  await setChurchCookie(churchId);
  return ok({ churchId });
}

const JoinWithCodeSchema = z.object({ code: z.string().trim().min(16, "Cole o link ou o código que você recebeu").max(500) }).strict();

export type JoinOutcome = { churchId: string; churchName: string | null; status: "active" | "pending" };

/**
 * Entrada pelo link geral da igreja (vira pedido "pending" até a administração aprovar) ou, se o código
 * for de um convite individual por e-mail, aceita o convite (entra direto, com o papel do convite).
 */
export async function joinWithCodeAction(input: unknown): Promise<Result<JoinOutcome>> {
  const parsed = JoinWithCodeSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Link ou código inválido.", zodFieldErrors(parsed.error.issues));
  const user = await requireUser();
  const fp = await clientFingerprint();
  if (!(await allow(`join:${user.id}:${fp}`, 10, 3600))) return fail("RATE_LIMITED", "Muitas tentativas. Tente mais tarde.");
  const code = extractJoinCode(parsed.data.code);
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(code)) return fail("VALIDATION", "Link ou código inválido.", { code: ["Confira o link recebido"] });
  const supabase = await createSupabaseServerClient();

  const join = await supabase.rpc("request_church_join", { p_token: code });
  if (!join.error) {
    const row = z.array(z.object({ church_id: z.string().uuid(), church_name: z.string(), status: z.enum(["active", "pending"]) })).parse(join.data)[0];
    if (row === undefined) return fail("NOT_FOUND", "Link inválido ou desativado.");
    if (row.status === "active") await setChurchCookie(row.church_id);
    return ok({ churchId: row.church_id, churchName: row.church_name, status: row.status });
  }
  if (join.error.code === "42501") return fail("FORBIDDEN", "Seu acesso a esta igreja está suspenso. Fale com a administração.");

  const invite = await supabase.rpc("accept_invitation", { p_token: code });
  if (invite.error) return fail("NOT_FOUND", "Link inválido, desativado ou expirado. Peça um novo à sua igreja.");
  const churchId = z.string().uuid().parse(invite.data);
  await setChurchCookie(churchId);
  return ok({ churchId, churchName: null, status: "active" });
}

/** Troca o contexto: só aceita igrejas em que o usuário tem vínculo ativo (revalidado no banco). */
export async function switchChurchAction(input: unknown): Promise<Result<{ churchId: string }>> {
  const parsed = SwitchChurchSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", "Igreja inválida.");
  const user = await requireUser();
  const mine = await listMyChurches(user.id);
  if (!mine.some((c) => c.churchId === parsed.data.churchId)) return fail("FORBIDDEN", "Você não participa desta igreja.");
  await setChurchCookie(parsed.data.churchId);
  return ok({ churchId: parsed.data.churchId });
}
