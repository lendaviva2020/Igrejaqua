import { NextResponse, type NextRequest } from "next/server";
import { resolveChurchContext } from "@/lib/auth/context";
import { can } from "@/lib/permissions/capabilities";
import { entriesToCsv } from "@/modules/finance/csv";
import { listEntries } from "@/modules/finance/queries";
import { MonthSchema } from "@/modules/finance/schemas";

export const dynamic = "force-dynamic";

/** Exporta o mês do livro-caixa em CSV. Somente administração; a RLS ainda restringe os dados. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const ctx = await resolveChurchContext();
  if (!can(ctx, "finance.manage")) return new NextResponse("Não encontrado", { status: 404 });
  const month = MonthSchema.safeParse(request.nextUrl.searchParams.get("m"));
  if (!month.success) return new NextResponse("Mês inválido (use AAAA-MM).", { status: 400 });
  const [yearText = "", monthText = ""] = month.data.split("-");
  const entries = await listEntries(ctx.churchId, Number(yearText), Number(monthText));
  return new NextResponse(entriesToCsv(entries), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="livro-caixa-${month.data}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
