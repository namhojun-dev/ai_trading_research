export type SimilarityInput = {
  sector?: string;
  industry?: string;
  mainProducts?: string[];
  businessSummary?: string;
  marketCap?: number | null;
  operatingMargin?: number | null;
};

function norm(s?: string | null): string {
  return (s ?? "").trim().toLowerCase();
}

function tokenize(s?: string | null): Set<string> {
  if (!s) return new Set();
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2),
  );
}

/**
 * 제품 키워드 매칭 비율. "2차전지" ~ "2차전지소재", "반도체" ~ "반도체장비" 는 연결하되,
 * 짧은 2글자 토큰의 부분일치는 오매칭(예: "마트" ⊂ "스마트폰")을 막기 위해 제외하고
 * 정확일치만 허용한다. 부분일치는 두 토큰이 모두 3글자 이상일 때만 적용.
 */
export function productOverlap(a: string[] = [], b: string[] = []): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bn = b.map(norm).filter((y) => y.length >= 2);
  const related = (x: string, y: string): boolean => {
    if (x === y) return true; // 정확일치 (길이 무관: 철강·정유·조선 등 2글자 허용)
    if (x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x))) return true;
    return false;
  };
  let hit = 0;
  for (const x of a.map(norm)) {
    if (x.length < 2) continue;
    if (bn.some((y) => related(x, y))) hit++;
  }
  return hit / Math.max(a.length, b.length);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** 시가총액 규모 유사도: 같은 자릿수일수록 1에 가깝다. */
function marketCapCloseness(a?: number | null, b?: number | null): number {
  if (a == null || b == null || a <= 0 || b <= 0) return 0;
  const ratio = Math.min(a, b) / Math.max(a, b);
  return ratio; // 0..1
}

/**
 * 유사도 점수 (0~100). 가중치는 RPD 명세를 따른다.
 *   업종 25 · 산업 20 · 주요제품 20 · 사업키워드 15 · 시총규모 10 · 재무구조 10
 * 후보 단계(재무 미조회)에서는 시총/재무 항목이 0으로 계산되고, 랭킹 단계에서
 * 재무가 채워지면 정확히 재계산된다.
 */
export function scoreSimilarity(base: SimilarityInput, cand: SimilarityInput): number {
  const sectorScore = base.sector && cand.sector && norm(base.sector) === norm(cand.sector) ? 100 : 0;

  let industryScore = 0;
  if (base.industry && cand.industry) {
    if (norm(base.industry) === norm(cand.industry)) industryScore = 100;
    else {
      const ji = jaccard(tokenize(base.industry), tokenize(cand.industry));
      industryScore = Math.round(ji * 100);
    }
  }

  const productScore = Math.round(productOverlap(base.mainProducts, cand.mainProducts) * 100);

  const keywordSet = (x: SimilarityInput) => {
    const t = tokenize(x.businessSummary);
    for (const p of x.mainProducts ?? []) for (const w of tokenize(p)) t.add(w);
    return t;
  };
  const keywordScore = Math.round(jaccard(keywordSet(base), keywordSet(cand)) * 100);

  const marketCapScore = Math.round(marketCapCloseness(base.marketCap, cand.marketCap) * 100);

  let financialStructureScore = 0;
  if (base.operatingMargin != null && cand.operatingMargin != null) {
    const diff = Math.abs(base.operatingMargin - cand.operatingMargin);
    financialStructureScore = Math.max(0, Math.round((1 - Math.min(diff, 30) / 30) * 100));
  }

  const score =
    sectorScore * 0.25 +
    industryScore * 0.2 +
    productScore * 0.2 +
    keywordScore * 0.15 +
    marketCapScore * 0.1 +
    financialStructureScore * 0.1;

  return Math.round(score);
}
