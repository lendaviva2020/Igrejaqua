/**
 * E-mails de autenticação do Supabase (confirmação de cadastro, senha, convite, troca de e-mail,
 * link de acesso e código de verificação) em português, na identidade "Noite & Âmbar".
 *
 * Gera o corpo do PATCH /v1/projects/{ref}/config/auth da Management API do Supabase:
 *   node --experimental-strip-types tools/supabase/auth-emails.ts https://igrejaqua.vercel.app 3600 > payload.json
 * (2º argumento: validade dos links em segundos = mailer_otp_exp do projeto; só entra no texto.)
 *
 * HTML de e-mail: tabelas e estilos inline (clientes de e-mail ignoram <style> e CSS moderno).
 * Variáveis {{ .X }} são preenchidas pelo Supabase; nada aqui é dado fictício.
 */

export interface AuthEmailConfig {
  readonly site_url: string;
  readonly uri_allow_list: string;
  readonly [key: `mailer_subjects_${string}` | `mailer_templates_${string}_content`]: string;
}

const COLORS = { fundo: "#0f1420", superficie: "#171f33", linha: "#2b3856", texto: "#f4efe6", texto2: "#a9b3c9", ambar: "#f5a524", sobreAmbar: "#1a1204" } as const;

/** Validade legível: 3600 → "1 hora"; 86400 → "24 horas"; 600 → "10 minutos". */
export function humanDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "pouco tempo";
  if (seconds % 3600 === 0) { const h = seconds / 3600; return h === 1 ? "1 hora" : `${h} horas`; }
  const m = Math.round(seconds / 60);
  return m === 1 ? "1 minuto" : `${m} minutos`;
}

interface Block { readonly heading: string; readonly paragraphs: readonly string[]; readonly button?: { readonly label: string; readonly href: string }; readonly code?: string; readonly note: string }

function layout(siteUrl: string, block: Block): string {
  const p = (html: string): string => `<p style="margin:0 0 14px;font-size:16px;line-height:24px;color:${COLORS.texto}">${html}</p>`;
  const button = block.button === undefined ? "" : `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px"><tr><td style="border-radius:999px;background:${COLORS.ambar}">
<a href="${block.button.href}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:${COLORS.sobreAmbar};text-decoration:none;border-radius:999px">${block.button.label}</a>
</td></tr></table>
<p style="margin:0 0 18px;font-size:13px;line-height:20px;color:${COLORS.texto2}">Se o botão não abrir, copie e cole este endereço no navegador:<br><a href="${block.button.href}" style="color:${COLORS.ambar};word-break:break-all">${block.button.href}</a></p>`;
  const code = block.code === undefined ? "" : `
<p style="margin:6px 0 22px;font-size:32px;line-height:40px;font-weight:700;letter-spacing:6px;color:${COLORS.ambar};font-family:'Courier New',monospace">${block.code}</p>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>${block.heading}</title></head>
<body style="margin:0;padding:0;background:${COLORS.fundo};font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.fundo}"><tr><td align="center" style="padding:28px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 4px 18px">
<a href="${siteUrl}" style="text-decoration:none"><img src="${siteUrl}/icons/icon-192.png" width="40" height="40" alt="IGREJAQUA" style="vertical-align:middle;border-radius:10px;border:0">
<span style="vertical-align:middle;margin-left:10px;font-size:18px;font-weight:700;letter-spacing:1px;color:${COLORS.texto}">IGREJA<span style="color:${COLORS.ambar}">QUA</span></span></a>
</td></tr>
<tr><td style="background:${COLORS.superficie};border:1px solid ${COLORS.linha};border-radius:18px;padding:28px 24px">
<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:32px;color:${COLORS.texto}">${block.heading}</h1>
${block.paragraphs.map(p).join("\n")}${code}${button}
<p style="margin:0;padding-top:16px;border-top:1px solid ${COLORS.linha};font-size:13px;line-height:20px;color:${COLORS.texto2}">${block.note}</p>
</td></tr>
<tr><td style="padding:18px 4px 0;font-size:12px;line-height:18px;color:${COLORS.texto2}">Você recebeu este e-mail porque este endereço foi usado no IGREJAQUA. Mensagem automática: respostas não são lidas.</td></tr>
</table></td></tr></table></body></html>`;
}

/** Monta configuração de URLs + assuntos + modelos para o projeto. */
export function buildAuthEmailConfig(siteUrl: string, linkValiditySeconds: number): AuthEmailConfig {
  const base = siteUrl.replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(base)) throw new Error(`siteUrl precisa ser https sem caminho: ${siteUrl}`);
  const validity = humanDuration(linkValiditySeconds);
  const ignore = "Se não foi você, ignore este e-mail: nada será alterado na sua conta.";
  return {
    site_url: base,
    // Destinos aceitos para o retorno dos e-mails e do login com Google; o app envia /callback?next=...
    uri_allow_list: [`${base}/**`, "http://localhost:3000/**"].join(","),

    mailer_subjects_confirmation: "Confirme seu e-mail para entrar no IGREJAQUA",
    mailer_templates_confirmation_content: layout(base, {
      heading: "Confirme seu e-mail",
      paragraphs: ["Olá! Recebemos um cadastro no IGREJAQUA com o e-mail <strong>{{ .Email }}</strong>.", "Toque no botão para confirmar que este e-mail é seu e entrar no sistema da sua igreja."],
      button: { label: "Confirmar meu e-mail", href: "{{ .ConfirmationURL }}" },
      note: `O link vale por ${validity} e só pode ser usado uma vez. Se você não criou uma conta, ignore este e-mail: nenhuma conta será ativada.`,
    }),

    mailer_subjects_recovery: "Redefina sua senha do IGREJAQUA",
    mailer_templates_recovery_content: layout(base, {
      heading: "Crie uma nova senha",
      paragraphs: ["Recebemos um pedido para redefinir a senha da conta <strong>{{ .Email }}</strong> no IGREJAQUA.", "Toque no botão para escolher uma nova senha."],
      button: { label: "Criar nova senha", href: "{{ .ConfirmationURL }}" },
      note: `O link vale por ${validity} e só pode ser usado uma vez. ${ignore} Sua senha atual continua valendo.`,
    }),

    mailer_subjects_magic_link: "Seu link para entrar no IGREJAQUA",
    mailer_templates_magic_link_content: layout(base, {
      heading: "Seu link de acesso",
      paragraphs: ["Use o botão abaixo para entrar no IGREJAQUA com a conta <strong>{{ .Email }}</strong>, sem digitar senha."],
      button: { label: "Entrar no IGREJAQUA", href: "{{ .ConfirmationURL }}" },
      note: `O link vale por ${validity} e só pode ser usado uma vez. ${ignore}`,
    }),

    mailer_subjects_invite: "Você foi convidado para o IGREJAQUA",
    mailer_templates_invite_content: layout(base, {
      heading: "Você foi convidado",
      paragraphs: ["Você recebeu um convite para usar o IGREJAQUA, o sistema de organização da sua igreja: escalas, agenda, repertório e comunicados.", "Toque no botão para aceitar o convite e criar seu acesso."],
      button: { label: "Aceitar convite", href: "{{ .ConfirmationURL }}" },
      note: `O convite vale por ${validity}. Se você não esperava este convite, ignore este e-mail.`,
    }),

    mailer_subjects_email_change: "Confirme a troca do seu e-mail no IGREJAQUA",
    mailer_templates_email_change_content: layout(base, {
      heading: "Confirme o novo e-mail",
      paragraphs: ["Foi pedida a troca do e-mail da sua conta no IGREJAQUA de <strong>{{ .Email }}</strong> para <strong>{{ .NewEmail }}</strong>.", "Toque no botão para confirmar a troca."],
      button: { label: "Confirmar novo e-mail", href: "{{ .ConfirmationURL }}" },
      note: `O link vale por ${validity}. Se você não pediu esta troca, ignore este e-mail e troque sua senha.`,
    }),

    mailer_subjects_reauthentication: "Seu código de verificação do IGREJAQUA: {{ .Token }}",
    mailer_templates_reauthentication_content: layout(base, {
      heading: "Confirme que é você",
      paragraphs: ["Para concluir uma ação importante na sua conta do IGREJAQUA, digite este código:"],
      code: "{{ .Token }}",
      note: `O código vale por ${validity}. Nunca compartilhe este código com ninguém, nem com a liderança da igreja. ${ignore}`,
    }),
  };
}

// Execução direta: imprime o JSON do PATCH.
const [, script, siteArg, validityArg] = process.argv;
if (script !== undefined && script.endsWith("auth-emails.ts") && siteArg !== undefined) {
  process.stdout.write(`${JSON.stringify(buildAuthEmailConfig(siteArg, Number(validityArg ?? "3600")), null, 2)}\n`);
}
