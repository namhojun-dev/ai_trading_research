import { NextRequest } from "next/server";
import { fetchEarningsCalendar } from "@/lib/data/earnings";
import { findUserBySession, getStoredApiKey, SESSION_COOKIE } from "@/lib/server/kfin-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim();
  if (!symbol) {
    return Response.json(
      {
        status: "no_data",
        source: "Finnhub earnings calendar",
        fetchedAt: null,
        message: "symbol 파라미터가 필요합니다.",
        data: [],
      },
      { status: 400 },
    );
  }

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 8);
  const user = await findUserBySession(req.cookies.get(SESSION_COOKIE)?.value);
  const apiKey = getStoredApiKey(user, "finnhub") ?? undefined;
  const payload = await fetchEarningsCalendar(symbol, Number.isFinite(limit) ? limit : 8, apiKey);
  return Response.json(payload);
}
