import type { TerminalModule, WatchSymbol } from "@/lib/types";
import { fetchQuote } from "./quote";

export const DEFAULT_WATCHLIST: WatchSymbol[] = [
  { symbol: "AAPL", label: "Apple", assetClass: "us_stock" },
  { symbol: "NVDA", label: "NVIDIA", assetClass: "us_stock" },
  { symbol: "MSFT", label: "Microsoft", assetClass: "us_stock" },
  { symbol: "QQQ", label: "Nasdaq 100 ETF", assetClass: "etf" },
  { symbol: "SPY", label: "S&P 500 ETF", assetClass: "etf" },
  { symbol: "^GSPC", label: "S&P 500 Index", assetClass: "index" },
  { symbol: "^TNX", label: "US 10Y Yield", assetClass: "rate" },
  { symbol: "KRW=X", label: "USD/KRW", assetClass: "fx" },
  { symbol: "GC=F", label: "Gold Futures", assetClass: "commodity" },
  { symbol: "CL=F", label: "WTI Crude Futures", assetClass: "commodity" },
  { symbol: "005930.KS", label: "Samsung Electronics", assetClass: "korea_stock" },
];

const TERMINAL_MODULES: TerminalModule[] = [
  {
    id: "us-equities",
    title: "미국 주식/ETF/지수",
    category: "markets",
    status: "delayed",
    source: "Yahoo Finance chart API",
    description: "공개 시세 기반 가격, 등락률, 거래량",
    updatedAt: null,
  },
  {
    id: "news",
    title: "뉴스",
    category: "news",
    status: "actual",
    source: "MarketWatch RSS / Investing.com RSS",
    description: "비로그인 공개 시장 뉴스 RSS",
    updatedAt: null,
  },
  {
    id: "sec-filings",
    title: "SEC 공시",
    category: "filings",
    status: "actual",
    source: "SEC EDGAR submissions API",
    description: "미국 상장사 최근 10-K, 10-Q, 8-K, Form 4",
    updatedAt: null,
  },
  {
    id: "earnings",
    title: "실적/캘린더",
    category: "markets",
    status: "api_required",
    source: "Finnhub / Polygon / Nasdaq Data Link",
    description: "발표 일정, EPS, 매출 컨센서스",
    updatedAt: null,
    apiKeyRequired: true,
  },
  {
    id: "options",
    title: "옵션",
    category: "markets",
    status: "api_required",
    source: "OPRA licensed feed / Polygon",
    description: "체인, IV, OI, 만기별 스큐",
    updatedAt: null,
    apiKeyRequired: true,
  },
  {
    id: "fx-rates-commodities",
    title: "환율/금리/원자재",
    category: "macro",
    status: "delayed",
    source: "Yahoo Finance symbols / FRED API optional",
    description: "환율과 선물 심볼은 공개 시세, 금리는 FRED 키 필요",
    updatedAt: null,
  },
  {
    id: "korea-equities",
    title: "한국 주식",
    category: "markets",
    status: "delayed",
    source: "Yahoo Finance .KS/.KQ symbols",
    description: "기본 한국 주식 시세는 지연 공개 심볼로 조회, KRX 정식 데이터는 API 필요",
    updatedAt: null,
  },
  {
    id: "dart",
    title: "DART 공시",
    category: "filings",
    status: "api_required",
    source: "OpenDART",
    description: "OpenDART API 키 연결 후 회사별 공시 조회",
    updatedAt: null,
    apiKeyRequired: true,
  },
  {
    id: "portfolio",
    title: "포트폴리오/관심종목 저장",
    category: "personal",
    status: "permission_denied",
    source: "User database",
    description: "로그인 사용자 전용 저장 영역",
    updatedAt: null,
    authRequired: true,
  },
  {
    id: "ai-settings",
    title: "API 키/AI 설정/레이아웃/알림",
    category: "personal",
    status: "permission_denied",
    source: "User profile",
    description: "로그인 사용자 전용 개인화 설정",
    updatedAt: null,
    authRequired: true,
  },
  {
    id: "trading",
    title: "실제 주문",
    category: "execution",
    status: "permission_denied",
    source: "Broker API",
    description: "기본 비활성화. 별도 권한과 명시적 활성화 필요",
    updatedAt: null,
    authRequired: true,
    apiKeyRequired: true,
  },
];

export function getTerminalModules(
  fetchedAt: string,
  configuredProviders = new Set<string>(),
  isAuthenticated = false,
): TerminalModule[] {
  return TERMINAL_MODULES.map((module) => {
    if (module.id === "earnings") {
      const enabled = Boolean(
        process.env.FINNHUB_API_KEY || configuredProviders.has("finnhub"),
      );
      return {
        ...module,
        status: enabled ? "actual" : "api_required",
        updatedAt: enabled ? fetchedAt : null,
      };
    }
    if (module.id === "options") {
      const enabled = Boolean(process.env.POLYGON_API_KEY || configuredProviders.has("polygon"));
      return {
        ...module,
        status: enabled ? "actual" : "api_required",
        updatedAt: enabled ? fetchedAt : null,
      };
    }
    if (module.id === "dart") {
      const enabled = Boolean(process.env.OPENDART_API_KEY || configuredProviders.has("opendart"));
      return {
        ...module,
        status: enabled ? "actual" : "api_required",
        updatedAt: enabled ? fetchedAt : null,
      };
    }
    if (module.id === "portfolio" || module.id === "ai-settings") {
      return {
        ...module,
        status: isAuthenticated ? "actual" : "permission_denied",
        updatedAt: isAuthenticated ? fetchedAt : null,
        description: isAuthenticated
          ? "로그인 사용자 전용 저장 영역이 활성화됨"
          : module.description,
      };
    }
    return module.status === "delayed" ? { ...module, updatedAt: fetchedAt } : module;
  });
}

export async function getMarketSnapshot(
  symbols: string[],
  configuredProviders = new Set<string>(),
  isAuthenticated = false,
) {
  const uniqueSymbols = Array.from(
    new Set(symbols.map((symbol) => symbol.trim()).filter(Boolean)),
  ).slice(0, 16);
  const quotes = await Promise.all(uniqueSymbols.map((symbol) => fetchQuote(symbol)));
  const fetchedAt = new Date().toISOString();
  const modules = getTerminalModules(fetchedAt, configuredProviders, isAuthenticated);

  return {
    fetchedAt,
    quotes,
    modules,
  };
}
