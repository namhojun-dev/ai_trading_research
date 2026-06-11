import type { ComparableCompany, CompanyProfile, UniverseEntry } from "./types";
import { scoreSimilarity, productOverlap, type SimilarityInput } from "./scoreSimilarity";

const MAX_PER_MARKET = 12; // 재무 조회 횟수를 제한하기 위한 시장별 후보 상한

// 한 섹터 안에 이질적인 업종이 섞이는 "광범위" 섹터. 이 섹터에서는 같은 섹터라는
// 이유만으로 후보에 넣지 않고, 업종 일치 또는 제품 공통점을 추가로 요구한다.
// (예: Industrials 안의 2차전지 vs 방산 vs 조선)
const BROAD_SECTORS = new Set([
  "industrials",
  "basic materials",
  "consumer cyclical",
  "consumer defensive",
  "financial services",
  "communication services", // 게임 + 통신 + 인터넷 + 엔터가 한 섹터에 섞임
]);

const norm = (s?: string) => (s ?? "").trim().toLowerCase();

function stub(entry: UniverseEntry, preScore: number): ComparableCompany {
  return {
    ticker: entry.code,
    name: entry.name,
    market: entry.market,
    sector: entry.sector,
    industry: entry.industry,
    mainProducts: entry.mainProducts,
    price: null,
    marketCap: null,
    per: null,
    eps: null,
    pbr: null,
    roe: null,
    revenueGrowthYoY: null,
    operatingMargin: null,
    netMargin: null,
    similarityScore: preScore,
    valuationScore: 0,
    qualityScore: 0,
    finalScore: 0,
    reason: "",
    dataStatus: { price: "missing", financials: "missing" },
  };
}

/**
 * 유니버스에서 기준 기업과 유사한 후보를 골라낸다. 이 단계는 메타데이터(업종/산업/
 * 제품)만으로 사전 점수를 매겨 시장별 상위 후보만 추린다. 정확한 유사도/저평가
 * 점수는 재무 조회 후 rankComparables 에서 다시 계산한다.
 */
export async function findSimilarCompanies(
  base: CompanyProfile,
  universe: UniverseEntry[],
): Promise<ComparableCompany[]> {
  const baseInput: SimilarityInput = {
    sector: base.sector,
    industry: base.industry,
    mainProducts: base.mainProducts,
    businessSummary: base.businessSummary,
    // 사전 단계에서는 시총/재무를 제외(후보 재무 미조회) → 메타데이터 위주
  };

  const baseSector = norm(base.sector);
  const baseIndustry = norm(base.industry);

  const relevant = (e: UniverseEntry): boolean => {
    const sameSector = baseSector !== "" && norm(e.sector) === baseSector;
    const sameIndustry = baseIndustry !== "" && norm(e.industry) === baseIndustry;
    const productHit = productOverlap(base.mainProducts, e.mainProducts) > 0;
    if (sameIndustry || productHit) return true;
    // 같은 섹터지만 광범위 섹터라면 업종/제품 공통점 없이는 제외
    if (sameSector && !BROAD_SECTORS.has(baseSector)) return true;
    return false;
  };

  const scored = universe
    .filter((e) => e.code !== base.code && relevant(e)) // 자기 자신 제외 + 관련성 필터
    .map((e) => {
      const pre = scoreSimilarity(baseInput, {
        sector: e.sector,
        industry: e.industry,
        mainProducts: e.mainProducts,
        businessSummary: e.mainProducts.join(" "),
      });
      return { entry: e, pre };
    })
    .filter((x) => x.pre > 0);

  const byMarket = (mk: "KOSPI" | "KOSDAQ") =>
    scored
      .filter((x) => x.entry.market === mk)
      .sort((a, b) => b.pre - a.pre)
      .slice(0, MAX_PER_MARKET)
      .map((x) => stub(x.entry, x.pre));

  return [...byMarket("KOSPI"), ...byMarket("KOSDAQ")];
}
