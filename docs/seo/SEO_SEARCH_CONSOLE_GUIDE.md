# SEO_SEARCH_CONSOLE_GUIDE — procedimento para o proprietário

Não há acesso autorizado à conta Google neste trabalho. **Nada foi enviado ao Search Console e nenhuma URL foi declarada indexada.** Os passos abaixo são para execução manual.

## 0. Pré-requisito bloqueante: o Googlebot precisa conseguir abrir o site
Leitura do projeto na Vercel (2026-11-27): `ssoProtection = all_except_custom_domains`, domínios só `*.vercel.app`, nenhum domínio próprio.
1. Confira numa janela anônima (sem login na Vercel) se `https://igrejaqua.vercel.app/` abre a home. Se aparecer a tela de login da Vercel, o Google também é barrado e **nada será indexado**.
2. Recomendado: configurar um domínio próprio (ex.: `igrejaqua.com.br`) em *Project → Settings → Domains*. Domínio próprio de produção fica fora da Vercel Authentication nesse modo, e a URL canônica passa a ser estável.
3. Defina `NEXT_PUBLIC_SITE_URL=https://<domínio definitivo>` em *Settings → Environment Variables (Production)* e faça novo deploy. Sem ela, o site usa `VERCEL_PROJECT_PRODUCTION_URL` como origem canônica.
4. Se usar domínio próprio, redirecione `www` ↔ raiz com **308** na tela de Domains (um único salto).

## 1. Verificar a propriedade
- Prefira **propriedade de domínio** (registro TXT no DNS): cobre http/https e subdomínios. Search Console → *Adicionar propriedade → Domínio* → copiar o TXT → criar no DNS → *Verificar*.
- Sem acesso ao DNS: propriedade de **prefixo de URL** com a meta tag. Nesse caso, envie o código para incluirmos em `metadata.verification.google` no `src/app/layout.tsx` (não incluímos nenhum código inventado).

## 2. Enviar o sitemap
*Indexação → Sitemaps* → `https://<domínio>/sitemap.xml` → *Enviar*. Esperado: status "Sucesso" e **3 URLs descobertas**.

## 3. Inspecionar URLs
*Inspeção de URL* para `/`, `/privacidade`, `/termos`:
- "A URL está no Google" ou "pode ser indexada"; *Testar URL publicada* → captura mostra o texto da home.
- **Canônica escolhida pelo Google** = canônica declarada. Divergência indica domínio duplicado acessível (ex.: `*.vercel.app` e domínio próprio): resolva com redirecionamento 308 do domínio secundário.
- Opcional: *Solicitar indexação*.

Esperado para `/login` e `/dashboard`: "Excluída pela tag noindex" / "Página com redirecionamento". **Isso é correto.**

## 4. Cobertura e erros
*Indexação → Páginas*: acompanhe "Não encontrado (404)" (devem ser só caminhos inexistentes reais) e "Soft 404" (deve ficar zerado).

## 5. Core Web Vitals
*Experiência → Core Web Vitals* depende de tráfego real (CrUX); pode levar semanas para aparecer. Enquanto isso, use os dados de campo próprios: logs `web_vital` da Vercel (ver `docs/performance/PERFORMANCE_OPTIMIZATION_REPORT.md §Monitoramento`).

## 6. Rotina mensal
Páginas indexadas (deve se manter em ~3) · erros novos · CWV p75 (LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1).
