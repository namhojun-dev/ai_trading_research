import { NextRequest, NextResponse } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function applyRateLimit(
  req: NextRequest,
  scope: string,
  options: { limit: number; windowMs: number } = { limit: 30, windowMs: 60_000 },
) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("x-real-ip") || "local";
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  if (current.count >= options.limit) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterMs: current.resetAt - now },
      {
        status: 429,
        headers: {
          "Retry-After": `${Math.ceil((current.resetAt - now) / 1000)}`,
        },
      },
    );
  }

  current.count += 1;
  return null;
}
