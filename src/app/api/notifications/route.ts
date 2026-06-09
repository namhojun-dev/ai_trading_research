import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLifeOSService } from "@/features/lifeos/application/container";
import { applyRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NotificationSchema = z.object({
  title: z.string().min(1).max(120),
  message: z.string().min(1).max(500),
  sentAt: z.string().datetime().nullable().optional(),
});

export async function GET() {
  const snapshot = await getLifeOSService().getDashboardSnapshot();
  return NextResponse.json({ notifications: snapshot.notifications });
}

export async function POST(req: NextRequest) {
  const rateLimited = applyRateLimit(req, "lifeos:notifications:create", { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const parsed = NotificationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const notification = await getLifeOSService().createNotification(parsed.data);
  return NextResponse.json({ notification }, { status: 201 });
}
