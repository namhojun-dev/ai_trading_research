import type { DataEnvelope, RateItem } from "@/lib/types";
import { fetchWithTimeout } from "./fetch";

interface FredObservation {
  date?: string;
  value?: string;
}

interface FredResponse {
  observations?: FredObservation[];
  error_message?: string;
}

const FRED_SERIES = [
  { seriesId: "DGS2", label: "미국 2년 국채" },
  { seriesId: "DGS10", label: "미국 10년 국채" },
  { seriesId: "DGS30", label: "미국 30년 국채" },
  { seriesId: "FEDFUNDS", label: "연방기금금리" },
  { seriesId: "SOFR", label: "SOFR" },
];

export async function fetchRates(apiKey = process.env.FRED_API_KEY): Promise<DataEnvelope<RateItem[]>> {
  const fetchedAt = new Date().toISOString();
  const token = apiKey;
  if (!token) {
    return {
      status: "api_required",
      source: "FRED API",
      fetchedAt,
      message: "정식 금리 시계열 조회에는 FRED_API_KEY가 필요합니다. 화면의 ^TNX는 지연 시세로 별도 제공됩니다.",
      data: [],
    };
  }

  try {
    const results = await Promise.all(FRED_SERIES.map((series) => fetchFredLatest(series, token)));
    const data = results.filter((item): item is RateItem => item !== null);
    return {
      status: data.length > 0 ? "actual" : "no_data",
      source: "FRED API",
      fetchedAt,
      message: data.length > 0 ? "FRED 최신 금리 관측치" : "FRED 금리 관측치가 없습니다.",
      data,
    };
  } catch (err) {
    return {
      status: "error",
      source: "FRED API",
      fetchedAt,
      message: err instanceof Error ? err.message : String(err),
      data: [],
    };
  }
}

async function fetchFredLatest(
  series: (typeof FRED_SERIES)[number],
  token: string,
): Promise<RateItem | null> {
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", series.seriesId);
  url.searchParams.set("api_key", token);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "1");

  const res = await fetchWithTimeout(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  }, 8000);
  const payload = (await res.json().catch(() => ({}))) as FredResponse;
  if (!res.ok) {
    throw new Error(payload.error_message || `FRED ${series.seriesId} HTTP ${res.status}`);
  }

  const observation = payload.observations?.[0];
  if (!observation || !observation.date || !observation.value || observation.value === ".") {
    return null;
  }

  const value = Number(observation.value);
  return {
    seriesId: series.seriesId,
    label: series.label,
    value: Number.isFinite(value) ? value : null,
    date: observation.date,
    unit: "%",
  };
}
