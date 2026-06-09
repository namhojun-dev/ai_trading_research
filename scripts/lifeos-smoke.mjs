import { existsSync } from "node:fs";

const baseUrl = process.env.LIFEOS_BASE_URL ?? "http://127.0.0.1:3100";

const results = [];

function record(name, ok, detail = {}) {
  results.push({ name, ok, detail });
  if (!ok) {
    throw new Error(`${name} failed: ${JSON.stringify(detail)}`);
  }
}

async function request(path, init = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal });
    const body = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, body, setCookie: res.headers.get("set-cookie") };
  } finally {
    clearTimeout(timeout);
  }
}

const page = await fetch(baseUrl, { method: "GET" });
const html = await page.text();
record("root page", page.ok && html.includes("LifeOS AI"), { status: page.status });

const health = await request("/api/health");
record("health", health.ok && health.body?.service === "lifeos-ai", health.body);

const score = await request("/api/life-score");
record("life score", score.ok && score.body?.lifeScore?.today >= 0 && Array.isArray(score.body?.goals), {
  score: score.body?.lifeScore?.today,
  goals: score.body?.goals?.length,
});

const analyze = await request("/api/analyze", { method: "POST" });
record("analysis", analyze.ok && Array.isArray(analyze.body?.probabilities), {
  probabilities: analyze.body?.probabilities?.length,
});

const goal = await request("/api/goal", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    title: `Smoke goal ${Date.now()}`,
    description: "Verify goal creation and probability recalculation path.",
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    priority: "medium",
  }),
});
record("goal create", goal.status === 201 && goal.body?.goal?.title?.startsWith("Smoke goal"), {
  status: goal.status,
});

const behaviorLog = await request("/api/behavior-log", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ type: "study_minutes", value: 15, source: "manual", createdAt: new Date().toISOString() }),
});
record("behavior ingestion", behaviorLog.status === 201 && behaviorLog.body?.lifeScore?.today >= 0, {
  score: behaviorLog.body?.lifeScore?.today,
});

const mobileSync = await request("/api/mobile/behavior-sync", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    device: { platform: "android", timezone: "Asia/Seoul" },
    samples: [
      { source: "usage_stats", metric: "app_usage_minutes", category: "youtube", value: 18, unit: "minutes", capturedAt: new Date().toISOString() },
      { source: "health_connect", metric: "steps", value: 2400, unit: "count", capturedAt: new Date().toISOString() },
      { source: "health_connect", metric: "sleep_hours", value: 7.25, unit: "hours", capturedAt: new Date().toISOString() },
    ],
  }),
});
record("mobile behavior sync", mobileSync.status === 201 && mobileSync.body?.accepted === 3 && mobileSync.body?.lifeScore?.today >= 0, {
  accepted: mobileSync.body?.accepted,
  rejected: mobileSync.body?.rejected?.length,
});

const schedule = await request("/api/schedule", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ workStart: "10:00", workEnd: "19:00", sleepStart: "23:00", sleepEnd: "06:30" }),
});
record("schedule", schedule.ok && schedule.body?.schedule?.[3]?.start === "10:00", {
  blocks: schedule.body?.schedule?.length,
});

const coach = await request("/api/coach", { method: "POST" }, 25000);
record(
  "coach",
  coach.ok && ["problem", "insight", "today_action", "motivation"].every((key) => typeof coach.body?.[key] === "string"),
  coach.body,
);

const plans = await request("/api/billing/plans");
record("plans", plans.ok && plans.body?.plans?.map((plan) => plan.id).join(",") === "FREE,PREMIUM,VIP", plans.body);

const checkout = await request("/api/billing/checkout", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    planId: "PREMIUM",
    successUrl: `${baseUrl}/?checkout=success`,
    cancelUrl: `${baseUrl}/?checkout=cancel`,
  }),
});
record("checkout boundary", [200, 501, 502].includes(checkout.status), {
  status: checkout.status,
  configured: checkout.status === 200,
});

const billingWebhook = await request("/api/billing/webhook", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ type: "checkout.session.completed" }),
});
record("billing webhook boundary", [200, 400, 501].includes(billingWebhook.status), {
  status: billingWebhook.status,
});

const providers = await request("/api/auth/providers");
record("auth providers", providers.ok && providers.body?.providers?.length === 3, providers.body);

const avatarUpload = await request("/api/assistant/avatar", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    fileName: "smoke-avatar.svg",
    contentType: "image/svg+xml",
    base64: Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"5\"/></svg>").toString("base64"),
  }),
});
record("assistant avatar storage boundary", [201, 501, 502].includes(avatarUpload.status), {
  status: avatarUpload.status,
  configured: avatarUpload.status === 201,
});

const oauth = await request("/api/auth/oauth", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ provider: "google", redirectTo: `${baseUrl}/auth/callback` }),
});
record("oauth boundary", [200, 501, 502].includes(oauth.status), { status: oauth.status });

const calendar = await fetch(`${baseUrl}/api/calendar/export`);
const calendarText = await calendar.text();
record("calendar export", calendar.ok && calendarText.includes("BEGIN:VCALENDAR"), { status: calendar.status });

const notification = await request("/api/notifications", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ title: "Smoke notification", message: "LifeOS smoke test notification" }),
});
record("notification create", notification.status === 201 && notification.body?.notification?.title === "Smoke notification", {
  status: notification.status,
});

const pushToken = await request("/api/push-token", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ token: `smoke-fcm-token-${Date.now()}`, platform: "web" }),
});
record("push token register", pushToken.status === 201 && pushToken.body?.pushToken?.provider === "fcm", {
  status: pushToken.status,
  encrypted: pushToken.body?.pushToken?.encrypted,
});

const pushTokens = await request("/api/push-token");
record("push token list", pushTokens.ok && Array.isArray(pushTokens.body?.tokens) && pushTokens.body.tokens.every((item) => item.tokenHash === undefined), {
  tokens: pushTokens.body?.tokens?.length,
  exposesHash: pushTokens.body?.tokens?.some((item) => item.tokenHash !== undefined),
});

const realtime = await request("/api/realtime/lifeos");
record("realtime contract", realtime.ok && realtime.body?.provider === "supabase" && Array.isArray(realtime.body?.events), {
  configured: realtime.body?.configured,
  channel: realtime.body?.channel,
});

const dailyJob = await request("/api/jobs/lifeos-daily-analysis", {
  method: "POST",
  headers: { "content-type": "application/json" },
});
record("daily analysis job boundary", [200, 401, 501].includes(dailyJob.status), {
  status: dailyJob.status,
  configured: dailyJob.status === 200,
});

const interventionDelivery = await request("/api/intervention/deliver", { method: "POST" });
record("intervention delivery boundary", interventionDelivery.ok && interventionDelivery.body?.delivery?.provider === "fcm" && interventionDelivery.body?.realtime?.event === "intervention.created", {
  delivered: interventionDelivery.body?.delivery?.delivered,
  reason: interventionDelivery.body?.delivery?.reason,
  realtime: interventionDelivery.body?.realtime?.reason,
});

const calendarSync = await request("/api/calendar/sync", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ provider: "google" }),
});
record("calendar sync boundary", [200, 501, 502].includes(calendarSync.status), { status: calendarSync.status });

const reward = await request("/api/character/reward", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ experience: 50, title: "Smoke reward" }),
});
record("character reward", reward.ok && reward.body?.assistant?.experience >= 0 && reward.body?.reward?.title === "Smoke reward", {
  level: reward.body?.assistant?.level,
});

const login = await request("/api/auth/lifeos", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: `smoke-${Date.now()}@lifeos.ai`, password: "password123", name: "Smoke" }),
});
const cookie = login.setCookie?.split(";")[0];
record("email login", login.ok && login.body?.authenticated === true && Boolean(cookie), {
  status: login.status,
  cookie: Boolean(cookie),
});

const session = await request("/api/auth/lifeos", {
  headers: { cookie },
});
record("session", session.ok && session.body?.authenticated === true, session.body);

const i18n = await request("/api/i18n/lifeos?locale=en");
record("i18n", i18n.ok && i18n.body?.messages?.appName === "LifeOS AI", i18n.body);

const workspaceFiles = [
  "apps/web/package.json",
  "apps/mobile/package.json",
  "packages/ui/package.json",
  "packages/types/package.json",
  "packages/utils/package.json",
  "packages/ai/package.json",
  "backend/database/schema.sql",
  "backend/functions/lifeos-daily-analysis/index.ts",
  "docs/lifeos-architecture.md",
];
record("workspace structure", workspaceFiles.every((path) => existsSync(path)), {
  missing: workspaceFiles.filter((path) => !existsSync(path)),
});

console.log(JSON.stringify({ ok: true, checks: results.length, results }, null, 2));
