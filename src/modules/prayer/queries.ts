import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Row = z.object({ id: z.string().uuid(), body: z.string(), status: z.enum(["open", "answered", "archived", "removed"]), is_anonymous: z.boolean(), public_author_membership_id: z.string().uuid().nullable(), created_at: z.string() });
const Inter = z.object({ prayer_request_id: z.string().uuid(), membership_id: z.string().uuid() });
const Author = z.object({ prayer_request_id: z.string().uuid() });
const Dir = z.object({ membership_id: z.string().uuid(), display_name: z.string() });

export interface PrayerItem {
  readonly id: string; readonly body: string; readonly status: "open" | "answered" | "archived" | "removed";
  /** Nome só quando o autor optou por se identificar; anônimo nunca resolve nome. */
  readonly authorName: string | null; readonly createdAt: string;
  readonly prayingCount: number; readonly iPray: boolean;
  /** Pedido é meu (RLS só devolve meus vínculos de autoria). */
  readonly mine: boolean;
}

export async function listPrayerRequests(churchId: string, membershipId: string): Promise<readonly PrayerItem[]> {
  const supabase = await createSupabaseServerClient();
  const [reqs, inter, mineRes, dir] = await Promise.all([
    supabase.from("prayer_requests").select("id, body, status, is_anonymous, public_author_membership_id, created_at").eq("church_id", churchId).order("created_at", { ascending: false }).limit(100),
    supabase.from("prayer_interactions").select("prayer_request_id, membership_id").eq("church_id", churchId),
    supabase.from("prayer_request_authors").select("prayer_request_id"),
    supabase.rpc("church_directory", { p_church: churchId }),
  ]);
  for (const r of [reqs, inter, mineRes, dir]) if (r.error) throw new Error(`Falha ao carregar pedidos: ${r.error.message}`);
  const names = new Map(z.array(Dir).parse(dir.data).map((d) => [d.membership_id, d.display_name] as const));
  const mine = new Set(z.array(Author).parse(mineRes.data).map((a) => a.prayer_request_id));
  const counts = new Map<string, number>();
  const iPray = new Set<string>();
  for (const i of z.array(Inter).parse(inter.data)) {
    counts.set(i.prayer_request_id, (counts.get(i.prayer_request_id) ?? 0) + 1);
    if (i.membership_id === membershipId) iPray.add(i.prayer_request_id);
  }
  return z.array(Row).parse(reqs.data).map((r) => ({
    id: r.id, body: r.body, status: r.status, createdAt: r.created_at,
    authorName: r.is_anonymous || r.public_author_membership_id === null ? null : (names.get(r.public_author_membership_id) ?? null),
    prayingCount: counts.get(r.id) ?? 0, iPray: iPray.has(r.id), mine: mine.has(r.id),
  }));
}
