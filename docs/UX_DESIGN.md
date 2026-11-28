# IGREJAQUA — UX e Design System

Status: **PENDING_REVIEW**. O Designer Principal (humano) deve aprovar esta direção antes de qualquer tela (Gate 1).

## 1. Direção estética: "Noite & Âmbar"

Decisão do responsável pelo produto (substitui a direção anterior "Caderno de Culto"): app de igreja **mobile-first escuro**, no padrão do mockup de referência — tema azul-noite, cartões arredondados, grade de atalhos, bloco de data (dia da semana / dia / mês), navegação inferior de 5 itens e botões em pílula — com **âmbar** como cor de marca no lugar do roxo.

Regras: âmbar só para ação primária, "agora/próximo" e ícones de atalho; teal = sucesso/confirmado; coral = erro/perigo; sem emoji como ícone; sem fotos de pessoas fictícias nem números/eventos de exemplo (apenas dados reais); brilho âmbar apenas no cartão de boas-vindas e na abertura (`brilho-ambar`), sem neon.

### Paleta (tokens em `src/app/globals.css`)
| Token | Hex | Uso | Contraste medido |
|---|---|---|---|
| `fundo` | `#0F1420` | fundo | — |
| `superficie` / `superficie-2` | `#171F33` / `#1F2A44` | cartões / hover e blocos de data | — |
| `linha` | `#2B3856` | divisores | decorativo |
| `borda` | `#5F7098` | bordas de campos e botões secundários | 3,73:1 / 3,33:1 (fundo / superfície) |
| `texto` | `#F4EFE6` | texto | 16,07:1 / 14,32:1 |
| `texto-2` | `#A9B3C9` | texto secundário | 8,74:1 / 7,79:1 |
| `ambar` | `#F5A524` | ação primária, ícones | 9,02:1 sobre fundo |
| `ambar-claro` | `#FFC96B` | links, foco, estado ativo | 10,79:1 sobre superfície |
| `sobre-ambar` | `#1A1204` | texto sobre âmbar | 9,09:1 |
| `sucesso` | `#3CC9A8` | confirmado | 7,90:1 sobre superfície |
| `perigo` | `#F27885` | erro, remover | 6,09:1 sobre superfície |

Tipografia: Merriweather (títulos) + Source Sans 3 (texto), auto-hospedadas via @fontsource (sem chamadas ao Google) em pesos 400–700; IBM Plex Mono para cifras. Raios: controles 12px, cartões 18px, botões em pílula. Foco: contorno âmbar-claro de 2px.

### Navegação
Fonte única: `src/components/layout/navigation.ts` (mesmas capacidades que as páginas checam: nenhum link leva a 404 de permissão). Celular (< 768 px): barra inferior com Painel, Agenda, Repertório, Oração e **Menu**; o Menu abre uma folha com todos os módulos permitidos, agrupados (Início, Cultos e louvor, Comunidade, Palavra, Contribuições, Conta) e o botão Sair. Tablet/desktop: barra lateral fixa com os mesmos grupos. Painel: "Minha escala" e depois "Tudo da igreja" com todos os módulos.

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
- WCAG 2.2 AA: foco visível de 2px com offset (cor `ambar-claro`), alvos ≥ 24px (44px no mobile), `aria-live` para confirmações, navegação por teclado completa, rótulos em todos os campos, `lang="pt-BR"`, reduz movimento.
- Teste: axe no Playwright em todas as rotas; checklist manual com leitor de tela (NVDA/VoiceOver) no Gate 6.

## 8. Processo (Gate 1)
1. Designer aprova tokens e tipografia (este documento).
2. Montar Design System em Storybook/rota interna `/design` (não pública) com todos os estados.
3. Telas de referência: Agenda do membro, Montagem de escala, Editor de versão, Stage Mode, Painel admin.
4. Revisão com a skill `web-design-guidelines` e `frontend-design`; aprovação humana → Gate 2.

## Classificação
Direção visual: PENDING_REVIEW · Implementação: NOT_IMPLEMENTED

## Landing
A landing pública (`/`) usa o mesmo tema "Noite & Âmbar" do restante do produto (tokens `fundo`, `superficie`, `texto`, `ambar`, `palco`), com Merriweather nos títulos e seções alternando `fundo` e `superficie`. As ilustrações da interface na landing não exibem nomes, números, datas nem letras de música (sem dados fictícios; letras são protegidas por direitos autorais).
