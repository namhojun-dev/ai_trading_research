import { fetchWithTimeout } from "./fetch";

export interface DailyBar {
  date: string; // YYYY-MM-DD
  open: number;
  close: number;
  change_pct: number; // (close - open) / open * 100
}

interface YahooChartResponse {
  chart?: {
    result?: {
      meta: { symbol: string };
      timestamp?: number[];
      indicators?: {
        quote?: { open?: (number | null)[]; close?: (number | null)[] }[];
      };
    }[];
    error?: unknown;
  };
}

export async function fetchHistoricalBars(
  symbol: string,
  fromDate: string, // YYYY-MM-DD
  toDate: string,   // YYYY-MM-DD
): Promise<DailyBar[]> {
  const ticker = symbol.toUpperCase().trim();
  const period1 = Math.floor(new Date(fromDate).getTime() / 1000);
  // Add 2 days buffer so we get the day after toDate (for next-day return)
  const period2 = Math.floor(new Date(toDate).getTime() / 1000) + 86400 * 3;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${period1}&period2=${period2}`;
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    }, 8000);
    if (!res.ok) return [];

    const data = (await res.json()) as YahooChartResponse;
    const result = data.chart?.result?.[0];
    if (!result) return [];

    const timestamps = result.timestamp ?? [];
    const opens = result.indicators?.quote?.[0]?.open ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];

    const bars: DailyBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const open = opens[i];
      const close = closes[i];
      if (typeof open !== "number" || typeof close !== "number") continue;
      if (!Number.isFinite(open) || !Number.isFinite(close)) continue;

      const date = new Date(ts * 1000).toISOString().split("T")[0];
      bars.push({
        date,
        open,
        close,
        change_pct: open > 0 ? ((close - open) / open) * 100 : 0,
      });
    }
    return bars;
  } catch {
    return [];
  }
}

// Returns the bar for the next trading day after `date` from a sorted bar list
export function getNextBar(bars: DailyBar[], date: string): DailyBar | null {
  const idx = bars.findIndex((b) => b.date > date);
  return idx !== -1 ? bars[idx] : null;
}
