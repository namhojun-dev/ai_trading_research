import { NextRequest } from "next/server";
import { fetchRates } from "@/lib/data/rates";
import { findUserBySession, getStoredApiKey, SESSION_COOKIE } from "@/lib/server/kfin-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await findUserBySession(req.cookies.get(SESSION_COOKIE)?.value);
  const apiKey = getStoredApiKey(user, "fred") ?? undefined;
  return Response.json(await fetchRates(apiKey));
}
