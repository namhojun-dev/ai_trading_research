"use client";

import type { ComparableCompany } from "@/lib/comparables/types";

function avg(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x) && x > 0);
  if (v.length === 0) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function dec(n: number | null | undefined, d = 1): string {
  return n == null ? "데이터 없음" : n.toFixed(d);
}
function krw(n: number | null | undefined): string {
  return n == null ? "데이터 없음" : Math.round(n).toLocaleString("ko-KR");
}

interface Props {
  base: ComparableCompany;
  peers: ComparableCompany[];
}

/** 기준 종목의 밸류에이션을 동종 평균과 대비해 카드로 요약. 모든 값은 조회된 실제 값. */
export function ValuationScoreCard({ base, peers }: Props) {
  const peerPer = avg(peers.map((p) => p.per));
  const peerEps = avg(peers.map((p) => p.eps));

  const verdict: { label: string; cls: string } = (() => {
    if (base.per == null || base.per <= 0)
      return { label: "PER 데이터 없음/적자 — 판단 보류", cls: "text-[var(--color-muted)]" };
    if (peerPer == null)
      return { label: "동종 평균 비교 불가 (데이터 부족)", cls: "text-[var(--color-muted)]" };
    if (base.per < peerPer * 0.9) return { label: "동종 평균 대비 저평가", cls: "text-emerald-400" };
    if (base.per > peerPer * 1.1) return { label: "동종 평균 대비 고평가", cls: "text-amber-300" };
    return { label: "동종 평균과 유사", cls: "text-cyan-300" };
  })();

  const Cell = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div className="mt-0.5 font-mono text-sm">{value}</div>
    </div>
  );

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {base.name} <span className="font-mono text-xs text-[var(--color-muted)]">{base.ticker}</span>
        </h3>
        <span className={`text-xs font-semibold ${verdict.cls}`}>{verdict.label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Cell label="현재가" value={krw(base.price)} />
        <Cell label="입력 종목 PER" value={dec(base.per)} />
        <Cell label="동종 평균 PER" value={dec(peerPer)} />
        <Cell label="입력 종목 EPS" value={krw(base.eps)} />
        <Cell label="동종 평균 EPS" value={krw(peerEps)} />
        <Cell label="ROE" value={base.roe == null ? "데이터 없음" : `${base.roe.toFixed(1)}%`} />
      </div>
      {base.dataStatus.financials !== "ok" && (
        <p className="mt-3 text-[11px] text-amber-300/80">
          ⚠ 기준 종목 재무 데이터가 {base.dataStatus.financials === "missing" ? "조회되지 않았습니다" : "부분만 조회되었습니다"}.
          누락 항목은 가짜값 없이 “데이터 없음”으로 표시됩니다.
        </p>
      )}
    </div>
  );
}
