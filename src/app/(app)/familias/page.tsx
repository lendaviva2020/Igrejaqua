import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { listMembers } from "@/modules/members/queries";
import { listFamilies } from "@/modules/families/queries";
import { FAMILY_RELATION_LABEL } from "@/modules/families/schemas";
import { AddMemberForm, CreateFamilyForm, DeleteFamilyButton, RemoveMemberButton } from "./families-client";

export const metadata: Metadata = { title: "Famílias" };
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

export default async function FamiliesPage() {
  const ctx = await resolveChurchContext();
  const manage = can(ctx, "family.manage");
  const [families, members] = await Promise.all([listFamilies(ctx.churchId), manage ? listMembers(ctx.churchId) : Promise.resolve([])]);
  if (!manage && families.length === 0 && !can(ctx, "family.view")) notFound();
  const nameOf = new Map(members.map((m) => [m.membershipId, m.name]));
  const active = members.filter((m) => m.status === "active");
  return (
    <>
      <PageHeader title="Famílias" description={manage ? "Agrupe membros e dependentes. Menores de 18 anos exigem um responsável cadastrado." : "Os dados da sua família."} />
      {families.length === 0 ? <EmptyState title="Nenhuma família cadastrada">{manage ? "Crie a primeira família abaixo." : "A administração ainda não cadastrou sua família."}</EmptyState> : (
        <ul className="flex flex-col gap-4">
          {families.map((f) => (
            <li key={f.id} className="rounded-superficie border border-linha bg-superficie p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl">{f.name}</h2>
                {manage ? <DeleteFamilyButton familyId={f.id} /> : null}
              </div>
              <ul className="mt-3 divide-y divide-linha">
                {f.members.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <div>
                      <p className="font-medium">{m.fullName ?? (m.membershipId ? nameOf.get(m.membershipId) ?? "Membro da igreja" : "Membro da igreja")}</p>
                      <p className="text-sm text-texto-2">{FAMILY_RELATION_LABEL[m.relation]}{m.birthDate ? ` · nascimento ${dateFmt.format(new Date(`${m.birthDate}T00:00:00Z`))}` : ""}{m.membershipId ? "" : " · sem conta"}</p>
                    </div>
                    {manage ? <RemoveMemberButton id={m.id} /> : null}
                  </li>
                ))}
              </ul>
              {manage ? <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-ambar-claro">Adicionar pessoa</summary><AddMemberForm familyId={f.id} members={active.map((m) => ({ id: m.membershipId, name: m.name }))} /></details> : null}
            </li>
          ))}
        </ul>
      )}
      {manage ? <section aria-labelledby="nova" className="mt-10"><h2 id="nova" className="mb-3 text-2xl">Nova família</h2><CreateFamilyForm /></section> : null}
    </>
  );
}
