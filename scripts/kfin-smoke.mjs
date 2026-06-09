import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const baseUrl = process.env.KFIN_BASE_URL ?? "http://127.0.0.1:3100";
const storePath = join(process.cwd(), "data", "kfin-terminal", "users.json");
const hadStore = existsSync(storePath);
const originalStore = hadStore ? readFileSync(storePath, "utf8") : null;

const allowedStatuses = new Set([
  "actual",
  "delayed",
  "api_required",
  "no_data",
  "permission_denied",
  "error",
]);

const results = [];

function record(name, ok, detail = {}) {
  results.push({ name, ok, detail });
  if (!ok) {
    throw new Error(`${name} failed: ${JSON.stringify(detail)}`);
  }
}

async function request(path, init = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal });
    const body = await res.json().catch(() => null);
    return { httpStatus: res.status, body, setCookie: res.headers.get("set-cookie") };
  } finally {
    clearTimeout(timeout);
  }
}

function statusOf(envelope) {
  return typeof envelope?.status === "string" ? envelope.status : null;
}

try {
  const page = await fetch(baseUrl, { method: "HEAD" });
  record("page", page.ok, { httpStatus: page.status });

  const market = await request("/api/market?symbols=AAPL,QQQ,KRW=X,005930.KS");
  record("market", market.httpStatus === 200 && Array.isArray(market.body?.quotes), {
    httpStatus: market.httpStatus,
    quotes: market.body?.quotes?.length,
  });
  record(
    "market quote statuses",
    market.body.quotes.every((quote) => allowedStatuses.has(quote.freshness?.status)),
    { statuses: market.body.quotes.map((quote) => quote.freshness?.status) },
  );

  const news = await request("/api/news?limit=3");
  record("news", news.httpStatus === 200 && allowedStatuses.has(statusOf(news.body)), {
    httpStatus: news.httpStatus,
    status: news.body?.status,
    rows: news.body?.data?.length,
  });

  const filings = await request("/api/filings?symbol=AAPL&limit=2");
  record("sec filings", filings.httpStatus === 200 && allowedStatuses.has(statusOf(filings.body)), {
    httpStatus: filings.httpStatus,
    status: filings.body?.status,
    rows: filings.body?.data?.length,
  });

  for (const [name, path] of [
    ["earnings", "/api/earnings?symbol=AAPL&limit=2"],
    ["options snapshot", "/api/options/snapshot?symbol=AAPL&limit=2"],
    ["rates", "/api/rates"],
    ["dart", "/api/dart?symbol=005930.KS&limit=2"],
  ]) {
    const response = await request(path);
    record(name, response.httpStatus === 200 && allowedStatuses.has(statusOf(response.body)), {
      httpStatus: response.httpStatus,
      status: response.body?.status,
    });
  }

  const orderStatus = await request("/api/orders");
  record("orders disabled", statusOf(orderStatus.body) === "permission_denied", {
    httpStatus: orderStatus.httpStatus,
    status: orderStatus.body?.status,
  });

  const noAuthPortfolio = await request("/api/portfolio/valuation");
  const noAuthAlerts = await request("/api/alerts/evaluate");
  record("private portfolio denied", noAuthPortfolio.httpStatus === 401 && statusOf(noAuthPortfolio.body) === "permission_denied", {
    httpStatus: noAuthPortfolio.httpStatus,
    status: noAuthPortfolio.body?.status,
  });
  record("private alerts denied", noAuthAlerts.httpStatus === 401 && statusOf(noAuthAlerts.body) === "permission_denied", {
    httpStatus: noAuthAlerts.httpStatus,
    status: noAuthAlerts.body?.status,
  });

  const email = `codex-smoke-${Date.now()}@example.com`;
  const login = await request("/api/auth/local", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "testpass123" }),
  });
  const cookie = login.setCookie?.split(";")[0];
  record("login", login.httpStatus === 200 && statusOf(login.body) === "actual" && Boolean(cookie), {
    httpStatus: login.httpStatus,
    status: login.body?.status,
    cookie: Boolean(cookie),
  });

  const save = await request("/api/user-state", {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      portfolio: [{ symbol: "AAPL", quantity: 1, averageCost: 100, currency: "USD" }],
      watchlist: ["AAPL", "QQQ", "005930.KS"],
      alerts: [{ id: "AAPL-price-below", symbol: "AAPL", metric: "price", operator: "below", value: 999999, enabled: true }],
      aiSettings: { primaryModel: "gpt", language: "ko", riskProfile: "balanced" },
      layout: { density: "compact", leftRail: true, rightRail: true },
    }),
  });
  record("user state save", save.httpStatus === 200 && statusOf(save.body) === "actual", {
    httpStatus: save.httpStatus,
    status: save.body?.status,
    portfolio: save.body?.data?.portfolio?.length,
    alerts: save.body?.data?.alerts?.length,
  });

  const valuation = await request("/api/portfolio/valuation", { headers: { cookie } });
  record("portfolio valuation", valuation.httpStatus === 200 && allowedStatuses.has(statusOf(valuation.body)) && valuation.body?.data?.positions?.length === 1, {
    httpStatus: valuation.httpStatus,
    status: valuation.body?.status,
    positions: valuation.body?.data?.positions?.length,
  });

  const alertRun = await request("/api/alerts/run", { method: "POST", headers: { cookie } });
  record("alert run", alertRun.httpStatus === 200 && allowedStatuses.has(statusOf(alertRun.body)) && alertRun.body?.data?.run?.totalCount === 1, {
    httpStatus: alertRun.httpStatus,
    status: alertRun.body?.status,
    total: alertRun.body?.data?.run?.totalCount,
    triggered: alertRun.body?.data?.run?.triggeredCount,
  });

  console.log(JSON.stringify({ ok: true, baseUrl, results }, null, 2));
} finally {
  if (hadStore && originalStore !== null) {
    mkdirSync(dirname(storePath), { recursive: true });
    writeFileSync(storePath, originalStore, "utf8");
  } else if (existsSync(storePath)) {
    unlinkSync(storePath);
  }
}
