# SEO_INDEXABILITY_REPORT

## Política
| Camada | Indexáveis (`/`, `/privacidade`, `/termos`) | Todo o resto |
|---|---|---|
| `<meta name="robots">` | ausente (= index, follow) | `noindex, nofollow` nos layouts `(auth)`, `(app)`, `(onboarding)`, `(stage)` e em `/offline`; `noindex, follow` no 404 |
| `X-Robots-Tag` (proxy) | ausente | `noindex, nofollow` em toda resposta, inclusive 307 para login, APIs e arquivos |
| robots.txt | `Allow: /` | só `Disallow: /api/` |
| Canônica | autorreferente absoluta | nenhuma |
| Sitemap | incluídas | excluídas |

## Por que as áreas privadas não estão no `Disallow`
Se o robots.txt bloqueasse `/dashboard`, o Google não leria o `noindex` e poderia indexar a URL "nua" a partir de links externos. Deixando o rastreamento livre, ele vê o 307 para o login com `X-Robots-Tag: noindex`. A proteção dos dados continua sendo autenticação (`getUser()` no proxy e no layout) + RLS, sem alteração.

## Conflitos verificados
- Nenhuma URL do sitemap tem `noindex` (E2E: `sitemap.xml … canônica igual`).
- Nenhuma página `noindex` tem canônica (E2E: telas de autenticação).
- robots.txt não bloqueia `/_next/` (CSS/JS liberados para renderização).

## 404 e soft 404
Antes: anônimo em caminho inexistente → 307 para `/login` (soft 404). Agora o proxy só redireciona prefixos **protegidos conhecidos**; o resto chega ao Next e recebe **404 real** com `src/app/not-found.tsx`. A lista de prefixos é validada contra o sistema de arquivos em teste, então uma rota privada nova não fica sem redirecionamento por esquecimento (e, mesmo assim, o layout `(app)` chama `requireUser()`).

## Páginas em massa / qualidade
Não há páginas geradas automaticamente públicas. Nenhuma página nova de "SEO" foi criada: o sitemap tem 3 URLs com conteúdo próprio.
