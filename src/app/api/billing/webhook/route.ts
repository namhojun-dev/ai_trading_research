import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { LIFEOS_PLANS, type LifeOSPlanId } from "@/lib/billing/plans";
import { logLifeOSEvent } from "@/lib/logging/lifeos-logger";
import { getSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CheckoutCompletedSchema = z.object({
  id: z.string(),
  object: z.literal("checkout.session"),
  customer: z.string().nullable().optional(),
  subscription: z.string().nullable().optional(),
  client_reference_id: z.string().nullable().optional(),
  metadata: z
    .object({
      plan_id: z.enum(["FREE", "PREMIUM", "VIP"]).optional(),
      user_id: z.string().optional(),
    })
    .nullable()
    .optional(),
});

function verifyStripeSignature(payload: string, signatureHeader: string, secret: string) {
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=", 2);
      return [key, value];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

async function persistCheckout(session: z.infer<typeof CheckoutCompletedSchema>) {
  if (!hasSupabaseServerConfig()) {
    return { persisted: false, reason: "supabase_not_configured" };
  }

  const plan = session.metadata?.plan_id as LifeOSPlanId | undefined;
  const userId = session.metadata?.user_id ?? session.client_reference_id ?? undefined;
  if (!plan || !LIFEOS_PLANS.some((item) => item.id === plan) || !userId) {
    return { persisted: false, reason: "missing_plan_or_user" };
  }

  const supabase = getSupabaseServerClient();
  const { error: userError } = await supabase.from("users").update({ plan }).eq("id", userId);
  if (userError) throw userError;

  const { error: subscriptionError } = await supabase.from("subscriptions").insert({
    user_id: userId,
    plan,
    provider: "stripe",
    provider_customer_id: session.customer ?? null,
    provider_subscription_id: session.subscription ?? null,
    provider_checkout_session_id: session.id,
    status: "active",
  });
  if (subscriptionError) throw subscriptionError;

  return { persisted: true, plan, userId };
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 501 });
  }

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature || !verifyStripeSignature(payload, signature, process.env.STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  const event = JSON.parse(payload) as { id?: string; type?: string; data?: { object?: unknown } };
  let result: unknown = { ignored: true };

  if (event.type === "checkout.session.completed") {
    const session = CheckoutCompletedSchema.parse(event.data?.object);
    result = await persistCheckout(session);
  }

  logLifeOSEvent("info", "lifeos:billing:webhook", "Stripe webhook processed", {
    eventId: event.id,
    eventType: event.type,
    result,
  });

  return NextResponse.json({ received: true, result });
}
