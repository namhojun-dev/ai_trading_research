import { NextResponse } from "next/server";
import { hasSupabaseServerConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "lifeos-ai",
      supabaseConfigured: hasSupabaseServerConfig(),
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      at: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
