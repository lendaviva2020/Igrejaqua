/**
 * Semeia o banco ISOLADO iq_e2e com uma igreja de teste e pessoas/dados claramente rotulados como teste.
 * Nunca rode contra Supabase real. Usuários são criados pelo servidor de login de teste (senha com hash).
 */
import pg from "pg";

const GATEWAY = process.env["IQ_GATEWAY_URL"] ?? "http://127.0.0.1:54400";
const DB_URL = process.env["IQ_DB_URL"] ?? "postgres://pgtest@/iq_e2e?host=/tmp&port=54329";
export const TEST_PASSWORD = "SenhaDeTeste2026!";
export const TEST_USERS = {
  admin: { email: "admin@teste.local", name: "Administrador de Teste" },
  leader: { email: "lider@teste.local", name: "Líder de Teste" },
  member: { email: "membro@teste.local", name: "Membro de Teste" },
} as const;
const EXTRA = ["Pessoa de Teste Um", "Pessoa de Teste Dois", "Pessoa de Teste Três", "Pessoa de Teste Quatro"] as const;

async function signUp(email: string, name: string): Promise<{ id: string; token: string }> {
  const res = await fetch(`${GATEWAY}/auth/v1/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: TEST_PASSWORD, data: { full_name: name } }) });
  const body = (await res.json()) as { access_token?: string; user?: { id: string }; msg?: string };
  if (!res.ok || body.access_token === undefined || body.user === undefined) throw new Error(`signup falhou (${email}): ${body.msg ?? res.status}`);
  return { id: body.user.id, token: body.access_token };
}

async function main(): Promise<void> {
  const db = new pg.Client({ connectionString: DB_URL });
  await db.connect();
  const admin = await signUp(TEST_USERS.admin.email, TEST_USERS.admin.name);
  const leader = await signUp(TEST_USERS.leader.email, TEST_USERS.leader.name);
  const member = await signUp(TEST_USERS.member.email, TEST_USERS.member.name);
  const extras = await Promise.all(EXTRA.map((name, i) => signUp(`pessoa${i + 1}@teste.local`, name)));

  // A igreja é criada pela RPC real (como no onboarding do app), com o token do administrador.
  const rpc = await fetch(`${GATEWAY}/rest/v1/rpc/create_church`, { method: "POST", headers: { "Content-Type": "application/json", apikey: "sb_publishable_seed", Authorization: `Bearer ${admin.token}` }, body: JSON.stringify({ p_name: "Igreja de Teste", p_slug: "igreja-de-teste" }) });
  if (!rpc.ok) throw new Error(`create_church falhou: ${await rpc.text()}`);
  const churchId = (await rpc.json()) as string;

  // Dados restantes: sem gatilhos (apenas neste banco de teste) e com colunas explícitas.
  await db.query("set session_replication_role = replica");
  const q = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> => (await db.query<T>(sql, params)).rows;
  const addMember = async (userId: string, role: "leader" | "member"): Promise<string> =>
    (await q<{ id: string }>("insert into public.church_memberships (church_id, user_id, role, status) values ($1,$2,$3,'active') returning id", [churchId, userId, role]))[0]?.id ?? "";
  const adminM = (await q<{ id: string }>("select id from public.church_memberships where church_id=$1 and user_id=$2", [churchId, admin.id]))[0]?.id ?? "";
  const leaderM = await addMember(leader.id, "leader");
  const memberM = await addMember(member.id, "member");
  const extraM: string[] = [];
  for (const e of extras) extraM.push(await addMember(e.id, "member"));

  const ids = async (sql: string, params: unknown[]): Promise<string> => (await q<{ id: string }>(sql, params))[0]?.id ?? "";
  const louvor = await ids("insert into public.ministries (church_id,name,slug,kind,description) values ($1,'Louvor','louvor','music','Ministério de música (teste)') returning id", [churchId]);
  const acolhimento = await ids("insert into public.ministries (church_id,name,slug,kind,description) values ($1,'Acolhimento','acolhimento','care','Recepção de visitantes (teste)') returning id", [churchId]);
  const mmLeader = await ids("insert into public.ministry_memberships (church_id,ministry_id,membership_id,role,instruments,voice_part) values ($1,$2,$3,'coordinator','{violao}','tenor') returning id", [churchId, louvor, leaderM]);
  const mmMember = await ids("insert into public.ministry_memberships (church_id,ministry_id,membership_id,role,instruments,voice_part) values ($1,$2,$3,'member','{teclado}','soprano') returning id", [churchId, louvor, memberM]);
  const mmAcolhe = await ids("insert into public.ministry_memberships (church_id,ministry_id,membership_id,role) values ($1,$2,$3,'coordinator') returning id", [churchId, acolhimento, leaderM]);
  for (const p of ["manage_ministry", "manage_schedule", "publish_schedule", "manage_repertoire", "manage_content", "view_availability"]) await q("insert into public.ministry_permissions (church_id,ministry_id,ministry_membership_id,permission) values ($1,$2,$3,$4::public.ministry_permission)", [churchId, louvor, mmLeader, p]);
  await q("insert into public.ministry_permissions (church_id,ministry_id,ministry_membership_id,permission) values ($1,$2,$3,'manage_members')", [churchId, acolhimento, mmAcolhe]);

  const event = await ids("insert into public.events (church_id,title,kind,status,starts_at,ends_at,location,description,created_by) values ($1,'Culto de domingo','service','scheduled', date_trunc('day', now()) + interval '3 days 19 hours', date_trunc('day', now()) + interval '3 days 21 hours','Templo principal','Culto de teste',$2) returning id", [churchId, adminM]);
  await q("insert into public.events (church_id,title,kind,status,starts_at,ends_at,location,created_by) values ($1,'Ensaio do louvor','rehearsal','scheduled', date_trunc('day', now()) + interval '1 day 20 hours', date_trunc('day', now()) + interval '1 day 22 hours','Sala de música',$2)", [churchId, adminM]);
  const session = await ids("insert into public.event_sessions (church_id,event_id,name,starts_at,ends_at,location,ministry_id,position) values ($1,$2,'Culto',date_trunc('day', now()) + interval '3 days 19 hours', date_trunc('day', now()) + interval '3 days 21 hours','Templo principal',$3,0) returning id", [churchId, event, louvor]);
  const song = await ids("insert into public.songs (church_id,title,artist,default_key,tags,language,created_by) values ($1,'Música de teste 1','Autor de teste','G','{louvor}','pt-BR',$2) returning id", [churchId, leaderM]);
  const version = await ids("insert into public.song_versions (church_id,song_id,label,original_key,chordpro,bpm,time_signature,status,is_default,created_by) values ($1,$2,'Principal','G','{title: Música de teste 1}\n[G]Letra de [C]teste para o [D]ensaio',72,'4/4','published',true,$3) returning id", [churchId, song, leaderM]);
  await q("insert into public.event_setlist (church_id,session_id,song_version_id,position,target_key) values ($1,$2,$3,0,'G')", [churchId, session, version]);
  await q("insert into public.event_lineup (church_id,session_id,ministry_id,ministry_membership_id,function,status,source) values ($1,$2,$3,$4,'Violão','published','manual'), ($1,$2,$3,$5,'Teclado','confirmed','manual')", [churchId, session, louvor, mmLeader, mmMember]);
  await q("insert into public.unavailabilities (church_id,membership_id,during,reason) values ($1,$2,daterange((current_date + 10), (current_date + 14)),'Viagem (teste)')", [churchId, memberM]);

  await q("insert into public.announcements_and_devotionals (church_id,kind,title,body_md,audience,status,published_at,author_membership_id) values ($1,'announcement','Comunicado de teste','Texto de teste do comunicado para a igreja.','church','published',now(),$2)", [churchId, adminM]);
  await q("insert into public.announcements_and_devotionals (church_id,kind,title,body_md,audience,status,published_at,scripture_ref,author_membership_id) values ($1,'devotional','Devocional de teste','Texto de teste do devocional.','church','published',now(),'João 3:16',$2)", [churchId, adminM]);
  await q("insert into public.announcements_and_devotionals (church_id,kind,title,body_md,audience,status,author_membership_id) values ($1,'announcement','Rascunho de teste','Ainda não publicado.','church','draft',$2)", [churchId, adminM]);
  const prayer = await ids("insert into public.prayer_requests (church_id,body,status,is_anonymous) values ($1,'Pedido de oração de teste.','open',true) returning id", [churchId]);
  await q("insert into public.prayer_request_authors (prayer_request_id,church_id,membership_id) values ($1,$2,$3)", [prayer, churchId, memberM]);

  const family = await ids("insert into public.families (church_id,name) values ($1,'Família de Teste') returning id", [churchId]);
  await q("insert into public.family_members (church_id,family_id,membership_id,relation) values ($1,$2,$3,'responsavel')", [churchId, family, extraM[0]]);
  await q("insert into public.family_members (church_id,family_id,full_name,relation,birth_date) values ($1,$2,'Criança de Teste','filho',current_date - interval '8 years')", [churchId, family]);
  const visitor = await ids("insert into public.visitors (church_id,full_name,phone,contact_consent_at,source,status,assigned_membership_id) values ($1,'Visitante de Teste','11999990000',now(),'Convite de membro','novo',$2) returning id", [churchId, leaderM]);
  await q("insert into public.visit_followups (church_id,visitor_id,kind,note,by_membership_id) values ($1,$2,'ligacao','Contato de teste realizado.',$3)", [churchId, visitor, leaderM]);
  const cell = await ids("insert into public.cell_groups (church_id,name,leader_membership_id,weekday,meeting_time,location) values ($1,'Célula Centro',$2,3,'19:30','Casa de teste') returning id", [churchId, leaderM]);
  await q("insert into public.cell_members (church_id,cell_id,membership_id) values ($1,$2,$3), ($1,$2,$4)", [churchId, cell, extraM[1], extraM[2]]);
  await q("insert into public.cell_meetings (church_id,cell_id,held_on,topic) values ($1,$2,current_date - 7,'Encontro de teste')", [churchId, cell]);

  const catIn = await ids("insert into public.finance_categories (church_id,name,kind) values ($1,'Ofertas','entrada') returning id", [churchId]);
  const catOut = await ids("insert into public.finance_categories (church_id,name,kind) values ($1,'Manutenção','saida') returning id", [churchId]);
  await q("insert into public.finance_entries (church_id,kind,category_id,occurred_on,amount_cents,description,created_by_membership_id) values ($1,'entrada',$2,current_date - 2,150000,'Oferta de teste',$4), ($1,'saida',$3,current_date - 1,45050,'Despesa de teste',$4)", [churchId, catIn, catOut, adminM]);
  await q("insert into public.pix_charges (church_id,membership_id,purpose,amount_cents,status,paid_at) values ($1,$2,'oferta',5000,'approved',now())", [churchId, memberM]);
  await q("insert into public.attendance_records (church_id,session_id,membership_id,method) values ($1,$2,$3,'self')", [churchId, session, memberM]);
  await db.end();
  console.log(JSON.stringify({ churchId, users: Object.values(TEST_USERS).map((u) => u.email), password: "(ver TEST_PASSWORD em seed.ts)" }));
}
main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
