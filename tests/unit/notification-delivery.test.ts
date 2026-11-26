import { describe, expect, it, vi } from "vitest";
import { parseDeliveryConfig, type DeliveryConfig } from "@/lib/notifications/config";
import { processDeliveries, type ClaimedDelivery, type DeliveryStore } from "@/lib/notifications/deliver";
import { absoluteLink, buildEmail, sendEmail } from "@/lib/notifications/email";
import { buildPushPayload, sendPush } from "@/lib/notifications/push";

const SITE = "https://igreja.exemplo.test";
const FULL_ENV = { NEXT_PUBLIC_SITE_URL: `${SITE}/`, RESEND_API_KEY: "re_1234567890", EMAIL_FROM: "IGREJAQUA <aviso@igreja.exemplo.test>", NEXT_PUBLIC_VAPID_PUBLIC_KEY: "B".repeat(60), VAPID_PRIVATE_KEY: "k".repeat(30), VAPID_SUBJECT: "mailto:ti@igreja.exemplo.test" };

describe("config de entrega", () => {
  it("canal sem configuração completa fica nulo", () => {
    const cfg = parseDeliveryConfig({ NEXT_PUBLIC_SITE_URL: SITE });
    expect(cfg.email).toBeNull();
    expect(cfg.push).toBeNull();
  });
  it("configura os dois canais e normaliza a URL do site", () => {
    const cfg = parseDeliveryConfig(FULL_ENV);
    expect(cfg.siteUrl).toBe(SITE);
    expect(cfg.email?.from).toContain("aviso@");
    expect(cfg.push?.subject).toBe("mailto:ti@igreja.exemplo.test");
  });
  it("assunto VAPID inválido desliga o push", () => {
    expect(parseDeliveryConfig({ ...FULL_ENV, VAPID_SUBJECT: "ti@igreja" }).push).toBeNull();
  });
});

describe("e-mail", () => {
  it("escapa HTML e só monta link interno", () => {
    const built = buildEmail({ title: "<script>x</script>", body: "a & b", linkPath: "/agenda/123", siteUrl: SITE });
    expect(built.html).not.toContain("<script>");
    expect(built.html).toContain("&lt;script&gt;");
    expect(built.html).toContain(`${SITE}/agenda/123`);
    expect(built.text).toContain("/notificacoes");
  });
  it("rejeita links externos ou com esquema", () => {
    expect(absoluteLink(SITE, "https://evil.test/x")).toBeNull();
    expect(absoluteLink(SITE, "//evil.test")).toBeNull();
    expect(absoluteLink(SITE, "javascript:alert(1)")).toBeNull();
    expect(absoluteLink(SITE, null)).toBeNull();
  });
  it("classifica erros do provedor sem expor o corpo", async () => {
    const cfg = { apiKey: "re_x", from: "a@b.test" };
    const msg = { to: "u@x.test", email: buildEmail({ title: "t", body: null, linkPath: null, siteUrl: SITE }) };
    const reply = (status: number) => vi.fn<typeof fetch>().mockResolvedValue(new Response("segredo", { status }));
    expect(await sendEmail(cfg, msg, reply(200))).toEqual({ ok: true });
    expect(await sendEmail(cfg, msg, reply(422))).toEqual({ ok: false, retriable: false, reason: "e-mail HTTP 422" });
    expect(await sendEmail(cfg, msg, reply(429))).toMatchObject({ ok: false, retriable: true });
    expect(await sendEmail(cfg, msg, reply(503))).toMatchObject({ ok: false, retriable: true });
    expect(await sendEmail(cfg, msg, vi.fn<typeof fetch>().mockRejectedValue(new Error("rede")))).toMatchObject({ ok: false, retriable: true });
  });
});

describe("push", () => {
  it("limita tamanho e cai para /notificacoes com link inválido", () => {
    const payload = JSON.parse(buildPushPayload({ title: "t".repeat(200), body: "b".repeat(300), linkPath: "https://evil.test" })) as { title: string; body: string; url: string };
    expect(payload.title).toHaveLength(80);
    expect(payload.body).toHaveLength(140);
    expect(payload.url).toBe("/notificacoes");
    expect((JSON.parse(buildPushPayload({ title: "t", body: null, linkPath: "//evil.test" })) as { url: string }).url).toBe("/notificacoes");
  });
  it("404/410 = inscrição expirada; 5xx = repetir; 400 = permanente", async () => {
    const sub = { endpoint: "https://push.exemplo.test/x", p256dh: "p", auth: "a" };
    const failing = (statusCode: number) => async () => { throw Object.assign(new Error("x"), { statusCode }); };
    expect(await sendPush(failing(410), sub, "{}")).toMatchObject({ ok: false, gone: true, retriable: false });
    expect(await sendPush(failing(404), sub, "{}")).toMatchObject({ gone: true });
    expect(await sendPush(failing(503), sub, "{}")).toMatchObject({ gone: false, retriable: true });
    expect(await sendPush(failing(400), sub, "{}")).toMatchObject({ gone: false, retriable: false });
    expect(await sendPush(async () => undefined, sub, "{}")).toEqual({ ok: true });
  });
});

function makeStore(items: ClaimedDelivery[]) {
  const complete = vi.fn<DeliveryStore["complete"]>().mockResolvedValue(undefined);
  const dropSubscription = vi.fn<DeliveryStore["dropSubscription"]>().mockResolvedValue(undefined);
  const store: DeliveryStore = { claim: async () => items, complete, dropSubscription };
  return { store, complete, dropSubscription };
}
const emailItem: ClaimedDelivery = { deliveryId: "d1", channel: "email", title: "Escala", body: null, linkPath: "/agenda", email: "u@x.test", subscriptions: [] };
const pushItem: ClaimedDelivery = { deliveryId: "d2", channel: "push", title: "Escala", body: null, linkPath: "/agenda", email: null, subscriptions: [{ endpoint: "https://p.test/1", p256dh: "p", auth: "a" }, { endpoint: "https://p.test/2", p256dh: "p", auth: "a" }] };

describe("processDeliveries", () => {
  const config: DeliveryConfig = parseDeliveryConfig(FULL_ENV);

  it("envia e-mail e marca como enviado", async () => {
    const { store, complete } = makeStore([emailItem]);
    const send = vi.fn().mockResolvedValue({ ok: true });
    const summary = await processDeliveries({ store, config, pushSender: null, send });
    expect(summary).toEqual({ claimed: 1, sent: 1, failed: 0, skipped: 0 });
    expect(complete).toHaveBeenCalledWith("d1", "sent", null);
  });
  it("canal não configurado vira skipped (nunca finge envio)", async () => {
    const { store, complete } = makeStore([emailItem, pushItem]);
    const summary = await processDeliveries({ store, config: parseDeliveryConfig({ NEXT_PUBLIC_SITE_URL: SITE }), pushSender: null });
    expect(summary.skipped).toBe(2);
    expect(complete).toHaveBeenCalledWith("d1", "skipped", "e-mail não configurado");
    expect(complete).toHaveBeenCalledWith("d2", "skipped", "push não configurado");
  });
  it("erro transitório de e-mail vira failed (banco reagenda); permanente vira skipped", async () => {
    const a = makeStore([emailItem]);
    expect((await processDeliveries({ store: a.store, config, pushSender: null, send: async () => ({ ok: false, retriable: true, reason: "e-mail HTTP 503" }) })).failed).toBe(1);
    const b = makeStore([emailItem]);
    expect((await processDeliveries({ store: b.store, config, pushSender: null, send: async () => ({ ok: false, retriable: false, reason: "e-mail HTTP 422" }) })).skipped).toBe(1);
  });
  it("push: remove inscrição expirada e conta como enviado se outra entregou", async () => {
    const { store, complete, dropSubscription } = makeStore([pushItem]);
    const sender = vi.fn(async (sub: { endpoint: string }) => { if (sub.endpoint.endsWith("/1")) throw Object.assign(new Error("gone"), { statusCode: 410 }); });
    const summary = await processDeliveries({ store, config, pushSender: sender });
    expect(dropSubscription).toHaveBeenCalledWith("https://p.test/1");
    expect(complete).toHaveBeenCalledWith("d2", "sent", null);
    expect(summary.sent).toBe(1);
  });
  it("push com todas as inscrições expiradas vira skipped", async () => {
    const { store, complete } = makeStore([pushItem]);
    await processDeliveries({ store, config, pushSender: async () => { throw Object.assign(new Error("gone"), { statusCode: 410 }); } });
    expect(complete).toHaveBeenCalledWith("d2", "skipped", "inscrição expirada (410)");
  });
  it("exceção inesperada em um item não derruba o lote", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { store, complete } = makeStore([emailItem, { ...emailItem, deliveryId: "d3" }]);
    const send = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ ok: true });
    const summary = await processDeliveries({ store, config, pushSender: null, send });
    expect(summary).toMatchObject({ claimed: 2, sent: 1, failed: 1 });
    expect(complete).toHaveBeenCalledWith("d1", "failed", "erro inesperado");
    quiet.mockRestore();
  });
});
