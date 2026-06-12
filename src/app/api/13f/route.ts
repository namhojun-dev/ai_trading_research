import { NextRequest, NextResponse } from "next/server";
import { get13F, MANAGERS } from "@/lib/thirteenf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cik = searchParams.get("cik");

  // CIK 미지정 → 큐레이션한 기관 목록 반환
  if (!cik) {
    return NextResponse.json({ ok: true, managers: MANAGERS });
  }

  try {
    const result = await get13F(cik);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "13F 조회에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
