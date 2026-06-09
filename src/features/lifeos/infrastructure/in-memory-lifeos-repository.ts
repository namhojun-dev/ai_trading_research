import type {
  Assistant,
  BehaviorLog,
  CreateBehaviorLogInput,
  CreateGoalInput,
  CreateNotificationInput,
  CreatePushTokenInput,
  Goal,
  Notification,
  PushToken,
  SavedLifeScore,
} from "../domain/entities";
import type { LifeOSRepository } from "../domain/ports";
import { seedAssistant, seedBehaviorLogs, seedGoals, seedUser } from "./seed-data";

export class InMemoryLifeOSRepository implements LifeOSRepository {
  private goals = [...seedGoals];
  private behaviorLogs = [...seedBehaviorLogs];
  private lifeScores: SavedLifeScore[] = [];
  private notifications: Notification[] = [];
  private pushTokens: PushToken[] = [];
  private assistant = { ...seedAssistant };

  async getCurrentUser() {
    return seedUser;
  }

  async getAssistant(userId: string) {
    return { ...this.assistant, userId };
  }

  async listGoals(userId: string) {
    return this.goals.filter((goal) => goal.userId === userId);
  }

  async listBehaviorLogs(userId: string) {
    return this.behaviorLogs.filter((log) => log.userId === userId);
  }

  async listNotifications(userId: string) {
    return this.notifications.filter((notification) => notification.userId === userId);
  }

  async listPushTokens(userId: string) {
    return this.pushTokens.filter((token) => token.userId === userId);
  }

  async createGoal(userId: string, input: CreateGoalInput): Promise<Goal> {
    const goal: Goal = {
      id: `goal_${Date.now()}`,
      userId,
      title: input.title,
      description: input.description,
      deadline: input.deadline,
      priority: input.priority,
      createdAt: new Date().toISOString(),
    };
    this.goals = [goal, ...this.goals];
    return goal;
  }

  async createBehaviorLog(userId: string, input: CreateBehaviorLogInput): Promise<BehaviorLog> {
    const log: BehaviorLog = {
      id: `log_${Date.now()}`,
      userId,
      type: input.type,
      value: input.value,
      source: input.source,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    this.behaviorLogs = [log, ...this.behaviorLogs];
    return log;
  }

  async createNotification(userId: string, input: CreateNotificationInput): Promise<Notification> {
    const notification: Notification = {
      id: `notification_${Date.now()}`,
      userId,
      title: input.title,
      message: input.message,
      sentAt: input.sentAt ?? null,
      createdAt: new Date().toISOString(),
    };
    this.notifications = [notification, ...this.notifications];
    return notification;
  }

  async createPushToken(userId: string, input: CreatePushTokenInput): Promise<PushToken> {
    const existing = this.pushTokens.find((item) =>
      item.userId === userId && (input.tokenHash ? item.tokenHash === input.tokenHash : item.token === input.token)
    );
    if (existing) return existing;

    const pushToken: PushToken = {
      id: `push_${Date.now()}`,
      userId,
      token: input.token,
      tokenHash: input.tokenHash,
      platform: input.platform,
      provider: input.provider ?? "fcm",
      encrypted: input.encrypted ?? false,
      createdAt: new Date().toISOString(),
    };
    this.pushTokens = [pushToken, ...this.pushTokens];
    return pushToken;
  }

  async saveLifeScore(userId: string, score: number, date: string): Promise<SavedLifeScore> {
    const existing = this.lifeScores.find((item) => item.userId === userId && item.date === date);
    if (existing) {
      const updated = { ...existing, score };
      this.lifeScores = this.lifeScores.map((item) => (item.id === updated.id ? updated : item));
      return updated;
    }

    const lifeScore: SavedLifeScore = {
      id: `score_${Date.now()}`,
      userId,
      score,
      date,
      createdAt: new Date().toISOString(),
    };
    this.lifeScores = [lifeScore, ...this.lifeScores];
    return lifeScore;
  }

  async saveAssistant(assistant: Assistant) {
    this.assistant = assistant;
    return this.assistant;
  }
}
