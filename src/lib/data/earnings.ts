import type { DataEnvelope, EarningsItem } from "@/lib/types";
import { fetchWithTimeout } from "./fetch";
import { normalizeSymbol } from "./quote";

interface FinnhubEarningsRecord {
  date?: string;
  epsActual?: number | null;
  epsEstimate?: number | null;
  hour?: string | null;
  quarter?: number | null;
  revenueActual?: number | null;
  revenueEstimate?: number | null;
  symbol?: string;
  year?: number | null;
}

interface FinnhubEarningsResponse {
  earningsCalendar?: FinnhubEarningsRecord[];
}

export async function fetchEarningsCalendar(
  symbol: string,
  limit = 8,
  apiKey = process.env.FINNHUB_API_KEY,
): Promise<DataEnvelope<EarningsItem[]>> {
  const fetchedAt = new Date().toISOString();
  const ticker = normalizeSymbol(symbol);
  if (!ticker || ticker.includes("=") || ticker.startsWith("^") || ticker.endsWith(".KS") || ticker.endsWith(".KQ")) {
    return {
      status: "no_data",
      source: "Finnhub earnings calendar",
      fetchedAt,
      message: "실적 캘린더는 미국 상장 보통주/ETF 티커 기준으로 조회합니다.",
      data: [],
    };
  }

  const token = apiKey;
  if (!token) {
    return {
      status: "api_required",
      source: "Finnhub earnings calendar",
      fetchedAt,
      message: "실적 발표일, EPS, 매출 컨센서스 조회에는 FINNHUB_API_KEY가 필요합니다.",
      data: [],
    };
  }

  try {
    const to = offsetDate(120);
    const from = offsetDate(-30);
    const url = new URL("https://finnhub.io/api/v1/calendar/earnings");
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    url.searchParams.set("symbol", ticker);
    url.searchParams.set("token", token);

    const res = await fetchWithTimeout(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 900 },
    }, 8000);

    if (!res.ok) {
      return {
        status: res.status === 401 || res.status === 403 ? "permission_denied" : "error",
        source: "Finnhub earnings calendar",
        fetchedAt,
        message: `Finnhub API가 HTTP ${res.status}를 반환했습니다.`,
        data: [],
      };
    }

    const payload = (await res.json()) as FinnhubEarningsResponse;
    const data = (payload.earningsCalendar ?? [])
      .filter((item) => item.symbol?.toUpperCase() === ticker)
      .map((item): EarningsItem => ({
        symbol: item.symbol ?? ticker,
        date: item.date ?? "",
        hour: item.hour ?? null,
        fiscalYear: numberOrNull(item.year),
        fiscalQuarter: numberOrNull(item.quarter),
        epsActual: numberOrNull(item.epsActual),
        epsEstimate: numberOrNull(item.epsEstimate),
        revenueActual: numberOrNull(item.revenueActual),
        revenueEstimate: numberOrNull(item.revenueEstimate),
      }))
      .filter((item) => item.date)
      .slice(0, limit);

    return {
      status: data.length > 0 ? "actual" : "no_data",
      source: "Finnhub earnings calendar",
      fetchedAt,
      message: data.length > 0 ? `${ticker} 실적 캘린더` : "조회 기간에 실적 캘린더 데이터가 없습니다.",
      data,
    };
  } catch (err) {
    return {
      status: "error",
      source: "Finnhub earnings calendar",
      fetchedAt,
      message: err instanceof Error ? err.message : String(err),
      data: [],
    };
  }
}

function offsetDate(offsetDays: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
