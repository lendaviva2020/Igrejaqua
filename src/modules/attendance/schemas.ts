import { z } from "zod";

export const SelfCheckInSchema = z.object({ sessionId: z.string().uuid() }).strict();
export const LeaderCheckInSchema = z.object({ sessionId: z.string().uuid(), membershipId: z.string().uuid() }).strict();
export const RemoveAttendanceSchema = z.object({ attendanceId: z.string().uuid() }).strict();

/** R-26: janela de check-in próprio = [início − 60 min, fim]. Espelha private.attendance_guard (o banco é a fonte da verdade). */
export function isCheckInOpen(startsAt: Date, endsAt: Date, now: Date): boolean {
  return now.getTime() >= startsAt.getTime() - 60 * 60_000 && now.getTime() <= endsAt.getTime();
}
