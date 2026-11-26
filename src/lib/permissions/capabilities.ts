/**
 * Fonte única das capacidades (RBAC.md §4). O servidor usa `can()`; o teste de paridade
 * (tests/unit/permissions-parity.test.ts) garante que o enum de permissões casa com o SQL.
 */
export const MINISTRY_PERMISSIONS = [
  "manage_ministry",
  "manage_members",
  "manage_schedule",
  "publish_schedule",
  "manage_repertoire",
  "manage_rehearsals",
  "manage_content",
  "view_availability",
] as const;
export type MinistryPermission = (typeof MINISTRY_PERMISSIONS)[number];

export const CHURCH_ROLES = ["admin", "leader", "member"] as const;
export type ChurchRole = (typeof CHURCH_ROLES)[number];

/** Contexto já validado no servidor (resolveChurchContext). */
export interface AuthContext {
  readonly userId: string;
  readonly churchId: string;
  readonly membershipId: string;
  readonly role: ChurchRole;
  /** Permissões por ministério (apenas ministérios em que o usuário está ativo). */
  readonly ministryPermissions: Readonly<Record<string, readonly MinistryPermission[]>>;
}

type Rule =
  | { readonly kind: "admin" }
  | { readonly kind: "ministry"; readonly anyOf: readonly MinistryPermission[] } // exige ministryId
  | { readonly kind: "anyMinistry"; readonly anyOf: readonly MinistryPermission[] }
  | { readonly kind: "member" };

/** Toda ação do sistema aparece aqui. Admin satisfaz qualquer regra. */
export const CAPABILITIES = {
  "church.settings.update": { kind: "admin" },
  "member.invite": { kind: "admin" },
  "member.role.change": { kind: "admin" },
  "ministry.create": { kind: "admin" },
  "ministry.update": { kind: "ministry", anyOf: ["manage_ministry"] },
  "ministry.members.manage": { kind: "ministry", anyOf: ["manage_members"] },
  "ministry.permissions.grant": { kind: "ministry", anyOf: ["manage_ministry"] },
  "event.manage": { kind: "anyMinistry", anyOf: ["manage_rehearsals", "manage_schedule"] },
  "schedule.edit": { kind: "ministry", anyOf: ["manage_schedule"] },
  "schedule.publish": { kind: "ministry", anyOf: ["publish_schedule"] },
  "availability.view": { kind: "ministry", anyOf: ["view_availability", "manage_schedule"] },
  "repertoire.manage": { kind: "anyMinistry", anyOf: ["manage_repertoire"] },
  "setlist.manage": { kind: "anyMinistry", anyOf: ["manage_repertoire", "manage_schedule"] },
  "content.publish.church": { kind: "admin" },
  "content.publish.ministry": { kind: "ministry", anyOf: ["manage_content"] },
  "prayer.moderate": { kind: "ministry", anyOf: ["manage_content"] },
  "ai.use": { kind: "anyMinistry", anyOf: ["manage_schedule", "manage_repertoire"] },
  "attendance.record.others": { kind: "anyMinistry", anyOf: ["manage_schedule"] },
  "contribution.manage": { kind: "admin" },
  "audit.view": { kind: "admin" },
  "data.export": { kind: "admin" },
  "agenda.view": { kind: "member" },
  "family.view": { kind: "anyMinistry", anyOf: ["manage_members"] },
  "family.manage": { kind: "admin" },
  "visitor.manage": { kind: "anyMinistry", anyOf: ["manage_members"] },
  "visitor.delete": { kind: "admin" },
  "cell.manage": { kind: "admin" },
  "finance.manage": { kind: "admin" },
} as const satisfies Record<string, Rule>;

export type Action = keyof typeof CAPABILITIES;

export function can(ctx: AuthContext, action: Action, ministryId?: string): boolean {
  if (ctx.role === "admin") return true;
  const rule: Rule = CAPABILITIES[action];
  switch (rule.kind) {
    case "admin":
      return false;
    case "member":
      return true;
    case "ministry": {
      if (ministryId === undefined) return false; // sem escopo explícito, nega
      const granted = ctx.ministryPermissions[ministryId] ?? [];
      return rule.anyOf.some((p) => granted.includes(p));
    }
    case "anyMinistry":
      return Object.values(ctx.ministryPermissions).some((granted) => rule.anyOf.some((p) => granted.includes(p)));
  }
}

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN" as const;
  constructor(action: Action) {
    super(`Sem permissão para: ${action}`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(ctx: AuthContext, action: Action, ministryId?: string): void {
  if (!can(ctx, action, ministryId)) throw new ForbiddenError(action);
}
