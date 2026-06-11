import { promises as fs } from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { fetchWithTimeout } from "@/lib/data/fetch";

/**
 * OpenDART(전자공시) 연동. 한국 상장사의 정확한 재무(매출/영업이익/순이익/자본/EPS)를
 * 받아 PER·ROE·영업이익률·매출성장률·PBR 을 계산한다. 가짜값은 만들지 않으며,
 * DART_API_KEY 가 없거나 조회 실패 시 null 을 반환해 호출측이 "데이터 없음" 처리한다.
 *
 * docs: https://opendart.fss.or.kr/  (무료 키 발급)
 */

function dartKey(): string {
  return (process.env.DART_API_KEY || process.env.OPENDART_API_KEY || "").trim();
}

export function isDartEnabled(): boolean {
  return dartKey().length > 0;
}

const CORP_CACHE = path.join(process.cwd(), "data", "comparables", "_dart_corpcode.json");
const CORP_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

let corpMapMem: Record<string, string> | null = null;

async function loadCorpMap(): Promise<Record<string, string> | null> {
  if (corpMapMem) return corpMapMem;
  const key = dartKey();
  if (!key) return null;

  // 1) 디스크 캐시
  try {
    const raw = JSON.parse(await fs.readFile(CORP_CACHE, "utf8")) as {
      ts: number;
      map: Record<string, string>;
    };
    if (Date.now() - raw.ts < CORP_TTL_MS && raw.map) {
      corpMapMem = raw.map;
      return corpMapMem;
    }
  } catch {
    /* 캐시 없음 */
  }

  // 2) corpCode.xml (zip) 다운로드 → 압축 해제 → 파싱
  try {
    const res = await fetchWithTimeout(
      `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(key)}`,
      {},
      20000,
    );
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    // PK(zip) 시그니처가 아니면 키 오류 등 XML 에러 응답 → 무시
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) return null;

    const files = unzipSync(buf);
    const xmlName = Object.keys(files).find((n) => n.toLowerCase().endsWith(".xml"));
    if (!xmlName) return null;
    const xml = new TextDecoder("utf-8").decode(files[xmlName]);

    const map: Record<string, string> = {};
    const re = /<list>([\s\S]*?)<\/list>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const block = m[1];
      const corp = /<corp_code>([^<]*)<\/corp_code>/.exec(block)?.[1]?.trim();
      const stock = /<stock_code>([^<]*)<\/stock_code>/.exec(block)?.[1]?.trim();
      if (corp && stock && /^\d{6}$/.test(stock)) map[stock] = corp;
    }
    if (Object.keys(map).length === 0) return null;

    corpMapMem = map;
    try {
      await fs.mkdir(path.dirname(CORP_CACHE), { recursive: true });
      await fs.writeFile(CORP_CACHE, JSON.stringify({ ts: Date.now(), map }), "utf8");
    } catch {
      /* 캐시 쓰기 실패는 무시 */
    }
    return corpMapMem;
  } catch {
    return null;
  }
}

export async function getCorpCode(stockCode: string): Promise<string | null> {
  const map = await loadCorpMap();
  return map?.[stockCode] ?? null;
}

type Acnt = {
  sj_div: string; // BS | IS | CIS | CF | SCE
  account_nm: string;
  account_id?: string;
  thstrm_amount: string; // 당기
  frmtrm_amount: string; // 전기
};

function toNum(s?: string): number | null {
  if (s == null || s === "") return null;
  const v = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(v) ? v : null;
}

const clean = (s?: string): string => (s ?? "").replace(/\s/g, "");

/** account_id(IFRS 표준 id) 우선 매칭 — 계정명 변형에 강함. */
function byId(list: Acnt[], ids: string[], sj?: string[]): Acnt | undefined {
  return list.find(
    (a) => (!sj || sj.includes(a.sj_div)) && a.account_id != null && ids.includes(a.account_id),
  );
}

/** 정확한 계정명 매칭(공백 제거 후 완전 일치) — 부분일치 오매칭 방지. */
function byExactName(list: Acnt[], names: string[], sj: string[]): Acnt | undefined {
  const set = new Set(names.map(clean));
  return list.find((a) => sj.includes(a.sj_div) && set.has(clean(a.account_nm)));
}

/** account_id 우선, 없으면 정확한 계정명으로 당기 금액 추출. */
function amount(
  list: Acnt[],
  ids: string[],
  names: string[],
  sj: string[],
): { thstrm: number | null; frmtrm: number | null } {
  const hit = byId(list, ids, sj) ?? byExactName(list, names, sj);
  return { thstrm: toNum(hit?.thstrm_amount), frmtrm: toNum(hit?.frmtrm_amount) };
}

/**
 * 기본 보통주 주당이익(EPS) 추출. 계정명 변형(이익/순이익/손익)과 우선주/희석/
 * 계속·중단 분할을 구분한다.
 *  1) 통합 보통주 기본 EPS 라인 우선 (계속/중단 구분 없는 라인)
 *  2) 없으면 계속영업 + 중단영업 기본 EPS 합산
 */
function extractBasicEps(list: Acnt[]): number | null {
  const is = list.filter((a) => a.sj_div === "IS" || a.sj_div === "CIS");
  // 보통주 기본 EPS 라인 판별. 계정명 변형 대응:
  //   "기본주당이익", "기본주당순이익", "기본주당손익/손실",
  //   "보통주 기본 및 희석주당이익/손실"(기본=희석 통합) 등.
  // 우선주는 제외. '희석'만 있고 '기본'이 없는 순수 희석 라인도 제외.
  const isBasicCommon = (a: Acnt) => {
    const nm = clean(a.account_nm);
    if (/우선주/.test(nm)) return false;
    if (!/주당(순)?(이익|손익|손실)/.test(nm)) return false;
    const hasBasic = /기본/.test(nm);
    const dilutedOnly = /희석/.test(nm) && !hasBasic;
    return hasBasic && !dilutedOnly;
  };
  const preferCommon = (arr: Acnt[]): Acnt | undefined =>
    arr.find((a) => /보통주/.test(clean(a.account_nm))) ?? arr[0];

  // 1) 계속/중단 구분이 없는 통합 라인
  const combined = is.filter(
    (a) => isBasicCommon(a) && !/계속영업|중단영업/.test(clean(a.account_nm)),
  );
  if (combined.length > 0) return toNum(preferCommon(combined)?.thstrm_amount);

  // 2) 계속영업 + 중단영업 합산
  const cont = preferCommon(is.filter((a) => isBasicCommon(a) && /계속영업/.test(clean(a.account_nm))));
  const disc = preferCommon(is.filter((a) => isBasicCommon(a) && /중단영업/.test(clean(a.account_nm))));
  const c = toNum(cont?.thstrm_amount);
  const d = toNum(disc?.thstrm_amount);
  if (c == null && d == null) return null;
  return (c ?? 0) + (d ?? 0);
}

async function fetchAcntList(
  corp: string,
  year: number,
  fsDiv: "CFS" | "OFS",
): Promise<Acnt[] | null> {
  const key = dartKey();
  if (!key) return null;
  const url =
    `https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${encodeURIComponent(key)}` +
    `&corp_code=${corp}&bsns_year=${year}&reprt_code=11011&fs_div=${fsDiv}`;
  try {
    const res = await fetchWithTimeout(url, {}, 12000);
    if (!res.ok) return null;
    const data = (await res.json()) as { status: string; list?: Acnt[] };
    if (data.status !== "000" || !data.list || data.list.length === 0) return null;
    return data.list;
  } catch {
    return null;
  }
}

export type DartMetrics = {
  eps: number | null;
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  equity: number | null;
  bps: number | null;
  revenueGrowthYoY: number | null; // percent
  roe: number | null; // percent
  operatingMargin: number | null; // percent
  netMargin: number | null; // percent
  year: number | null;
  fsDiv: string | null;
};

/** 최근 사업보고서(연결 우선, 없으면 별도)에서 재무를 추출해 지표를 계산. */
export async function getDartMetrics(stockCode: string): Promise<DartMetrics | null> {
  if (!isDartEnabled()) return null;
  const corp = await getCorpCode(stockCode);
  if (!corp) return null;

  for (const year of [2024, 2023]) {
    for (const div of ["CFS", "OFS"] as const) {
      const list = await fetchAcntList(corp, year, div);
      if (!list) continue;

      const rev = amount(
        list,
        ["ifrs-full_Revenue", "dart_OperatingRevenue"],
        ["매출액", "수익(매출액)", "영업수익", "매출"],
        ["IS", "CIS"],
      );
      const revenue = rev.thstrm; // 은행 등은 null 일 수 있음(매출 개념 없음)
      const prevRevenue = rev.frmtrm;

      const operatingIncome = amount(
        list,
        ["dart_OperatingIncomeLoss", "ifrs-full_ProfitLossFromOperatingActivities"],
        ["영업이익", "영업이익(손실)"],
        ["IS", "CIS"],
      ).thstrm;

      // 순이익·자본은 총액(자본총계) 기준으로 일관 계산
      const netIncome = amount(
        list,
        ["ifrs-full_ProfitLoss"],
        ["당기순이익", "당기순이익(손실)", "연결당기순이익"],
        ["IS", "CIS"],
      ).thstrm;

      const equity = amount(list, ["ifrs-full_Equity"], ["자본총계"], ["BS"]).thstrm;

      const eps = extractBasicEps(list);

      // 매출이 없어도(은행·지주 등) EPS·순이익·자본 중 하나라도 있으면 채택.
      // 모두 없으면 다음 후보 통계표(연결/별도/연도)로 넘어간다.
      if (eps == null && netIncome == null && equity == null) continue;

      const hasRevenue = revenue != null && revenue !== 0;
      const revenueGrowthYoY =
        hasRevenue && prevRevenue != null && prevRevenue !== 0
          ? ((revenue - prevRevenue) / Math.abs(prevRevenue)) * 100
          : null;
      const roe = netIncome != null && equity != null && equity !== 0 ? (netIncome / equity) * 100 : null;
      const operatingMargin =
        hasRevenue && operatingIncome != null ? (operatingIncome / revenue) * 100 : null;
      const netMargin = hasRevenue && netIncome != null ? (netIncome / revenue) * 100 : null;

      // 주식수 ≈ 순이익 / EPS → BPS = 자본 / 주식수 (PBR 계산용 근사치)
      let bps: number | null = null;
      if (eps != null && eps > 0 && netIncome != null && netIncome > 0 && equity != null) {
        const shares = netIncome / eps;
        if (shares > 0) bps = equity / shares;
      }

      return {
        eps,
        revenue,
        operatingIncome,
        netIncome,
        equity,
        bps,
        revenueGrowthYoY,
        roe,
        operatingMargin,
        netMargin,
        year,
        fsDiv: div,
      };
    }
  }
  return null;
}
