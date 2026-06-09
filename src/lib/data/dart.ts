import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import type { DartCompanyItem, DartFilingItem, DataEnvelope } from "@/lib/types";
import { fetchWithTimeout } from "./fetch";
import { normalizeSymbol } from "./quote";

interface DartListItem {
  rcept_no?: string;
  corp_name?: string;
  stock_code?: string;
  report_nm?: string;
  rcept_dt?: string;
  flr_nm?: string;
}

interface DartListResponse {
  status?: string;
  message?: string;
  list?: DartListItem[];
}

interface DartCorpCodeXml {
  result?: {
    list?: DartCorpCodeRecord | DartCorpCodeRecord[];
  };
}

interface DartCorpCodeRecord {
  corp_code?: string;
  corp_name?: string;
  stock_code?: string;
  modify_date?: string;
}

const DART_CORP_CODES: Record<string, { corpCode: string; corpName: string }> = {
  "005930": { corpCode: "00126380", corpName: "삼성전자" },
  "005930.KS": { corpCode: "00126380", corpName: "삼성전자" },
};

const corpCodeParser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
});

let corpCodeCache: { apiKey: string; fetchedAt: number; companies: DartCompanyItem[] } | null = null;

export async function fetchDartFilings(
  symbol: string,
  limit = 12,
  apiKey = process.env.OPENDART_API_KEY,
  corpCodeParam?: string | null,
): Promise<DataEnvelope<DartFilingItem[]>> {
  const fetchedAt = new Date().toISOString();
  const ticker = normalizeSymbol(symbol);
  const corpCode = corpCodeParam?.trim();
  if (!corpCode && (!ticker || !isKoreaSymbol(ticker))) {
    return {
      status: "no_data",
      source: "OpenDART",
      fetchedAt,
      message: "DART 공시는 한국 주식 코드 또는 .KS/.KQ 심볼 기준으로 조회합니다.",
      data: [],
    };
  }

  const token = apiKey;
  if (!token) {
    return {
      status: "api_required",
      source: "OpenDART",
      fetchedAt,
      message: "DART 공시 조회에는 OPENDART_API_KEY가 필요합니다.",
      data: [],
    };
  }

  const company = corpCode
    ? { corpCode, corpName: ticker ?? corpCode }
    : await resolveDartCompany(ticker, token, fetchedAt);
  if (!company) {
    return {
      status: "no_data",
      source: "OpenDART",
      fetchedAt,
      message: `${ticker}에 대한 corp_code 매핑이 없습니다.`,
      data: [],
    };
  }

  try {
    const url = new URL("https://opendart.fss.or.kr/api/list.json");
    url.searchParams.set("crtfc_key", token);
    url.searchParams.set("corp_code", company.corpCode);
    url.searchParams.set("bgn_de", oneYearAgoCompact());
    url.searchParams.set("page_count", String(Math.min(Math.max(limit, 1), 100)));

    const res = await fetchWithTimeout(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 900 },
    }, 8000);
    const payload = (await res.json().catch(() => ({}))) as DartListResponse;

    if (!res.ok) {
      return {
        status: "error",
        source: "OpenDART",
        fetchedAt,
        message: `OpenDART API가 HTTP ${res.status}를 반환했습니다.`,
        data: [],
      };
    }

    if (payload.status && payload.status !== "000") {
      return {
        status: payload.status === "013" ? "no_data" : payload.status === "010" ? "permission_denied" : "error",
        source: "OpenDART",
        fetchedAt,
        message: payload.message || "OpenDART 응답 오류입니다.",
        data: [],
      };
    }

    const data = (payload.list ?? [])
      .map((item): DartFilingItem | null => {
        if (!item.rcept_no || !item.corp_name || !item.report_nm || !item.rcept_dt) return null;
        return {
          receiptNumber: item.rcept_no,
          corpName: item.corp_name,
          stockCode: item.stock_code || null,
          reportName: item.report_nm,
          filedAt: item.rcept_dt,
          submitter: item.flr_nm || null,
          url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`,
        };
      })
      .filter((item): item is DartFilingItem => item !== null)
      .slice(0, limit);

    return {
      status: data.length > 0 ? "actual" : "no_data",
      source: "OpenDART",
      fetchedAt,
      message: data.length > 0 ? `${company.corpName} 최근 DART 공시` : "최근 DART 공시가 없습니다.",
      data,
    };
  } catch (err) {
    return {
      status: "error",
      source: "OpenDART",
      fetchedAt,
      message: err instanceof Error ? err.message : String(err),
      data: [],
    };
  }
}

export async function fetchDartCompanies(
  apiKey = process.env.OPENDART_API_KEY,
  query?: string | null,
  limit = 30,
): Promise<DataEnvelope<DartCompanyItem[]>> {
  const fetchedAt = new Date().toISOString();
  if (!apiKey) {
    return {
      status: "api_required",
      source: "OpenDART corpCode.xml",
      fetchedAt,
      message: "DART 회사 고유번호 매핑 조회에는 OPENDART_API_KEY가 필요합니다.",
      data: [],
    };
  }

  try {
    const companies = await loadDartCompanies(apiKey);
    const normalizedQuery = query?.trim().toUpperCase();
    const filtered = normalizedQuery
      ? companies.filter(
          (company) =>
            company.corpName.includes(query?.trim() ?? "") ||
            company.corpCode === normalizedQuery ||
            company.stockCode === cleanStockCode(normalizedQuery),
        )
      : companies;

    return {
      status: filtered.length > 0 ? "actual" : "no_data",
      source: "OpenDART corpCode.xml",
      fetchedAt,
      message: filtered.length > 0 ? "OpenDART 회사 고유번호 매핑입니다." : "검색 조건에 맞는 회사가 없습니다.",
      data: filtered.slice(0, Math.min(Math.max(limit, 1), 100)),
    };
  } catch (err) {
    return {
      status: "error",
      source: "OpenDART corpCode.xml",
      fetchedAt,
      message: err instanceof Error ? err.message : String(err),
      data: [],
    };
  }
}

async function resolveDartCompany(
  ticker: string | null,
  apiKey: string,
  fetchedAt: string,
): Promise<{ corpCode: string; corpName: string } | null> {
  if (!ticker) return null;
  const staticCompany = DART_CORP_CODES[ticker] ?? DART_CORP_CODES[ticker.replace(/\.(KS|KQ)$/u, "")];
  if (staticCompany) return staticCompany;

  const companies = await fetchDartCompanies(apiKey, ticker, 1);
  if (companies.status !== "actual") {
    if (companies.status === "error") {
      throw new Error(companies.message ?? `OpenDART corp_code 매핑 오류: ${fetchedAt}`);
    }
    return null;
  }
  const company = companies.data[0];
  return company ? { corpCode: company.corpCode, corpName: company.corpName } : null;
}

async function loadDartCompanies(apiKey: string): Promise<DartCompanyItem[]> {
  const now = Date.now();
  if (corpCodeCache?.apiKey === apiKey && now - corpCodeCache.fetchedAt < 1000 * 60 * 60 * 12) {
    return corpCodeCache.companies;
  }

  const url = new URL("https://opendart.fss.or.kr/api/corpCode.xml");
  url.searchParams.set("crtfc_key", apiKey);
  const res = await fetchWithTimeout(url, {
    headers: { Accept: "application/zip, application/octet-stream" },
    next: { revalidate: 43200 },
  }, 12000);

  if (!res.ok) {
    throw new Error(`OpenDART corpCode.xml HTTP ${res.status}`);
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(bytes);
  const xmlFileName = Object.keys(files).find((name) => name.toLowerCase().endsWith(".xml"));
  if (!xmlFileName) throw new Error("OpenDART corpCode.xml ZIP 안에서 XML 파일을 찾지 못했습니다.");

  const xml = new TextDecoder("utf-8").decode(files[xmlFileName]);
  const parsed = corpCodeParser.parse(xml) as DartCorpCodeXml;
  const raw = normalizeArray(parsed.result?.list);
  const companies = raw
    .map((item): DartCompanyItem | null => {
      const corpCode = item.corp_code?.trim();
      const corpName = item.corp_name?.trim();
      if (!corpCode || !corpName) return null;
      const stockCode = item.stock_code?.trim();
      return {
        corpCode,
        corpName,
        stockCode: stockCode && /^\d{6}$/u.test(stockCode) ? stockCode : null,
        modifyDate: item.modify_date?.trim() || null,
      };
    })
    .filter((item): item is DartCompanyItem => item !== null);

  corpCodeCache = { apiKey, fetchedAt: now, companies };
  return companies;
}

function isKoreaSymbol(symbol: string) {
  return /^\d{6}(\.(KS|KQ))?$/u.test(symbol);
}

function cleanStockCode(symbol: string) {
  return symbol.replace(/\.(KS|KQ)$/u, "");
}

function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function oneYearAgoCompact() {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - 1);
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}
