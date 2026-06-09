import { NextRequest } from "next/server";
import { fetchSecFilings } from "@/lib/data/filings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim();
  if (!symbol) {
    return Response.json(
      {
        status: "no_data",
        source: "SEC EDGAR submissions API",
        fetchedAt: null,
        message: "symbol 파라미터가 필요합니다.",
        data: [],
      },
      { status: 400 },
    );
  }

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 12);
  const payload = await fetchSecFilings(symbol, Number.isFinite(limit) ? limit : 12);
  return Response.json(payload);
}
