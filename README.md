# AI Compete · 멀티 LLM 주식 포지션 분석

여러 LLM(GPT, Gemini)이 한 종목을 두고 **3라운드 토론**을 벌여 매매 시그널(롱/숏/관망)을 만들고,
Perplexity가 이를 종합한 뒤, 과거 분석 기록을 **백테스트로 검증**하는 멀티에이전트 분석 시스템입니다.

## 분석 흐름

1. **Round 1** — GPT·Gemini가 각자 독립적으로 종목을 분석 (포지션 / 확신도 / 목표가 / 손절)
2. **Round 2** — 서로의 1라운드 의견을 보고 재평가
3. **Round 3** — 토론 후 최종 의견 확정
4. **종합(Synthesis)** — Perplexity(Sonar)가 최종 의견들을 종합해 컨센서스 시그널 + (레버리지 종목은) TQQT 시그널 생성
5. **저장** — 분석 결과를 `data/history`에 기록
6. **백테스트** — 저장된 시그널을 다음 거래일 open→close 수익률로 검증 (승률 / 평균손익 / MDD / 샤프)

레버리지 ETF(TQQQ 등)는 단타 전용 시스템 프롬프트가 적용됩니다.

## 구성

- 오케스트레이터: `src/lib/orchestrator/index.ts`
- 모델 어댑터 / 프롬프트: `src/lib/models/`
- 백테스트 엔진: `src/lib/backtest/engine.ts`
- 시장 데이터 제공자 (K-Fin 터미널): `src/lib/data/`, `src/lib/server/kfin-store.ts`
- 분석 대시보드 UI: `src/app/page.tsx`, `src/components/`
- 백테스트 UI: `src/app/backtest/page.tsx`

## 주요 API

- `POST /api/analyze` — 멀티 LLM 분석 (SSE 스트리밍)
- `GET  /api/backtest` — 저장된 분석 기록 백테스트
- `GET  /api/history` — 분석 기록 조회
- `GET  /api/quote` · `/api/market` · `/api/news` · `/api/rates` · `/api/tickers` — 시장 데이터
- `GET  /api/earnings` · `/api/filings` · `/api/dart` · `/api/options` — 펀더멘털 / 공시 / 옵션
- `GET|POST /api/orders` · `/api/portfolio/valuation` · `/api/user-state` — 포트폴리오 (K-Fin 터미널)
- `POST /api/alerts/run` · `/api/alerts/evaluate` — 알림
- `GET  /api/kfin/health` · `/api/capabilities` — 상태 / 가용 기능

## Run

```bash
PATH=$HOME/.nvm/versions/node/v22.22.2/bin:$PATH npm install
PATH=$HOME/.nvm/versions/node/v22.22.2/bin:$PATH npm run dev -- --hostname 0.0.0.0 --port 3200
```

열기: http://127.0.0.1:3200

## Verify

```bash
npm run build
npm run test:kfin   # K-Fin 터미널 스모크 테스트
```

## Environment

`.env.local.example`를 `.env.local`로 복사한 뒤 필요한 키만 채웁니다.

- LLM: `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `PERPLEXITY_API_KEY`
- 시장 데이터: `FINNHUB_API_KEY`, `POLYGON_API_KEY`, `FRED_API_KEY`, `OPENDART_API_KEY`, `SEC_USER_AGENT`
- 일일 분석 알림: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

## 일일 자동 분석

`scripts/daily-analysis.mjs` — 지정 종목 분석 후 Telegram 알림 (crontab 등록 예시는 스크립트 헤더 참고).

## 한국 코스닥 스윙 스킬셋

`trading-skills/` — Claude Code용 코스닥 단기 스윙 트레이딩 스킬셋. 자세한 내용은 `trading-skills/README.md` 참고.

## Disclaimer

본 시스템의 출력은 투자 자문이 아니며 교육·연구 목적입니다. 모든 매매 판단과 책임은 사용자에게 있습니다.
