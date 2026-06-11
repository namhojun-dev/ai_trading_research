import { promises as fs } from "node:fs";
import path from "node:path";
import { normalizeTicker } from "./normalizeTicker";
import { fetchCompanyProfile } from "./fetchCompanyProfile";
import { fetchKoreanUniverse } from "./fetchKoreanUniverse";
import { findSimilarCompanies } from "./findSimilarCompanies";
import { fetchFinancialMetrics, resetYahooCredentials } from "./fetchFinancialMetrics";
import { rankComparables } from "./rankComparables";
import { generateComparableSummary } from "./generateComparableSummary";
import { isDartEnabled } from "./dart";
import {
  ComparableRejection,
  type ComparableApiResponse,
  type ComparableCompany,
} from "./types";

const CACHE_DIR = path.join(process.cwd(), "data", "comparables");
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6시간

const ETF_MESSAGE =
  "ETF는 기업 PER·EPS 비교 대상이 아닙니다. ETF 비교는 구성 종목, 보수, 거래량, 추적오차, 괴리율, 변동성 기준으로 별도 처리해야 합니다.";

type CacheFile = {
  ticker: string;
  generatedAt: string;
  expiresAt: string;
  result: ComparableApiResponse;
};

async function readCache(code: string): Promise<ComparableApiResponse | null> {
  try {
    const raw = await fs.readFile(path.join(CACHE_DIR, `${code}.json`), "utf8");
    const parsed = JSON.parse(raw) as CacheFile;
    if (new Date(parsed.expiresAt).getTime() > Date.now()) {
      return parsed.result;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeCache(code: string, result: ComparableApiResponse): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const now = Date.now();
    const file: CacheFile = {
      ticker: code,
      generatedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + CACHE_TTL_MS).toISOString(),
      result,
    };
    await fs.writeFile(path.join(CACHE_DIR, `${code}.json`), JSON.stringify(file, null, 2), "utf8");
  } catch {
    // 캐시 쓰기 실패는 치명적이지 않음
  }
}

function isEtfLike(name: string, quoteType?: string | null): boolean {
  if (quoteType && ["etf", "mutualfund", "etn"].includes(quoteType.toLowerCase())) return true;
  return /\b(etf|etn)\b|kodex|tiger|kbstar|arirang|hanaro|kosef|sol |timefolio|스팩|기업인수목적/i.test(
    name,
  );
}

/** 우선주 이름 패턴: '...우', '...우B', '...우(전환)'. 보통주는 해당 없음. */
function isPreferred(name: string): boolean {
  return /우(B|\(전환\))?$/.test(name.trim());
}

export async function getComparableValuation(
  inputTicker: string,
): Promise<ComparableApiResponse> {
  resetYahooCredentials();
  const normalized = normalizeTicker(inputTicker);

  // 캐시 우선
  const cached = await readCache(normalized.ticker);
  if (cached) return cached;

  const baseCompany = await fetchCompanyProfile(normalized);

  // ETF/ETN/스팩 차단 (이름·quoteType 기반)
  if (isEtfLike(baseCompany.name, baseCompany.quoteType)) {
    throw new ComparableRejection(ETF_MESSAGE, "etf");
  }
  // 우선주 차단: 이름('...우') 또는 코드 끝자리(보통주=0, 우선주=5/7/9).
  // 미존재 티커는 fetchCompanyProfile 에서 먼저 not-found 로 걸러진다.
  const code6 = /^\d{6}$/.test(baseCompany.code) ? baseCompany.code : null;
  const preferredByCode = code6 != null && /[579]$/.test(code6);
  if (isPreferred(baseCompany.name) || preferredByCode) {
    throw new ComparableRejection(
      "우선주는 기업 재무제표 비교 대상이 아닙니다. 보통주로 입력하세요.",
      "preferred",
    );
  }

  const warnings: string[] = [];
  if (baseCompany.market === "UNKNOWN") {
    warnings.push("기준 종목의 상장 시장(코스피/코스닥)을 확인하지 못했습니다.");
  }
  if (!baseCompany.sector) {
    warnings.push("기준 종목의 업종 정보를 확인하지 못해 유사 종목 탐색 정확도가 낮을 수 있습니다.");
  }

  const universe = await fetchKoreanUniverse();
  const candidates = await findSimilarCompanies(baseCompany, universe);

  // 후보 재무 지표 조회 (코드+시장 → Yahoo 심볼)
  const enriched: ComparableCompany[] = await Promise.all(
    candidates.map(async (c) => {
      const symbol = `${c.ticker}.${c.market === "KOSPI" ? "KS" : "KQ"}`;
      const m = await fetchFinancialMetrics(symbol);
      return {
        ...c,
        price: m.price,
        marketCap: m.marketCap,
        per: m.per,
        eps: m.eps,
        pbr: m.pbr,
        roe: m.roe,
        revenueGrowthYoY: m.revenueGrowthYoY,
        operatingMargin: m.operatingMargin,
        netMargin: m.netMargin,
        dataStatus: { price: m.priceStatus, financials: m.financialsStatus },
      } satisfies ComparableCompany;
    }),
  );

  const ranked = rankComparables(baseCompany, enriched);

  // 기준 종목을 ComparableCompany 형태로 변환
  const baseAsComparable: ComparableCompany = {
    ticker: baseCompany.code,
    name: baseCompany.name,
    market: baseCompany.market,
    sector: baseCompany.sector,
    industry: baseCompany.industry,
    businessSummary: baseCompany.businessSummary,
    mainProducts: baseCompany.mainProducts,
    price: baseCompany.metrics.price,
    marketCap: baseCompany.metrics.marketCap,
    per: baseCompany.metrics.per,
    eps: baseCompany.metrics.eps,
    pbr: baseCompany.metrics.pbr,
    roe: baseCompany.metrics.roe,
    revenueGrowthYoY: baseCompany.metrics.revenueGrowthYoY,
    operatingMargin: baseCompany.metrics.operatingMargin,
    netMargin: baseCompany.metrics.netMargin,
    similarityScore: 100,
    valuationScore: 0,
    qualityScore: 0,
    finalScore: 0,
    reason: "기준 종목",
    dataStatus: {
      price: baseCompany.metrics.priceStatus,
      financials: baseCompany.metrics.financialsStatus,
    },
  };

  const summary = await generateComparableSummary({
    baseCompany,
    kospi: ranked.kospi,
    kosdaq: ranked.kosdaq,
  });

  const response: ComparableApiResponse = {
    ok: true,
    ticker: normalized.ticker,
    companyName: baseCompany.name,
    baseCompany: baseAsComparable,
    kospi: ranked.kospi,
    kosdaq: ranked.kosdaq,
    summary,
    generatedAt: new Date().toISOString(),
    dataSource: {
      price: "Yahoo Finance",
      financials: isDartEnabled()
        ? "OpenDART(전자공시) + Yahoo 폴백"
        : baseCompany.metrics.financialsStatus === "missing"
          ? "Yahoo Finance (일부 조회 실패)"
          : "Yahoo Finance",
      sector: "Yahoo Finance / 로컬 종목 유니버스",
    },
    warnings: [...warnings, ...ranked.warnings],
  };

  await writeCache(normalized.ticker, response);
  return response;
}
