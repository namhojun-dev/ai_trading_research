import type { NormalizedTicker } from "./types";
import { findUniverseByName, findUniverseByCode } from "./fetchKoreanUniverse";

/**
 * 입력을 Yahoo 심볼 후보로 정규화한다. 가짜 데이터는 만들지 않으며, 단지
 * 어떤 심볼을 조회할지 후보 목록만 만든다.
 *
 * - "005930"        → ["005930.KS", "005930.KQ"]  (코스피/코스닥 둘 다 확인)
 * - "091990.KQ"     → ["091990.KQ"]               (접미사가 있으면 그대로)
 * - "삼성전자"       → 유니버스에서 이름으로 코드 조회 후 후보 생성
 * - "AAPL"          → ["AAPL"]                     (해외 티커는 그대로; 후속 단계에서 비교 제외)
 */
export function normalizeTicker(input: string): NormalizedTicker {
  const raw = input.trim();
  const upper = raw.toUpperCase();

  // 이미 시장 접미사가 붙은 한국 심볼: 005930.KS / 091990.KQ
  const suffixed = upper.match(/^(\d{6})\.(KS|KQ)$/);
  if (suffixed) {
    return {
      input: raw,
      ticker: suffixed[1],
      candidates: [`${suffixed[1]}.${suffixed[2]}`],
      isKoreanCode: true,
    };
  }

  // 6자리 숫자 코드: 유니버스에 있으면 올바른 시장(.KS/.KQ)을 먼저 시도.
  // (그렇지 않으면 Yahoo 에서 반대 시장 코드가 뮤추얼펀드로 잡히는 충돌 발생)
  if (/^\d{6}$/.test(upper)) {
    const u = findUniverseByCode(upper);
    if (u) {
      const other = u.market === "KOSPI" ? `${upper}.KQ` : `${upper}.KS`;
      return { input: raw, ticker: upper, candidates: [u.ticker, other], isKoreanCode: true };
    }
    return {
      input: raw,
      ticker: upper,
      candidates: [`${upper}.KS`, `${upper}.KQ`],
      isKoreanCode: true,
    };
  }

  // 한글 회사명: 로컬 유니버스에서 코드 조회
  if (/[가-힣]/.test(raw)) {
    const hit = findUniverseByName(raw);
    if (hit) {
      return {
        input: raw,
        ticker: hit.code,
        candidates: [hit.ticker],
        resolvedName: hit.name,
        isKoreanCode: true,
      };
    }
    // 유니버스에 없는 한글명 → 후보 없음 (조회 단계에서 "데이터 없음" 처리)
    return { input: raw, ticker: raw, candidates: [], isKoreanCode: true };
  }

  // 그 외(해외 티커 등): 그대로 사용
  return { input: raw, ticker: upper, candidates: [upper], isKoreanCode: false };
}

/** 우선주(코드 끝자리가 0이 아님, 예: 005935) 휴리스틱. 보통주 코드는 끝자리 0. */
export function looksLikePreferred(code: string): boolean {
  return /^\d{6}$/.test(code) && !code.endsWith("0");
}
