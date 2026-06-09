"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  ChevronRight,
  Clock3,
  LineChart,
  Languages,
  Plus,
  Send,
  Smartphone,
  Target,
  Trophy,
  UserRound,
  Zap,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import type {
  Assistant,
  AssistantPersona,
  CoachingResponse,
  Goal,
  GoalPriority,
  GoalProbability,
  HabitInterference,
  Intervention,
  LifeScoreResult,
  ScheduleBlock,
} from "@/features/lifeos/domain/entities";
import { getLifeOSMessages } from "@/lib/i18n/lifeos";
import { cn } from "@/lib/utils";
import { useLifeOSUIStore, type LifeOSViewId } from "./use-lifeos-ui-store";

interface DashboardPayload {
  lifeScore: LifeScoreResult;
  goals: Goal[];
  probabilities: GoalProbability[];
  schedule: ScheduleBlock[];
  assistant: Assistant;
  coach: CoachingResponse;
  interferences: HabitInterference[];
  intervention: Intervention;
}

type LifeOSMessages = ReturnType<typeof getLifeOSMessages>;

const navItems: Array<{ id: LifeOSViewId; label: string; icon: typeof Target }> = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "goals", label: "Goals", icon: Target },
  { id: "assistant", label: "Assistant", icon: Bot },
  { id: "analytics", label: "Analytics", icon: LineChart },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "profile", label: "Profile", icon: UserRound },
];

const personaOptions: Array<{ id: AssistantPersona; label: string; tone: string }> = [
  { id: "ceo", label: "CEO", tone: "성과와 우선순위 중심" },
  { id: "fitness_coach", label: "운동코치", tone: "루틴과 회복 중심" },
  { id: "drill_sergeant", label: "군대조교", tone: "강한 실행 압박" },
  { id: "butler", label: "집사", tone: "정돈된 생활 관리" },
  { id: "future_self", label: "미래의 나", tone: "장기 확률 최적화" },
];

const analyticsData = [
  { name: "운동", value: 38, target: 45 },
  { name: "수면", value: 64, target: 75 },
  { name: "공부", value: 72, target: 90 },
  { name: "SNS", value: 96, target: 40 },
  { name: "영상", value: 88, target: 35 },
];

const intentStyle: Record<ScheduleBlock["intent"], string> = {
  sleep: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  work: "border-stone-300/25 bg-stone-300/10 text-stone-100",
  exercise: "border-orange-300/30 bg-orange-300/10 text-orange-100",
  focus: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  recovery: "border-lime-300/30 bg-lime-300/10 text-lime-100",
  review: "border-amber-300/30 bg-amber-300/10 text-amber-100",
};

function probabilityFor(probabilities: GoalProbability[], goalId: string) {
  return probabilities.find((item) => item.goalId === goalId);
}

function priorityLabel(priority: GoalPriority) {
  return priority === "high" ? "높음" : priority === "medium" ? "보통" : "낮음";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(value));
}

export function LifeOSDashboard() {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const { activeView, locale, setActiveView, toggleLocale } = useLifeOSUIStore();
  const messages = getLifeOSMessages(locale);
  const [savingGoal, setSavingGoal] = useState(false);
  const [scheduleState, setScheduleState] = useState({
    workStart: "09:30",
    workEnd: "18:30",
    sleepStart: "23:30",
    sleepEnd: "07:00",
  });
  const [goalForm, setGoalForm] = useState({
    title: "마라톤 10km 완주",
    description: "주 4회 러닝과 수면 회복을 유지한다.",
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 68).toISOString().slice(0, 10),
    priority: "high" as GoalPriority,
  });

  async function loadDashboard() {
    const response = await fetch("/api/life-score", { cache: "no-store" });
    setPayload((await response.json()) as DashboardPayload);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const primaryGoal = useMemo(() => {
    if (!payload?.goals.length) return null;
    return [...payload.goals].sort((a, b) => {
      const aProbability = probabilityFor(payload.probabilities, a.id)?.probability ?? 0;
      const bProbability = probabilityFor(payload.probabilities, b.id)?.probability ?? 0;
      return aProbability - bProbability;
    })[0];
  }, [payload]);

  async function createGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingGoal(true);
    await fetch("/api/goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...goalForm,
        deadline: new Date(`${goalForm.deadline}T23:59:00`).toISOString(),
      }),
    });
    await loadDashboard();
    setSavingGoal(false);
  }

  async function updatePersona(persona: AssistantPersona) {
    const option = personaOptions.find((item) => item.id === persona);
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        persona,
        name: persona === "future_self" ? "Mira" : option?.label ?? "LifeOS",
        personality: option?.tone ?? "Goal optimizer",
      }),
    });
    const data = (await response.json()) as { assistant: Assistant };
    setPayload((current) => (current ? { ...current, assistant: data.assistant } : current));
  }

  async function generateSchedule() {
    const response = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scheduleState),
    });
    const data = (await response.json()) as { schedule: ScheduleBlock[] };
    setPayload((current) => (current ? { ...current, schedule: data.schedule } : current));
  }

  if (!payload) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
          <Activity className="h-4 w-4 animate-pulse text-[var(--color-accent)]" />
          {messages.appName} analysis engine loading
        </div>
      </main>
    );
  }

  const probability = primaryGoal ? probabilityFor(payload.probabilities, primaryGoal.id) : null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col lg:flex-row">
        <aside className="border-b border-[var(--color-border)] bg-[var(--color-rail)]/95 px-4 py-4 lg:w-[248px] lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-lime-300/30 bg-lime-300/10">
              <Zap className="h-5 w-5 text-lime-200" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">LifeOS AI</h1>
              <p className="text-xs text-[var(--color-muted)]">Goal Probability Engine</p>
            </div>
          </div>

          <nav className="mt-5 grid grid-cols-3 gap-2 lg:grid-cols-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={cn(
                    "flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition lg:justify-start",
                    activeView === item.id
                      ? "border-lime-300/40 bg-lime-300/12 text-lime-100"
                      : "border-transparent text-[var(--color-muted-foreground)] hover:border-[var(--color-border)] hover:bg-white/[0.04]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              );
            })}
          </nav>

          <div className="mt-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="flex items-center gap-3">
              <img src={payload.assistant.avatar} alt="" className="h-12 w-12 rounded-lg border border-lime-200/20" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{payload.assistant.name}</p>
                <p className="text-xs text-[var(--color-muted)]">Level {payload.assistant.level}</p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/30">
              <div className="h-full rounded-full bg-lime-300" style={{ width: `${payload.assistant.experience % 100}%` }} />
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-4 sm:px-6 lg:px-7">
          <header className="mb-5 flex flex-col gap-3 border-b border-[var(--color-border)] pb-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-200">AI life operating system</p>
              <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">{messages.dashboardTitle}</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <MetricPill icon={Activity} label={messages.lifeScore} value={`${payload.lifeScore.today}`} />
              <MetricPill icon={Target} label="위험 목표" value={primaryGoal ? `${probability?.probability ?? 0}%` : "-"} />
              <MetricPill icon={AlertTriangle} label={messages.habitInterference} value={`${payload.interferences.length}`} />
              <MetricPill icon={Bell} label={messages.intervention} value={payload.intervention.shouldSend ? "ON" : "OFF"} />
              <button
                type="button"
                onClick={toggleLocale}
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-semibold text-lime-100"
                aria-label="Toggle language"
              >
                <Languages className="h-4 w-4" />
                {locale.toUpperCase()}
              </button>
            </div>
          </header>

          {activeView === "dashboard" && <DashboardView payload={payload} messages={messages} />}
          {activeView === "goals" && (
            <GoalsView
              payload={payload}
              form={goalForm}
              saving={savingGoal}
              setForm={setGoalForm}
              createGoal={createGoal}
            />
          )}
          {activeView === "assistant" && <AssistantView payload={payload} updatePersona={updatePersona} />}
          {activeView === "analytics" && <AnalyticsView />}
          {activeView === "schedule" && (
            <ScheduleView
              payload={payload}
              state={scheduleState}
              setState={setScheduleState}
              generateSchedule={generateSchedule}
            />
          )}
          {activeView === "profile" && <ProfileView payload={payload} />}
        </section>
      </div>
    </main>
  );
}

function DashboardView({ payload, messages }: { payload: DashboardPayload; messages: LifeOSMessages }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
      <section className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
          <ScorePanel score={payload.lifeScore} />
          <CoachPanel coach={payload.coach} />
        </div>
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <PanelTitle icon={Target} title={messages.goalProbability} action="Rule-Based v1" />
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {payload.goals.map((goal) => (
              <GoalProbabilityCard key={goal.id} goal={goal} probability={probabilityFor(payload.probabilities, goal.id)} />
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-4">
        <InterventionPanel intervention={payload.intervention} />
        <ScheduleList schedule={payload.schedule.slice(0, 5)} />
        <InterferenceList interferences={payload.interferences.slice(0, 4)} />
      </section>
    </div>
  );
}

function GoalsView({
  payload,
  form,
  saving,
  setForm,
  createGoal,
}: {
  payload: DashboardPayload;
  form: { title: string; description: string; deadline: string; priority: GoalPriority };
  saving: boolean;
  setForm: (form: { title: string; description: string; deadline: string; priority: GoalPriority }) => void;
  createGoal: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form onSubmit={createGoal} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <PanelTitle icon={Plus} title="목표 생성" action="FREE 3개 제한" />
        <div className="mt-4 grid gap-3">
          <LabelInput label="Title" value={form.title} onChange={(title) => setForm({ ...form, title })} />
          <label className="grid gap-1 text-xs font-semibold text-[var(--color-muted-foreground)]">
            Description
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="min-h-24 rounded-lg border border-[var(--color-border)] bg-black/20 p-3 text-sm text-foreground outline-none focus:border-lime-300/60"
            />
          </label>
          <LabelInput label="Deadline" type="date" value={form.deadline} onChange={(deadline) => setForm({ ...form, deadline })} />
          <div className="grid grid-cols-3 gap-2">
            {(["high", "medium", "low"] as GoalPriority[]).map((priority) => (
              <button
                key={priority}
                type="button"
                onClick={() => setForm({ ...form, priority })}
                className={cn(
                  "h-10 rounded-lg border text-xs font-semibold",
                  form.priority === priority
                    ? "border-lime-300/50 bg-lime-300/12 text-lime-100"
                    : "border-[var(--color-border)] text-[var(--color-muted-foreground)]",
                )}
              >
                {priorityLabel(priority)}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-2 flex h-11 items-center justify-center gap-2 rounded-lg bg-lime-300 px-4 text-sm font-bold text-black transition hover:bg-lime-200 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {saving ? "생성 중" : "목표 추가"}
          </button>
        </div>
      </form>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <PanelTitle icon={Target} title="목표 리스트" action={`${payload.goals.length} active`} />
        <div className="mt-4 grid gap-3">
          {payload.goals.map((goal) => (
            <GoalRow key={goal.id} goal={goal} probability={probabilityFor(payload.probabilities, goal.id)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function AssistantView({ payload, updatePersona }: { payload: DashboardPayload; updatePersona: (persona: AssistantPersona) => void }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <PanelTitle icon={Bot} title="AI 비서" action={payload.assistant.persona} />
        <div className="mt-4 flex items-center gap-4">
          <img src={payload.assistant.avatar} alt="" className="h-24 w-24 rounded-lg border border-lime-200/20" />
          <div>
            <h3 className="text-xl font-semibold">{payload.assistant.name}</h3>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{payload.assistant.personality}</p>
            <p className="mt-2 font-mono text-xs text-lime-200">EXP {payload.assistant.experience}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2">
          {personaOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => void updatePersona(option.id)}
              className={cn(
                "flex min-h-12 items-center justify-between rounded-lg border px-3 text-left transition",
                payload.assistant.persona === option.id
                  ? "border-lime-300/45 bg-lime-300/12"
                  : "border-[var(--color-border)] bg-black/14 hover:border-lime-300/25",
              )}
            >
              <span>
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="text-xs text-[var(--color-muted)]">{option.tone}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-[var(--color-muted)]" />
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <PanelTitle icon={Send} title="AI 코칭 출력" action="JSON contract" />
        <pre className="mt-4 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-black/30 p-4 text-sm leading-7 text-lime-50">
          {JSON.stringify(payload.coach, null, 2)}
        </pre>
      </section>
    </div>
  );
}

function AnalyticsView() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <PanelTitle icon={LineChart} title="행동 데이터" action="Usage + Health" />
        <div className="mt-4 h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analyticsData}>
              <XAxis dataKey="name" stroke="#8b9484" fontSize={12} />
              <YAxis stroke="#8b9484" fontSize={12} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ background: "#151712", border: "1px solid #30362d", borderRadius: 8 }} />
              <Bar dataKey="target" fill="#3b4234" radius={[6, 6, 0, 0]} />
              <Bar dataKey="value" fill="#bef264" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <PanelTitle icon={Smartphone} title="수집 소스" action="MVP" />
        <div className="mt-4 grid gap-3">
          {[
            ["Android", "Usage Stats API, Health Connect"],
            ["iOS", "Screen Time API, HealthKit"],
            ["Calendar", "Google Calendar, Apple Calendar"],
            ["Realtime", "Supabase Realtime, FCM"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-[var(--color-border)] bg-black/16 p-3">
              <p className="text-sm font-semibold">{label}</p>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ScheduleView({
  payload,
  state,
  setState,
  generateSchedule,
}: {
  payload: DashboardPayload;
  state: { workStart: string; workEnd: string; sleepStart: string; sleepEnd: string };
  setState: (state: { workStart: string; workEnd: string; sleepStart: string; sleepEnd: string }) => void;
  generateSchedule: () => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <PanelTitle icon={Clock3} title="일정 생성" action="Calendar-ready" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {Object.entries(state).map(([key, value]) => (
            <LabelInput key={key} label={key} type="time" value={value} onChange={(next) => setState({ ...state, [key]: next })} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => void generateSchedule()}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-lime-300 px-4 text-sm font-bold text-black transition hover:bg-lime-200"
        >
          <CalendarDays className="h-4 w-4" />
          최적 일정 생성
        </button>
      </section>
      <ScheduleList schedule={payload.schedule} />
    </div>
  );
}

function ProfileView({ payload }: { payload: DashboardPayload }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <PanelTitle icon={Trophy} title="캐릭터 성장" action={`Level ${payload.assistant.level}`} />
        <div className="mt-4 flex items-center gap-4">
          <img src={payload.assistant.avatar} alt="" className="h-24 w-24 rounded-lg border border-lime-200/20" />
          <div>
            <p className="text-lg font-semibold">{payload.assistant.name}</p>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">습관 성공, 목표 달성, 연속 유지로 성장</p>
          </div>
        </div>
      </section>
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 xl:col-span-2">
        <PanelTitle icon={Target} title="핵심 KPI" action="Product" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <KpiCard label="목표 달성률" value="67%" icon={Target} />
          <KpiCard label="30일 유지율" value="54%" icon={BarChart3} />
          <KpiCard label="AI 코칭 재사용률" value="72%" icon={Bot} />
        </div>
      </section>
    </div>
  );
}

function ScorePanel({ score }: { score: LifeScoreResult }) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <PanelTitle icon={Activity} title="Life Score" action={`상위 ${score.topPercent}%`} />
      <div className="mt-5 flex items-center justify-center">
        <div className="grid h-48 w-48 place-items-center rounded-full" style={{ background: `conic-gradient(#bef264 ${score.today * 3.6}deg, #2c3329 0deg)` }}>
          <div className="grid h-36 w-36 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="text-center">
              <p className="font-mono text-5xl font-bold">{score.today}</p>
              <p className="text-xs text-[var(--color-muted)]">오늘 점수</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <MetricPill icon={CalendarDays} label="이번주" value={`${score.week}`} />
        <MetricPill icon={BarChart3} label="월간" value={`${score.month}`} />
      </div>
    </section>
  );
}

function CoachPanel({ coach }: { coach: CoachingResponse }) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <PanelTitle icon={Bot} title="오늘의 코칭" action="GPT-ready" />
      <div className="mt-4 grid gap-3">
        <InsightRow label="문제점" value={coach.problem} />
        <InsightRow label="핵심 원인" value={coach.insight} />
        <InsightRow label="오늘 행동" value={coach.today_action} />
        <InsightRow label="동기부여" value={coach.motivation} />
      </div>
    </section>
  );
}

function InterventionPanel({ intervention }: { intervention: Intervention }) {
  return (
    <section className={cn("rounded-lg border p-4", intervention.shouldSend ? "border-orange-300/40 bg-orange-300/10" : "border-[var(--color-border)] bg-[var(--color-surface)]")}>
      <PanelTitle icon={Bell} title="실시간 개입" action={intervention.shouldSend ? "Push ready" : "Stable"} />
      <p className="mt-3 text-sm font-semibold">{intervention.title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted-foreground)]">{intervention.message}</p>
      <p className="mt-3 font-mono text-xs text-orange-100">delta {intervention.probabilityDelta}% · {intervention.trigger}</p>
    </section>
  );
}

function ScheduleList({ schedule }: { schedule: ScheduleBlock[] }) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <PanelTitle icon={CalendarDays} title="오늘 일정" action={`${schedule.length} blocks`} />
      <div className="mt-4 grid gap-2">
        {schedule.map((item) => (
          <div key={item.id} className={cn("rounded-lg border px-3 py-2", intentStyle[item.intent])}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="shrink-0 font-mono text-xs">{item.start}-{item.end}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InterferenceList({ interferences }: { interferences: HabitInterference[] }) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <PanelTitle icon={AlertTriangle} title="제거 우선순위" action="Habit killer" />
      <div className="mt-4 grid gap-2">
        {interferences.map((item) => (
          <div key={item.id} className="rounded-lg border border-[var(--color-border)] bg-black/16 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{item.behavior}</p>
              <span className="rounded-md bg-orange-300/15 px-2 py-1 font-mono text-xs text-orange-100">{item.priority}</span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{item.evidence}</p>
            <p className="mt-2 text-xs text-lime-100">{item.replacement}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function GoalProbabilityCard({ goal, probability }: { goal: Goal; probability?: GoalProbability }) {
  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-black/16 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{goal.title}</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{dateLabel(goal.deadline)} · {priorityLabel(goal.priority)}</p>
        </div>
        <span className="font-mono text-2xl font-bold text-lime-200">{probability?.probability ?? 0}%</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/30">
        <div className="h-full rounded-full bg-lime-300" style={{ width: `${probability?.probability ?? 0}%` }} />
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--color-muted-foreground)]">{probability?.reasons[0] ?? goal.description}</p>
    </article>
  );
}

function GoalRow({ goal, probability }: { goal: Goal; probability?: GoalProbability }) {
  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-black/16 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">{goal.title}</h3>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{goal.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs">{priorityLabel(goal.priority)}</span>
          <span className="font-mono text-xl font-bold text-lime-200">{probability?.probability ?? 0}%</span>
        </div>
      </div>
    </article>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-black/16 p-3">
      <p className="text-xs font-semibold text-lime-200">{label}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--color-muted-foreground)]">{value}</p>
    </div>
  );
}

function PanelTitle({ icon: Icon, title, action }: { icon: typeof Target; title: string; action?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-lime-200" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {action && <span className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted-foreground)]">{action}</span>}
    </div>
  );
}

function MetricPill({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3">
      <Icon className="h-4 w-4 shrink-0 text-lime-200" />
      <div className="min-w-0">
        <p className="truncate text-[11px] text-[var(--color-muted)]">{label}</p>
        <p className="font-mono text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

function LabelInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-[var(--color-muted-foreground)]">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-0 rounded-lg border border-[var(--color-border)] bg-black/20 px-3 text-sm text-foreground outline-none focus:border-lime-300/60"
      />
    </label>
  );
}

function KpiCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Target }) {
  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-black/16 p-4">
      <Icon className="h-5 w-5 text-lime-200" />
      <p className="mt-4 font-mono text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{label}</p>
    </article>
  );
}
