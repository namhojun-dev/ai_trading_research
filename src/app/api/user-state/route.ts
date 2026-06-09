import { NextRequest, NextResponse } from "next/server";
import {
  findUserBySession,
  SESSION_COOKIE,
  toPublicState,
  updateUserState,
  type UserStateUpdate,
} from "@/lib/server/kfin-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await findUserBySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json(
      {
        status: "permission_denied",
        source: "K-Fin user store",
        fetchedAt: new Date().toISOString(),
        message: "로그인 사용자만 포트폴리오, 관심종목, API 키, AI 설정, 레이아웃, 알림을 저장할 수 있습니다.",
        data: null,
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    status: "actual",
    source: "K-Fin user store",
    fetchedAt: new Date().toISOString(),
    message: "저장된 사용자 설정입니다.",
    data: toPublicState(user),
  });
}

export async function PUT(req: NextRequest) {
  const user = await findUserBySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json(
      {
        status: "permission_denied",
        source: "K-Fin user store",
        fetchedAt: new Date().toISOString(),
        message: "로그인 세션이 없어서 저장할 수 없습니다.",
        data: null,
      },
      { status: 401 },
    );
  }

  try {
    const update = (await req.json()) as UserStateUpdate;
    const data = await updateUserState(user.id, update);
    return NextResponse.json({
      status: "actual",
      source: "K-Fin user store",
      fetchedAt: new Date().toISOString(),
      message: "사용자 설정을 저장했습니다.",
      data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        source: "K-Fin user store",
        fetchedAt: new Date().toISOString(),
        message: err instanceof Error ? err.message : String(err),
        data: null,
      },
      { status: 400 },
    );
  }
}
