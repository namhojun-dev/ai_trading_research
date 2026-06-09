import type {
  Assistant,
  CharacterReward,
  CreateBehaviorLogInput,
  CreateGoalInput,
  CreateNotificationInput,
  CreatePushTokenInput,
} from "../domain/entities";
import type { LifeOSRepository } from "../domain/ports";
import { getPlan } from "@/lib/billing/plans";
import { revealPushToken, securePushTokenForStorage } from "@/lib/security/push-token-privacy";
import { CoachingService } from "./coaching-service";
import { GoalProbabilityEngine } from "./goal-probability-engine";
import { HabitRemovalEngine } from "./habit-removal-engine";
import { InterventionEngine } from "./intervention-engine";
import { LifeScoreEngine } from "./life-score-engine";
import { ScheduleEngine, type ScheduleInput } from "./schedule-engine";

export class LifeOSEntitlementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LifeOSEntitlementError";
  }
}

export class LifeOSService {
  constructor(
    private readonly repository: LifeOSRepository,
    private readonly lifeScoreEngine = new LifeScoreEngine(),
    private readonly probabilityEngine = new GoalProbabilityEngine(),
    private readonly habitRemovalEngine = new HabitRemovalEngine(),
    private readonly scheduleEngine = new ScheduleEngine(),
    private readonly coachingService = new CoachingService(),
    private readonly interventionEngine = new InterventionEngine(),
  ) {}

  async getCurrentUser() {
    return this.repository.getCurrentUser();
  }

  async getDashboardSnapshot(scheduleInput?: ScheduleInput) {
    const user = await this.repository.getCurrentUser();
    const [assistant, goals, behaviorLogs, notifications] = await Promise.all([
      this.repository.getAssistant(user.id),
      this.repository.listGoals(user.id),
      this.repository.listBehaviorLogs(user.id),
      this.repository.listNotifications(user.id),
    ]);
    const lifeScore = this.lifeScoreEngine.calculate(behaviorLogs);
    await this.repository.saveLifeScore(user.id, lifeScore.today, lifeScore.calculatedAt.slice(0, 10));
    const probabilities = this.probabilityEngine.calculate(goals, behaviorLogs, lifeScore);
    const interferences = this.habitRemovalEngine.detect(goals, behaviorLogs);
    const schedule = this.scheduleEngine.generate(goals, scheduleInput);
    const coach = await this.coachingService.coach(assistant, goals, lifeScore, probabilities, interferences);
    const intervention = this.interventionEngine.evaluate(goals, behaviorLogs, probabilities);

    return {
      user,
      assistant,
      goals,
      behaviorLogs,
      lifeScore,
      probabilities,
      interferences,
      schedule,
      coach,
      intervention,
      notifications,
    };
  }

  async createGoal(input: CreateGoalInput) {
    const user = await this.repository.getCurrentUser();
    const goals = await this.repository.listGoals(user.id);
    const plan = getPlan(user.plan);
    if (plan?.goalLimit !== null && plan?.goalLimit !== undefined && goals.length >= plan.goalLimit) {
      throw new LifeOSEntitlementError(`${user.plan} plan allows up to ${plan.goalLimit} goals`);
    }
    return this.repository.createGoal(user.id, input);
  }

  async createBehaviorLog(input: CreateBehaviorLogInput) {
    const user = await this.repository.getCurrentUser();
    return this.repository.createBehaviorLog(user.id, input);
  }

  async createBehaviorLogs(inputs: CreateBehaviorLogInput[]) {
    const user = await this.repository.getCurrentUser();
    return Promise.all(inputs.map((input) => this.repository.createBehaviorLog(user.id, input)));
  }

  async createNotification(input: CreateNotificationInput) {
    const user = await this.repository.getCurrentUser();
    return this.repository.createNotification(user.id, input);
  }

  async createPushToken(input: CreatePushTokenInput) {
    const user = await this.repository.getCurrentUser();
    const token = await this.repository.createPushToken(user.id, securePushTokenForStorage(input));
    return revealPushToken(token);
  }

  async listPushTokens() {
    const user = await this.repository.getCurrentUser();
    const tokens = await this.repository.listPushTokens(user.id);
    return tokens.map(revealPushToken);
  }

  async awardAssistantExperience(experience: number, title = "Habit success reward") {
    const user = await this.repository.getCurrentUser();
    const assistant = await this.repository.getAssistant(user.id);
    const nextExperience = assistant.experience + Math.max(0, Math.round(experience));
    const nextLevel = Math.min(100, Math.max(1, assistant.level + Math.floor(nextExperience / 1000) - Math.floor(assistant.experience / 1000)));
    const updated = await this.repository.saveAssistant({
      ...assistant,
      experience: nextExperience,
      level: nextLevel,
    });
    const reward: CharacterReward = {
      id: `reward_${Date.now()}`,
      assistantId: updated.id,
      type: nextLevel > assistant.level ? "evolution" : "experience",
      title,
      unlockedAt: new Date().toISOString(),
    };
    return { assistant: updated, reward };
  }

  async updateAssistant(input: Partial<Assistant>) {
    const user = await this.repository.getCurrentUser();
    const current = await this.repository.getAssistant(user.id);
    return this.repository.saveAssistant({
      ...current,
      ...input,
      userId: user.id,
      id: current.id,
      level: input.level ?? current.level,
      experience: input.experience ?? current.experience,
    });
  }
}
