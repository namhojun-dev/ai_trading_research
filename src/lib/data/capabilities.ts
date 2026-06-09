import type { DataCapability } from "@/lib/types";

export function getTerminalCapabilities(configuredProviders = new Set<string>(), isAuthenticated = false): DataCapability[] {
  const hasProvider = (provider: string) => configuredProviders.has(provider);
  const personalStatus = isAuthenticated ? "actual" : "permission_denied";
  const personalMessage = (label: string) =>
    isAuthenticated
      ? `${label} 기능은 현재 로그인 세션의 서버 저장소에 연결되어 있습니다.`
      : `${label} 기능은 로그인 세션이 필요합니다.`;

  return [
    {
      id: "earnings-calendar",
      label: "실적 캘린더",
      status: process.env.FINNHUB_API_KEY || hasProvider("finnhub")
        ? "actual"
        : "api_required",
      source: "Finnhub / Polygon",
      message: "EPS, 매출 컨센서스, 발표 일정은 공급자 API 키 연결 후 활성화됩니다.",
      apiKeyRequired: true,
    },
    {
      id: "options-chain",
      label: "옵션 체인",
      status: process.env.POLYGON_API_KEY || hasProvider("polygon") ? "actual" : "api_required",
      source: "OPRA licensed feed / Polygon",
      message: "실시간 옵션 체인과 IV/OI는 유료 OPRA 계열 데이터 권한이 필요합니다.",
      apiKeyRequired: true,
    },
    {
      id: "rates",
      label: "금리",
      status: process.env.FRED_API_KEY || hasProvider("fred") ? "actual" : "api_required",
      source: "FRED",
      message: "정식 금리 시계열은 FRED API 키 연결 후 활성화됩니다. 일부 수익률 심볼은 지연 시세로 조회됩니다.",
      apiKeyRequired: true,
    },
    {
      id: "dart",
      label: "DART 공시",
      status: process.env.OPENDART_API_KEY || hasProvider("opendart") ? "actual" : "api_required",
      source: "OpenDART",
      message: "한국 기업 공시는 OpenDART API 키와 corp_code 매핑 연결 후 활성화됩니다.",
      apiKeyRequired: true,
    },
    {
      id: "portfolio",
      label: "포트폴리오 저장",
      status: personalStatus,
      source: "User database",
      message: personalMessage("포트폴리오 저장"),
      authRequired: true,
    },
    {
      id: "watchlist",
      label: "관심종목 저장",
      status: personalStatus,
      source: "User database",
      message: personalMessage("관심종목 저장"),
      authRequired: true,
    },
    {
      id: "api-keys",
      label: "API 키 저장",
      status: personalStatus,
      source: "Encrypted user secrets",
      message: personalMessage("API 키 저장"),
      authRequired: true,
    },
    {
      id: "orders",
      label: "실제 주문",
      status: "permission_denied",
      source: "Broker API",
      message: "주문 기능은 기본 비활성화되어 있으며 별도 권한과 명시적 활성화가 필요합니다.",
      authRequired: true,
      apiKeyRequired: true,
    },
  ];
}
