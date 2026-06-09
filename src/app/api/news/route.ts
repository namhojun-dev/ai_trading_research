import { NextRequest } from "next/server";
import { fetchMarketNews } from "@/lib/data/news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 12);
  const payload = await fetchMarketNews(Number.isFinite(limit) ? limit : 12);
  return Response.json(payload);
}
