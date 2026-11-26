import type { EmailConfig } from "@/lib/notifications/config";

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export interface BuiltEmail { readonly subject: string; readonly text: string; readonly html: string }

/** Só links internos (começam com "/"): o destino nunca vem de fora do nosso domínio. */
export function absoluteLink(siteUrl: string, linkPath: string | null): string | null {
  if (linkPath === null || !/^\/(?!\/)[A-Za-z0-9/_\-.?=&%]*$/.test(linkPath)) return null;
  return `${siteUrl}${linkPath}`;
}

export function buildEmail(input: { title: string; body: string | null; linkPath: string | null; siteUrl: string }): BuiltEmail {
  const link = absoluteLink(input.siteUrl, input.linkPath);
  const prefs = `${input.siteUrl}/notificacoes`;
  const text = [input.title, input.body ?? "", link ? `Abrir: ${link}` : "", "", `Para parar de receber e-mails, ajuste suas preferências: ${prefs}`].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#0f1420;font-family:Arial,sans-serif;color:#f4efe6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="100%" style="max-width:520px;background:#171f33;border-radius:16px;padding:24px">
<tr><td><p style="margin:0 0 4px;font-size:12px;letter-spacing:1px;color:#ffc96b">IGREJAQUA</p>
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(input.title)}</h1>
${input.body ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#a9b3c9">${escapeHtml(input.body)}</p>` : ""}
${link ? `<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#f5a524;color:#1a1204;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">Abrir</a></p>` : ""}
<p style="margin:0;font-size:12px;color:#a9b3c9">Para parar de receber e-mails, <a href="${escapeHtml(prefs)}" style="color:#ffc96b">ajuste suas preferências</a>.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject: input.title.slice(0, 160), text, html };
}

export type SendOutcome = { readonly ok: true } | { readonly ok: false; readonly retriable: boolean; readonly reason: string };

/** Resend (REST). Erros 4xx (exceto 408/429) não são repetidos; a mensagem de erro nunca inclui o corpo da resposta. */
export async function sendEmail(config: EmailConfig, message: { to: string; email: BuiltEmail }, fetchImpl: typeof fetch = fetch): Promise<SendOutcome> {
  let response: Response;
  try {
    response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ from: config.from, to: [message.to], subject: message.email.subject, text: message.email.text, html: message.email.html }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, retriable: true, reason: "falha de rede" };
  }
  if (response.ok) return { ok: true };
  const retriable = response.status === 408 || response.status === 429 || response.status >= 500;
  return { ok: false, retriable, reason: `e-mail HTTP ${response.status}` };
}
