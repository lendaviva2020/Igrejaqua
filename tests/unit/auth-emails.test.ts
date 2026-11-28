import { describe, expect, it } from "vitest";
import { buildAuthEmailConfig, humanDuration } from "../../tools/supabase/auth-emails.ts";

describe("e-mails de autenticação do Supabase", () => {
  const cfg = buildAuthEmailConfig("https://igrejaqua.vercel.app/", 3600);

  it("URLs: Site URL de produção e lista de retorno com produção e desenvolvimento", () => {
    expect(cfg.site_url).toBe("https://igrejaqua.vercel.app");
    expect(cfg.uri_allow_list).toBe("https://igrejaqua.vercel.app/**,http://localhost:3000/**");
  });

  it("cada e-mail com link usa {{ .ConfirmationURL }} no botão e no texto de reserva", () => {
    for (const t of ["confirmation", "recovery", "magic_link", "invite", "email_change"]) {
      const html = cfg[`mailer_templates_${t}_content`] ?? "";
      expect(html.match(/\{\{ \.ConfirmationURL \}\}/g)?.length, t).toBe(3);
      expect(html, t).toContain('lang="pt-BR"');
      expect(html, t).not.toMatch(/localhost/);
      expect(cfg[`mailer_subjects_${t}`], t).toMatch(/IGREJAQUA/);
    }
    expect(cfg.mailer_templates_email_change_content).toContain("{{ .NewEmail }}");
  });

  it("código de verificação aparece no assunto e no corpo, sem link", () => {
    expect(cfg.mailer_subjects_reauthentication).toContain("{{ .Token }}");
    expect(cfg.mailer_templates_reauthentication_content).toContain("{{ .Token }}");
    expect(cfg.mailer_templates_reauthentication_content).not.toContain("ConfirmationURL");
  });

  it("validade no texto vem da configuração do projeto", () => {
    expect(humanDuration(3600)).toBe("1 hora");
    expect(humanDuration(86400)).toBe("24 horas");
    expect(humanDuration(600)).toBe("10 minutos");
    expect(cfg.mailer_templates_confirmation_content).toContain("vale por 1 hora");
  });

  it("recusa URL sem https ou com caminho", () => {
    expect(() => buildAuthEmailConfig("http://igrejaqua.vercel.app", 3600)).toThrow();
    expect(() => buildAuthEmailConfig("https://igrejaqua.vercel.app/app", 3600)).toThrow();
  });
});
