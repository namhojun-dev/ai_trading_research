import type { DataEnvelope, FilingItem } from "@/lib/types";
import { fetchWithTimeout } from "./fetch";
import { normalizeSymbol } from "./quote";

interface SecTickerRecord {
  cik_str: number;
  ticker: string;
  title: string;
}

interface SecSubmissions {
  cik: string;
  name: string;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      reportDate?: string[];
      form?: string[];
      primaryDocument?: string[];
      primaryDocDescription?: string[];
    };
  };
}

const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ||
  "K-Fin Terminal local research app contact@example.com";

export async function fetchSecFilings(
  symbol: string,
  limit = 12,
): Promise<DataEnvelope<FilingItem[]>> {
  const fetchedAt = new Date().toISOString();
  const ticker = normalizeSymbol(symbol);
  if (!ticker || ticker.includes("=") || ticker.startsWith("^") || ticker.endsWith(".KS") || ticker.endsWith(".KQ")) {
    return {
      status: "no_data",
      source: "SEC EDGAR submissions API",
      fetchedAt,
      message: "SEC 공시는 미국 상장 보통주/ETF 심볼에 대해서만 조회합니다.",
      data: [],
    };
  }

  try {
    const mapping = await fetchSecTickerMapping();
    const record = mapping.find((item) => item.ticker.toUpperCase() === ticker);
    if (!record) {
      return {
        status: "no_data",
        source: "SEC company_tickers.json",
        fetchedAt,
        message: `${ticker}의 CIK 매핑을 찾지 못했습니다.`,
        data: [],
      };
    }

    const cik = String(record.cik_str).padStart(10, "0");
    const res = await fetchWithTimeout(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: {
        "User-Agent": SEC_USER_AGENT,
        Accept: "application/json",
      },
      next: { revalidate: 900 },
    }, 8000);

    if (!res.ok) {
      return {
        status: "error",
        source: "SEC EDGAR submissions API",
        fetchedAt,
        message: `SEC submissions API가 HTTP ${res.status}를 반환했습니다.`,
        data: [],
      };
    }

    const data = (await res.json()) as SecSubmissions;
    const recent = data.filings?.recent;
    const accessionNumbers = recent?.accessionNumber ?? [];
    const filings = accessionNumbers
      .map((accessionNumber, index): FilingItem | null => {
        const form = recent?.form?.[index];
        const filedAt = recent?.filingDate?.[index];
        const primaryDocument = recent?.primaryDocument?.[index];
        if (!accessionNumber || !form || !filedAt || !primaryDocument) return null;

        const accessionPath = accessionNumber.replaceAll("-", "");
        const cikPath = String(record.cik_str);
        return {
          accessionNumber,
          form,
          filedAt,
          reportDate: recent?.reportDate?.[index] || null,
          description: recent?.primaryDocDescription?.[index] || null,
          url: `https://www.sec.gov/Archives/edgar/data/${cikPath}/${accessionPath}/${primaryDocument}`,
        };
      })
      .filter((item): item is FilingItem => item !== null)
      .slice(0, limit);

    return {
      status: filings.length > 0 ? "actual" : "no_data",
      source: "SEC EDGAR submissions API",
      fetchedAt,
      message: filings.length > 0 ? `${record.title} 최근 공시` : "최근 공시가 없습니다.",
      data: filings,
    };
  } catch (err) {
    return {
      status: "error",
      source: "SEC EDGAR submissions API",
      fetchedAt,
      message: err instanceof Error ? err.message : String(err),
      data: [],
    };
  }
}

async function fetchSecTickerMapping(): Promise<SecTickerRecord[]> {
  const res = await fetchWithTimeout("https://www.sec.gov/files/company_tickers.json", {
    headers: {
      "User-Agent": SEC_USER_AGENT,
      Accept: "application/json",
    },
    next: { revalidate: 86400 },
  }, 8000);
  if (!res.ok) {
    throw new Error(`SEC ticker mapping HTTP ${res.status}`);
  }

  const raw = (await res.json()) as Record<string, SecTickerRecord>;
  return Object.values(raw);
}
