/**
 * SOMENTE AMBIENTE DE TESTE ISOLADO. Nunca implantar em produção.
 *
 * Porta única que imita o gateway do Supabase para o app:
 *   /auth/v1/*  -> servidor de autenticação de teste (este arquivo; senha + MFA TOTP)
 *   /rest/v1/*  -> PostgREST real (banco iq_e2e)
 * Os JWT são HS256 com o mesmo segredo configurado no PostgREST, então a RLS do banco é exercida de verdade.
 */
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import pg from "pg";
import QRCode from "qrcode";
import { newTotpSecret, verifyTotp } from "./totp.ts";

const PORT = Number(process.env["IQ_GATEWAY_PORT"] ?? 54400);
const POSTGREST_PORT = Number(process.env["IQ_POSTGREST_PORT"] ?? 54401);
const JWT_SECRET = process.env["IQ_JWT_SECRET"] ?? "iq-e2e-local-secret-nao-usar-em-producao-0123456789";
const DB_URL = process.env["IQ_DB_URL"] ?? "postgres://pgtest@/iq_e2e?host=/tmp&port=54329";
const ISSUER = `http://127.0.0.1:${PORT}/auth/v1`;
const TTL_SECONDS = 3600;

const pool = new pg.Pool({ connectionString: DB_URL, max: 5 });

// ---------- JWT ----------
const b64 = (input: Buffer | string): string => Buffer.from(input).toString("base64url");
export function signJwt(claims: Record<string, unknown>): string {
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify(claims));
  return `${head}.${body}.${createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url")}`;
}
function verifyJwt(token: string): Record<string, unknown> | null {
  const [head, body, sig] = token.split(".");
  if (head === undefined || body === undefined || sig === undefined) return null;
  const expected = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
  return typeof claims["exp"] === "number" && claims["exp"] > Date.now() / 1000 ? claims : null;
}
/** Chaves de API estáticas (equivalentes às anon/service_role do Supabase). */
const STATIC_KEYS = { anon: signJwt({ role: "anon", iss: "iq-e2e", exp: 4_102_444_800 }), service_role: signJwt({ role: "service_role", iss: "iq-e2e", exp: 4_102_444_800 }) };

// ---------- Senhas ----------
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 32).toString("hex")}`;
}
function checkPassword(password: string, stored: string | null): boolean {
  if (stored === null) return false;
  const [, saltHex, hashHex] = stored.split("$");
  if (saltHex === undefined || hashHex === undefined) return false;
  const expected = Buffer.from(hashHex, "hex");
  const given = scryptSync(password, Buffer.from(saltHex, "hex"), 32);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// ---------- Modelo ----------
interface UserRow { id: string; email: string; encrypted_password: string | null; raw_user_meta_data: Record<string, unknown>; created_at: Date; updated_at: Date }
interface FactorRow { id: string; friendly_name: string | null; factor_type: string; status: "unverified" | "verified"; secret: string; created_at: Date; updated_at: Date }
interface SessionState { userId: string; sessionId: string; aal: "aal1" | "aal2"; amr: { method: string; timestamp: number }[] }
const refreshTokens = new Map<string, SessionState>();
const challenges = new Map<string, { factorId: string; userId: string }>();

async function findUserByEmail(email: string): Promise<UserRow | null> {
  const r = await pool.query<UserRow>("select * from auth.users where lower(email) = lower($1)", [email]);
  return r.rows[0] ?? null;
}
async function findUserById(id: string): Promise<UserRow | null> {
  const r = await pool.query<UserRow>("select * from auth.users where id = $1", [id]);
  return r.rows[0] ?? null;
}
async function factorsOf(userId: string): Promise<FactorRow[]> {
  return (await pool.query<FactorRow>("select * from auth.mfa_factors where user_id = $1 order by created_at", [userId])).rows;
}
async function publicUser(user: UserRow): Promise<Record<string, unknown>> {
  const factors = await factorsOf(user.id);
  return {
    id: user.id, aud: "authenticated", role: "authenticated", email: user.email, phone: "",
    email_confirmed_at: user.created_at.toISOString(), confirmed_at: user.created_at.toISOString(), last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] }, user_metadata: user.raw_user_meta_data, identities: [],
    created_at: user.created_at.toISOString(), updated_at: user.updated_at.toISOString(), is_anonymous: false,
    factors: factors.map((f) => ({ id: f.id, friendly_name: f.friendly_name, factor_type: f.factor_type, status: f.status, created_at: f.created_at.toISOString(), updated_at: f.updated_at.toISOString() })),
  };
}
async function issueSession(user: UserRow, state: SessionState): Promise<Record<string, unknown>> {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = signJwt({
    iss: ISSUER, aud: "authenticated", sub: user.id, email: user.email, phone: "", role: "authenticated", aal: state.aal, amr: state.amr,
    session_id: state.sessionId, app_metadata: { provider: "email", providers: ["email"] }, user_metadata: user.raw_user_meta_data, is_anonymous: false, iat: now, exp: now + TTL_SECONDS,
  });
  const refresh = randomBytes(12).toString("base64url");
  refreshTokens.set(refresh, state);
  return { access_token: accessToken, token_type: "bearer", expires_in: TTL_SECONDS, expires_at: now + TTL_SECONDS, refresh_token: refresh, user: await publicUser(user) };
}

// ---------- HTTP ----------
class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const send = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(body === undefined ? undefined : JSON.stringify(body));
};
async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.length === 0) return {};
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new HttpError(400, "bad_json", "Corpo inválido.");
  return parsed as Record<string, unknown>;
}
const str = (v: unknown): string => (typeof v === "string" ? v : "");
async function bearerUser(req: IncomingMessage): Promise<{ user: UserRow; claims: Record<string, unknown> }> {
  const header = req.headers.authorization ?? "";
  const claims = header.startsWith("Bearer ") ? verifyJwt(header.slice(7)) : null;
  const sub = claims === null ? "" : str(claims["sub"]);
  const user = sub === "" ? null : await findUserById(sub);
  if (claims === null || user === null) throw new HttpError(401, "bad_jwt", "Sessão inválida ou expirada.");
  return { user, claims };
}

async function handleAuth(req: IncomingMessage, res: ServerResponse, path: string, query: URLSearchParams): Promise<void> {
  const method = req.method ?? "GET";
  if (method === "POST" && path === "/token") {
    const body = await readJson(req);
    const grant = query.get("grant_type");
    if (grant === "password") {
      const user = await findUserByEmail(str(body["email"]));
      if (user === null || !checkPassword(str(body["password"]), user.encrypted_password)) throw new HttpError(400, "invalid_credentials", "Invalid login credentials");
      return send(res, 200, await issueSession(user, { userId: user.id, sessionId: randomUUID(), aal: "aal1", amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }] }));
    }
    if (grant === "refresh_token") {
      const state = refreshTokens.get(str(body["refresh_token"]));
      const user = state === undefined ? null : await findUserById(state.userId);
      if (state === undefined || user === null) throw new HttpError(400, "refresh_token_not_found", "Invalid Refresh Token");
      refreshTokens.delete(str(body["refresh_token"]));
      return send(res, 200, await issueSession(user, state));
    }
    throw new HttpError(400, "unsupported_grant_type", "Tipo de concessão não suportado.");
  }
  if (method === "POST" && path === "/signup") {
    const body = await readJson(req);
    const email = str(body["email"]).trim();
    const password = str(body["password"]);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 8) throw new HttpError(422, "weak_password", "E-mail ou senha inválidos.");
    if ((await findUserByEmail(email)) !== null) throw new HttpError(422, "user_already_exists", "User already registered");
    const meta = typeof body["data"] === "object" && body["data"] !== null ? (body["data"] as Record<string, unknown>) : {};
    const created = await pool.query<UserRow>("insert into auth.users (email, encrypted_password, raw_user_meta_data) values ($1, $2, $3) returning *", [email, hashPassword(password), JSON.stringify(meta)]);
    const user = created.rows[0];
    if (user === undefined) throw new HttpError(500, "unexpected_failure", "Falha ao criar usuário.");
    return send(res, 200, await issueSession(user, { userId: user.id, sessionId: randomUUID(), aal: "aal1", amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }] }));
  }
  if (method === "POST" && path === "/logout") return send(res, 204, undefined);
  if (method === "POST" && path === "/recover") { await readJson(req); return send(res, 200, {}); }
  if (method === "GET" && path === "/user") return send(res, 200, await publicUser((await bearerUser(req)).user));
  if (method === "PUT" && path === "/user") {
    const { user } = await bearerUser(req);
    const body = await readJson(req);
    if (str(body["password"]).length >= 8) await pool.query("update auth.users set encrypted_password = $2, updated_at = now() where id = $1", [user.id, hashPassword(str(body["password"]))]);
    if (typeof body["data"] === "object" && body["data"] !== null) await pool.query("update auth.users set raw_user_meta_data = raw_user_meta_data || $2::jsonb, updated_at = now() where id = $1", [user.id, JSON.stringify(body["data"])]);
    return send(res, 200, await publicUser((await findUserById(user.id)) ?? user));
  }
  // ----- MFA TOTP -----
  if (method === "POST" && path === "/factors") {
    const { user } = await bearerUser(req);
    const body = await readJson(req);
    if (str(body["factor_type"]) !== "totp") throw new HttpError(422, "mfa_factor_type_unsupported", "Só TOTP.");
    const secret = newTotpSecret();
    const name = str(body["friendly_name"]) || "Autenticador";
    const created = await pool.query<{ id: string }>("insert into auth.mfa_factors (user_id, friendly_name, secret) values ($1, $2, $3) returning id", [user.id, name, secret]);
    const uri = `otpauth://totp/${encodeURIComponent(str(body["issuer"]) || "IGREJAQUA")}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${encodeURIComponent(str(body["issuer"]) || "IGREJAQUA")}`;
    const svg = await QRCode.toString(uri, { type: "svg", margin: 1 });
    return send(res, 200, { id: created.rows[0]?.id, type: "totp", friendly_name: name, totp: { qr_code: `data:image/svg+xml;utf-8,${svg}`, secret, uri } });
  }
  const factorMatch = /^\/factors\/([0-9a-f-]{36})(?:\/(challenge|verify))?$/.exec(path);
  if (factorMatch !== null) {
    const factorId = factorMatch[1] ?? "";
    const action = factorMatch[2];
    const { user, claims } = await bearerUser(req);
    const factor = (await factorsOf(user.id)).find((f) => f.id === factorId);
    if (factor === undefined) throw new HttpError(404, "mfa_factor_not_found", "Fator não encontrado.");
    if (method === "DELETE" && action === undefined) {
      await pool.query("delete from auth.mfa_factors where id = $1", [factorId]);
      return send(res, 200, { id: factorId });
    }
    if (method === "POST" && action === "challenge") {
      const id = randomUUID();
      challenges.set(id, { factorId, userId: user.id });
      return send(res, 200, { id, type: "totp", expires_at: Math.floor(Date.now() / 1000) + 300 });
    }
    if (method === "POST" && action === "verify") {
      const body = await readJson(req);
      const challenge = challenges.get(str(body["challenge_id"]));
      if (challenge === undefined || challenge.factorId !== factorId || challenge.userId !== user.id) throw new HttpError(422, "mfa_challenge_expired", "Desafio expirado.");
      if (!verifyTotp(factor.secret, str(body["code"]))) throw new HttpError(422, "mfa_verification_failed", "Código inválido.");
      challenges.delete(str(body["challenge_id"]));
      await pool.query("update auth.mfa_factors set status = 'verified', updated_at = now() where id = $1", [factorId]);
      const now = Math.floor(Date.now() / 1000);
      const previous = Array.isArray(claims["amr"]) ? (claims["amr"] as { method: string; timestamp: number }[]) : [];
      return send(res, 200, await issueSession(user, { userId: user.id, sessionId: str(claims["session_id"]) || randomUUID(), aal: "aal2", amr: [{ method: "totp", timestamp: now }, ...previous] }));
    }
  }
  throw new HttpError(404, "not_found", `Rota de autenticação desconhecida: ${method} ${path}`);
}

/** O app envia a chave publicável (sb_publishable_…); o PostgREST só entende JWT: troca-se por um JWT anon. */
function proxyRest(req: IncomingMessage, res: ServerResponse, path: string, search: string): void {
  const headers = { ...req.headers };
  delete headers.host;
  const auth = headers.authorization ?? "";
  if (!auth.startsWith("Bearer ") || verifyJwt(auth.slice(7)) === null) {
    const apikey = typeof headers["apikey"] === "string" ? headers["apikey"] : "";
    headers.authorization = `Bearer ${apikey !== "" && verifyJwt(apikey) !== null ? apikey : STATIC_KEYS.anon}`;
  }
  const upstream = httpRequest({ host: "127.0.0.1", port: POSTGREST_PORT, method: req.method, path: `${path}${search}`, headers }, (up) => {
    res.writeHead(up.statusCode ?? 502, up.headers);
    up.pipe(res);
  });
  upstream.on("error", () => send(res, 502, { message: "PostgREST indisponível" }));
  req.pipe(upstream);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  if (req.method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" }); res.end(); return; }
  if (url.pathname === "/health") return send(res, 200, { ok: true });
  if (url.pathname === "/keys") return send(res, 200, STATIC_KEYS);
  if (url.pathname.startsWith("/rest/v1")) return proxyRest(req, res, url.pathname.slice("/rest/v1".length) || "/", url.search);
  if (url.pathname.startsWith("/auth/v1")) {
    handleAuth(req, res, url.pathname.slice("/auth/v1".length), url.searchParams).catch((cause: unknown) => {
      if (cause instanceof HttpError) return send(res, cause.status, { code: cause.status, error_code: cause.code, msg: cause.message, message: cause.message });
      console.error("auth_shim_erro", cause instanceof Error ? cause.message : "desconhecido");
      return send(res, 500, { code: 500, error_code: "unexpected_failure", msg: "Erro interno do servidor de teste." });
    });
    return;
  }
  send(res, 404, { message: "Rota desconhecida" });
});
server.listen(PORT, "127.0.0.1", () => console.log(`gateway de teste em http://127.0.0.1:${PORT}`));
