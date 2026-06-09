import { NextRequest, NextResponse } from "next/server";
import { evaluateAlerts } from "@/lib/data/personal";
import { findUserBySession, SESSION_COOKIE, toPublicState } from "@/lib/server/kfin-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await findUserBySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json(
      {
        status: "permission_denied",
        source: "K-Fin alert evaluator",
        fetchedAt: new Date().toISOString(),
        message: "로그인 사용자만 알림 평가를 조회할 수 있습니다.",
        data: null,
      },
      { status: 401 },
    );
  }

  return NextResponse.json(await evaluateAlerts(toPublicState(user).alerts));
}
