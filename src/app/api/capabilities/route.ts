import { NextRequest } from "next/server";
import { getTerminalCapabilities } from "@/lib/data/capabilities";
import { findUserBySession, getConfiguredApiProviders, SESSION_COOKIE } from "@/lib/server/kfin-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await findUserBySession(req.cookies.get(SESSION_COOKIE)?.value);
  return Response.json({
    fetchedAt: new Date().toISOString(),
    capabilities: getTerminalCapabilities(getConfiguredApiProviders(user), Boolean(user)),
  });
}
