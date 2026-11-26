# IGREJAQUA — UX e Design System

Status: **PENDING_REVIEW**. O Designer Principal (humano) deve aprovar esta direção antes de qualquer tela (Gate 1).

## 1. Direção estética: "Caderno de Culto"

Conceito: o produto se comporta como o **caderno do ministério** — papel quente, tinta, anotações à margem, tipografia de livro litúrgico — e não como um painel SaaS. A pessoa deve sentir ordem e serenidade, não "dashboard".

O que a torna reconhecível (e não "cara de IA"):
- **Fundo papel** quente em vez de branco/cinza-azulado; superfícies diferenciadas por **filete e tipografia**, não por sombras e cards empilhados.
- **Tipografia editorial**: títulos em serifa de livro, texto em grotesca humanista. Números tabulares em agendas.
- **Estrutura de "folha de ordem de culto"**: listas com linha-guia e marcação lateral (margem) em vez de grade de cards. Cada sessão é uma linha do tempo vertical com horas na margem esquerda.
- **Acento único** (cobre) usado só para ação primária e estado "agora".
- Ilustração: nenhuma decorativa. Único elemento gráfico de marca: o **filete duplo** (duas linhas finas) como divisor/identidade.

Proibido (herdado dos prompts): gradientes exagerados, neon, brilho, glassmorphism, emojis como ícone, cards repetitivos sem função, gráficos fictícios, decoração sem função.

## 2. Tokens

### Cor (contrastes calculados — WCAG 2.x)
| Token | Hex | Uso | Contraste |
|---|---|---|---|
| `--papel` | `#F4EFE4` | fundo | — |
| `--superficie` | `#FBF8F1` | áreas elevadas | — |
| `--tinta` | `#1F1B16` | texto | 14,93:1 sobre papel |
| `--tinta-2` | `#4A433A` | texto secundário | 8,50:1 |
| `--nanquim` | `#1E3A5F` | links, navegação ativa | 10,03:1 |
| `--cobre` | `#A8481F` | ação primária, "agora" | 5,07:1 (texto ≥ 18px/negrito ou ícone+rótulo) |
| `--oliva` | `#4F6B2E` | confirmado/sucesso | 5,27:1 |
| `--vinho` | `#8A2C3A` | erro/destrutivo | 7,32:1 |
| `--linha` | `#D9D0BF` | filetes e bordas | decorativo (não carrega informação) |

Texto sobre `--cobre`/`--nanquim`: `--papel` (5,07:1 / 10,03:1).
Estado nunca depende só de cor: sempre ícone + texto.

### Stage Mode (tema próprio, escuro, alto contraste)
| Token | Hex | Contraste sobre `--palco` |
|---|---|---|
| `--palco` | `#0C0B09` | fundo |
| `--palco-txt` | `#F6F1E6` | 17,47:1 (letra) |
| `--palco-acorde` | `#FFB347` | 11,05:1 (acordes) |
| `--palco-mudo` | `#B9B09E` | 9,15:1 (metadados) |

Sem brilho/glow. Acordes distinguem-se por **cor + posição + peso**, não só cor.

### Tipografia (auto-hospedada via `next/font`, subset latin + latin-ext)
- Títulos: **Newsreader** (serifa com eixo óptico).
- Interface e texto: **Instrument Sans**.
- Letras/cifras: **IBM Plex Mono** (alinhamento de acordes por coluna).
Escala (rem): 0,8125 · 0,9375 · 1 · 1,125 · 1,375 · 1,75 · 2,25 · 3. Corpo ≥ 16px. Stage: letra 28–44px ajustável, acorde 0,7× da letra.
(Escolha de fontes é proposta; o Designer pode substituir sem alterar tokens.)

### Espaço, raio, elevação
Base 4px; passos 4/8/12/16/24/32/48/72. Raio 2px (controles) / 6px (superfícies). Elevação por filete 1px; sombra só em overlays (menus, diálogos).

### Movimento
150–220 ms, ease-out; respeita `prefers-reduced-motion`. Um momento de entrada orquestrado por tela (revelação escalonada de linhas da agenda); sem micro-animações gratuitas. View Transitions do React apenas para navegação (skill `vercel-react-view-transitions`).

## 3. Experiências por papel

### ADMIN — "Secretaria"
Navegação lateral (desktop) / gaveta (mobile): Painel · Membros · Ministérios · Agenda · Escalas · Repertório · Comunidade · Notificações · Configurações.
Painel: **o que exige ação hoje** (escalas sem publicar, convites pendentes, conflitos), próximos eventos; sem gráficos sem dado real.

### LEADER — "Mesa do ministério"
Seletor de ministério no topo (se tiver vários). Atalhos: Escala do ministério (com indicador de justiça e disponibilidade), Repertório, Ensaios, Comunicados do ministério. Funções visíveis conforme `ministry_permissions`.

### MEMBER — "Minha semana"
Barra inferior (mobile): Agenda · Disponibilidade · Palco · Comunidade · Mais. Início = próximos compromissos com botão **Confirmo / Não posso** direto na linha. Contribuição (PIX) acessível em Comunidade → Contribuir.

## 4. Hierarquia de navegação e inventário de páginas

| Rota | Papéis | Conteúdo |
|---|---|---|
| `/` (marketing) | público | apresentação institucional |
| `/login` `/cadastro` `/recuperar-senha` `/callback` | público | autenticação |
| `/selecionar-igreja` | autenticado | contexto de igreja (>1 vínculo) |
| `/dashboard` | todos (variação por papel) | resumo acionável |
| `/membros`, `/membros/[id]`, `/membros/convites` | admin | diretório, papéis, convites |
| `/ministerios`, `/ministerios/[id]`, `/ministerios/[id]/equipe`, `/ministerios/[id]/permissoes` | admin/leader/member (leitura) | ministérios |
| `/agenda`, `/agenda/[eventoId]`, `/agenda/novo` | todos / criação P | calendário e detalhe com sessões |
| `/escalas`, `/escalas/[sessaoId]` | leader/admin; member vê a sua | montagem, revisão de IA, publicação |
| `/repertorio`, `/repertorio/[musicaId]`, `/repertorio/[musicaId]/versoes/[id]` | leader/admin; member lê | biblioteca, editor ChordPro, transposição |
| `/palco/[sessaoId]` | escalados e membros | Stage Mode |
| `/disponibilidade` | todos | indisponibilidades próprias |
| `/comunidade` (avisos, devocionais, oração, presença, contribuir) | todos | |
| `/notificacoes` | todos | central + preferências |
| `/configuracoes` (igreja, perfil, privacidade/LGPD, PIX) | admin / próprio | |

## 5. Componentes compartilhados
`AppShell`, `NavRail`, `BottomBar`, `ChurchSwitcher`, `PageHeader` (título + filete duplo), `AgendaRow` (hora na margem), `StatusMark` (ícone+texto), `PersonRef` (sem foto obrigatória), `RoleGate` (só UX), `ConfirmDialog`, `DataTable` (denso, teclado), `FormField` (RHF+Zod), `ChordSheet`, `KeyBadge`, `TransposeControl`, `SetlistEditor`, `LineupBoard`, `AvailabilityStrip`, `EmptyState` (texto útil, sem ilustração), `Toaster`, `OfflineBanner`. Base: shadcn/ui (Radix) reestilizado com os tokens; Lucide com traço 1,5px.

## 6. Stage Mode
- Rota `/palco/[sessaoId]`, layout próprio sem navegação, tema `--palco`.
- Letra grande, acordes sobre a sílaba (parser ChordPro), alternância de seção; controles: tom (±1 semitom, voltar ao original), tamanho da fonte, colunas, modo cifra/letra.
- Navegação por **toque nas bordas, setas/PageUp-Down, pedal Bluetooth (teclas)**; swipe opcional.
- Wake Lock API enquanto aberto; retoma ao voltar do background.
- Offline: carrega do cache da sessão publicada; indicador claro de "offline/versão de HH:MM".
- Segurança: `frame-ancestors 'none'`; sem dados de outros membros; aviso de direitos autorais conforme R-21.
- Alvos de toque ≥ 48px; contraste ≥ 7:1.

## 7. Responsivo e acessibilidade
- Mobile-first; breakpoints 480 / 768 / 1100 / 1440. Navegação: barra inferior (<768), trilho lateral (≥768), lateral expandida (≥1100).
- WCAG 2.2 AA: foco visível de 2px com offset (cor `--nanquim` + halo de papel), alvos ≥ 24px (44px no mobile), `aria-live` para confirmações, navegação por teclado completa, rótulos em todos os campos, `lang="pt-BR"`, reduz movimento.
- Teste: axe no Playwright em todas as rotas; checklist manual com leitor de tela (NVDA/VoiceOver) no Gate 6.

## 8. Processo (Gate 1)
1. Designer aprova tokens e tipografia (este documento).
2. Montar Design System em Storybook/rota interna `/design` (não pública) com todos os estados.
3. Telas de referência: Agenda do membro, Montagem de escala, Editor de versão, Stage Mode, Painel admin.
4. Revisão com a skill `web-design-guidelines` e `frontend-design`; aprovação humana → Gate 2.

## Classificação
Direção visual: PENDING_REVIEW · Implementação: NOT_IMPLEMENTED
