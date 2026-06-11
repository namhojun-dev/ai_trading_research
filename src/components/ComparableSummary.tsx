"use client";

interface Props {
  summary: string;
  dataSource: { price: string; financials: string; sector: string };
  warnings: string[];
  generatedAt: string;
}

export function ComparableSummary({ summary, dataSource, warnings, generatedAt }: Props) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          최종 해석
        </h3>
        <p className="text-sm leading-relaxed text-[var(--color-foreground)]/90 whitespace-pre-line">
          {summary}
        </p>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h4 className="mb-1.5 text-xs font-semibold text-amber-300">주의사항</h4>
          <ul className="list-disc space-y-1 pl-5 text-[11px] text-amber-200/80">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-[var(--color-muted)]">
        데이터 출처 — 가격: {dataSource.price} · 재무: {dataSource.financials} · 분류: {dataSource.sector}
        {" · "}생성 {new Date(generatedAt).toLocaleString("ko-KR")}
        {" · "}숫자는 데이터 소스 값만 사용하며, 순위는 정량 점수로 계산됩니다(투자 자문 아님).
      </p>
    </div>
  );
}
