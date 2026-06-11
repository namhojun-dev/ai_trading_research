export type MarketType = "KOSPI" | "KOSDAQ" | "UNKNOWN";

export type PriceStatus = "ok" | "missing" | "stale";
export type FinancialsStatus = "ok" | "missing" | "partial";

export type ComparableCompany = {
  rank?: number;

  ticker: string;
  name: string;
  market: MarketType;

  sector?: string;
  industry?: string;
  businessSummary?: string;
  mainProducts?: string[];

  price?: number | null;
  marketCap?: number | null;

  per?: number | null;
  eps?: number | null;
  pbr?: number | null;
  roe?: number | null;

  revenueGrowthYoY?: number | null;
  operatingMargin?: number | null;
  netMargin?: number | null;

  similarityScore: number;
  valuationScore: number;
  qualityScore: number;
  finalScore: number;

  reason: string;

  dataStatus: {
    price: PriceStatus;
    financials: FinancialsStatus;
  };
};

/** A single entry in the local Korean listed-stock universe. Metadata only — no financials. */
export type UniverseEntry = {
  ticker: string; // Yahoo symbol, e.g. "005930.KS"
  code: string; // bare 6-digit code, e.g. "005930"
  name: string;
  market: Exclude<MarketType, "UNKNOWN">;
  sector: string;
  industry: string;
  mainProducts: string[];
};

/** Raw financial + profile data pulled from a data source (Yahoo Finance). */
export type FinancialMetrics = {
  name?: string | null;
  sector?: string | null;
  industry?: string | null;
  businessSummary?: string | null;

  price: number | null;
  marketCap: number | null;
  per: number | null;
  eps: number | null;
  pbr: number | null;
  roe: number | null; // percent
  revenueGrowthYoY: number | null; // percent
  operatingMargin: number | null; // percent
  netMargin: number | null; // percent

  quoteType?: string | null;
  currency?: string | null;

  priceStatus: PriceStatus;
  financialsStatus: FinancialsStatus;
};

export type CompanyProfile = {
  ticker: string; // resolved Yahoo symbol
  code: string; // bare code
  name: string;
  market: MarketType;
  sector?: string;
  industry?: string;
  businessSummary?: string;
  mainProducts?: string[];
  quoteType?: string | null;
  metrics: FinancialMetrics;
};

export type NormalizedTicker = {
  input: string;
  /** Bare display code/ticker, e.g. "005930" or "AAPL". */
  ticker: string;
  /** Yahoo symbol candidates to probe, in priority order. */
  candidates: string[];
  /** Resolved from universe-by-name lookup, if the input was a Korean company name. */
  resolvedName?: string;
  isKoreanCode: boolean;
};

export type ComparableApiResponse = {
  ok: true;
  ticker: string;
  companyName: string;
  baseCompany: ComparableCompany;
  kospi: ComparableCompany[];
  kosdaq: ComparableCompany[];
  summary: string;
  generatedAt: string;
  dataSource: {
    price: string;
    financials: string;
    sector: string;
  };
  warnings: string[];
};

/** Thrown for inputs we deliberately refuse to compare (ETF/ETN/SPAC/preferred). */
export class ComparableRejection extends Error {
  readonly reason: string;
  constructor(message: string, reason: string) {
    super(message);
    this.name = "ComparableRejection";
    this.reason = reason;
  }
}
