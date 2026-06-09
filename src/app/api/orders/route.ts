import { NextRequest, NextResponse } from "next/server";
import { findUserBySession, SESSION_COOKIE } from "@/lib/server/kfin-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDER_SOURCE = "K-Fin order gateway";

export async function GET() {
  return NextResponse.json({
    status: "permission_denied",
    source: ORDER_SOURCE,
    fetchedAt: new Date().toISOString(),
    message: "실제 주문 기능은 기본 비활성화되어 있습니다. 브로커 API, 사용자 권한, KFIN_ENABLE_LIVE_ORDERS=true가 모두 필요합니다.",
    data: {
      liveOrdersEnabled: process.env.KFIN_ENABLE_LIVE_ORDERS === "true",
      paperTradingOnly: process.env.KFIN_ENABLE_LIVE_ORDERS !== "true",
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await findUserBySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json(
      {
        status: "permission_denied",
        source: ORDER_SOURCE,
        fetchedAt: new Date().toISOString(),
        message: "로그인 사용자만 주문 게이트웨이에 접근할 수 있습니다.",
        data: null,
      },
      { status: 401 },
    );
  }

  if (process.env.KFIN_ENABLE_LIVE_ORDERS !== "true") {
    return NextResponse.json(
      {
        status: "permission_denied",
        source: ORDER_SOURCE,
        fetchedAt: new Date().toISOString(),
        message: "실제 주문은 서버에서 기본 차단되어 있습니다. KFIN_ENABLE_LIVE_ORDERS=true와 브로커 API 권한이 필요합니다.",
        data: null,
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      status: "api_required",
      source: ORDER_SOURCE,
      fetchedAt: new Date().toISOString(),
      message: "실제 주문 활성화 플래그는 켜져 있지만 브로커 API 어댑터가 연결되지 않았습니다.",
      data: null,
    },
    { status: 501 },
  );
}
