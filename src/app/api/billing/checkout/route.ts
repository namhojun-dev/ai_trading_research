import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPlan } from "@/lib/billing/plans";
import { applyRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CheckoutSchema = z.object({
  planId: z.enum(["PREMIUM", "VIP"]),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export async function POST(req: NextRequest) {
  const rateLimited = applyRateLimit(req, "lifeos:billing:checkout", { limit: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const parsed = CheckoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const plan = getPlan(parsed.data.planId);
  if (!plan) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 404 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      {
        error: "Stripe is not configured",
        plan,
      },
      { status: 501 },
    );
  }

  const body = new URLSearchParams({
    mode: "payment",
    success_url: parsed.data.successUrl,
    cancel_url: parsed.data.cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "krw",
    "line_items[0][price_data][product_data][name]": `LifeOS AI ${plan.id}`,
    "line_items[0][price_data][unit_amount]": `${plan.priceKrw}`,
    "metadata[plan_id]": plan.id,
    "metadata[user_id]": process.env.LIFEOS_DEMO_USER_ID ?? "user_demo",
    client_reference_id: process.env.LIFEOS_DEMO_USER_ID ?? "user_demo",
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json({ error: "Stripe checkout failed", detail: data }, { status: 502 });
  }

  return NextResponse.json({
    checkoutUrl: data.url,
    sessionId: data.id,
  });
}
