import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return NextResponse.json({
    providers: [
      { id: "email", label: "Email Login", configured: true },
      { id: "google", label: "Google Login", configured: supabaseConfigured },
      { id: "apple", label: "Apple Login", configured: supabaseConfigured },
    ],
    supabaseConfigured,
  });
}
