"use client";

import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { cn, formatCompactUSD, formatNumber, formatPercent } from "@/lib/utils";
import { DATA_STATUS_LABEL, type QuoteSnapshot } from "@/lib/types";

interface Props {
  ticker: string;
  quote: QuoteSnapshot | null;
}

export function PriceHeader({ ticker, quote }: Props) {
  if (!quote) {
    return (
      <div className="flex items-baseline justify-between rounded-lg border bg-[var(--color-surface)]/60 px-5 py-4">
        <div>
          <div className="font-mono text-2xl font-bold tracking-tight">{ticker}</div>
          <div className="text-xs text-[var(--color-muted)]">시세 데이터 없음</div>
        </div>
      </div>
    );
  }

  const price = quote.price;
  const change = quote.change;
  const changePercent = quote.changePercent;
  const hasPrice = price !== null && change !== null && changePercent !== null;
  const up = (changePercent ?? 0) >= 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  const fetchedLabel = formatFetchedAt(quote.fetchedAt);

  return (
    <div className="rounded-lg border bg-[var(--color-surface)]/60 backdrop-blur">
      <div className="grid grid-cols-1 items-center gap-4 px-5 py-4 sm:grid-cols-3 sm:gap-6">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight">{quote.symbol}</span>
            <span className="text-xs text-[var(--color-muted)]">{quote.exchange ?? "거래소 데이터 없음"}</span>
          </div>
          <div className="mt-0.5 truncate text-sm text-[var(--color-muted-foreground)]">
            {quote.shortName ?? "이름 데이터 없음"}
          </div>
        </div>

        <div className="flex items-baseline justify-start gap-3 sm:justify-center">
          <span className="font-mono text-3xl font-semibold tabular-nums">
            {hasPrice ? `$${price.toFixed(2)}` : "데이터 없음"}
          </span>
          {hasPrice && (
            <span
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium tabular-nums",
                up ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400",
              )}
            >
              <Arrow className="h-3.5 w-3.5" />
              {formatPercent(changePercent)} ({up ? "+" : ""}
              {change.toFixed(2)})
            </span>
          )}
        </div>

        <div className="flex justify-start gap-6 text-sm sm:justify-end">
          <Stat
            label="시가총액"
            value={quote.marketCap ? formatCompactUSD(quote.marketCap) : "데이터 없음"}
          />
          <Stat
            label="거래량"
            value={quote.volume ? formatNumber(quote.volume) : "데이터 없음"}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[var(--color-border-subtle)] px-5 py-2 text-[11px] text-[var(--color-muted)]">
        <span className="flex items-center gap-1.5">
          <Info className="h-3 w-3" />
          {DATA_STATUS_LABEL[quote.freshness.status]} · {quote.freshness.source}
        </span>
        <span>{fetchedLabel ? `조회: ${fetchedLabel}` : quote.freshness.message}</span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">{label}</div>
      <div className="mt-0.5 font-mono tabular-nums">{value}</div>
    </div>
  );
}

function formatFetchedAt(iso: string): string | null {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return null;
  }
}
