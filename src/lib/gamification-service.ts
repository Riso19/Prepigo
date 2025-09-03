import { XpEvent, StreakType } from '@/data/gamification';

// Service for integrating gamification into existing app flows
export class GamificationService {
  private addXp:
    | ((
        type: XpEvent['type'],
        amount?: number,
        metadata?: Record<string, unknown>,
      ) => Promise<void>)
    | null = null;
  private updateStreak: ((type: StreakType) => Promise<void>) | null = null;
  private updateStats: ((updates: Record<string, unknown>) => Promise<void>) | null = null;

  initialize(
    addXpFn: (
      type: XpEvent['type'],
      amount?: number,
      metadata?: Record<string, unknown>,
    ) => Promise<void>,
    updateStreakFn: (type: StreakType) => Promise<void>,
    updateStatsFn: (updates: Record<string, unknown>) => Promise<void>,
  ) {
    this.addXp = addXpFn;
    this.updateStreak = updateStreakFn;
    this.updateStats = updateStatsFn;
  }

  // Called when a flashcard is reviewed
  async onCardReviewed(cardId: string, rating: number, timeTaken?: number) {
    if (!this.addXp || !this.updateStreak || !this.updateStats) return;

    try {
      // Award XP for reviewing a card
      await this.addXp('card_reviewed', undefined, {
        cardId,
        rating,
        timeTaken,
      });

      // Update study streak
      await this.updateStreak('study');

      // Update stats
      await this.updateStats({
        totalCardsReviewed: 1, // This would be incremented in the context
        lastStudyDate: new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      console.error('Failed to track card review gamification:', error);
    }
  }

  // Called when an exam is completed
  async onExamCompleted(
    examId: string,
    score: number,
    totalQuestions: number,
    timeTaken: number,
    isPerfect: boolean,
  ) {
    if (!this.addXp || !this.updateStreak || !this.updateStats) return;

    try {
      // Base XP for completing exam
      await this.addXp('exam_completed', undefined, {
        examId,
        score,
        totalQuestions,
        timeTaken,
      });

      // Bonus XP for perfect score
      if (isPerfect) {
        await this.addXp('perfect_exam', undefined, {
          examId,
          score,
          totalQuestions,
        });

        // Update perfect score streak
        await this.updateStreak('perfect_score');
      }

      // Update exam streak
      await this.updateStreak('exam');

      // Update stats
      const updates: Record<string, unknown> = {
        totalExamsCompleted: 1,
        lastStudyDate: new Date().toISOString().split('T')[0],
      };

      if (isPerfect) {
        updates.perfectExams = 1;
      }

      await this.updateStats(updates);
    } catch (error) {
      console.error('Failed to track exam completion gamification:', error);
    }
  }

  // Called when user logs in
  async onLogin() {
    if (!this.updateStreak) return;

    try {
      await this.updateStreak('login');
    } catch (error) {
      console.error('Failed to track login streak:', error);
    }
  }

  // Called when daily goal is met
  async onDailyGoalMet(goalType: string) {
    if (!this.addXp) return;

    try {
      await this.addXp('daily_goal_met', undefined, {
        goalType,
      });
    } catch (error) {
      console.error('Failed to track daily goal completion:', error);
    }
  }

  // Called when weekly goal is met
  async onWeeklyGoalMet(goalType: string) {
    if (!this.addXp) return;

    try {
      await this.addXp('weekly_goal_met', undefined, {
        goalType,
      });
    } catch (error) {
      console.error('Failed to track weekly goal completion:', error);
    }
  }

  // Called when study streak milestone is reached
  async onStreakMilestone(streakType: StreakType, days: number) {
    if (!this.addXp) return;

    try {
      await this.addXp('study_streak', days * 2, {
        // 2 XP per day in streak
        streakType,
        days,
      });
    } catch (error) {
      console.error('Failed to track streak milestone:', error);
    }
  }
}

// Global instance
export const gamificationService = new GamificationService();
