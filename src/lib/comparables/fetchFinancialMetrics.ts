import { fetchWithTimeout } from "@/lib/data/fetch";
import type { FinancialMetrics } from "./types";
import { getDartMetrics, isDartEnabled, type DartMetrics } from "./dart";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

/** 한 요청(getComparableValuation 1회) 동안 crumb/cookie를 재사용하기 위한 모듈 캐시. */
let crumbCache: { crumb: string; cookie: string } | null = null;

async function getCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (crumbCache) return crumbCache;
  try {
    // 1) 쿠키 획득
    const seed = await fetchWithTimeout(
      "https://fc.yahoo.com",
      { headers: { "User-Agent": UA } },
      6000,
    ).catch(() => null);

    let cookie = "";
    if (seed) {
      const setCookie =
        // Node/undici: getSetCookie() 우선, 폴백으로 get('set-cookie')
        (seed.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ??
        (seed.headers.get("set-cookie") ? [seed.headers.get("set-cookie") as string] : []);
      cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
    }

    // 2) crumb 획득
    const res = await fetchWithTimeout(
      "https://query2.finance.yahoo.com/v1/test/getcrumb",
      { headers: { "User-Agent": UA, Accept: "text/plain", Cookie: cookie } },
      6000,
    );
    if (!res.ok) return null;
    const crumb = (await res.text()).trim();
    if (!crumb || crumb.includes("<")) return null;

    crumbCache = { crumb, cookie };
    return crumbCache;
  } catch {
    return null;
  }
}

/** Yahoo quoteSummary 응답에서 raw 숫자만 안전하게 추출. */
function num(node: unknown): number | null {
  if (node == null) return null;
  if (typeof node === "number") return Number.isFinite(node) ? node : null;
  if (typeof node === "object" && "raw" in (node as Record<string, unknown>)) {
    const raw = (node as { raw?: unknown }).raw;
    return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  }
  return null;
}

function str(node: unknown): string | null {
  return typeof node === "string" && node.trim() ? node.trim() : null;
}

const EMPTY = (): FinancialMetrics => ({
  price: null,
  marketCap: null,
  per: null,
  eps: null,
  pbr: null,
  roe: null,
  revenueGrowthYoY: null,
  operatingMargin: null,
  netMargin: null,
  quoteType: null,
  currency: null,
  priceStatus: "missing",
  financialsStatus: "missing",
});

/**
 * Yahoo Finance quoteSummary로 가격 + 재무 지표를 조회한다.
 * 실패하거나 일부만 있으면 가짜값 없이 missing/partial 로 표시한다.
 */
export async function fetchYahooData(symbol: string): Promise<FinancialMetrics> {
  const cred = await getCrumb();
  const base = EMPTY();
  if (!cred) return base; // crumb 실패 → 전부 missing (가짜값 없음)

  const modules = [
    "price",
    "summaryDetail",
    "defaultKeyStatistics",
    "financialData",
    "assetProfile",
  ].join(",");

  const url =
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
    `?modules=${modules}&crumb=${encodeURIComponent(cred.crumb)}`;

  let json: Record<string, unknown>;
  try {
    const res = await fetchWithTimeout(
      url,
      { headers: { "User-Agent": UA, Accept: "application/json", Cookie: cred.cookie } },
      8000,
    );
    if (!res.ok) return base;
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return base;
  }

  const result = (json?.quoteSummary as { result?: Record<string, unknown>[] } | undefined)
    ?.result?.[0];
  if (!result) return base;

  const price = result.price as Record<string, unknown> | undefined;
  const summaryDetail = result.summaryDetail as Record<string, unknown> | undefined;
  const keyStats = result.defaultKeyStatistics as Record<string, unknown> | undefined;
  const financialData = result.financialData as Record<string, unknown> | undefined;
  const assetProfile = result.assetProfile as Record<string, unknown> | undefined;

  const priceVal = num(price?.regularMarketPrice);
  const per = num(summaryDetail?.trailingPE) ?? num(keyStats?.trailingPE);
  const eps = num(keyStats?.trailingEps);
  const pbr = num(keyStats?.priceToBook) ?? num(summaryDetail?.priceToBook);
  const roeRaw = num(financialData?.returnOnEquity);
  const opMarginRaw = num(financialData?.operatingMargins);
  const netMarginRaw = num(financialData?.profitMargins);
  const revGrowthRaw = num(financialData?.revenueGrowth);

  const financialFields = [per, eps, pbr, roeRaw, opMarginRaw, revGrowthRaw];
  const present = financialFields.filter((v) => v != null).length;
  const financialsStatus =
    present === 0 ? "missing" : present >= 4 ? "ok" : "partial";

  return {
    name: str(price?.longName) ?? str(price?.shortName),
    sector: str(assetProfile?.sector),
    industry: str(assetProfile?.industry),
    businessSummary: str(assetProfile?.longBusinessSummary),
    price: priceVal,
    marketCap: num(price?.marketCap) ?? num(summaryDetail?.marketCap),
    per,
    eps,
    pbr,
    roe: roeRaw != null ? roeRaw * 100 : null,
    revenueGrowthYoY: revGrowthRaw != null ? revGrowthRaw * 100 : null,
    operatingMargin: opMarginRaw != null ? opMarginRaw * 100 : null,
    netMargin: netMarginRaw != null ? netMarginRaw * 100 : null,
    quoteType: str(price?.quoteType),
    currency: str(price?.currency),
    priceStatus: priceVal != null ? "ok" : "missing",
    financialsStatus,
  };
}

/**
 * Yahoo 가격 + DART 재무를 병합한다. 한국 코드(.KS/.KQ)이고 DART_API_KEY 가 있으면
 * PER·EPS·PBR·ROE·영업이익률·매출성장률을 DART 값으로 채운다(가격은 Yahoo 유지).
 */
export function mergeDart(yahoo: FinancialMetrics, dart: DartMetrics): FinancialMetrics {
  const per =
    yahoo.price != null && dart.eps != null && dart.eps > 0
      ? yahoo.price / dart.eps
      : yahoo.per;
  const pbr =
    yahoo.price != null && dart.bps != null && dart.bps > 0
      ? yahoo.price / dart.bps
      : yahoo.pbr;

  const merged: FinancialMetrics = {
    ...yahoo,
    per,
    eps: dart.eps ?? yahoo.eps,
    pbr,
    roe: dart.roe ?? yahoo.roe,
    operatingMargin: dart.operatingMargin ?? yahoo.operatingMargin,
    netMargin: dart.netMargin ?? yahoo.netMargin,
    revenueGrowthYoY: dart.revenueGrowthYoY ?? yahoo.revenueGrowthYoY,
  };

  const present = [
    merged.per,
    merged.eps,
    merged.pbr,
    merged.roe,
    merged.operatingMargin,
    merged.revenueGrowthYoY,
  ].filter((v) => v != null).length;
  merged.financialsStatus = present === 0 ? "missing" : present >= 4 ? "ok" : "partial";

  return merged;
}

/** Yahoo 메트릭에 DART 를 덧입힌다(한국 종목 한정). */
export async function enrichWithDart(
  symbol: string,
  yahoo: FinancialMetrics,
): Promise<FinancialMetrics> {
  const m = symbol.match(/^(\d{6})\.(KS|KQ)$/);
  if (!m || !isDartEnabled()) return yahoo;
  const dart = await getDartMetrics(m[1]).catch(() => null);
  return dart ? mergeDart(yahoo, dart) : yahoo;
}

/** 후보 종목의 재무 지표 조회 (Yahoo + DART 병합). orchestrator enrich 단계에서 사용. */
export async function fetchFinancialMetrics(symbol: string): Promise<FinancialMetrics> {
  const yahoo = await fetchYahooData(symbol);
  return enrichWithDart(symbol, yahoo);
}

/** 새 요청 시작 시 crumb 캐시를 비운다 (장시간 프로세스에서 만료 대비). */
export function resetYahooCredentials(): void {
  crumbCache = null;
}
