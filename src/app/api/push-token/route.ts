import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { PushToken } from "@/features/lifeos/domain/entities";
import { getLifeOSService } from "@/features/lifeos/application/container";
import { applyRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PushTokenSchema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.enum(["ios", "android", "web"]),
  provider: z.literal("fcm").optional(),
});

function maskToken(token: string) {
  if (token.length <= 16) return "********";
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

function publicPushToken(token: PushToken) {
  return {
    id: token.id,
    userId: token.userId,
    token: maskToken(token.token),
    platform: token.platform,
    provider: token.provider,
    encrypted: token.encrypted ?? false,
    createdAt: token.createdAt,
  };
}

export async function GET() {
  const tokens = await getLifeOSService().listPushTokens();

  return NextResponse.json({
    tokens: tokens.map(publicPushToken),
  });
}

export async function POST(req: NextRequest) {
  const rateLimited = applyRateLimit(req, "lifeos:push-token:create", { limit: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const parsed = PushTokenSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push token payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const pushToken = await getLifeOSService().createPushToken(parsed.data);

  return NextResponse.json(
    {
      pushToken: publicPushToken(pushToken),
    },
    { status: 201 },
  );
}
