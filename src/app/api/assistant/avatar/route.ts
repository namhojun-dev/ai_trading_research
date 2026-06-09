import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLifeOSService } from "@/features/lifeos/application/container";
import { applyRateLimit } from "@/lib/security/rate-limit";
import { hasAssistantAvatarStorageConfig, uploadAssistantAvatar } from "@/lib/storage/assistant-avatar-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AvatarUploadSchema = z.object({
  fileName: z.string().min(1).max(120),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]),
  base64: z.string().min(1).max(2_000_000),
});

export async function POST(req: NextRequest) {
  const rateLimited = applyRateLimit(req, "lifeos:assistant:avatar", { limit: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const parsed = AvatarUploadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid avatar upload payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (!hasAssistantAvatarStorageConfig()) {
    return NextResponse.json(
      {
        error: "Supabase Storage is not configured",
        bucket: "assistant-avatars",
      },
      { status: 501 },
    );
  }

  const service = getLifeOSService();
  const snapshot = await service.getDashboardSnapshot();

  try {
    const upload = await uploadAssistantAvatar({
      userId: snapshot.user.id,
      fileName: parsed.data.fileName,
      contentType: parsed.data.contentType,
      base64: parsed.data.base64,
    });
    const assistant = await service.updateAssistant({ avatar: upload.publicUrl });

    return NextResponse.json({ assistant, upload }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Avatar upload failed",
        message: error instanceof Error ? error.message : "Unknown storage error",
      },
      { status: 502 },
    );
  }
}
