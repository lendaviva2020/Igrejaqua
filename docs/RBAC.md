# IGREJAQUA — RBAC

Status: **PENDING_REVIEW**

## 1. Modelo
Três níveis combinados:
1. **Identidade global** (`profiles`): sem papel.
2. **Papel na igreja** (`church_memberships.role`): `admin` | `leader` | `member`, mais `is_owner` (um ou mais proprietários; não pode ser removido o último).
3. **Permissões de ministério** (`ministry_permissions`): concedidas por ministério a um `ministry_membership`.

Regra de ouro: `leader` **não** concede poder sobre ministérios por si só — dá acesso à experiência de líder. O poder vem de `ministry_permissions` no ministério específico. `admin` tem todas as permissões implícitas em todos os ministérios da própria igreja.

Um usuário pode ser `admin` na igreja A e `member` na B: o papel é sempre avaliado com `church_id`.

## 2. Matriz de papéis (igreja)

Legenda: ✔ permitido · ◐ condicionado · ✖ negado · P = permissão de ministério

| Capacidade | admin | leader | member |
|---|---|---|---|
| Ver dados da própria igreja (agenda, comunicados) | ✔ | ✔ | ✔ |
| Editar dados da igreja / `church_settings` | ✔ | ✖ | ✖ |
| Convidar/suspender membros | ✔ | ✖ | ✖ |
| Alterar papel de igreja | ✔ (não o próprio; não rebaixar último admin) | ✖ | ✖ |
| Criar/arquivar ministério | ✔ | ✖ | ✖ |
| Gerir membros do ministério | ✔ | ◐ P `manage_members` | ✖ |
| Conceder permissões de ministério | ✔ | ◐ P `manage_ministry` (só dentro do ministério, nunca acima do próprio nível) | ✖ |
| Criar/editar eventos e sessões | ✔ | ◐ P `manage_rehearsals` (ensaios) / `manage_schedule` | ✖ |
| Montar escala (rascunho) | ✔ | ◐ P `manage_schedule` | ✖ |
| **Publicar** escala | ✔ | ◐ P `publish_schedule` | ✖ |
| Usar IA de escala/repertório | ✔ | ◐ P `manage_schedule` ou `manage_repertoire` | ✖ |
| Gerir repertório (músicas/versões) | ✔ | ◐ P `manage_repertoire` | ✖ (leitura ✔) |
| Montar setlist | ✔ | ◐ P `manage_repertoire` ou `manage_schedule` | ✖ |
| Ver disponibilidade (sim/não) dos membros | ✔ | ◐ P `view_availability` | ✖ |
| Ver **motivo** da indisponibilidade | ✖ | ✖ | só o próprio |
| Declarar própria indisponibilidade | ✔ | ✔ | ✔ |
| Confirmar/recusar a própria escala; RSVP | ✔ | ✔ | ✔ |
| Publicar comunicado/devocional | ✔ | ◐ P `manage_content` (no ministério) | ✖ |
| Criar pedido de oração (inclusive anônimo) | ✔ | ✔ | ✔ |
| Moderar pedidos de oração | ✔ | ◐ P `manage_content` | ✖ |
| Revelar autor de pedido anônimo | ✖ por padrão (opt-in, auditado) | ✖ | ✖ |
| Registrar presença de outros | ✔ | ◐ P `manage_schedule` | ✖ (self check-in ✔) |
| Gerir PIX/`contributions` | ✔ | ✖ | ✖ (ver ✔ se `visible`) |
| Ver `audit_logs` | ✔ | ✖ | ✖ (o titular vê eventos sobre si via LGPD) |
| Exportar dados da igreja | ✔ (owner) | ✖ | ✖ |
| Acessar Stage Mode de sessão publicada | ✔ | ✔ | ✔ (se escalado ou membro do ministério; ou setlist público da igreja — configurável) |
| Excluir a igreja | owner | ✖ | ✖ |

## 3. Permissões de ministério — semântica

| Permissão | Autoriza |
|---|---|
| `manage_ministry` | editar dados do ministério; conceder/revogar demais permissões abaixo (limitada ao que possui) |
| `manage_members` | adicionar/remover membros do ministério; editar instrumentos/faixa vocal |
| `manage_schedule` | criar/editar `event_lineup` em rascunho; acionar IA de escala |
| `publish_schedule` | transicionar escala `draft → published`; substituir escalados |
| `manage_repertoire` | CRUD de `songs`/`song_versions`/`event_setlist` |
| `manage_rehearsals` | criar/editar eventos `rehearsal` e sessões do ministério |
| `manage_content` | comunicados/devocionais do ministério; moderar orações do ministério |
| `view_availability` | consultar `get_ministry_availability` (somente boolean) |

Anti-escalada: ninguém concede permissão que não possui; ninguém altera as próprias permissões; trigger `memberships_guard` reforça no banco.

## 4. Onde cada checagem acontece

| Camada | Mecanismo |
|---|---|
| UI | esconde/desabilita ações (conveniência; **não** é segurança) |
| Servidor | `can(ctx, action, resource)` em `lib/permissions` (função pura, testada com tabela de verdade) |
| Banco | políticas RLS chamando `private.has_church_role` / `private.has_ministry_permission` |

`lib/permissions/policy.ts` e as políticas SQL derivam de **uma única tabela de capacidades** (`capabilities.ts`) — teste de paridade falha se divergirem (SINGLE_SOURCE_OF_TRUTH).

## 5. Casos de borda
- Membro `suspended`: perde acesso imediato (RLS usa `status='active'`).
- Usuário removido do ministério: perde permissões em cascata; escalas futuras em `draft/published` viram `cancelled` com notificação ao líder.
- Último admin/owner: não pode sair, ser rebaixado ou suspenso.
- Mesmo usuário em várias igrejas: troca de contexto exige nova resolução; permissões nunca são mescladas.

## Classificação
Matriz: **PENDING_REVIEW**. Implementação: **NOT_IMPLEMENTED**.
