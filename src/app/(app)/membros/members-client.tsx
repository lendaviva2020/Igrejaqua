"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { changeMemberRoleAction, decideJoinRequestAction, disableJoinLinkAction, inviteMemberAction, revokeInvitationAction, rotateJoinLinkAction, setMemberStatusAction } from "@/modules/members/actions";
import { InviteSchema, ROLE_LABEL, ROLES } from "@/modules/members/schemas";

const STATUS_LABEL = { invited: "Convidado", active: "Ativo", suspended: "Suspenso", left: "Saiu", pending: "Aguardando aprovação" } as const;

export function InviteForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("member");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = InviteSchema.safeParse({ email, role });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Dados inválidos."); return; }
    setError(null); setLink(null); setCopied(false);
    start(async () => {
      const r = await inviteMemberAction(parsed.data);
      if (r.ok) { setLink(r.data.link); setEmail(""); router.refresh(); } else setError(r.error.message);
    });
  };
  const copy = async () => {
    if (link === null) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError("Não foi possível copiar. Selecione o link e copie manualmente."); }
  };
  return (
    <div className="flex max-w-md flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormField label="E-mail da pessoa" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Papel
          <select value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])} className="min-h-11 rounded-controle border border-borda bg-superficie px-3 text-texto">
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </label>
        {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
        <Button type="submit" disabled={pending}>{pending ? "Gerando…" : "Gerar convite"}</Button>
      </form>
      {link !== null ? (
        <div role="status" className="rounded-superficie border border-ambar bg-superficie-2 p-4">
          <p className="mb-2 text-sm">Link válido por 7 dias e exibido só agora. Envie-o a quem foi convidado; só funciona para o e-mail informado.</p>
          <input readOnly value={link} aria-label="Link do convite" onFocus={(e) => e.currentTarget.select()} className="mb-3 min-h-11 w-full rounded-controle border border-borda bg-fundo px-3 text-sm" />
          <Button type="button" variant="secondary" onClick={copy}>{copied ? "Copiado" : "Copiar link"}</Button>
        </div>
      ) : null}
    </div>
  );
}

export function RevokeInviteButton({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="secondary" disabled={pending} onClick={() => start(async () => { await revokeInvitationAction({ invitationId }); router.refresh(); })}>
      Revogar
    </Button>
  );
}

export function MemberRow({ membershipId, name, role, status, isSelf }: { membershipId: string; name: string; role: (typeof ROLES)[number]; status: keyof typeof STATUS_LABEL; isSelf: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    setError(null);
    start(async () => { const r = await fn(); if (!r.ok) setError(r.error?.message ?? "Falha na operação."); router.refresh(); });
  };
  const editable = !isSelf && (status === "active" || status === "suspended");
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">{name}{isSelf ? " (você)" : ""}</p>
          <p className="text-sm text-texto-2">{ROLE_LABEL[role]} · {STATUS_LABEL[status]}</p>
        </div>
        {editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label={`Papel de ${name}`} value={role} disabled={pending} onChange={(e) => run(() => changeMemberRoleAction({ membershipId, role: e.target.value }))} className="min-h-11 rounded-controle border border-borda bg-superficie px-3 text-sm text-texto">
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => run(() => setMemberStatusAction({ membershipId, status: status === "active" ? "suspended" : "active" }))}>
              {status === "active" ? "Suspender" : "Reativar"}
            </Button>
          </div>
        ) : null}
      </div>
      {error ? <p role="alert" className="mt-2 text-sm text-perigo">{error}</p> : null}
    </li>
  );
}

/** Link geral da igreja: um só por vez; quem entra por ele fica aguardando aprovação. */
export function JoinLinkCard({ link }: { link: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    setError(null); setCopied(false);
    start(async () => { const r = await fn(); if (!r.ok) setError(r.error?.message ?? "Falha na operação."); router.refresh(); });
  };
  const copy = async () => {
    if (link === null) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError("Não foi possível copiar. Selecione o link e copie manualmente."); }
  };
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <p className="text-sm text-texto-2">Envie este link no grupo da igreja. Quem entrar por ele aparece em “Pedidos para entrar” e só passa a ver a igreja depois que você aprovar.</p>
      {link !== null ? (
        <>
          <input readOnly value={link} aria-label="Link da igreja" onFocus={(e) => e.currentTarget.select()} className="min-h-11 w-full rounded-controle border border-borda bg-fundo px-3 text-sm" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={copy}>{copied ? "Copiado" : "Copiar link"}</Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => run(rotateJoinLinkAction)}>Gerar novo link</Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => run(disableJoinLinkAction)}>Desativar</Button>
          </div>
          <p className="text-xs text-texto-2">Gerar um novo link ou desativar faz o link atual parar de funcionar na hora.</p>
        </>
      ) : (
        <div><Button type="button" disabled={pending} onClick={() => run(rotateJoinLinkAction)}>{pending ? "Gerando…" : "Gerar link da igreja"}</Button></div>
      )}
      {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
    </div>
  );
}

export function JoinRequestRow({ membershipId, name }: { membershipId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const decide = (approve: boolean) => {
    setError(null);
    start(async () => { const r = await decideJoinRequestAction({ membershipId, approve }); if (!r.ok) setError(r.error.message); router.refresh(); });
  };
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium">{name}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={() => decide(true)}>Aprovar</Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => decide(false)}>Recusar</Button>
        </div>
      </div>
      {error ? <p role="alert" className="mt-2 text-sm text-perigo">{error}</p> : null}
    </li>
  );
}
