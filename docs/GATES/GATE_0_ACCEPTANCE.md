# GATE 0 — Relatório de Aceite

**Veredito: GATE 0 NÃO APROVADO. Pronto para revisão humana.** A existência dos documentos não equivale a aprovação. Este gate só é aprovado quando um humano resolver os itens `PENDING_REVIEW`/`BLOCKED` abaixo.

Classificações: `APPROVED` · `PENDING_REVIEW` · `BLOCKED` · `NOT_IMPLEMENTED`

## 1. Relatório de descoberta do repositório
| Item | Achado |
|---|---|
| Repositório | Não havia repositório; diretório `/home/claude/igrejaqua` criado e `git init` (branch `main`, sem commits) |
| Aplicação existente | Nenhuma. Sem `package.json`, sem `supabase/` |
| Código preexistente sobrescrito/apagado | Nenhum |
| Ambiente | Node v22.23.5, npm 10.9.9; registro npm e GitHub acessíveis |
| Skills instaladas (`.claude/skills/`) | `vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-react-view-transitions`, `web-design-guidelines` (de `vercel-labs/agent-skills`); `frontend-design`, `skill-creator` (de `anthropics/skills`) — **todas com SKILL.md válido** |
| "Vercel Next.js Skills" | `vercel-labs/next-skills` não contém skills válidas; a cobertura Next.js vem de `vercel-react-best-practices`. Classificação: PENDING_REVIEW (confirmar se há outra fonte desejada) |
| `ultracode` / `ultra-frontend` | Não encontradas por busca (`skills find`). NOT_IMPLEMENTED; não simuladas |
| Subagentes | Mecanismo real: ferramenta `Agent` (`claude`, `general-purpose`, `Explore`, `Plan`). Ver `AGENTS.md` |
| Pasta `supabase/` e Supabase MCP | Projeto Supabase **não foi consultado nem alterado** nesta fase |

## 2. Itens entregues
| # | Entrega | Status |
|---|---|---|
| 1 | Arquitetura proposta (`ARCHITECTURE.md`) | PENDING_REVIEW |
| 2 | Estrutura de diretórios (preserva a árvore do usuário; acréscimos marcados) | PENDING_REVIEW |
| 3 | Diagrama ER (`ER_DIAGRAM.md`) | PENDING_REVIEW |
| 4 | Decisões de banco (`DATABASE.md`) | PENDING_REVIEW |
| 5 | Segurança e RLS (`SECURITY.md`) | PENDING_REVIEW |
| 6 | Matriz RBAC (`RBAC.md`) | PENDING_REVIEW |
| 7 | Mapa de dependência de módulos (`ARCHITECTURE.md` §2) | PENDING_REVIEW |
| 8 | Motor de IA (`AI_ENGINE.md`) | PENDING_REVIEW |
| 9 | UX e Design System (`UX_DESIGN.md`) | PENDING_REVIEW |
| 10 | Roadmap Gates 1–7 (`IMPLEMENTATION_ROADMAP.md`) | PENDING_REVIEW |
| 11 | ADRs 0001–0009 | PENDING_REVIEW |
| 12 | Contratos de API, regras de domínio, estratégia de testes | PENDING_REVIEW |
| 13 | `CLAUDE.md`, `AGENTS.md` | PENDING_REVIEW |
| — | Migrations, código de aplicação, telas, integrações | NOT_IMPLEMENTED (por escopo) |

## 3. Registro de riscos técnicos
| ID | Risco | Sev. | Mitigação | Status |
|---|---|---|---|---|
| RISK-01 | Dois prompts com escopos distintos (louvor/IA vs. gestão geral/financeiro) | Alta | União em 2 ondas (ARCHITECTURE §1); decisão humana | PENDING_REVIEW |
| RISK-02 | Versões muito novas e não testadas em conjunto (TS 7, Next 16, Vitest 5, Tailwind 4, Zod 4, lucide 1.x) | Alta | Spike de compatibilidade no Gate 1; fallback TS 5.x | PENDING_REVIEW |
| RISK-03 | Dado de religião é **sensível** na LGPD | Alta | Consentimento específico, minimização, DPO, ROPA | PENDING_REVIEW |
| RISK-04 | Transferência internacional de dados para DeepSeek | Alta | Pseudonimização + consentimento + parecer jurídico; IA desligada por padrão | BLOCKED (para ativar IA em produção) |
| RISK-05 | Falha de política RLS vazar dados entre igrejas | Crítica | 3 camadas, FKs compostas, matriz cross-tenant automática | PENDING_REVIEW |
| RISK-06 | Anonimato de oração quebrado por admin/service role/correlação | Alta | Tabela separada, sem leitura geral, revelação auditada e opcional | PENDING_REVIEW |
| RISK-07 | Ledger financeiro (dízimos) fora do escopo seguro do piloto | Média | Adiado p/ Onda 2; PIX apenas informativo | BLOCKED (até decisão) |
| RISK-08 | Transposição/ChordPro com acordes complexos | Média | Função pura + testes de propriedade; avaliar lib | PENDING_REVIEW |
| RISK-09 | Cache offline expor dados após logout (PWA) | Média | Limpeza no logout, TTL, só sessões publicadas | PENDING_REVIEW |
| RISK-10 | Modelo de contexto de igreja por cookie vs. slug na URL | Média | Cookie revalidado; reavaliar slug | PENDING_REVIEW |
| RISK-11 | Direitos autorais de letras/cifras | Média | Campos de copyright, aviso, responsabilidade da igreja | PENDING_REVIEW |
| RISK-12 | API DeepSeek (modelos, limites, termos) não verificada | Média | Verificar no Gate 5 com chamada real | PENDING_REVIEW |
| RISK-13 | Pedido "50 agentes" vs. mecanismo real | Baixa | Catálogo de papéis; execução com poucos subagentes reais | APPROVED (esclarecimento) |

## 4. Decisões pendentes para o responsável (nenhuma bloqueia a leitura; as 1–3 bloqueiam o Gate 2)
1. Escopo: Onda 1/Onda 2 (RISK-01, RISK-07).
2. Contexto de igreja: cookie (recomendado) ou slug (RISK-10).
3. Parecer jurídico sobre IA com provedor estrangeiro (RISK-04) e sobre dado religioso (RISK-03).
4. Aprovação da direção visual "Caderno de Culto" e das fontes.
5. Plano Supabase/Vercel e região (recomendado `sa-east-1`) para PITR e metas RPO/RTO.
6. Fonte para "Vercel Next.js Skills" e para "ultracode/ultra-frontend", se existirem.

## 5. Checklist de aceite
- [x] Repositório inspecionado; nada sobrescrito
- [x] Documentos obrigatórios criados
- [x] Consistência entre documentos verificada por script (ver §6)
- [ ] Revisão humana da arquitetura — PENDING_REVIEW
- [ ] Decisões 1–3 da §4 tomadas — PENDING_REVIEW
- [ ] Direção visual aprovada pelo Designer — PENDING_REVIEW
- [ ] Spike de compatibilidade de versões — NOT_IMPLEMENTED (Gate 1)
- [ ] Migrations — NOT_IMPLEMENTED (aguardam aprovação)

## 6. Verificação de consistência
Resultado da checagem automática (tabelas do `DATABASE.md` ↔ `ER_DIAGRAM.md`, enums de permissão ↔ `RBAC.md`, IDs de regra citados): ver saída registrada no final deste arquivo.

### Saída da verificação (executada em 2026-11-25)
```
req missing in DATABASE: []
req missing in ER: só rate_limit_buckets e idempotency_keys (infra; nota adicionada ao ER_DIAGRAM.md)
perms missing in RBAC: []
regras citadas e não definidas: []
```
Correção feita durante a verificação: IDs de risco renomeados de `R-NN` para `RISK-NN` para não colidir com as regras de domínio `R-NN`.
Limitação: a checagem é textual; não valida SQL (não existe SQL ainda).
