import type { DataFreshness, QuoteSnapshot } from "@/lib/types";
import { fetchWithTimeout } from "./fetch";

interface YahooChartMeta {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketVolume?: number;
  currency?: string;
  fullExchangeName?: string;
  exchangeName?: string;
}

interface YahooChartResult {
  meta: YahooChartMeta;
  indicators?: {
    quote?: { close?: (number | null)[]; volume?: (number | null)[] }[];
  };
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[];
    error?: { code: string; description: string } | null;
  };
}

export function normalizeSymbol(symbol: string): string | null {
  const ticker = symbol.toUpperCase().trim();
  return /^[A-Z0-9.^=\-]{1,16}$/.test(ticker) ? ticker : null;
}

export function statusSnapshot(
  symbol: string,
  status: DataFreshness["status"],
  message: string,
): QuoteSnapshot {
  const now = new Date().toISOString();
  return {
    symbol,
    shortName: null,
    price: null,
    change: null,
    changePercent: null,
    marketCap: null,
    volume: null,
    currency: "USD",
    exchange: null,
    fetchedAt: now,
    freshness: {
      status,
      source: "Yahoo Finance chart API",
      fetchedAt: status === "error" ? now : null,
      message,
    },
  };
}

export async function fetchQuote(symbol: string): Promise<QuoteSnapshot> {
  const ticker = normalizeSymbol(symbol);
  if (!ticker) {
    return statusSnapshot(symbol, "no_data", "지원하지 않는 심볼 형식입니다.");
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?interval=1d&range=7d`;

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      next: { revalidate: 30 },
    }, 7000);

    if (!res.ok) {
      return statusSnapshot(ticker, "error", `시세 공급자가 HTTP ${res.status}를 반환했습니다.`);
    }

    const data = (await res.json()) as YahooChartResponse;
    const providerError = data.chart?.error;
    if (providerError) {
      return statusSnapshot(
        ticker,
        "error",
        providerError.description || providerError.code || "시세 공급자 오류입니다.",
      );
    }

    const result = data.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") {
      return statusSnapshot(ticker, "no_data", "해당 심볼의 가격 데이터가 없습니다.");
    }

    const price = meta.regularMarketPrice;
    const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter(
      (close): close is number => typeof close === "number" && Number.isFinite(close),
    );

    let prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    if (closes.length >= 2) {
      const last = closes[closes.length - 1];
      prevClose = Math.abs(last - price) < 0.01 ? closes[closes.length - 2] : last;
    } else if (closes.length === 1) {
      prevClose = closes[0];
    }

    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
    const fetchedAt = new Date().toISOString();

    return {
      symbol: meta.symbol || ticker,
      shortName: meta.shortName ?? meta.longName ?? null,
      price,
      change,
      changePercent,
      marketCap: null,
      volume: meta.regularMarketVolume ?? null,
      currency: meta.currency ?? "USD",
      exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
      fetchedAt,
      freshness: {
        status: "delayed",
        source: "Yahoo Finance chart API",
        fetchedAt,
        delayMinutes: 15,
        message: "무료 공개 시세는 거래소와 상품에 따라 지연될 수 있습니다.",
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return statusSnapshot(ticker, "error", message);
  }
}
