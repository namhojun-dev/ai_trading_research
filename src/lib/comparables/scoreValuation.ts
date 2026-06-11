import type { ComparableCompany } from "./types";

export type PeerAverages = {
  per: number | null;
  eps: number | null;
};

/** PER 점수 (0~90). 음수/적자/무PER 은 0. RPD 13-3 사다리. */
export function perScore(per: number | null | undefined): number {
  if (per == null) return 0;
  if (per <= 0) return 0;
  if (per < 5) return 90;
  if (per < 10) return 80;
  if (per < 15) return 65;
  if (per < 20) return 50;
  if (per < 30) return 35;
  return 20;
}

/** EPS 점수 (0~80). 적자/무EPS 0, 동종평균 초과 80, 양수 50. RPD 13-4. */
export function epsScore(eps: number | null | undefined, peerEps: number | null): number {
  if (eps == null) return 0;
  if (eps <= 0) return 0;
  if (peerEps != null && peerEps > 0) return eps > peerEps ? 80 : 50;
  return 50; // 비교 기준 없으면 양수만으로 중립 점수
}

function roeScore(roe: number | null | undefined): number {
  if (roe == null) return 0;
  if (roe < 0) return 0;
  if (roe < 5) return 30;
  if (roe < 8) return 50;
  if (roe < 12) return 70;
  if (roe < 18) return 85;
  return 95;
}

function operatingMarginScore(m: number | null | undefined): number {
  if (m == null) return 0;
  if (m < 0) return 0;
  if (m < 5) return 40;
  if (m < 10) return 60;
  if (m < 15) return 75;
  if (m < 20) return 85;
  return 95;
}

function revenueGrowthScore(g: number | null | undefined): number {
  if (g == null) return 0;
  if (g < 0) return 20;
  if (g < 5) return 45;
  if (g < 10) return 65;
  if (g < 20) return 80;
  return 90;
}

/** PBR 부담 점수 (0~90). 낮을수록 높음. 무PBR/음수 0. */
function pbrScore(pbr: number | null | undefined): number {
  if (pbr == null) return 0;
  if (pbr <= 0) return 0;
  if (pbr < 1) return 90;
  if (pbr < 1.5) return 80;
  if (pbr < 2) return 65;
  if (pbr < 3) return 50;
  if (pbr < 5) return 35;
  return 20;
}

/** 사업 퀄리티 점수 (0~100): ROE·영업이익률·EPS 양수 여부 결합. */
export function qualityScore(c: Pick<ComparableCompany, "roe" | "operatingMargin" | "eps">): number {
  const r = roeScore(c.roe);
  const o = operatingMarginScore(c.operatingMargin);
  const e = c.eps != null && c.eps > 0 ? 100 : 0;
  return Math.round(r * 0.4 + o * 0.4 + e * 0.2);
}

export type ValuationResult = {
  valuationScore: number;
  reason: string;
};

/**
 * 저평가 점수 (0~100). RPD 13-2 가중치:
 *   PER 30 · EPS 20 · ROE 15 · 영업이익률 15 · 매출성장 10 · PBR 10
 * PER 이 없거나 적자(<=0)면 점수 0 + 사유 명시 (RPD 20).
 */
export function scoreValuation(c: ComparableCompany, peer: PeerAverages): ValuationResult {
  if (c.per == null || c.per <= 0) {
    return {
      valuationScore: 0,
      reason:
        c.per == null
          ? "PER 데이터가 없어 저평가 점수 계산에서 제외됨 (데이터 없음)"
          : "PER이 음수(적자)라 저평가 점수 계산에서 제외됨",
    };
  }

  const ps = perScore(c.per);
  const es = epsScore(c.eps, peer.eps);
  const rs = roeScore(c.roe);
  const os = operatingMarginScore(c.operatingMargin);
  const gs = revenueGrowthScore(c.revenueGrowthYoY);
  const bs = pbrScore(c.pbr);

  // 동종 평균 PER 대비 할인율 보너스 (최대 +10, PER 사다리 점수에 가산)
  let perAdjusted = ps;
  if (peer.per != null && peer.per > 0) {
    const discount = (peer.per - c.per) / peer.per; // 양수면 평균보다 저렴
    perAdjusted = Math.max(0, Math.min(100, ps + Math.round(discount * 20)));
  }

  const valuationScore = Math.round(
    perAdjusted * 0.3 + es * 0.2 + rs * 0.15 + os * 0.15 + gs * 0.1 + bs * 0.1,
  );

  const drivers: string[] = [];
  if (perAdjusted >= 65) drivers.push("PER 부담이 낮음");
  else if (perAdjusted <= 35) drivers.push("PER이 높은 편");
  if (es >= 80) drivers.push("EPS가 동종평균 대비 높음");
  if (rs >= 70) drivers.push("ROE 양호");
  if (os >= 75) drivers.push("영업이익률 양호");
  if (bs >= 80) drivers.push("PBR 부담 낮음");
  if (c.eps != null && c.eps <= 0) drivers.push("EPS 적자");

  const reason = drivers.length > 0 ? drivers.join(", ") : "지표가 중립 범위";

  return { valuationScore, reason };
}
