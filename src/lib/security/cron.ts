import type { NextRequest } from "next/server";

export function verifyCronRequest(req: NextRequest) {
  const secret = process.env.LIFEOS_CRON_SECRET;
  if (!secret) {
    return { ok: false, status: 501, error: "LifeOS cron secret is not configured" };
  }

  const provided = req.headers.get("x-lifeos-cron-secret") ?? "";
  if (provided !== secret) {
    return { ok: false, status: 401, error: "Invalid LifeOS cron secret" };
  }

  return { ok: true, status: 200, error: null };
}
