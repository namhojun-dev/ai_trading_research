---
name: kosdaq-trade-journal
description: 코스닥 스윙 매매 일지 기록 및 분석. 진입/청산 이유, 손익, 반성 기록. 테마별/패턴별 승률 추적. 매매 직후 또는 장 마감 후 실행.
---

# 코스닥 매매 일지

## 매매 기록 템플릿

```yaml
trade:
  date: "YYYY-MM-DD"
  ticker: "종목코드"
  name: "종목명"
  
  entry:
    price: 0        # 매수가
    quantity: 0     # 수량
    total: 0        # 총 매수금액
    reason: ""      # 진입 이유 (테마/저평가/패턴)
    theme: ""       # AI반도체/방산/광통신 등
    regime: ""      # 당일 시장 국면
    pattern: ""     # 눌림목/돌파/반등/모멘텀추격
  
  exit:
    price: 0
    quantity: 0
    date: "YYYY-MM-DD"
    reason: ""      # 목표가달성/손절/테마소멸/시장악화
  
  result:
    pnl_amount: 0   # 손익 금액
    pnl_pct: 0.0    # 손익 %
    hold_days: 0    # 보유 기간
  
  review:
    what_worked: ""     # 잘된 점
    what_failed: ""     # 잘못된 점
    lesson: ""          # 다음에 적용할 교훈
    rule_violation: ""  # 어긴 원칙 (없으면 "없음")
```

---

## 저장 경로

```
trading-skills/journal/
  YYYY-MM-DD_종목명.yaml   # 개별 매매 기록
  summary.yaml              # 월별 성과 요약
```

---

## 월간 성과 요약 계산

장 마감 또는 월말에 실행:

```
=== 월간 성과 요약 ===
총 매매 횟수: N회
승률: XX% (승 N / 패 N)
평균 수익: +X.X%
평균 손실: -X.X%
리스크/리워드: 1 : X.X
총 손익: +/-XXX,XXX원

[테마별 승률]
  AI반도체: X/N (XX%)
  방산:     X/N (XX%)
  저평가:   X/N (XX%)

[패턴별 승률]
  눌림목 매수: XX%
  돌파 매수:   XX%
  모멘텀 추격: XX%

[가장 많이 어긴 원칙]
  1. [원칙명]: N회
```

---

## 자동 교훈 추출 규칙

기록이 5개 이상 쌓이면 다음을 분석:

| 분석 항목 | 목적 |
|---------|------|
| 손절 미이행 건수 | 원칙 준수도 |
| 모멘텀 추격 매수 결과 | 추격 매수 자제 근거 |
| 국면 무시 진입 결과 | regime-check 중요성 |
| 거래대금 낮은 종목 결과 | 유동성 필터 정당성 |

---

## 빠른 기록 명령어

"오늘 [종목명] [매수/매도] [가격]에 [수량]주 [이유]" 형태로 입력하면
자동으로 YAML 형식으로 변환해서 저장 경로 출력.
