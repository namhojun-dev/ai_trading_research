import { NextRequest, NextResponse } from "next/server";
import { runAlerts } from "@/lib/data/personal";
import { appendAlertRun, findUserBySession, SESSION_COOKIE, toPublicState } from "@/lib/server/kfin-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await findUserBySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json(
      {
        status: "permission_denied",
        source: "K-Fin alert runner",
        fetchedAt: new Date().toISOString(),
        message: "로그인 사용자만 알림 실행 기록을 조회할 수 있습니다.",
        data: [],
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    status: "actual",
    source: "K-Fin alert runner",
    fetchedAt: new Date().toISOString(),
    message: "최근 알림 실행 기록입니다.",
    data: toPublicState(user).alertRuns,
  });
}

export async function POST(req: NextRequest) {
  const user = await findUserBySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json(
      {
        status: "permission_denied",
        source: "K-Fin alert runner",
        fetchedAt: new Date().toISOString(),
        message: "로그인 사용자만 알림을 실행할 수 있습니다.",
        data: null,
      },
      { status: 401 },
    );
  }

  const result = await runAlerts(toPublicState(user).alerts);
  await appendAlertRun(user.id, result.data.run);
  return NextResponse.json(result);
}
