import { NextRequest, NextResponse } from "next/server";
import { getLifeOSMessages } from "@/lib/i18n/lifeos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get("locale");
  return NextResponse.json(
    {
      locale: locale === "en" ? "en" : "ko",
      messages: getLifeOSMessages(locale),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    },
  );
}
