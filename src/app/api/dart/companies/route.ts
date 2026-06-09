import { NextRequest } from "next/server";
import { fetchDartCompanies } from "@/lib/data/dart";
import { findUserBySession, getStoredApiKey, SESSION_COOKIE } from "@/lib/server/kfin-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 30);
  const user = await findUserBySession(req.cookies.get(SESSION_COOKIE)?.value);
  const apiKey = getStoredApiKey(user, "opendart") ?? undefined;
  const payload = await fetchDartCompanies(apiKey, query, Number.isFinite(limit) ? limit : 30);
  return Response.json(payload);
}
