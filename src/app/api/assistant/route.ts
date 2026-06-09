import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLifeOSService } from "@/features/lifeos/application/container";
import { applyRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AssistantSchema = z.object({
  persona: z.enum(["ceo", "fitness_coach", "drill_sergeant", "butler", "future_self"]).optional(),
  name: z.string().min(2).max(40).optional(),
  personality: z.string().min(2).max(160).optional(),
  voice: z.string().min(2).max(80).optional(),
  avatar: z.string().min(1).max(200).optional(),
});

export async function POST(req: NextRequest) {
  const rateLimited = applyRateLimit(req, "lifeos:assistant:update", { limit: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const json = await req.json().catch(() => null);
  const parsed = AssistantSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid assistant payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const assistant = await getLifeOSService().updateAssistant(parsed.data);
  return NextResponse.json({ assistant });
}
