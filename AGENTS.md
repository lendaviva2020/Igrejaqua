# AGENTS.md — IGREJAQUA

Regras para qualquer agente de código (Claude Code ou outro). Complementa `CLAUDE.md`.

## 1. Mecanismo real de agentes
No Claude Code, subagentes reais são criados pela ferramenta **Agent** (tipos disponíveis nesta sessão: `claude`, `general-purpose`, `Explore` (somente leitura), `Plan` (somente planejamento)). **Papéis abaixo são funções de trabalho atribuídas a subagentes reais sob demanda — não existem 50 processos permanentes e nada é simulado.** Teto prático: executar poucos agentes em paralelo (recomendado ≤ 6) com escopos de arquivos disjuntos; o número de papéis (até 50) é um limite de organização, não uma meta.

## 2. Papéis (catálogo; ativar apenas os necessários por Gate)
| Área | Vagas | Responsabilidade | Gate principal |
|---|---|---|---|
| Arquitetura e liderança técnica | 4 | Tech Lead (coordenação, contratos entre módulos, integração), Arquiteto de dados, Arquiteto de segurança, Revisor de ADR | 0–7 |
| Product Design e UX/UI | 8 | Designer Principal (aprova DS), UX research, Design System, Stage Mode, Conteúdo/microcopy, Acessibilidade, Motion, Ícones/marca | 1 |
| Frontend e Next.js | 10 | Shell/Navegação, Formulários, Agenda, Escalas, Repertório/ChordPro, Stage/PWA, Comunidade, Dashboard, Performance React, Testes de UI | 1,3,4 |
| Backend e Supabase | 8 | Migrations/RLS, Auth/SSR, Módulo members/ministries, events/schedules, repertoire, notifications, jobs/cron, IA | 2,4,5 |
| Segurança e LGPD | 5 | RLS review, AppSec/OWASP, LGPD/privacidade, segredos/dependências, pentest interno | 2,6 |
| QA e auditoria | 7 | Unidade, integração, E2E, a11y, carga, auditoria de consistência docs↔código, verificador independente | todos |
| DevOps e performance | 5 | CI/CD, ambientes Supabase/Vercel, observabilidade, backup/restore, performance/CWV | 1,6,7 |
| Documentação e homologação | 3 | Docs vivos, relatórios de Gate, UAT/homologação | todos |

## 3. Regras de coordenação
1. **Um dono por arquivo/diretório por vez.** O Tech Lead atribui áreas; dois agentes nunca editam o mesmo arquivo.
2. Cada tarefa delegada carrega **contexto completo** (objetivo, arquivos, contratos, critérios de aceite). Agente sem contexto não é acionado.
3. Contratos entre módulos mudam só via PR do Tech Lead + atualização do doc correspondente.
4. Agentes de revisão (QA, Segurança) **não escrevem** o código que revisam.
5. Tarefas de verificação de alto risco (RLS, auth, IA) usam um agente que não viu a implementação.
6. Nenhum agente avança de Gate; apenas o humano aprova.

## 4. Padrões de código
- TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); sem `any`; Zod `.strict()` em toda fronteira.
- Estrutura por módulo: `domain/ schemas.ts actions.ts queries.ts repository.ts index.ts`. Só `repository.ts` toca o banco; só `index.ts` é importável por outro módulo.
- Erros: classes de domínio (`ForbiddenError`, `RuleViolationError`…) mapeadas para `Result<T>` (`docs/API_CONTRACTS.md`).
- Logs estruturados com `requestId`; nunca logar PII, corpo de oração, tokens.
- Nomes que revelam intenção; comentários explicam o *porquê*; JSDoc em APIs públicas.
- Commits pequenos; mensagem em português ou inglês consistente; sem segredos.

## 5. Definição de pronto
Tipos, lint, build, testes unitários/integração/E2E/RLS verdes **com saída anexada** ao relatório do Gate; sem TODO; docs atualizados; revisão de segurança do que toca auth/RLS/IA.

## 6. Skills
Ver `CLAUDE.md`. `ultracode` / `ultra-frontend`: **não encontrados** em registro público na verificação do Gate 0; não referenciar até existirem e serem validados.
