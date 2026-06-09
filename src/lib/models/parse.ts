import type { OpinionPayload, Position, SynthesisPayload, TqqtSignal } from "@/lib/types";

const SEPARATOR = "---JSON---";

// sonar-reasoning-pro 같은 모델이 출력하는 <think>...</think> 추론 블록 제거
function stripThinkBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

// 균형 잡힌 중괄호로 첫 JSON 객체 추출 (문자열 내 중괄호/escape 무시)
function findBalancedJsonObject(text: string, startSearchAt = 0): string | null {
  const start = text.indexOf("{", startSearchAt);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function extractJson(text: string): { body: string; jsonStr: string | null } {
  const cleaned = stripThinkBlocks(text);

  // 우선순위 1: ---JSON--- 구분자 뒤
  const sepIdx = cleaned.lastIndexOf(SEPARATOR);
  if (sepIdx !== -1) {
    const after = cleaned.slice(sepIdx + SEPARATOR.length);
    const obj = findBalancedJsonObject(after);
    if (obj) {
      return { body: cleaned.slice(0, sepIdx).trim(), jsonStr: obj };
    }
  }

  // 우선순위 2: ```json 펜스 블록
  const fence = cleaned.match(/```json\s*([\s\S]*?)```/i);
  if (fence) {
    const obj = findBalancedJsonObject(fence[1]);
    if (obj) {
      return {
        body: cleaned.replace(fence[0], "").trim(),
        jsonStr: obj,
      };
    }
  }

  // 우선순위 3: 마지막 balanced { ... } 블록 (탐욕적: 뒤에서 가장 긴 매칭)
  // 모든 시작점에서 시도하고 가장 긴 객체 채택
  let bestObj: string | null = null;
  let bestStart = -1;
  let pos = 0;
  while (pos < cleaned.length) {
    const obj = findBalancedJsonObject(cleaned, pos);
    if (!obj) break;
    if (!bestObj || obj.length > bestObj.length) {
      bestObj = obj;
      bestStart = cleaned.indexOf(obj, pos);
    }
    pos = cleaned.indexOf(obj, pos) + obj.length;
  }
  if (bestObj && bestStart !== -1) {
    return { body: cleaned.slice(0, bestStart).trim(), jsonStr: bestObj };
  }

  return { body: cleaned, jsonStr: null };
}

function tryParseJson(jsonStr: string): Record<string, unknown> {
  try {
    return JSON.parse(jsonStr);
  } catch {
    // 흔한 오류 보정: trailing comma, single quotes, smart quotes
    const repaired = jsonStr
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");
    try {
      return JSON.parse(repaired);
    } catch {
      return {};
    }
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function normalizePosition(p: unknown): Position {
  const s = String(p ?? "").trim();
  if (s === "롱" || s.toLowerCase() === "long" || s.toLowerCase() === "buy") return "롱";
  if (s === "숏" || s.toLowerCase() === "short" || s.toLowerCase() === "sell") return "숏";
  return "관망";
}

export function parseOpinion(text: string): OpinionPayload {
  const { body, jsonStr } = extractJson(text);
  const parsed = jsonStr ? tryParseJson(jsonStr) : {};

  const position = normalizePosition(parsed.position);
  const confidence = clamp(Number(parsed.confidence ?? 50), 0, 100);
  let strength = Number(parsed.strength);
  if (!Number.isFinite(strength)) {
    strength = position === "롱" ? 50 : position === "숏" ? -50 : 0;
  }
  strength = clamp(strength, -100, 100);

  const target_price =
    parsed.target_price === null || parsed.target_price === undefined
      ? null
      : Number(parsed.target_price);
  const stop_loss =
    parsed.stop_loss === null || parsed.stop_loss === undefined
      ? null
      : Number(parsed.stop_loss);

  const key_reasons = Array.isArray(parsed.key_reasons)
    ? parsed.key_reasons.map((r) => String(r)).slice(0, 6)
    : [];

  return {
    position,
    confidence: Math.round(confidence),
    strength: Math.round(strength),
    target_price: target_price !== null && Number.isFinite(target_price) ? target_price : null,
    stop_loss: stop_loss !== null && Number.isFinite(stop_loss) ? stop_loss : null,
    key_reasons,
    body: body || stripThinkBlocks(text).trim(),
  };
}

export function parseSynthesis(text: string): SynthesisPayload {
  const { body, jsonStr } = extractJson(text);
  const parsed = jsonStr ? tryParseJson(jsonStr) : {};

  const rawSummary = parsed.summary ? String(parsed.summary).trim() : "";
  const summary =
    rawSummary ||
    extractFirstParagraph(body) ||
    "[종합 요약 파싱 실패] 모델 응답에서 summary 필드를 추출하지 못했습니다.";

  const consensus = normalizePosition(parsed.consensus);

  const target_price =
    parsed.target_price === null || parsed.target_price === undefined
      ? null
      : Number(parsed.target_price);
  const stop_loss =
    parsed.stop_loss === null || parsed.stop_loss === undefined
      ? null
      : Number(parsed.stop_loss);
  const entry_zone =
    parsed.entry_zone && String(parsed.entry_zone).trim()
      ? String(parsed.entry_zone).trim()
      : null;

  const notable_disagreements = Array.isArray(parsed.notable_disagreements)
    ? parsed.notable_disagreements.map(String).slice(0, 8)
    : [];
  const fresh_insights = Array.isArray(parsed.fresh_insights)
    ? parsed.fresh_insights.map(String).slice(0, 8)
    : [];
  const citations = Array.isArray(parsed.citations)
    ? parsed.citations
        .map((c): { title: string; url: string } | null => {
          if (typeof c === "object" && c !== null && "url" in c) {
            return {
              title: String((c as { title?: unknown }).title ?? ""),
              url: String((c as { url: unknown }).url),
            };
          }
          if (typeof c === "string") {
            return { title: c, url: c };
          }
          return null;
        })
        .filter((x): x is { title: string; url: string } => x !== null)
        .slice(0, 12)
    : [];
  const warning = parsed.warning ? String(parsed.warning) : undefined;

  // tqqt_signal 파싱 (레버리지 티커 전용)
  let tqqt_signal: TqqtSignal | undefined;
  const raw = parsed.tqqt_signal;
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const action = String(r.action ?? "관망");
    const normalizedAction =
      action === "매수" ? "매수" : action === "공매도" ? "공매도" : "관망";
    const regime = String(r.regime ?? "횡보장");
    const normalizedRegime =
      regime === "추세장" ? "추세장" : regime === "고변동" ? "고변동" : "횡보장";
    const decay = String(r.decay_risk ?? "보통");
    const normalizedDecay =
      decay === "낮음" ? "낮음" : decay === "높음" ? "높음" : "보통";

    tqqt_signal = {
      action: normalizedAction as "매수" | "관망" | "공매도",
      entry_score: clamp(Number(r.entry_score ?? 50), 0, 100),
      regime: normalizedRegime as "추세장" | "횡보장" | "고변동",
      entry_window: String(r.entry_window ?? "장 시작 30분 후"),
      exit_window: String(r.exit_window ?? "장 마감 1시간 전"),
      decay_risk: normalizedDecay as "낮음" | "보통" | "높음",
      key_conditions: Array.isArray(r.key_conditions)
        ? r.key_conditions.map(String).slice(0, 5)
        : [],
    };
  }

  return {
    summary,
    consensus,
    target_price: target_price !== null && Number.isFinite(target_price) ? target_price : null,
    stop_loss: stop_loss !== null && Number.isFinite(stop_loss) ? stop_loss : null,
    entry_zone,
    notable_disagreements,
    fresh_insights,
    citations,
    warning,
    ...(tqqt_signal ? { tqqt_signal } : {}),
  };
}

// 마크다운 헤더/포맷 제거하고 첫 의미있는 단락만 반환 (max ~280자)
function extractFirstParagraph(body: string): string {
  if (!body) return "";
  const stripped = body
    .replace(/^#{1,6}\s+.*$/gm, "") // markdown headers
    .replace(/^---+\s*$/gm, "") // hr
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/`([^`]+)`/g, "$1") // inline code
    .trim();
  const firstPara = stripped.split(/\n\s*\n/).find((p) => p.trim().length > 30) ?? "";
  const single = firstPara.replace(/\s+/g, " ").trim();
  return single.length > 280 ? single.slice(0, 280).trimEnd() + "…" : single;
}
