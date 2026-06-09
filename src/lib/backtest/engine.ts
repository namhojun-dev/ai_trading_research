import type { AnalysisRecord, BacktestStats, BacktestTrade, Position } from "@/lib/types";
import { fetchHistoricalBars, getNextBar } from "@/lib/data/prices";

export async function runBacktest(
  records: AnalysisRecord[],
  ticker: string,
  leverage = 1,
): Promise<BacktestStats> {
  if (records.length === 0) {
    return emptyStats(ticker);
  }

  // Sort by date ascending
  const sorted = [...records].sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt),
  );

  const earliest = sorted[0].startedAt.split("T")[0];
  const latest = sorted[sorted.length - 1].startedAt.split("T")[0];

  // Fetch price bars covering all analysis dates + one extra day
  const bars = await fetchHistoricalBars(ticker, earliest, latest);

  const trades: BacktestTrade[] = [];

  for (const record of sorted) {
    const signal = record.synthesis?.consensus ?? "관망";
    const tqqt = record.synthesis?.tqqt_signal;
    const action = tqqt?.action;
    const entryScore = tqqt?.entry_score ?? null;
    const date = record.startedAt.split("T")[0];

    const nextBar = getNextBar(bars, date);
    const openPrice = nextBar?.open ?? null;
    const nextClose = nextBar?.close ?? null;

    let returnPct: number | null = null;
    let leveragedReturnPct: number | null = null;

    if (nextBar && openPrice && nextClose) {
      // Use open→close return for the next trading day
      const raw = openPrice > 0 ? ((nextClose - openPrice) / openPrice) * 100 : 0;
      returnPct = raw;
      leveragedReturnPct = leverage > 1 ? raw * leverage : null;
    }

    const effectiveSignal: Position = signal;
    let isCorrect: boolean | null = null;
    if (returnPct !== null && effectiveSignal !== "관망") {
      isCorrect =
        (effectiveSignal === "롱" && returnPct > 0) ||
        (effectiveSignal === "숏" && returnPct < 0);
    }

    trades.push({
      date,
      ticker,
      signal: effectiveSignal,
      tqqt_action: action,
      entry_score: entryScore,
      open_price: openPrice,
      next_close: nextClose,
      return_pct: returnPct,
      leveraged_return_pct: leveragedReturnPct,
      is_correct: isCorrect,
      record_id: record.id,
    });
  }

  return computeStats(ticker, trades);
}

function computeStats(ticker: string, trades: BacktestTrade[]): BacktestStats {
  const tradable = trades.filter((t) => t.signal !== "관망" && t.return_pct !== null);
  const wins = tradable.filter((t) => t.is_correct === true);
  const losses = tradable.filter((t) => t.is_correct === false);

  const returns = tradable.map((t) => t.return_pct!);
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + t.return_pct!, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, t) => a + t.return_pct!, 0) / losses.length : 0;

  // Max drawdown from cumulative equity curve
  let peak = 100;
  let equity = 100;
  let maxDrawdown = 0;
  for (const r of returns) {
    equity *= 1 + r / 100;
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }
  const cumulativeReturn = equity - 100;

  // Sharpe (annualized, assuming 252 trading days, risk-free = 0)
  let sharpe: number | null = null;
  if (returns.length > 1) {
    const mean = avgReturn;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    const stddev = Math.sqrt(variance);
    sharpe = stddev > 0 ? (mean / stddev) * Math.sqrt(252) : null;
  }

  return {
    ticker,
    total_analyses: trades.length,
    traded: tradable.length,
    wins: wins.length,
    losses: losses.length,
    win_rate: tradable.length > 0 ? (wins.length / tradable.length) * 100 : 0,
    avg_win_pct: avgWin,
    avg_loss_pct: avgLoss,
    avg_return_pct: avgReturn,
    max_drawdown_pct: maxDrawdown,
    cumulative_return_pct: cumulativeReturn,
    sharpe,
    trades,
  };
}

function emptyStats(ticker: string): BacktestStats {
  return {
    ticker,
    total_analyses: 0,
    traded: 0,
    wins: 0,
    losses: 0,
    win_rate: 0,
    avg_win_pct: 0,
    avg_loss_pct: 0,
    avg_return_pct: 0,
    max_drawdown_pct: 0,
    cumulative_return_pct: 0,
    sharpe: null,
    trades: [],
  };
}
