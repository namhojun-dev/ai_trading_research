export type DataStatus =
  | "actual"
  | "delayed"
  | "api_required"
  | "no_data"
  | "permission_denied"
  | "error";

export const DATA_STATUS_LABEL: Record<DataStatus, string> = {
  actual: "실제 데이터",
  delayed: "지연 데이터",
  api_required: "API 필요",
  no_data: "데이터 없음",
  permission_denied: "권한 없음",
  error: "오류 발생",
};

export interface DataFreshness {
  status: DataStatus;
  source: string;
  fetchedAt: string | null;
  delayMinutes?: number;
  message?: string;
}

export interface DataEnvelope<T> extends DataFreshness {
  data: T;
}

export interface QuoteSnapshot {
  symbol: string;
  shortName: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  marketCap: number | null;
  volume: number | null;
  currency: string;
  exchange: string | null;
  fetchedAt: string;
  freshness: DataFreshness;
}

export interface TerminalModule {
  id: string;
  title: string;
  category:
    | "markets"
    | "news"
    | "filings"
    | "macro"
    | "personal"
    | "execution"
    | "ai";
  status: DataStatus;
  source: string;
  description: string;
  updatedAt: string | null;
  authRequired?: boolean;
  apiKeyRequired?: boolean;
}

export type AssetClass =
  | "us_stock"
  | "etf"
  | "index"
  | "fx"
  | "rate"
  | "commodity"
  | "korea_stock";

export interface WatchSymbol {
  symbol: string;
  label: string;
  assetClass: AssetClass;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  summary: string | null;
}

export interface FilingItem {
  accessionNumber: string;
  form: string;
  filedAt: string;
  reportDate: string | null;
  description: string | null;
  url: string;
}

export interface DataCapability {
  id: string;
  label: string;
  status: DataStatus;
  source: string;
  message: string;
  authRequired?: boolean;
  apiKeyRequired?: boolean;
}

export interface EarningsItem {
  symbol: string;
  date: string;
  hour: string | null;
  fiscalYear: number | null;
  fiscalQuarter: number | null;
  epsActual: number | null;
  epsEstimate: number | null;
  revenueActual: number | null;
  revenueEstimate: number | null;
}

export interface OptionContractItem {
  ticker: string;
  underlyingTicker: string;
  expirationDate: string;
  strikePrice: number;
  contractType: "call" | "put" | string;
  exerciseStyle: string | null;
}

export interface OptionSnapshotItem {
  ticker: string;
  underlyingTicker: string;
  expirationDate: string | null;
  strikePrice: number | null;
  contractType: "call" | "put" | string;
  lastPrice: number | null;
  bid: number | null;
  ask: number | null;
  impliedVolatility: number | null;
  openInterest: number | null;
  volume: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
}

export interface RateItem {
  seriesId: string;
  label: string;
  value: number | null;
  date: string | null;
  unit: string;
}

export interface DartFilingItem {
  receiptNumber: string;
  corpName: string;
  stockCode: string | null;
  reportName: string;
  filedAt: string;
  submitter: string | null;
  url: string;
}

export interface DartCompanyItem {
  corpCode: string;
  corpName: string;
  stockCode: string | null;
  modifyDate: string | null;
}

export interface PortfolioPosition {
  symbol: string;
  quantity: number;
  averageCost: number | null;
  currency: string;
}

export interface ApiKeyStatus {
  provider: string;
  configured: boolean;
  updatedAt: string | null;
}

export interface AiSettings {
  primaryModel: string;
  language: "ko";
  riskProfile: "conservative" | "balanced" | "aggressive";
}

export interface LayoutSettings {
  density: "compact" | "standard";
  leftRail: boolean;
  rightRail: boolean;
}

export interface AlertRule {
  id: string;
  symbol: string;
  metric: "price" | "change_percent";
  operator: "above" | "below";
  value: number;
  enabled: boolean;
}

export interface UserTerminalState {
  email: string;
  portfolio: PortfolioPosition[];
  watchlist: string[];
  apiKeys: ApiKeyStatus[];
  aiSettings: AiSettings;
  layout: LayoutSettings;
  alerts: AlertRule[];
  alertRuns: AlertRunRecord[];
  updatedAt: string;
}

export interface PortfolioValuationItem {
  symbol: string;
  quantity: number;
  averageCost: number | null;
  currency: string;
  price: number | null;
  marketValue: number | null;
  costBasis: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPercent: number | null;
  status: DataStatus;
  message: string;
}

export interface PortfolioCurrencyTotal {
  currency: string;
  marketValue: number;
  costBasis: number | null;
  unrealizedPnl: number | null;
}

export interface PortfolioValuation {
  positions: PortfolioValuationItem[];
  totals: PortfolioCurrencyTotal[];
}

export interface AlertEvaluationItem {
  id: string;
  symbol: string;
  metric: AlertRule["metric"];
  operator: AlertRule["operator"];
  threshold: number;
  currentValue: number | null;
  triggered: boolean;
  enabled: boolean;
  status: DataStatus;
  message: string;
}

export interface AlertEvaluation {
  alerts: AlertEvaluationItem[];
  triggeredCount: number;
}

export interface AlertRunRecord {
  id: string;
  ranAt: string;
  status: DataStatus;
  totalCount: number;
  triggeredCount: number;
  triggeredAlerts: AlertEvaluationItem[];
  message: string;
}

export interface AlertRunResult {
  run: AlertRunRecord;
  evaluation: AlertEvaluation;
}

export interface KfinHealthCheck {
  id: string;
  label: string;
  status: DataStatus;
  source: string;
  message: string;
  latencyMs: number | null;
}

export interface KfinHealthReport {
  product: "K-Fin Terminal";
  checkedAt: string;
  allowedStatuses: string[];
  liveOrdersEnabled: boolean;
  checks: KfinHealthCheck[];
  summary: Record<DataStatus, number>;
}

export type ModelId = "gpt" | "gemini" | "claude";

export interface ModelMeta {
  id: ModelId;
  label: string;
  provider: string;
  accent: string;
  icon: string;
  invertOnDark?: boolean;
}

export const MODELS: ModelMeta[] = [
  {
    id: "gpt",
    label: "GPT",
    provider: "OpenAI",
    accent: "#10a37f",
    icon: "/icons/gpt.png",
    invertOnDark: true,
  },
  {
    id: "gemini",
    label: "Gemini",
    provider: "Google",
    accent: "#4285f4",
    icon: "/icons/gemini.png",
  },
  {
    id: "claude",
    label: "Claude",
    provider: "Anthropic",
    accent: "#d97757",
    icon: "/icons/claude.png",
  },
];

export const PERPLEXITY_META = {
  label: "Perplexity",
  provider: "Sonar",
  accent: "#20b8cd",
  icon: "/icons/perplexity.png",
};

export type Position = "롱" | "숏" | "관망";

export interface OpinionPayload {
  position: Position;
  confidence: number;
  strength: number;
  target_price: number | null;
  stop_loss: number | null;
  key_reasons: string[];
  body: string;
  entry_score?: number;
  regime?: "추세장" | "횡보장" | "고변동";
  decay_risk?: "낮음" | "보통" | "높음";
}

export interface ModelOpinion extends OpinionPayload {
  modelId: ModelId;
  round: 1 | 2 | 3;
}

export interface TqqtSignal {
  action: "매수" | "관망" | "공매도";
  entry_score: number;
  regime: "추세장" | "횡보장" | "고변동";
  entry_window: string;
  exit_window: string;
  decay_risk: "낮음" | "보통" | "높음";
  key_conditions: string[];
}

export interface SynthesisPayload {
  summary: string;
  consensus: Position;
  target_price: number | null;
  stop_loss: number | null;
  entry_zone: string | null;
  notable_disagreements: string[];
  fresh_insights: string[];
  citations: { title: string; url: string }[];
  warning?: string;
  tqqt_signal?: TqqtSignal;
}

export interface AnalysisRecord {
  id: string;
  ticker: string;
  startedAt: string;
  finishedAt: string | null;
  quote: QuoteSnapshot | null;
  opinions: ModelOpinion[];
  synthesis: SynthesisPayload | null;
}

export type StreamEvent =
  | { type: "start"; ticker: string; quote: QuoteSnapshot | null }
  | { type: "round-begin"; round: 1 | 2 | 3 }
  | { type: "opinion"; opinion: ModelOpinion }
  | { type: "model-error"; modelId: ModelId; round: 1 | 2 | 3; message: string }
  | { type: "synthesis-begin" }
  | { type: "synthesis-delta"; text: string }
  | { type: "synthesis"; payload: SynthesisPayload }
  | { type: "done"; recordId: string }
  | { type: "error"; message: string };

export const LEVERAGED_TICKERS = new Set(["TQQQ", "QQQ", "QLD", "SQQQ", "PSQ", "QQEW"]);

export function isLeveragedTicker(ticker: string): boolean {
  return LEVERAGED_TICKERS.has(ticker.toUpperCase());
}

export interface BacktestTrade {
  date: string;
  ticker: string;
  signal: Position;
  tqqt_action?: TqqtSignal["action"];
  entry_score: number | null;
  open_price: number | null;
  next_close: number | null;
  return_pct: number | null;
  leveraged_return_pct: number | null;
  is_correct: boolean | null;
  record_id: string;
}

export interface BacktestStats {
  ticker: string;
  total_analyses: number;
  traded: number;
  wins: number;
  losses: number;
  win_rate: number;
  avg_win_pct: number;
  avg_loss_pct: number;
  avg_return_pct: number;
  max_drawdown_pct: number;
  cumulative_return_pct: number;
  sharpe: number | null;
  trades: BacktestTrade[];
}

export interface ScheduleConfig {
  enabled: boolean;
  ticker: string;
  hour_kr: number;
  minute_kr: number;
  telegram_bot_token: string;
  telegram_chat_id: string;
  last_run_at: string | null;
  last_run_status: "success" | "error" | null;
}
