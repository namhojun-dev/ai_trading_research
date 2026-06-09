import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  findUserBySession,
  loginOrRegister,
  SESSION_COOKIE,
  sessionMaxAge,
  toPublicState,
} from "@/lib/server/kfin-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await findUserBySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({
      status: "permission_denied",
      source: "K-Fin local auth",
      fetchedAt: new Date().toISOString(),
      message: "로그인 세션이 없습니다.",
      data: null,
    });
  }

  return NextResponse.json({
    status: "actual",
    source: "K-Fin local auth",
    fetchedAt: new Date().toISOString(),
    message: "로그인 세션이 활성화되어 있습니다.",
    data: toPublicState(user),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const user = await loginOrRegister(body.email ?? "", body.password ?? "");
    const res = NextResponse.json({
      status: "actual",
      source: "K-Fin local auth",
      fetchedAt: new Date().toISOString(),
      message: "로그인되었습니다.",
      data: toPublicState(user),
    });
    res.cookies.set(SESSION_COOKIE, createSession(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionMaxAge(),
      path: "/",
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        source: "K-Fin local auth",
        fetchedAt: new Date().toISOString(),
        message: err instanceof Error ? err.message : String(err),
        data: null,
      },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({
    status: "permission_denied",
    source: "K-Fin local auth",
    fetchedAt: new Date().toISOString(),
    message: "로그아웃되었습니다.",
    data: null,
  });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
  return res;
}
