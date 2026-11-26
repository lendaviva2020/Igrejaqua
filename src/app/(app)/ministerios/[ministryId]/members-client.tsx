"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { MINISTRY_PERMISSIONS, type MinistryPermission } from "@/lib/permissions/capabilities";
import { addMinistryMemberAction, removeMinistryMemberAction, setMinistryPermissionAction, updateMinistryMemberAction } from "@/modules/ministries/member-actions";
import { MINISTRY_ROLE_LABEL, PERMISSION_LABEL, parseInstruments } from "@/modules/ministries/member-schemas";
import type { MinistryMemberItem } from "@/modules/ministries/member-queries";

type Role = "coordinator" | "member";

export function AddMemberForm({ ministryId, candidates }: { ministryId: string; candidates: readonly { membershipId: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [membershipId, setMembershipId] = useState(candidates[0]?.membershipId ?? "");
  const [role, setRole] = useState<Role>("member");
  const [instruments, setInstruments] = useState("");
  const [voicePart, setVoicePart] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await addMinistryMemberAction({ ministryId, membershipId, role, instruments: parseInstruments(instruments), ...(voicePart.trim() ? { voicePart } : {}) });
      if (r.ok) { setInstruments(""); setVoicePart(""); router.refresh(); } else setError(r.error.fields ? Object.values(r.error.fields).flat()[0] ?? r.error.message : r.error.message);
    });
  };
  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1.5 text-sm font-medium">Pessoa
        <select value={membershipId} onChange={(e) => setMembershipId(e.target.value)} className="min-h-11 rounded-controle border border-borda bg-superficie px-3 text-texto">
          {candidates.map((c) => <option key={c.membershipId} value={c.membershipId}>{c.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">Função
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="min-h-11 rounded-controle border border-borda bg-superficie px-3 text-texto">
          <option value="member">{MINISTRY_ROLE_LABEL.member}</option><option value="coordinator">{MINISTRY_ROLE_LABEL.coordinator}</option>
        </select>
      </label>
      <FormField label="Instrumentos (separe por vírgula)" value={instruments} onChange={(e) => setInstruments(e.target.value)} />
      <FormField label="Naipe vocal (opcional)" value={voicePart} onChange={(e) => setVoicePart(e.target.value)} maxLength={40} />
      {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Adicionando…" : "Adicionar ao ministério"}</Button>
    </form>
  );
}

export function MemberCard({ ministryId, member, canManage, canGrant }: { ministryId: string; member: MinistryMemberItem; canManage: boolean; canGrant: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role>(member.role);
  const [active, setActive] = useState(member.active);
  const [instruments, setInstruments] = useState(member.instruments.join(", "));
  const [voicePart, setVoicePart] = useState(member.voicePart ?? "");

  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    setError(null);
    start(async () => { const r = await fn(); if (!r.ok) setError(r.error?.message ?? "Falha na operação."); router.refresh(); });
  };
  const save = () => run(() => updateMinistryMemberAction({ ministryId, ministryMembershipId: member.id, role, active, instruments: parseInstruments(instruments), voicePart: voicePart.trim() ? voicePart.trim() : null }));
  const togglePermission = (permission: MinistryPermission, granted: boolean) => run(() => setMinistryPermissionAction({ ministryId, ministryMembershipId: member.id, permission, granted }));

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{member.name}{!member.active ? " (inativo)" : ""}</p>
        <p className="text-sm text-texto-2">{MINISTRY_ROLE_LABEL[member.role]}{member.voicePart ? ` · ${member.voicePart}` : ""}</p>
      </div>
      {member.instruments.length > 0 ? <p className="text-sm text-texto-2">{member.instruments.join(", ")}</p> : null}
      {canManage || canGrant ? (
        <details className="mt-2">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-ambar-claro">Gerenciar</summary>
          <div className="mt-2 flex flex-col gap-4 rounded-superficie bg-superficie-2 p-4">
            {canManage ? (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-medium">Função
                  <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="min-h-11 rounded-controle border border-borda bg-superficie px-3 text-texto">
                    <option value="member">{MINISTRY_ROLE_LABEL.member}</option><option value="coordinator">{MINISTRY_ROLE_LABEL.coordinator}</option>
                  </select>
                </label>
                <FormField label="Instrumentos (separe por vírgula)" value={instruments} onChange={(e) => setInstruments(e.target.value)} />
                <FormField label="Naipe vocal" value={voicePart} onChange={(e) => setVoicePart(e.target.value)} maxLength={40} />
                <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Ativo nas escalas</label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={pending} onClick={save}>Salvar</Button>
                  <Button type="button" variant="danger" disabled={pending} onClick={() => run(() => removeMinistryMemberAction({ ministryId, ministryMembershipId: member.id }))}>Remover do ministério</Button>
                </div>
              </div>
            ) : null}
            {canGrant ? (
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 text-sm font-medium">Permissões</legend>
                {MINISTRY_PERMISSIONS.map((p) => (
                  <label key={p} className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" checked={member.permissions.includes(p)} disabled={pending} onChange={(e) => togglePermission(p, e.target.checked)} />{PERMISSION_LABEL[p]}
                  </label>
                ))}
              </fieldset>
            ) : null}
            {error ? <p role="alert" className="text-sm text-perigo">{error}</p> : null}
          </div>
        </details>
      ) : null}
    </li>
  );
}
