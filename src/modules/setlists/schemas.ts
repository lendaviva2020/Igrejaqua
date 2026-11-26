import { z } from "zod";

const KeySchema = z.string().regex(/^[A-G][#b]?m?$/, "Tom inválido");
export const AddSetlistSchema = z.object({ sessionId: z.string().uuid(), versionId: z.string().uuid(), targetKey: KeySchema.optional() }).strict();
export const RemoveSetlistSchema = z.object({ setlistId: z.string().uuid(), sessionId: z.string().uuid() }).strict();
export const MoveSetlistSchema = z.object({ sessionId: z.string().uuid(), setlistId: z.string().uuid(), direction: z.enum(["up", "down"]) }).strict();

/** Move um item uma posição, devolvendo a nova ordem (puro, testável). */
export function moveInOrder(ids: readonly string[], id: string, direction: "up" | "down"): readonly string[] | null {
  const i = ids.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const next = [...ids];
  const a = next[i] as string;
  next[i] = next[j] as string;
  next[j] = a;
  return next;
}
