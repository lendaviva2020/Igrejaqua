"use client";

import { ActionButton, ActionForm, Field, SelectField, TextAreaField } from "@/components/shared/action-form";
import { addCellMemberAction, createCellAction, deactivateCellAction, recordMeetingAction, removeCellMemberAction } from "@/modules/cells/actions";
import { WEEKDAY_LABEL } from "@/modules/cells/schemas";

type Person = { readonly id: string; readonly name: string };

export function NewCellForm({ leaders }: { readonly leaders: readonly Person[] }) {
  return (
    <ActionForm action={createCellAction} submitLabel="Criar célula">
      <Field label="Nome da célula" name="name" />
      <SelectField label="Líder" name="leaderMembershipId" defaultValue="">
        <option value="" disabled>Escolha…</option>
        {leaders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </SelectField>
      <SelectField label="Dia da reunião" name="weekday" defaultValue="">
        <option value="">Sem dia fixo</option>
        {WEEKDAY_LABEL.map((d, i) => <option key={d} value={i}>{d}</option>)}
      </SelectField>
      <Field label="Horário (HH:MM)" name="meetingTime" type="time" />
      <Field label="Local (opcional)" name="location" />
    </ActionForm>
  );
}

export function AddCellMemberForm({ cellId, candidates }: { readonly cellId: string; readonly candidates: readonly Person[] }) {
  return (
    <ActionForm action={addCellMemberAction} submitLabel="Adicionar à célula" extra={{ cellId }}>
      <SelectField label="Membro" name="membershipId" defaultValue="">
        <option value="" disabled>Escolha…</option>
        {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </SelectField>
    </ActionForm>
  );
}

export function RecordMeetingForm({ cellId, participants }: { readonly cellId: string; readonly participants: readonly Person[] }) {
  return (
    <ActionForm action={recordMeetingAction} submitLabel="Registrar reunião" extra={{ cellId }} multi={["attendees"]}>
      <Field label="Data da reunião" name="heldOn" type="date" max={new Date().toISOString().slice(0, 10)} />
      <Field label="Tema (opcional)" name="topic" />
      <fieldset className="flex flex-col">
        <legend className="mb-1 text-sm font-medium">Quem esteve presente</legend>
        {participants.map((p) => (
          <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" name="attendees" value={p.id} className="size-5 accent-ambar" />{p.name}</label>
        ))}
      </fieldset>
      <TextAreaField label="Anotações (opcional)" name="notes" maxLength={1000} />
    </ActionForm>
  );
}

export const RemoveCellMemberButton = ({ cellId, membershipId, label }: { readonly cellId: string; readonly membershipId: string; readonly label: string }) =>
  <ActionButton action={removeCellMemberAction} input={{ cellId, membershipId }} label={label} confirmMessage="Confirmar?" />;
export const DeactivateCellButton = ({ cellId }: { readonly cellId: string }) =>
  <ActionButton action={deactivateCellAction} input={{ cellId }} label="Encerrar célula" variant="danger" confirmMessage="Encerrar esta célula? O histórico é mantido." />;
