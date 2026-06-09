import type {
  AlertEvaluation,
  AlertEvaluationItem,
  AlertRunRecord,
  AlertRunResult,
  AlertRule,
  DataEnvelope,
  DataStatus,
  PortfolioCurrencyTotal,
  PortfolioPosition,
  PortfolioValuation,
  PortfolioValuationItem,
} from "@/lib/types";
import { fetchQuote } from "./quote";

export async function valuePortfolio(
  positions: PortfolioPosition[],
): Promise<DataEnvelope<PortfolioValuation>> {
  const fetchedAt = new Date().toISOString();
  if (positions.length === 0) {
    return {
      status: "no_data",
      source: "K-Fin portfolio valuation",
      fetchedAt,
      message: "저장된 포트폴리오 포지션이 없습니다.",
      data: { positions: [], totals: [] },
    };
  }

  const valuedPositions = await Promise.all(positions.map(valuePosition));
  const usable = valuedPositions.filter((item) => item.marketValue !== null);
  const worstStatus = summarizeStatus(valuedPositions.map((item) => item.status), usable.length > 0 ? "delayed" : "no_data");

  return {
    status: worstStatus,
    source: "K-Fin portfolio valuation / Yahoo Finance chart API",
    fetchedAt,
    message:
      usable.length > 0
        ? "포트폴리오 평가는 지연 시세 기준이며 통화별로 합산합니다."
        : "평가 가능한 포지션 시세가 없습니다.",
    data: {
      positions: valuedPositions,
      totals: calculateTotals(valuedPositions),
    },
  };
}

export async function evaluateAlerts(
  alerts: AlertRule[],
): Promise<DataEnvelope<AlertEvaluation>> {
  const fetchedAt = new Date().toISOString();
  if (alerts.length === 0) {
    return {
      status: "no_data",
      source: "K-Fin alert evaluator",
      fetchedAt,
      message: "저장된 알림이 없습니다.",
      data: { alerts: [], triggeredCount: 0 },
    };
  }

  const quotes = new Map(
    await Promise.all(
      Array.from(new Set(alerts.map((alert) => alert.symbol))).map(async (symbol) => [symbol, await fetchQuote(symbol)] as const),
    ),
  );
  const evaluated = alerts.map((alert): AlertEvaluationItem => {
    const quote = quotes.get(alert.symbol);
    const currentValue =
      alert.metric === "change_percent" ? quote?.changePercent ?? null : quote?.price ?? null;
    const triggered =
      alert.enabled && currentValue !== null
        ? alert.operator === "above"
          ? currentValue >= alert.value
          : currentValue <= alert.value
        : false;
    const status = quote?.freshness.status ?? "no_data";
    return {
      id: alert.id,
      symbol: alert.symbol,
      metric: alert.metric,
      operator: alert.operator,
      threshold: alert.value,
      currentValue,
      triggered,
      enabled: alert.enabled,
      status,
      message:
        currentValue === null
          ? quote?.freshness.message ?? "알림 평가에 필요한 시세 데이터가 없습니다."
          : triggered
            ? "알림 조건이 충족되었습니다."
            : "알림 조건이 아직 충족되지 않았습니다.",
    };
  });

  const triggeredCount = evaluated.filter((alert) => alert.triggered).length;
  return {
    status: summarizeStatus(evaluated.map((item) => item.status), evaluated.length > 0 ? "delayed" : "no_data"),
    source: "K-Fin alert evaluator / Yahoo Finance chart API",
    fetchedAt,
    message: "알림 평가는 지연 시세 기준입니다.",
    data: { alerts: evaluated, triggeredCount },
  };
}

export async function runAlerts(alerts: AlertRule[]): Promise<DataEnvelope<AlertRunResult>> {
  const evaluated = await evaluateAlerts(alerts);
  const ranAt = new Date().toISOString();
  const triggeredAlerts = evaluated.data.alerts.filter((alert) => alert.triggered);
  const run: AlertRunRecord = {
    id: `alert-run-${Date.now()}`,
    ranAt,
    status: evaluated.status,
    totalCount: evaluated.data.alerts.length,
    triggeredCount: triggeredAlerts.length,
    triggeredAlerts,
    message:
      triggeredAlerts.length > 0
        ? `${triggeredAlerts.length}개 알림 조건이 충족되었습니다.`
        : evaluated.data.alerts.length > 0
          ? "충족된 알림 조건이 없습니다."
          : "실행할 알림이 없습니다.",
  };

  return {
    status: evaluated.status,
    source: "K-Fin alert runner / Yahoo Finance chart API",
    fetchedAt: ranAt,
    message: run.message,
    data: {
      run,
      evaluation: evaluated.data,
    },
  };
}

async function valuePosition(position: PortfolioPosition): Promise<PortfolioValuationItem> {
  const quote = await fetchQuote(position.symbol);
  const price = quote.price;
  const marketValue = price === null ? null : price * position.quantity;
  const costBasis = position.averageCost === null ? null : position.averageCost * position.quantity;
  const unrealizedPnl = marketValue === null || costBasis === null ? null : marketValue - costBasis;
  const unrealizedPnlPercent =
    unrealizedPnl === null || costBasis === null || costBasis === 0 ? null : (unrealizedPnl / costBasis) * 100;

  return {
    symbol: position.symbol,
    quantity: position.quantity,
    averageCost: position.averageCost,
    currency: quote.currency || position.currency,
    price,
    marketValue,
    costBasis,
    unrealizedPnl,
    unrealizedPnlPercent,
    status: quote.freshness.status,
    message: quote.freshness.message ?? "시세 상태 메시지가 없습니다.",
  };
}

function calculateTotals(positions: PortfolioValuationItem[]): PortfolioCurrencyTotal[] {
  const totals = new Map<string, PortfolioCurrencyTotal>();
  for (const position of positions) {
    if (position.marketValue === null) continue;
    const current = totals.get(position.currency) ?? {
      currency: position.currency,
      marketValue: 0,
      costBasis: 0,
      unrealizedPnl: 0,
    };
    current.marketValue += position.marketValue;
    if (position.costBasis === null || current.costBasis === null) {
      current.costBasis = null;
      current.unrealizedPnl = null;
    } else {
      current.costBasis += position.costBasis;
      current.unrealizedPnl = current.marketValue - current.costBasis;
    }
    totals.set(position.currency, current);
  }
  return Array.from(totals.values());
}

function summarizeStatus(statuses: DataStatus[], fallback: DataStatus): DataStatus {
  if (statuses.includes("error")) return "error";
  if (statuses.includes("delayed")) return "delayed";
  if (statuses.includes("actual")) return "actual";
  if (statuses.includes("api_required")) return "api_required";
  if (statuses.includes("permission_denied")) return "permission_denied";
  if (statuses.includes("no_data")) return "no_data";
  return fallback;
}
