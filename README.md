# AI Compete · 멀티 LLM 주식 포지션 분석

여러 LLM(GPT · Gemini · Claude)이 한 종목을 두고 **3라운드 토론**으로 매매 시그널(롱/숏/관망)을 만들고,
Perplexity가 이를 종합한 뒤, 과거 분석 기록을 **백테스트로 검증**하는 멀티에이전트 분석 앱.

## 분석 흐름

1. **Round 1** — GPT · Gemini · Claude가 각자 독립 분석 (포지션 / 확신도 / 목표가 / 손절)
2. **Round 2** — 서로의 1라운드 의견을 보고 재평가
3. **Round 3** — 토론 후 최종 의견 확정
4. **종합** — Perplexity(Sonar)가 최종 의견들을 종합해 컨센서스 시그널 + (레버리지 종목은) TQQT 시그널 생성
5. **저장** — 분석 결과를 `data/history`에 기록
6. **백테스트** — 저장된 시그널을 다음 거래일 open→close 수익률로 검증 (승률 / 평균손익 / MDD / 샤프)

레버리지 ETF(TQQQ 등)는 단타 전용 시스템 프롬프트가 적용됩니다.
시세·히스토리는 Yahoo Finance(키 불필요)에서 가져옵니다.

## 구성

- 오케스트레이터: `src/lib/orchestrator/index.ts`
- 모델 어댑터 / 프롬프트: `src/lib/models/` (gpt · gemini · claude · perplexity)
- 백테스트 엔진: `src/lib/backtest/engine.ts`
- 데이터: `src/lib/data/` (quote · prices · history · tickers)
- 대시보드 UI: `src/app/page.tsx`, `src/components/`
- 백테스트 UI: `src/app/backtest/page.tsx`

## API

- `POST /api/analyze` — 멀티 LLM 분석 (SSE 스트리밍)
- `GET  /api/backtest` — 저장된 분석 기록 백테스트
- `GET  /api/tickers` — 티커 검색(자동완성)

## Run

```bash
npm install
npm run dev -- --hostname 0.0.0.0 --port 3200
```

열기: http://127.0.0.1:3200

## Verify

```bash
npm run build
```

## Environment

`.env.local.example`를 `.env.local`로 복사한 뒤 LLM 키 4개를 채웁니다.

- `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`

시장 데이터는 Yahoo Finance를 쓰므로 별도 키가 필요 없습니다.

## Disclaimer

본 앱의 출력은 투자 자문이 아니며 교육·연구 목적입니다. 모든 매매 판단과 책임은 사용자에게 있습니다.
