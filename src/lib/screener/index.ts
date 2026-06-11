import { promises as fs } from "node:fs";
import path from "node:path";
import { getKoreanUniverse } from "@/lib/comparables/fetchKoreanUniverse";
import {
  fetchFinancialMetrics,
  resetYahooCredentials,
} from "@/lib/comparables/fetchFinancialMetrics";
import { scoreValuation, qualityScore, type PeerAverages } from "@/lib/comparables/scoreValuation";
import { isDartEnabled } from "@/lib/comparables/dart";
import type { ComparableCompany, MarketType, UniverseEntry } from "@/lib/comparables/types";

/** Yahoo 섹터(영문) → 한국어 라벨. */
export const SECTOR_LABELS: Record<string, string> = {
  Technology: "기술 · IT · 반도체",
  Healthcare: "헬스케어 · 제약 · 바이오",
  "Financial Services": "금융 · 증권 · 보험",
  "Consumer Cyclical": "경기소비재 · 유통 · 자동차",
  "Consumer Defensive": "필수소비재 · 식품 · 화장품",
  "Basic Materials": "소재 · 화학 · 철강",
  Industrials: "산업재 · 기계 · 조선 · 건설",
  "Communication Services": "커뮤니케이션 · 게임 · 통신 · 엔터",
  Energy: "에너지",
  Utilities: "유틸리티",
};

/** Yahoo 업종(영문) → 한국어 라벨. 없으면 원문 사용. */
export const INDUSTRY_LABELS: Record<string, string> = {
  "Consumer Electronics": "가전 · 전자",
  Semiconductors: "반도체",
  "Electronic Components": "전자부품",
  "Information Technology Services": "IT 서비스",
  "Semiconductor Equipment & Materials": "반도체 장비·소재",
  "Scientific & Technical Instruments": "계측 · 정밀기기",
  "Software—Application": "응용 SW",
  "Software—Infrastructure": "인프라 SW",
  "Drug Manufacturers—General": "제약 (대형)",
  "Drug Manufacturers—Specialty & Generic": "제약 (전문·제네릭)",
  Biotechnology: "바이오텍",
  "Medical Devices": "의료기기",
  "Banks—Regional": "은행",
  "Capital Markets": "증권",
  "Insurance—Life": "생명보험",
  "Insurance—Property & Casualty": "손해보험",
  "Insurance—Diversified": "종합보험 · 금융",
  "Auto Manufacturers": "완성차",
  "Auto Parts": "자동차부품",
  "Department Stores": "백화점 · 유통",
  Lodging: "호텔 · 레저",
  "Household & Personal Products": "화장품 · 생활용품",
  "Packaged Foods": "식품",
  "Beverages—Non-Alcoholic": "음료",
  "Beverages—Wineries & Distilleries": "주류",
  "Grocery Stores": "편의점 · 마트",
  Confectioners: "제과",
  Steel: "철강",
  "Specialty Chemicals": "화학 · 소재",
  "Other Industrial Metals & Mining": "비철금속",
  "Electrical Equipment & Parts": "전기 · 중전기",
  "Specialty Industrial Machinery": "조선 · 기계",
  "Aerospace & Defense": "항공 · 방산",
  Railroads: "철도",
  "Engineering & Construction": "건설",
  "Integrated Freight & Logistics": "물류",
  "Farm & Heavy Construction Machinery": "건설기계",
  "Internet Content & Information": "인터넷 · 플랫폼",
  "Electronic Gaming & Multimedia": "게임",
  Entertainment: "엔터 · 콘텐츠",
  "Telecom Services": "통신",
  "Advertising Agencies": "광고",
  "Oil & Gas Refining & Marketing": "정유",
};

export const industryLabel = (industry: string): string => INDUSTRY_LABELS[industry] ?? industry;

export type IndustryInfo = { industry: string; label: string; count: number };
export type SectorInfo = {
  sector: string;
  label: string;
  count: number;
  industries: IndustryInfo[];
};

/** 섹터 → 하위 업종(2종목 이상) 트리. */
export function getSectors(): SectorInfo[] {
  const u = getKoreanUniverse();
  const bySector = new Map<string, Map<string, number>>();
  for (const e of u) {
    if (!bySector.has(e.sector)) bySector.set(e.sector, new Map());
    const ind = bySector.get(e.sector)!;
    ind.set(e.industry, (ind.get(e.industry) ?? 0) + 1);
  }
  return [...bySector.entries()]
    .map(([sector, ind]) => ({
      sector,
      label: SECTOR_LABELS[sector] ?? sector,
      count: [...ind.values()].reduce((a, b) => a + b, 0),
      industries: [...ind.entries()]
        .filter(([, c]) => c >= 2) // 1종목 업종은 하위 칩에서 제외
        .map(([industry, count]) => ({ industry, label: industryLabel(industry), count }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.count - a.count);
}

export type ScreenerResponse = {
  ok: true;
  kind: "sector" | "industry";
  key: string;
  label: string;
  count: number;
  rows: ComparableCompany[];
  generatedAt: string;
  dataSource: { price: string; financials: string };
  warnings: string[];
};

const CACHE_DIR = path.join(process.cwd(), "data", "screener");
const TTL_MS = 6 * 60 * 60 * 1000;

function average(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x) && x > 0);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

async function readCache(key: string): Promise<ScreenerResponse | null> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(CACHE_DIR, `${key}.json`), "utf8")) as {
      expiresAt: string;
      result: ScreenerResponse;
    };
    return new Date(raw.expiresAt).getTime() > Date.now() ? raw.result : null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, result: ScreenerResponse): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(
      path.join(CACHE_DIR, `${key}.json`),
      JSON.stringify({ expiresAt: new Date(Date.now() + TTL_MS).toISOString(), result }),
      "utf8",
    );
  } catch {
    /* 캐시 실패 무시 */
  }
}

/** 주어진 종목 집합을 Yahoo+DART 로 조회해 저평가 점수순으로 정렬한다. */
async function screen(
  members: UniverseEntry[],
  meta: { kind: "sector" | "industry"; key: string; label: string },
): Promise<ScreenerResponse> {
  resetYahooCredentials();

  const enriched: ComparableCompany[] = await Promise.all(
    members.map(async (e) => {
      const m = await fetchFinancialMetrics(e.ticker);
      return {
        ticker: e.code,
        name: e.name,
        market: e.market as MarketType,
        sector: e.sector,
        industry: e.industry,
        mainProducts: e.mainProducts,
        price: m.price,
        marketCap: m.marketCap,
        per: m.per,
        eps: m.eps,
        pbr: m.pbr,
        roe: m.roe,
        revenueGrowthYoY: m.revenueGrowthYoY,
        operatingMargin: m.operatingMargin,
        netMargin: m.netMargin,
        similarityScore: 0,
        valuationScore: 0,
        qualityScore: 0,
        finalScore: 0,
        reason: "",
        dataStatus: { price: m.priceStatus, financials: m.financialsStatus },
      } satisfies ComparableCompany;
    }),
  );

  const peer: PeerAverages = {
    per: average(enriched.map((c) => c.per)),
    eps: average(enriched.map((c) => c.eps)),
  };

  let missing = 0;
  const scored = enriched.map((c) => {
    if (c.dataStatus.financials === "missing") missing++;
    const { valuationScore, reason } = scoreValuation(c, peer);
    const quality = qualityScore(c);
    return { ...c, valuationScore, qualityScore: quality, finalScore: valuationScore, reason };
  });

  scored.sort((a, b) => b.valuationScore - a.valuationScore || b.qualityScore - a.qualityScore);
  scored.forEach((c, i) => (c.rank = i + 1));

  const warnings: string[] = [];
  if (missing > 0) {
    warnings.push(
      `${missing}개 종목의 재무 지표를 가져오지 못해 저평가 점수에서 제외(0점)되어 하위에 배치됨 (가짜값 없음).`,
    );
  }
  if (peer.per == null) warnings.push("평균 PER을 계산할 유효 데이터가 부족합니다.");

  const result: ScreenerResponse = {
    ok: true,
    kind: meta.kind,
    key: meta.key,
    label: meta.label,
    count: scored.length,
    rows: scored,
    generatedAt: new Date().toISOString(),
    dataSource: {
      price: "Yahoo Finance",
      financials: isDartEnabled() ? "OpenDART(전자공시) + Yahoo 폴백" : "Yahoo Finance",
    },
    warnings,
  };

  await writeCache(`${meta.kind}_${meta.key.replace(/[^a-zA-Z0-9가-힣]/g, "_")}`, result);
  return result;
}

export async function getSectorScreener(sectorInput: string): Promise<ScreenerResponse> {
  const universe = getKoreanUniverse();
  const sector =
    Object.keys(SECTOR_LABELS).find((s) => s.toLowerCase() === sectorInput.toLowerCase()) ??
    universe.find((e) => e.sector.toLowerCase() === sectorInput.toLowerCase())?.sector;
  if (!sector) throw new Error(`알 수 없는 섹터입니다: ${sectorInput}`);

  const cached = await readCache(`sector_${sector.replace(/[^a-zA-Z0-9가-힣]/g, "_")}`);
  if (cached) return cached;

  return screen(universe.filter((e) => e.sector === sector), {
    kind: "sector",
    key: sector,
    label: SECTOR_LABELS[sector] ?? sector,
  });
}

export async function getIndustryScreener(industryInput: string): Promise<ScreenerResponse> {
  const universe = getKoreanUniverse();
  const industry = universe.find(
    (e) => e.industry.toLowerCase() === industryInput.toLowerCase(),
  )?.industry;
  if (!industry) throw new Error(`알 수 없는 업종입니다: ${industryInput}`);

  const cached = await readCache(`industry_${industry.replace(/[^a-zA-Z0-9가-힣]/g, "_")}`);
  if (cached) return cached;

  return screen(universe.filter((e) => e.industry === industry), {
    kind: "industry",
    key: industry,
    label: industryLabel(industry),
  });
}
