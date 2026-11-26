"use client";

import { ActionButton, ActionForm, Field, SelectField } from "@/components/shared/action-form";
import { addFamilyMemberAction, createFamilyAction, deleteFamilyAction, removeFamilyMemberAction } from "@/modules/families/actions";
import { FAMILY_RELATIONS, FAMILY_RELATION_LABEL } from "@/modules/families/schemas";

export function CreateFamilyForm() {
  return <ActionForm action={createFamilyAction} submitLabel="Criar família"><Field label="Nome da família" name="name" placeholder="Família Silva" /></ActionForm>;
}

export function AddMemberForm({ familyId, members }: { readonly familyId: string; readonly members: readonly { id: string; name: string }[] }) {
  return (
    <ActionForm action={addFamilyMemberAction} submitLabel="Adicionar" extra={{ familyId }} className="mt-2 flex max-w-md flex-col gap-4">
      <SelectField label="Membro da igreja (com conta)" name="membershipId" defaultValue="">
        <option value="">— dependente sem conta —</option>
        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </SelectField>
      <Field label="Nome do dependente (se não tiver conta)" name="fullName" />
      <SelectField label="Relação" name="relation" defaultValue="outro">
        {FAMILY_RELATIONS.map((r) => <option key={r} value={r}>{FAMILY_RELATION_LABEL[r]}</option>)}
      </SelectField>
      <Field label="Data de nascimento" name="birthDate" type="date" />
    </ActionForm>
  );
}

export const RemoveMemberButton = ({ id }: { readonly id: string }) => <ActionButton action={removeFamilyMemberAction} input={{ id }} label="Remover" confirmMessage="Remover esta pessoa da família?" />;
export const DeleteFamilyButton = ({ familyId }: { readonly familyId: string }) => <ActionButton action={deleteFamilyAction} input={{ familyId }} label="Excluir família" variant="danger" confirmMessage="Excluir esta família e seus vínculos?" />;
