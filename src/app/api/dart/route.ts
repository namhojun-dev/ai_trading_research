import { NextRequest } from "next/server";
import { fetchDartFilings } from "@/lib/data/dart";
import { findUserBySession, getStoredApiKey, SESSION_COOKIE } from "@/lib/server/kfin-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim();
  if (!symbol) {
    return Response.json(
      {
        status: "no_data",
        source: "OpenDART",
        fetchedAt: null,
        message: "symbol 파라미터가 필요합니다.",
        data: [],
      },
      { status: 400 },
    );
  }

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 12);
  const corpCode = req.nextUrl.searchParams.get("corpCode");
  const user = await findUserBySession(req.cookies.get(SESSION_COOKIE)?.value);
  const apiKey = getStoredApiKey(user, "opendart") ?? undefined;
  const payload = await fetchDartFilings(symbol, Number.isFinite(limit) ? limit : 12, apiKey, corpCode);
  return Response.json(payload);
}
