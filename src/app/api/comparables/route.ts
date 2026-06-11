import { NextRequest, NextResponse } from "next/server";
import { getComparableValuation } from "@/lib/comparables";
import { ComparableRejection } from "@/lib/comparables/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");

  if (!ticker || !ticker.trim()) {
    return NextResponse.json({ ok: false, error: "ticker is required" }, { status: 400 });
  }

  try {
    const result = await getComparableValuation(ticker.trim());
    return NextResponse.json(result);
  } catch (error) {
    // 의도적 거절(ETF/ETN/스팩/우선주)은 200 + reason 으로 명확히 전달
    if (error instanceof ComparableRejection) {
      return NextResponse.json(
        { ok: false, error: error.message, reason: error.reason },
        { status: 200 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "유사 종목 비교 분석에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
