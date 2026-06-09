import { DATA_STATUS_LABEL, type DataStatus, type KfinHealthCheck, type KfinHealthReport } from "@/lib/types";
import { getTerminalCapabilities } from "./capabilities";
import { fetchSecFilings } from "./filings";
import { getMarketSnapshot } from "./market";
import { fetchMarketNews } from "./news";

const ALLOWED_STATUSES = Object.values(DATA_STATUS_LABEL);

export async function getKfinHealthReport(): Promise<KfinHealthReport> {
  const checks = await Promise.all([
    timedCheck("market-public", "비로그인 시장 데이터", async () => {
      const snapshot = await getMarketSnapshot(["AAPL", "QQQ", "^GSPC", "KRW=X", "GC=F", "005930.KS"]);
      const usable = snapshot.quotes.filter((quote) => quote.price !== null);
      return {
        status: usable.length > 0 ? "delayed" : "no_data",
        source: "Yahoo Finance chart API",
        message:
          usable.length > 0
            ? `공개 지연 시세 ${usable.length}/${snapshot.quotes.length}개 조회됨`
            : "조회 가능한 공개 시세가 없습니다.",
      };
    }),
    timedCheck("news-public", "비로그인 뉴스", async () => {
      const news = await fetchMarketNews(5);
      return {
        status: news.status,
        source: news.source,
        message: news.message ?? `뉴스 ${news.data.length}건`,
      };
    }),
    timedCheck("sec-filings", "SEC 공시", async () => {
      const filings = await fetchSecFilings("AAPL", 3);
      return {
        status: filings.status,
        source: filings.source,
        message: filings.message ?? `SEC 공시 ${filings.data.length}건`,
      };
    }),
    timedCheck("api-gated", "실적/옵션/금리/DART API 상태", async () => {
      const gated = getTerminalCapabilities().filter((item) =>
        ["earnings-calendar", "options-chain", "rates", "dart"].includes(item.id),
      );
      const actual = gated.filter((item) => item.status === "actual").length;
      return {
        status: actual > 0 ? "actual" : "api_required",
        source: gated.map((item) => item.source).join(" / "),
        message:
          actual > 0
            ? `API 연결 데이터 ${actual}/${gated.length}개 활성`
            : "실적, 옵션, 정식 금리, DART는 API 키 연결 전까지 API 필요 상태입니다.",
      };
    }),
    timedCheck("personal-auth", "로그인 저장 영역", async () => ({
      status: "permission_denied",
      source: "K-Fin local auth / user store",
      message: "비로그인 요청은 포트폴리오, 관심종목, API 키, AI 설정, 레이아웃, 알림 저장에 접근할 수 없습니다.",
    })),
    timedCheck("orders-disabled", "실제 주문 기본 비활성", async () => ({
      status: "permission_denied",
      source: "K-Fin order gateway",
      message:
        process.env.KFIN_ENABLE_LIVE_ORDERS === "true"
          ? "실제 주문 플래그가 켜져 있습니다. 브로커 어댑터와 사용자 권한 검사가 필요합니다."
          : "실제 주문은 기본 비활성화되어 있습니다.",
    })),
  ]);

  return {
    product: "K-Fin Terminal",
    checkedAt: new Date().toISOString(),
    allowedStatuses: ALLOWED_STATUSES,
    liveOrdersEnabled: process.env.KFIN_ENABLE_LIVE_ORDERS === "true",
    checks,
    summary: summarize(checks),
  };
}

async function timedCheck(
  id: string,
  label: string,
  run: () => Promise<Omit<KfinHealthCheck, "id" | "label" | "latencyMs">>,
): Promise<KfinHealthCheck> {
  const startedAt = Date.now();
  try {
    const result = await run();
    return {
      id,
      label,
      ...result,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      id,
      label,
      status: "error",
      source: "K-Fin health runner",
      message: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - startedAt,
    };
  }
}

function summarize(checks: KfinHealthCheck[]): Record<DataStatus, number> {
  const summary: Record<DataStatus, number> = {
    actual: 0,
    delayed: 0,
    api_required: 0,
    no_data: 0,
    permission_denied: 0,
    error: 0,
  };
  for (const check of checks) summary[check.status]++;
  return summary;
}
