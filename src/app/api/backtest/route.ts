import { NextRequest, NextResponse } from "next/server";
import { listByTicker, listAnalyses } from "@/lib/data/history";
import { runBacktest } from "@/lib/backtest/engine";
import { isLeveragedTicker } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get("ticker") ?? "").toUpperCase().trim();

  try {
    const records = ticker
      ? await listByTicker(ticker, 200)
      : await listAnalyses(200);

    const effectiveTicker = ticker || "QQQ";
    const leverage = isLeveragedTicker(effectiveTicker) && effectiveTicker !== "QQQ" ? 3 : 1;
    const stats = await runBacktest(records, effectiveTicker, leverage);

    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
