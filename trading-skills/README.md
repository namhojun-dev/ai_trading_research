# 코스닥 스윙 트레이딩 스킬셋

> tradermonty/claude-trading-skills 기반 코스닥 단기 스윙 맞춤 버전

## 구조

```
trading-skills/
├── skills-index.yaml              # 전체 스킬 목록
├── skills/
│   ├── kosdaq-regime-check/       # 시장 국면 판단
│   ├── kosdaq-value-screener/     # 저PER/PBR/EPS 종목 스크리닝
│   ├── kosdaq-position-sizer/     # 포지션 크기 계산
│   ├── kosdaq-theme-detector/     # 주도 테마 탐지
│   └── kosdaq-trade-journal/      # 매매 일지
└── workflows/
    ├── daily-premarket.md         # 장 시작 전 30분 루틴
    └── swing-entry-checklist.md  # 진입 직전 2분 체크리스트
```

## 매일 사용 순서

```
08:30  kosdaq-regime-check    → 오늘 시장 국면
08:40  kosdaq-theme-detector  → 주도 테마 파악
08:50  kosdaq-value-screener  → 후보 종목 압축
09:00  장 시작
진입 전 swing-entry-checklist → 포지션 사이징 + 손절 설정
장 마감 후 kosdaq-trade-journal → 매매 기록
```

## Claude Code에서 사용하는 방법

각 SKILL.md를 Claude 대화에 붙여넣거나,
"kosdaq-regime-check 실행해줘" 형태로 요청하면
해당 스킬의 프로세스를 따라 분석 수행.

## 핵심 원칙

1. 시장 국면 먼저 확인 → 하락장 신규 진입 금지
2. 재무 필터 (흑자 + 저PER + 저PBR) 통과한 종목만
3. 진입 전 반드시 손절가 설정
4. 한 종목 최대 손실 = 계좌의 2%
5. 매매 후 반드시 일지 기록
