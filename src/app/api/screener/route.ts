import { NextRequest, NextResponse } from "next/server";
import { getSectors, getSectorScreener, getIndustryScreener } from "@/lib/screener";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sector = searchParams.get("sector");
  const industry = searchParams.get("industry");

  // 미지정 → 섹터/업종 트리 반환
  if (!sector && !industry) {
    return NextResponse.json({ ok: true, sectors: getSectors() });
  }

  try {
    const result = industry
      ? await getIndustryScreener(industry)
      : await getSectorScreener(sector!);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "스크리닝에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
