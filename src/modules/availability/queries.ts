import "server-only";
import { z } from "zod";
import { parseDateRange } from "./date-range";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Row = z.object({ id: z.string().uuid(), during: z.string(), weekdays: z.array(z.number()).nullable(), reason: z.string().nullable() });
export interface MyUnavailability { readonly id: string; readonly from: string; readonly to: string; readonly weekdays: readonly number[] | null; readonly reason: string | null }

export async function listMyUnavailabilities(churchId: string): Promise<readonly MyUnavailability[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("unavailabilities").select("id, during, weekdays, reason").eq("church_id", churchId).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(`Falha ao listar indisponibilidades: ${error.message}`);
  return z.array(Row).parse(data).map((r) => ({ id: r.id, ...parseDateRange(r.during), weekdays: r.weekdays, reason: r.reason }));
}
