import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/browser";
import { applyRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OAuthSchema = z.object({
  provider: z.enum(["google", "apple"]),
  redirectTo: z.string().url(),
});

export async function POST(req: NextRequest) {
  const rateLimited = applyRateLimit(req, "lifeos:auth:oauth", { limit: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const parsed = OAuthSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid OAuth payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (!hasSupabaseBrowserConfig()) {
    return NextResponse.json({ error: "Supabase OAuth is not configured" }, { status: 501 });
  }

  const { data, error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
    provider: parsed.data.provider,
    options: {
      redirectTo: parsed.data.redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  return NextResponse.json({ url: data.url });
}
