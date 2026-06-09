import { NextRequest } from "next/server";
import { DEFAULT_WATCHLIST, getMarketSnapshot } from "@/lib/data/market";
import { findUserBySession, getConfiguredApiProviders, SESSION_COOKIE } from "@/lib/server/kfin-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const rawSymbols = req.nextUrl.searchParams.get("symbols");
  const symbols = rawSymbols
    ? rawSymbols.split(",").map((symbol) => symbol.trim())
    : DEFAULT_WATCHLIST.map((item) => item.symbol);

  const user = await findUserBySession(req.cookies.get(SESSION_COOKIE)?.value);
  const snapshot = await getMarketSnapshot(symbols, getConfiguredApiProviders(user), Boolean(user));
  return Response.json(snapshot);
}
