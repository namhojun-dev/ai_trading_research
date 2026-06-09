import type { DataEnvelope, OptionContractItem, OptionSnapshotItem } from "@/lib/types";
import { fetchWithTimeout } from "./fetch";
import { normalizeSymbol } from "./quote";

interface PolygonOptionContract {
  ticker?: string;
  underlying_ticker?: string;
  expiration_date?: string;
  strike_price?: number;
  contract_type?: string;
  exercise_style?: string | null;
}

interface PolygonContractsResponse {
  results?: PolygonOptionContract[];
  status?: string;
  error?: string;
  message?: string;
}

interface PolygonOptionSnapshot {
  details?: {
    ticker?: string;
    underlying_ticker?: string;
    expiration_date?: string;
    strike_price?: number;
    contract_type?: string;
  };
  last_quote?: {
    bid?: number;
    ask?: number;
  };
  last_trade?: {
    price?: number;
  };
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  };
  implied_volatility?: number;
  open_interest?: number;
  day?: {
    volume?: number;
  };
}

interface PolygonSnapshotResponse {
  results?: PolygonOptionSnapshot[];
  status?: string;
  error?: string;
  message?: string;
}

export async function fetchOptionContracts(
  symbol: string,
  limit = 20,
  apiKey = process.env.POLYGON_API_KEY,
): Promise<DataEnvelope<OptionContractItem[]>> {
  const fetchedAt = new Date().toISOString();
  const ticker = normalizeSymbol(symbol);
  if (!ticker || ticker.includes("=") || ticker.startsWith("^") || ticker.endsWith(".KS") || ticker.endsWith(".KQ")) {
    return {
      status: "no_data",
      source: "Polygon options reference API",
      fetchedAt,
      message: "옵션 계약 목록은 미국 상장 개별주/ETF 티커 기준으로 조회합니다.",
      data: [],
    };
  }

  const token = apiKey;
  if (!token) {
    return {
      status: "api_required",
      source: "Polygon options reference API / OPRA 권한",
      fetchedAt,
      message: "옵션 계약, 체인, IV/OI 조회에는 POLYGON_API_KEY와 OPRA 데이터 권한이 필요합니다.",
      data: [],
    };
  }

  try {
    const url = new URL("https://api.polygon.io/v3/reference/options/contracts");
    url.searchParams.set("underlying_ticker", ticker);
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 100)));
    url.searchParams.set("apiKey", token);

    const res = await fetchWithTimeout(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 900 },
    }, 8000);
    const payload = (await res.json().catch(() => ({}))) as PolygonContractsResponse;

    if (!res.ok) {
      return {
        status: res.status === 401 || res.status === 403 ? "permission_denied" : "error",
        source: "Polygon options reference API",
        fetchedAt,
        message: payload.error || payload.message || `Polygon API가 HTTP ${res.status}를 반환했습니다.`,
        data: [],
      };
    }

    const data = (payload.results ?? [])
      .map((item): OptionContractItem | null => {
        if (!item.ticker || !item.underlying_ticker || !item.expiration_date || typeof item.strike_price !== "number") {
          return null;
        }
        return {
          ticker: item.ticker,
          underlyingTicker: item.underlying_ticker,
          expirationDate: item.expiration_date,
          strikePrice: item.strike_price,
          contractType: item.contract_type ?? "unknown",
          exerciseStyle: item.exercise_style ?? null,
        };
      })
      .filter((item): item is OptionContractItem => item !== null)
      .slice(0, limit);

    return {
      status: data.length > 0 ? "actual" : "no_data",
      source: "Polygon options reference API",
      fetchedAt,
      message:
        data.length > 0
          ? "옵션 계약 목록은 실제 데이터입니다. 실시간 호가, IV, OI는 별도 OPRA 권한이 필요할 수 있습니다."
          : "해당 심볼의 옵션 계약 데이터가 없습니다.",
      data,
    };
  } catch (err) {
    return {
      status: "error",
      source: "Polygon options reference API",
      fetchedAt,
      message: err instanceof Error ? err.message : String(err),
      data: [],
    };
  }
}

export async function fetchOptionSnapshots(
  symbol: string,
  limit = 20,
  apiKey = process.env.POLYGON_API_KEY,
): Promise<DataEnvelope<OptionSnapshotItem[]>> {
  const fetchedAt = new Date().toISOString();
  const ticker = normalizeSymbol(symbol);
  if (!ticker || ticker.includes("=") || ticker.startsWith("^") || ticker.endsWith(".KS") || ticker.endsWith(".KQ")) {
    return {
      status: "no_data",
      source: "Polygon options snapshot API / OPRA 권한",
      fetchedAt,
      message: "옵션 스냅샷은 미국 상장 개별주/ETF 티커 기준으로 조회합니다.",
      data: [],
    };
  }

  const token = apiKey;
  if (!token) {
    return {
      status: "api_required",
      source: "Polygon options snapshot API / OPRA 권한",
      fetchedAt,
      message: "옵션 스냅샷, IV, OI, Greeks 조회에는 POLYGON_API_KEY와 OPRA 데이터 권한이 필요합니다.",
      data: [],
    };
  }

  try {
    const url = new URL(`https://api.polygon.io/v3/snapshot/options/${encodeURIComponent(ticker)}`);
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 250)));
    url.searchParams.set("apiKey", token);

    const res = await fetchWithTimeout(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    }, 8000);
    const payload = (await res.json().catch(() => ({}))) as PolygonSnapshotResponse;

    if (!res.ok) {
      return {
        status: res.status === 401 || res.status === 403 ? "permission_denied" : "error",
        source: "Polygon options snapshot API",
        fetchedAt,
        message: payload.error || payload.message || `Polygon snapshot API가 HTTP ${res.status}를 반환했습니다.`,
        data: [],
      };
    }

    const data = (payload.results ?? [])
      .map((item): OptionSnapshotItem | null => {
        const details = item.details;
        if (!details?.ticker) return null;
        return {
          ticker: details.ticker,
          underlyingTicker: details.underlying_ticker ?? ticker,
          expirationDate: details.expiration_date ?? null,
          strikePrice: numberOrNull(details.strike_price),
          contractType: details.contract_type ?? "unknown",
          lastPrice: numberOrNull(item.last_trade?.price),
          bid: numberOrNull(item.last_quote?.bid),
          ask: numberOrNull(item.last_quote?.ask),
          impliedVolatility: numberOrNull(item.implied_volatility),
          openInterest: numberOrNull(item.open_interest),
          volume: numberOrNull(item.day?.volume),
          delta: numberOrNull(item.greeks?.delta),
          gamma: numberOrNull(item.greeks?.gamma),
          theta: numberOrNull(item.greeks?.theta),
          vega: numberOrNull(item.greeks?.vega),
        };
      })
      .filter((item): item is OptionSnapshotItem => item !== null)
      .slice(0, limit);

    return {
      status: data.length > 0 ? "actual" : "no_data",
      source: "Polygon options snapshot API",
      fetchedAt,
      message: data.length > 0 ? "옵션 스냅샷, IV, OI, Greeks 데이터입니다." : "옵션 스냅샷 데이터가 없습니다.",
      data,
    };
  } catch (err) {
    return {
      status: "error",
      source: "Polygon options snapshot API",
      fetchedAt,
      message: err instanceof Error ? err.message : String(err),
      data: [],
    };
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
