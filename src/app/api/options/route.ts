import { NextRequest } from "next/server";
import { fetchOptionContracts } from "@/lib/data/options";
import { findUserBySession, getStoredApiKey, SESSION_COOKIE } from "@/lib/server/kfin-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim();
  if (!symbol) {
    return Response.json(
      {
        status: "no_data",
        source: "Polygon options reference API",
        fetchedAt: null,
        message: "symbol 파라미터가 필요합니다.",
        data: [],
      },
      { status: 400 },
    );
  }

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);
  const user = await findUserBySession(req.cookies.get(SESSION_COOKIE)?.value);
  const apiKey = getStoredApiKey(user, "polygon") ?? undefined;
  const payload = await fetchOptionContracts(symbol, Number.isFinite(limit) ? limit : 20, apiKey);
  return Response.json(payload);
}
