import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { ComparableCompany, CompanyProfile } from "./types";

type SummaryInput = {
  baseCompany: CompanyProfile;
  kospi: ComparableCompany[];
  kosdaq: ComparableCompany[];
};

function fmt(n: number | null | undefined, digits = 1): string {
  return n == null ? "데이터 없음" : n.toFixed(digits);
}

function line(c: ComparableCompany): string {
  return `${c.name}(${c.market}) PER ${fmt(c.per)}, EPS ${
    c.eps == null ? "데이터 없음" : Math.round(c.eps).toLocaleString()
  }, ROE ${fmt(c.roe)}%, 최종점수 ${c.finalScore}`;
}

/** LLM 호출 실패/키 없음 시: 계산된 실제 값만으로 결정론적 요약 생성 (가짜값 없음). */
function fallbackSummary({ baseCompany, kospi, kosdaq }: SummaryInput): string {
  const parts: string[] = [];
  parts.push(`기준 종목 ${baseCompany.name} 기준 유사 종목 상대 저평가 비교 결과입니다.`);
  if (kospi[0]) parts.push(`코스피 1위는 ${kospi[0].name}로 ${kospi[0].reason} (최종점수 ${kospi[0].finalScore}).`);
  else parts.push("코스피에서는 비교 가능한 유사 종목을 찾지 못했습니다.");
  if (kosdaq[0]) parts.push(`코스닥 1위는 ${kosdaq[0].name}로 ${kosdaq[0].reason} (최종점수 ${kosdaq[0].finalScore}).`);
  else parts.push("코스닥에서는 비교 가능한 유사 종목을 찾지 못했습니다.");
  parts.push("순위는 PER·EPS·ROE 등 정량 점수로 계산되었으며, 데이터가 없는 항목은 점수에서 제외되었습니다.");
  return parts.join(" ");
}

/**
 * 최종 해석 문장 생성. LLM 은 오직 코드가 계산한 숫자만 해석하며, 숫자를 새로
 * 만들지 않는다. 키가 없거나 실패하면 동일 데이터로 결정론적 요약을 반환한다.
 */
export async function generateComparableSummary(input: SummaryInput): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackSummary(input);
  }

  const { baseCompany, kospi, kosdaq } = input;
  const context = [
    `기준 종목: ${baseCompany.name} (${baseCompany.market})`,
    `기준 PER: ${fmt(baseCompany.metrics.per)}, EPS: ${
      baseCompany.metrics.eps == null ? "데이터 없음" : Math.round(baseCompany.metrics.eps).toLocaleString()
    }, ROE: ${fmt(baseCompany.metrics.roe)}%`,
    "",
    "코스피 유사 종목 (최종점수 순):",
    ...kospi.slice(0, 5).map((c, i) => `${i + 1}. ${line(c)}`),
    "",
    "코스닥 유사 종목 (최종점수 순):",
    ...kosdaq.slice(0, 5).map((c, i) => `${i + 1}. ${line(c)}`),
  ].join("\n");

  const system =
    "너는 한국 주식 애널리스트다. 아래에 주어진 숫자만 사용해 2~4문장의 한국어 해석을 작성한다. " +
    "절대 새로운 숫자(PER·EPS·주가·ROE 등)를 만들지 말 것. 주어지지 않은 종목을 언급하지 말 것. " +
    "어떤 종목이 사업 유사도가 높은지, 어떤 종목이 실적 대비 상대적으로 저평가로 보이는지 균형 있게 서술한다. " +
    "투자 권유 표현은 피하고 비교 관점만 제시한다.";

  try {
    const { text } = await generateText({
      model: openai("gpt-5.4"),
      system,
      prompt: context,
      maxRetries: 1,
    });
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : fallbackSummary(input);
  } catch {
    return fallbackSummary(input);
  }
}
