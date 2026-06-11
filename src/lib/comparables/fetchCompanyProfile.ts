import type { CompanyProfile, MarketType, NormalizedTicker } from "./types";
import { fetchYahooData, enrichWithDart } from "./fetchFinancialMetrics";
import { findUniverseByCode } from "./fetchKoreanUniverse";

function marketFromSymbol(symbol: string): MarketType {
  if (symbol.endsWith(".KS")) return "KOSPI";
  if (symbol.endsWith(".KQ")) return "KOSDAQ";
  return "UNKNOWN";
}

/**
 * 기준 기업 프로필을 조회한다. 정규화된 후보 심볼들을 순서대로 시도하여
 * 가격이 잡히는 첫 심볼을 채택한다. 가격이 전혀 안 잡히면 그래도 첫 후보를
 * 기준으로 반환하되 dataStatus 를 missing 으로 표시한다(가짜값 없음).
 */
export async function fetchCompanyProfile(
  normalized: NormalizedTicker,
): Promise<CompanyProfile> {
  const candidates = normalized.candidates;
  if (candidates.length === 0) {
    throw new Error(
      `'${normalized.input}'에 해당하는 종목을 찾을 수 없습니다. 6자리 코드(예: 005930) 또는 등록된 회사명으로 입력하세요.`,
    );
  }

  const isFundType = (q?: string | null) =>
    q != null && ["etf", "mutualfund", "etn", "fund"].includes(q.toLowerCase());
  // 가격이 있고 펀드/ETF가 아닌(=기업) 후보가 가장 바람직
  const good = (m: Awaited<ReturnType<typeof fetchYahooData>>) =>
    m.priceStatus === "ok" && !isFundType(m.quoteType);

  let chosenSymbol = candidates[0];
  let metrics = await fetchYahooData(chosenSymbol);

  // 첫 후보가 기업이 아니거나 가격이 없으면 다음 후보 시도 (반대 시장 코드의 펀드 충돌 회피)
  if (!good(metrics) && candidates.length > 1) {
    for (const sym of candidates.slice(1)) {
      const m = await fetchYahooData(sym);
      if (good(m)) {
        chosenSymbol = sym;
        metrics = m;
        break;
      }
    }
  }

  const code = chosenSymbol.replace(/\.(KS|KQ)$/, "");
  const universe = findUniverseByCode(code);

  // 가격도 없고 이름도 못 받았고 유니버스에도 없으면 → 존재하지 않는 종목으로 판단
  if (metrics.priceStatus !== "ok" && !metrics.name && !universe) {
    throw new Error(
      `'${normalized.input}' 종목을 찾을 수 없습니다. 상장폐지되었거나 잘못된 코드일 수 있습니다.`,
    );
  }

  // 기준 종목 재무를 DART 로 보강 (한국 종목 + 키 존재 시)
  metrics = await enrichWithDart(chosenSymbol, metrics);

  const market: MarketType =
    marketFromSymbol(chosenSymbol) !== "UNKNOWN"
      ? marketFromSymbol(chosenSymbol)
      : universe?.market ?? "UNKNOWN";

  const name =
    metrics.name ?? normalized.resolvedName ?? universe?.name ?? normalized.ticker;

  return {
    ticker: chosenSymbol,
    code,
    name,
    market,
    sector: metrics.sector ?? universe?.sector ?? undefined,
    industry: metrics.industry ?? universe?.industry ?? undefined,
    businessSummary: metrics.businessSummary ?? undefined,
    mainProducts: universe?.mainProducts ?? undefined,
    quoteType: metrics.quoteType ?? undefined,
    metrics,
  };
}
