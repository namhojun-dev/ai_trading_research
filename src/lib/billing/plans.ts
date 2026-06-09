export type LifeOSPlanId = "FREE" | "PREMIUM" | "VIP";

export interface LifeOSPlan {
  id: LifeOSPlanId;
  priceKrw: number;
  goalLimit: number | null;
  features: string[];
}

export const LIFEOS_PLANS: LifeOSPlan[] = [
  {
    id: "FREE",
    priceKrw: 0,
    goalLimit: 3,
    features: ["목표 3개", "기본 Life Score", "Rule-based 목표 확률"],
  },
  {
    id: "PREMIUM",
    priceKrw: 9900,
    goalLimit: null,
    features: ["무제한 목표", "고급 행동 분석", "AI 일정 생성", "습관 제거 우선순위"],
  },
  {
    id: "VIP",
    priceKrw: 29900,
    goalLimit: null,
    features: ["음성 AI", "심층 분석", "웨어러블 연동 우선 지원", "캐릭터 고급 보상"],
  },
];

export function getPlan(id: LifeOSPlanId) {
  return LIFEOS_PLANS.find((plan) => plan.id === id);
}
