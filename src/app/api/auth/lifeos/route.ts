import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { applyRateLimit } from "@/lib/security/rate-limit";
import { createLifeOSJwt, verifyLifeOSJwt } from "@/lib/security/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "lifeos_session";
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(80).optional(),
});

function userIdFromEmail(email: string) {
  return createHash("sha256").update(email.toLowerCase()).digest("base64url").slice(0, 24);
}

export async function GET(req: NextRequest) {
  const session = verifyLifeOSJwt(req.cookies.get(COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.sub,
      email: session.email,
      name: session.name ?? session.email.split("@")[0],
    },
  });
}

export async function POST(req: NextRequest) {
  const rateLimited = applyRateLimit(req, "lifeos:auth:email", { limit: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const parsed = LoginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid login payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const token = createLifeOSJwt({
    sub: userIdFromEmail(email),
    email,
    name: parsed.data.name,
  });
  const res = NextResponse.json({
    authenticated: true,
    user: {
      id: userIdFromEmail(email),
      email,
      name: parsed.data.name ?? email.split("@")[0],
    },
  });

  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ authenticated: false, user: null });
  res.cookies.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
  return res;
}
