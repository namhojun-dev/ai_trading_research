import type { ComparableCompany, CompanyProfile } from "./types";
import { scoreSimilarity, type SimilarityInput } from "./scoreSimilarity";
import { scoreValuation, qualityScore, type PeerAverages } from "./scoreValuation";

const TOP_N = 10;

export type RankResult = {
  kospi: ComparableCompany[];
  kosdaq: ComparableCompany[];
  warnings: string[];
  peerAverages: PeerAverages;
};

function average(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length === 0) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/**
 * 재무가 채워진 후보들에 대해 유사도·저평가·퀄리티·최종 점수를 코드로 계산하고
 * 코스피/코스닥으로 분리해 최종 점수 내림차순 정렬한다. LLM 판단은 개입하지 않는다.
 */
export function rankComparables(
  base: CompanyProfile,
  candidates: ComparableCompany[],
): RankResult {
  const warnings: string[] = [];

  // 동종 평균 (양수 PER/EPS 만으로 계산)
  const peer: PeerAverages = {
    per: average(candidates.map((c) => c.per).filter((x): x is number => x != null && x > 0)),
    eps: average(candidates.map((c) => c.eps).filter((x): x is number => x != null && x > 0)),
  };

  const baseInput: SimilarityInput = {
    sector: base.sector,
    industry: base.industry,
    mainProducts: base.mainProducts,
    businessSummary: base.businessSummary,
    marketCap: base.metrics.marketCap,
    operatingMargin: base.metrics.operatingMargin,
  };

  let missingFinancials = 0;

  const scored = candidates.map((c) => {
    const similarityScore = scoreSimilarity(baseInput, {
      sector: c.sector,
      industry: c.industry,
      mainProducts: c.mainProducts,
      businessSummary: (c.mainProducts ?? []).join(" "),
      marketCap: c.marketCap,
      operatingMargin: c.operatingMargin,
    });

    if (c.dataStatus.financials === "missing") missingFinancials++;

    const { valuationScore, reason: vReason } = scoreValuation(c, peer);
    const quality = qualityScore(c);

    const finalScore = Math.round(
      similarityScore * 0.4 + valuationScore * 0.45 + quality * 0.15,
    );

    let reason = vReason;
    if (c.dataStatus.financials === "missing") {
      reason = "재무 데이터 없음 (계산 불가) — 유사도만 반영";
    } else if (c.dataStatus.financials === "partial") {
      reason = `부분 데이터 · ${vReason}`;
    }

    return {
      ...c,
      similarityScore,
      valuationScore,
      qualityScore: quality,
      finalScore,
      reason,
    } satisfies ComparableCompany;
  });

  const split = (mk: "KOSPI" | "KOSDAQ") =>
    scored
      .filter((c) => c.market === mk)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, TOP_N)
      .map((c, i) => ({ ...c, rank: i + 1 }));

  const kospi = split("KOSPI");
  const kosdaq = split("KOSDAQ");

  if (missingFinancials > 0) {
    warnings.push(
      `${missingFinancials}개 후보의 재무 지표를 가져오지 못해 저평가 점수에서 불리하게 처리됨 (가짜값 없음).`,
    );
  }
  if (peer.per == null) {
    warnings.push("동종 평균 PER을 계산할 수 있는 유효 데이터가 부족합니다.");
  }
  if (kospi.length === 0) warnings.push("코스피 유사 종목 후보를 찾지 못했습니다.");
  if (kosdaq.length === 0) warnings.push("코스닥 유사 종목 후보를 찾지 못했습니다.");

  return { kospi, kosdaq, warnings, peerAverages: peer };
}
