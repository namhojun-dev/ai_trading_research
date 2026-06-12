export type Manager = { cik: string; name: string; label: string };

export type ChangeType = "new" | "add" | "reduce" | "unchanged";

export type Holding = {
  rank?: number;
  issuer: string;
  cusip: string;
  titleOfClass: string;
  putCall?: string | null;
  value: number; // USD
  shares: number;
  pct: number; // % of portfolio
  change: ChangeType;
  prevShares: number | null;
  deltaSharesPct: number | null; // 직전 분기 대비 주식수 증감 %
};

export type ExitedHolding = { issuer: string; cusip: string; prevValue: number };

export type ThirteenFResult = {
  ok: true;
  cik: string;
  manager: string;
  reportDate: string; // 보고 기준일 (분기말)
  prevReportDate: string | null;
  filedAt: string; // 신고일
  totalValue: number;
  positions: number;
  holdings: Holding[];
  exited: ExitedHolding[]; // 직전 분기 대비 전량 청산
  generatedAt: string;
  source: string;
};
