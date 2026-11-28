# SEO_STRUCTURED_DATA

## O que é publicado
Somente na home (`/`), um `<script type="application/ld+json">` com `@graph`:

- **Organization** (`@id` `<origem>/#organization`): `name` "IGREJAQUA", `url`, `logo` (`/icons/icon-512.png`, 512×512 real).
  - `sameAs`: **apenas** as URLs de `NEXT_PUBLIC_SOCIAL_INSTAGRAM|YOUTUBE|FACEBOOK|WHATSAPP`, e só se forem `https://` (validação em `src/lib/site.ts`). Sem variável → propriedade omitida.
  - `contactPoint`: só se `NEXT_PUBLIC_CONTACT_EMAIL` estiver definido.
- **WebSite** (`@id` `<origem>/#website`): `name`, `url`, `inLanguage: pt-BR`, `publisher` → Organization.

Não declaramos endereço, telefone, CNPJ, avaliações, preço ou `SoftwareApplication`: não há dado verificado para isso (regra NO_FAKE_DATA).

## Atenção do proprietário
As variáveis `NEXT_PUBLIC_SOCIAL_*` aparecem no rodapé da home como "Redes sociais" e por isso entram no `sameAs` da Organization IGREJAQUA. **Configure nelas somente perfis oficiais do IGREJAQUA.** Se forem perfis da igreja que usa o sistema, deixe-as vazias ou peça para separarmos as duas coisas.

## Segurança
`serializeJsonLd` escapa `<`, `>` e `&` como `<`/`>`/`&`: nenhum valor configurado consegue fechar a tag. O bloco não é executável, então a CSP com nonce não interfere (teste E2E da home confirma ausência de violação de CSP).

## Validação
- Unitário: `tests/unit/seo-structured-data.test.ts` (ausência de dados inventados, filtro https, escape, JSON válido).
- E2E: `tests/e2e/seo.spec.ts` (parse do JSON-LD renderizado, tipos `Organization` + `WebSite`).
- Externo (pendente, manual): [Rich Results Test](https://search.google.com/test/rich-results) e [Schema Markup Validator](https://validator.schema.org/) sobre a URL de produção, depois do deploy.
