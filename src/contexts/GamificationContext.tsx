import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  Achievement,
  UserAchievement,
  XpEvent,
  UserLevel,
  Streak,
  Goal,
  GamificationNotification,
  UserStats,
  DEFAULT_ACHIEVEMENTS,
  XP_REWARDS,
  calculateLevelFromXp,
} from '@/data/gamification';
import {
  table,
  ACHIEVEMENTS_STORE,
  USER_ACHIEVEMENTS_STORE,
  XP_EVENTS_STORE,
  USER_LEVELS_STORE,
  STREAKS_STORE,
  GOALS_STORE,
  NOTIFICATIONS_STORE,
  USER_STATS_STORE,
  EXAM_LOGS_STORE,
  MCQ_REVIEW_LOGS_STORE,
} from '@/lib/dexie-db';
import { postMessage, subscribe } from '@/lib/broadcast';
import { gamificationService } from '@/lib/gamification-service';

interface GamificationContextType {
  // User Level & XP
  userLevel: UserLevel;
  addXp: (
    type: XpEvent['type'],
    amount?: number,
    metadata?: Record<string, unknown>,
  ) => Promise<void>;

  // Achievements
  achievements: Achievement[];
  userAchievements: UserAchievement[];
  checkAchievements: () => Promise<void>;

  // Streaks
  streaks: Streak[];
  updateStreak: (type: Streak['type']) => Promise<void>;

  // Goals
  goals: Goal[];
  updateGoalProgress: (metric: Goal['metric'], amount: number) => Promise<void>;

  // Notifications
  notifications: GamificationNotification[];
  markNotificationRead: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;

  // Stats
  userStats: UserStats;
  updateStats: (
    updates: Partial<UserStats> & { __delta_totalStudyTimeMinutes?: number },
  ) => Promise<void>;

  // Loading state
  isLoading: boolean;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

export const GamificationProvider = ({ children }: { children: ReactNode }) => {
  const [userLevel, setUserLevel] = useState<UserLevel>({
    userId: 'default',
    currentLevel: 1,
    totalXp: 0,
    xpToNextLevel: 100,
  });

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [notifications, setNotifications] = useState<GamificationNotification[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    userId: 'default',
    totalCardsReviewed: 0,
    totalMcqsAnswered: 0,
    totalExamsCompleted: 0,
    totalStudyTimeMinutes: 0,
    perfectExams: 0,
    averageExamScore: 0,
    studyStreakRecord: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const [isLoading, setIsLoading] = useState(true);

  // Initialize data
  useEffect(() => {
    const loadGamificationData = async () => {
      console.log('Loading gamification data...');
      setIsLoading(true);
      try {
        // Load achievements
        const achievementsTable = await table<Achievement>(ACHIEVEMENTS_STORE);
        const existingAchievements = await achievementsTable.toArray();

        // Seed or backfill missing achievements without overwriting existing ones
        if (existingAchievements.length === 0) {
          // First-time init
          await achievementsTable.bulkPut(DEFAULT_ACHIEVEMENTS);
          setAchievements(DEFAULT_ACHIEVEMENTS);
        } else {
          const existingIds = new Set(existingAchievements.map((a) => a.id));
          const toInsert = DEFAULT_ACHIEVEMENTS.filter((a) => !existingIds.has(a.id));
          if (toInsert.length > 0) {
            await achievementsTable.bulkPut(toInsert);
          }
          // Merge view: prefer existing records to preserve any edits, then append newly inserted
          setAchievements([...existingAchievements, ...toInsert]);
        }

        // Load user level
        const userLevelsTable = await table<UserLevel>(USER_LEVELS_STORE);
        const existingLevel = await userLevelsTable.get('default');
        if (existingLevel) {
          setUserLevel(existingLevel);
        } else {
          const initialLevel: UserLevel = {
            userId: 'default',
            currentLevel: 1,
            totalXp: 0,
            xpToNextLevel: 100,
          };
          await userLevelsTable.put(initialLevel, 'default');
          setUserLevel(initialLevel);
        }

        // Load other data
        const [userAchievementsData, streaksData, goalsData, notificationsData, userStatsData] =
          await Promise.all([
            table<UserAchievement>(USER_ACHIEVEMENTS_STORE).then((t) => t.toArray()),
            table<Streak>(STREAKS_STORE).then((t) => t.toArray()),
            table<Goal>(GOALS_STORE).then((t) => t.toArray()),
            table<GamificationNotification>(NOTIFICATIONS_STORE).then((t) => t.toArray()),
            table<UserStats>(USER_STATS_STORE).then((t) => t.get('default')),
          ]);

        setUserAchievements(userAchievementsData);
        setStreaks(streaksData);
        setGoals(goalsData);
        setNotifications(notificationsData.sort((a, b) => b.createdAt - a.createdAt));

        if (userStatsData) {
          // Backward-compat: ensure newly added fields exist with defaults
          const normalized: UserStats = {
            ...userStatsData,
            totalMcqsAnswered:
              (userStatsData as unknown as { totalMcqsAnswered?: number }).totalMcqsAnswered ?? 0,
          } as UserStats;
          console.log('Loaded existing user stats:', normalized);
          setUserStats(normalized);
        } else {
          const initialStats: UserStats = {
            userId: 'default',
            totalCardsReviewed: 0,
            totalMcqsAnswered: 0,
            totalExamsCompleted: 0,
            totalStudyTimeMinutes: 0,
            perfectExams: 0,
            averageExamScore: 0,
            studyStreakRecord: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          console.log('Creating initial user stats:', initialStats);
          await table<UserStats>(USER_STATS_STORE).then((t) => t.put(initialStats, 'default'));
          setUserStats(initialStats);
        }
      } catch (error) {
        console.error('Failed to load gamification data:', error);
      } finally {
        console.log('Gamification data loading complete');
        setIsLoading(false);
      }
    };

    loadGamificationData();

    // Multi-tab sync
    const unsubscribe = subscribe(async (msg) => {
      if (msg.type === 'storage-write') {
        if (msg.resource === USER_LEVELS_STORE) {
          const userLevelsTable = await table<UserLevel>(USER_LEVELS_STORE);
          const updated = await userLevelsTable.get('default');
          if (updated) setUserLevel(updated);
        }
        // Add other resource syncing as needed
      }
    });

    return unsubscribe;
  }, []);

  const addXp = useCallback(
    async (type: XpEvent['type'], customAmount?: number, metadata?: Record<string, unknown>) => {
      // Map event types to XP_REWARDS keys
      const xpKeyMap: Record<XpEvent['type'], keyof typeof XP_REWARDS> = {
        card_reviewed: 'CARD_REVIEWED',
        mcq_answered: 'MCQ_ANSWERED',
        exam_completed: 'EXAM_COMPLETED',
        perfect_exam: 'PERFECT_EXAM',
        study_streak: 'STUDY_STREAK_BONUS',
        achievement_unlocked: 'CARD_REVIEWED', // fallback
        daily_goal_met: 'DAILY_GOAL_MET',
        weekly_goal_met: 'WEEKLY_GOAL_MET',
      };

      const xpKey = xpKeyMap[type];
      const baseAmount = typeof XP_REWARDS[xpKey] === 'number' ? (XP_REWARDS[xpKey] as number) : 5;
      const amount = customAmount || baseAmount;

      try {
        // Create XP event (do not persist string id; Dexie schema uses auto-increment numeric id)
        const xpEvent: XpEvent = {
          id: crypto.randomUUID(),
          userId: 'default',
          type,
          xpGained: amount,
          timestamp: Date.now(),
          metadata,
        };

        // Persist a DB-friendly payload without the string id to avoid schema mismatch with '++id'
        try {
          const { id: _omit, ...eventForDb } = xpEvent as unknown as { id?: string } & Omit<
            XpEvent,
            'id'
          >;
          await table<Omit<XpEvent, 'id'>>(XP_EVENTS_STORE).then((t) => t.add(eventForDb));
        } catch (e) {
          // Do not block XP gain if event logging fails
          console.warn('XP event logging failed, continuing with XP update:', e);
        }

        // Update user level
        const newTotalXp = userLevel.totalXp + amount;
        const { level, xpToNextLevel } = calculateLevelFromXp(newTotalXp);
        const leveledUp = level > userLevel.currentLevel;

        const updatedLevel: UserLevel = {
          ...userLevel,
          currentLevel: level,
          totalXp: newTotalXp,
          xpToNextLevel,
          levelUpAt: leveledUp ? Date.now() : userLevel.levelUpAt,
        };

        await table<UserLevel>(USER_LEVELS_STORE).then((t) => t.put(updatedLevel, 'default'));
        setUserLevel(updatedLevel);

        // Show level up notification
        if (leveledUp) {
          const notification: GamificationNotification = {
            id: crypto.randomUUID(),
            userId: 'default',
            type: 'level_up',
            title: 'Level Up!',
            message: `Congratulations! You've reached level ${level}!`,
            icon: 'Star',
            isRead: false,
            createdAt: Date.now(),
          };

          await table<GamificationNotification>(NOTIFICATIONS_STORE).then((t) =>
            t.add(notification),
          );
          setNotifications((prev) => [notification, ...prev]);
        }

        postMessage({ type: 'storage-write', resource: USER_LEVELS_STORE });

        // Check for achievements after adding XP
        await checkAchievements();
      } catch (error) {
        console.error('Failed to add XP:', error);
      }
    },
    [userLevel],
  );

  // Create a ref to store the checkAchievements function
  const checkAchievementsRef = useRef<() => Promise<void>>(async () => {});

  // Update the ref when dependencies change
  useEffect(() => {
    checkAchievementsRef.current = async () => {
      try {
        if (!userStats) return;

        const unlockedAchievements: UserAchievement[] = [];
        const now = Date.now();

        // Get all achievements that haven't been unlocked yet
        const lockedAchievements = achievements.filter(
          (a) => !userAchievements.some((ua) => ua.achievementId === a.id),
        );

        // Prefetch performance logs once for this pass
        type ExamLogLite = {
          id?: string;
          date?: string;
          submittedAt?: number;
          results?: { score?: number; timeTaken?: number };
          createdAt?: number;
          updatedAt?: number;
        };
        type McqLogLite = { review?: string; rating?: number; duration?: number };

        const [examLogsArr, mcqLogsArr] = await Promise.all([
          table<ExamLogLite>(EXAM_LOGS_STORE)
            .then((t) => t.toArray())
            .catch(() => [] as ExamLogLite[]),
          table<McqLogLite>(MCQ_REVIEW_LOGS_STORE)
            .then((t) => t.toArray())
            .catch(() => [] as McqLogLite[]),
        ]);

        // Helpers
        const getLatestActivityHour = (): number | undefined => {
          const examTs = examLogsArr
            .map(
              (e) =>
                e.submittedAt ??
                (e.date ? Date.parse(e.date) : undefined) ??
                e.updatedAt ??
                e.createdAt,
            )
            .filter((v): v is number => typeof v === 'number');
          const mcqTs = mcqLogsArr
            .map((m) => (m.review ? Date.parse(m.review) : undefined))
            .filter((v): v is number => typeof v === 'number');
          const latest = Math.max(...[...examTs, ...mcqTs].filter((n) => !Number.isNaN(n)));
          if (!Number.isFinite(latest)) return undefined;
          return new Date(latest).getHours();
        };

        const countExamsAtOrAbove = (threshold: number): number => {
          return examLogsArr.reduce((acc, e) => {
            const score = e.results?.score;
            return acc + (typeof score === 'number' && score >= threshold ? 1 : 0);
          }, 0);
        };

        const anyExamDurationAtLeast = (minutes: number): boolean => {
          const minSeconds = minutes * 60;
          return examLogsArr.some((e) => (e.results?.timeTaken ?? 0) >= minSeconds);
        };

        const countDaysWithMcqAccuracyAtLeast = (thresholdPct: number): number => {
          // Group MCQ logs by day (YYYY-MM-DD) and compute accuracy based on ratings
          // Treat ratings >= 3 (Good/Easy) as correct
          const byDay: Record<string, { total: number; correct: number }> = {};
          for (const log of mcqLogsArr) {
            const ts = log.review ? Date.parse(log.review) : undefined;
            if (!ts || Number.isNaN(ts)) continue;
            const day = new Date(ts).toISOString().slice(0, 10);
            const rating = typeof log.rating === 'number' ? log.rating : undefined;
            const correct = rating !== undefined && rating >= 3 ? 1 : 0;
            if (!byDay[day]) byDay[day] = { total: 0, correct: 0 };
            byDay[day].total += 1;
            byDay[day].correct += correct;
          }
          return Object.values(byDay).reduce((acc, { total, correct }) => {
            if (total === 0) return acc;
            const pct = Math.round((correct / total) * 100);
            return acc + (pct >= thresholdPct ? 1 : 0);
          }, 0);
        };

        // Additional helpers
        const countPerfectExams = (): number =>
          examLogsArr.reduce(
            (acc, e) =>
              acc +
              ((e.results?.score ?? (e as unknown as { score?: number }).score) === 100 ? 1 : 0),
            0,
          );

        const mcqSpeedCountAtMost = (seconds: number): number => {
          const maxMs = seconds * 1000;
          return mcqLogsArr.reduce(
            (acc, m) => acc + ((m.duration ?? Infinity) <= maxMs ? 1 : 0),
            0,
          );
        };

        const anyExamAvgSecPerQuestionAtMost = (seconds: number): boolean => {
          return examLogsArr.some((e) => {
            const timeTaken = e.results?.timeTaken;
            const totalQ = (e as unknown as { totalQuestions?: number }).totalQuestions ?? 0;
            if (!timeTaken || !totalQ) return false;
            const avg = timeTaken / totalQ;
            return avg <= seconds;
          });
        };

        const hasWeekendWarrior = (): boolean => {
          // Track Saturday (6) and Sunday (0) activity per ISO week key (YYYY-WW)
          const daysByWeek: Record<string, Set<number>> = {};
          const pushTs = (ts: number | undefined) => {
            if (!ts || Number.isNaN(ts)) return;
            const d = new Date(ts);
            const day = d.getDay();
            const isoWeekKey = (() => {
              const temp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
              const dayNum = (temp.getUTCDay() + 6) % 7; // 0..6 Mon..Sun
              temp.setUTCDate(temp.getUTCDate() - dayNum + 3); // Thursday
              const firstThursday = new Date(Date.UTC(temp.getUTCFullYear(), 0, 4));
              const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
              firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
              const weekNo = 1 + Math.round((+temp - +firstThursday) / (7 * 24 * 3600 * 1000));
              return `${temp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
            })();
            const set = (daysByWeek[isoWeekKey] = daysByWeek[isoWeekKey] ?? new Set<number>());
            set.add(day);
          };

          for (const e of examLogsArr) {
            const ts =
              e.submittedAt ??
              (e.date ? Date.parse(e.date) : undefined) ??
              e.updatedAt ??
              e.createdAt;
            pushTs(ts);
          }
          for (const m of mcqLogsArr) pushTs(m.review ? Date.parse(m.review) : undefined);

          return Object.values(daysByWeek).some((set) => set.has(6) && set.has(0));
        };

        for (const achievement of lockedAchievements) {
          let isUnlocked = false;

          // Check achievement requirements based on type
          switch (achievement.requirement.type) {
            case 'count': {
              switch (achievement.type) {
                case 'flashcards_reviewed':
                case 'total_cards_reviewed': {
                  isUnlocked = userStats.totalCardsReviewed >= achievement.requirement.value;
                  break;
                }
                case 'mcq_answered': {
                  // Optional metric may not exist
                  const mcqCount =
                    'totalMcqsAnswered' in (userStats as object)
                      ? ((userStats as unknown as { totalMcqsAnswered?: number })
                          .totalMcqsAnswered ?? 0)
                      : 0;
                  isUnlocked = mcqCount >= achievement.requirement.value;
                  break;
                }
                case 'perfect_exam': {
                  const needed = achievement.requirement.value; // count
                  isUnlocked = countPerfectExams() >= needed;
                  break;
                }
              }
              break;
            }

            case 'time': {
              if (achievement.type === 'study_time') {
                isUnlocked = userStats.totalStudyTimeMinutes >= achievement.requirement.value;
              } else if (achievement.type === 'dedication') {
                // Fallback for legacy dedication with numeric value acting as hour threshold
                const hour = getLatestActivityHour();
                if (hour !== undefined) {
                  const v = achievement.requirement.value;
                  isUnlocked = v >= 12 ? hour >= v : hour < v;
                }
              } else if (achievement.type === 'speed') {
                // Exam speed: under X seconds per question for any exam
                isUnlocked = anyExamAvgSecPerQuestionAtMost(achievement.requirement.value);
              }
              break;
            }

            case 'streak': {
              const studyStreak = streaks.find((s) => s.type === 'study')?.currentStreak || 0;
              isUnlocked = studyStreak >= achievement.requirement.value;
              break;
            }

            case 'weekend_streak': {
              // Activity on both Saturday and Sunday within the same ISO week
              isUnlocked = hasWeekendWarrior();
              break;
            }

            case 'percentage': {
              if (achievement.type === 'exam_performance' || achievement.type === 'perfect_exam') {
                const threshold = achievement.requirement.value;
                const needed = achievement.requirement.count ?? 1;
                const count = countExamsAtOrAbove(threshold);
                isUnlocked = count >= needed;
              }
              break;
            }

            case 'accuracy': {
              if (achievement.type === 'mcq_accuracy') {
                const threshold = achievement.requirement.value;
                const needed = achievement.requirement.count ?? 1;
                const daysMet = countDaysWithMcqAccuracyAtLeast(threshold);
                isUnlocked = daysMet >= needed;
              }
              break;
            }

            case 'speed': {
              if (achievement.type === 'speed') {
                // MCQ speed achievements: at least N MCQs answered in <= X seconds each
                const thresholdSec = achievement.requirement.value;
                const needed =
                  (achievement.requirement as unknown as { count?: number }).count ?? 1;
                const count = mcqSpeedCountAtMost(thresholdSec);
                isUnlocked = count >= needed;
              }
              break;
            }

            case 'time_of_day':
              if (achievement.type === 'special' || achievement.type === 'dedication') {
                const hour = getLatestActivityHour();
                if (hour !== undefined) {
                  const { value, comparison } = achievement.requirement as unknown as {
                    value: number;
                    comparison: 'before' | 'after';
                  };
                  isUnlocked = comparison === 'before' ? hour < value : hour >= value;
                }
              }
              break;

            case 'duration':
              if (achievement.type === 'exam_marathon') {
                isUnlocked = anyExamDurationAtLeast(achievement.requirement.value);
              } else {
                // Fallback: approximate via MCQ daily accumulated duration
                const targetMs = achievement.requirement.value * 60 * 1000;
                const byDay: Record<string, number> = {};
                for (const log of mcqLogsArr) {
                  const ts = log.review ? Date.parse(log.review) : undefined;
                  if (!ts || Number.isNaN(ts)) continue;
                  const day = new Date(ts).toISOString().slice(0, 10);
                  byDay[day] = (byDay[day] ?? 0) + (log.duration ?? 0);
                }
                isUnlocked = Object.values(byDay).some((ms) => ms >= targetMs);
              }
              break;
          }

          if (isUnlocked) {
            const userAchievement: UserAchievement = {
              id: crypto.randomUUID(),
              achievementId: achievement.id,
              userId: 'default',
              unlockedAt: now,
              progress: 100,
              isCompleted: true,
              notificationShown: false,
            };

            unlockedAchievements.push(userAchievement);

            // Create notification
            const notification: GamificationNotification = {
              id: crypto.randomUUID(),
              userId: 'default',
              type: 'achievement',
              title: 'Achievement Unlocked!',
              message: achievement.name,
              icon: achievement.icon || 'Award',
              isRead: false,
              createdAt: now,
            };

            await table<GamificationNotification>(NOTIFICATIONS_STORE).then((t) =>
              t.add(notification),
            );
            setNotifications((prev) => [notification, ...prev]);

            // Add XP for unlocking achievement - use a small delay to avoid race conditions
            setTimeout(() => {
              addXp('achievement_unlocked', achievement.xpReward, {
                achievementId: achievement.id,
              });
            }, 100);
          }
        }

        // Save unlocked achievements one by one
        if (unlockedAchievements.length > 0) {
          const achievementsTable = await table<UserAchievement>(USER_ACHIEVEMENTS_STORE);
          for (const achievement of unlockedAchievements) {
            await achievementsTable.add(achievement);
          }
          setUserAchievements((prev) => [...prev, ...unlockedAchievements]);
        }
      } catch (error) {
        console.error('Error checking achievements:', error);
      }
    };
  }, [userStats, userAchievements, achievements, streaks, addXp]);

  // Wrapper function that uses the ref
  const checkAchievements = useCallback(async () => {
    return checkAchievementsRef.current();
  }, []);

  const updateStreak = useCallback(
    async (type: Streak['type']) => {
      const today = new Date().toISOString().split('T')[0];
      const existingStreak = streaks.find((s) => s.type === type);

      try {
        if (existingStreak) {
          const lastDate = new Date(existingStreak.lastActivityDate);
          const todayDate = new Date(today);
          const daysDiff = Math.floor(
            (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
          );

          let updatedStreak: Streak;
          if (daysDiff === 1) {
            // Continue streak
            updatedStreak = {
              ...existingStreak,
              currentStreak: existingStreak.currentStreak + 1,
              longestStreak: Math.max(
                existingStreak.longestStreak,
                existingStreak.currentStreak + 1,
              ),
              lastActivityDate: today,
              updatedAt: Date.now(),
            };
          } else if (daysDiff === 0) {
            // Same day, no change needed
            return;
          } else {
            // Streak broken, reset
            updatedStreak = {
              ...existingStreak,
              currentStreak: 1,
              lastActivityDate: today,
              updatedAt: Date.now(),
            };
          }

          await table<Streak>(STREAKS_STORE).then((t) => t.put(updatedStreak, existingStreak.id));
          setStreaks((prev) => prev.map((s) => (s.id === existingStreak.id ? updatedStreak : s)));

          // Check for achievements after updating an existing streak
          setTimeout(() => {
            checkAchievements();
          }, 100);
        } else {
          // Create new streak
          const newStreak: Streak = {
            id: crypto.randomUUID(),
            userId: 'default',
            type,
            currentStreak: 1,
            longestStreak: 1,
            lastActivityDate: today,
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          await table<Streak>(STREAKS_STORE).then((t) => t.add(newStreak));
          setStreaks((prev) => [...prev, newStreak]);

          // Check for achievements after creating a new streak
          setTimeout(() => {
            checkAchievements();
          }, 100);
        }
      } catch (error) {
        console.error('Failed to update streak:', error);
      }
    },
    [streaks],
  );

  const updateGoalProgress = useCallback(
    async (metric: Goal['metric'], amount: number) => {
      // TODO: Implementation for updating goal progress
      console.log('Updating goal progress:', metric, amount);
    },
    [goals],
  );

  const markNotificationRead = useCallback(
    async (id: string) => {
      try {
        const notification = notifications.find((n) => n.id === id);
        if (notification && !notification.isRead) {
          const updated = { ...notification, isRead: true };
          await table<GamificationNotification>(NOTIFICATIONS_STORE).then((t) =>
            t.put(updated, id),
          );
          setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
        }
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    },
    [notifications],
  );

  const clearAllNotifications = useCallback(async () => {
    try {
      await table<GamificationNotification>(NOTIFICATIONS_STORE).then((t) => t.clear());
      setNotifications([]);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }, []);

  const updateStats = useCallback(
    async (updates: Partial<UserStats> & { __delta_totalStudyTimeMinutes?: number }) => {
      try {
        // Support additive delta field for timer-based updates without requiring caller to read-modify-write
        const { __delta_totalStudyTimeMinutes = 0, ...rest } = updates;

        const next: UserStats = { ...userStats, ...(rest as Partial<UserStats>) } as UserStats;

        // Apply delta increment if provided
        if (__delta_totalStudyTimeMinutes) {
          next.totalStudyTimeMinutes =
            (next.totalStudyTimeMinutes || 0) + __delta_totalStudyTimeMinutes;
        }

        next.updatedAt = Date.now();

        const statsTable = await table<UserStats>(USER_STATS_STORE);
        await statsTable.put(next, 'default');

        setUserStats(next);
        postMessage({ type: 'storage-write', resource: USER_STATS_STORE });

        // Check for achievements shortly after stats update
        setTimeout(() => {
          checkAchievements();
        }, 100);
      } catch (error) {
        console.error('Failed to update user stats:', error);
      }
    },
    [userStats, checkAchievements],
  );

  // Initialize gamification service after all functions are defined
  useEffect(() => {
    gamificationService.initialize(addXp, updateStreak, updateStats);
  }, [addXp, updateStreak, updateStats]);

  return (
    <GamificationContext.Provider
      value={{
        userLevel,
        addXp,
        achievements,
        userAchievements,
        checkAchievements,
        streaks,
        updateStreak,
        goals,
        updateGoalProgress,
        notifications,
        markNotificationRead,
        clearAllNotifications,
        userStats,
        updateStats,
        isLoading,
      }}
    >
      {!isLoading && children}
    </GamificationContext.Provider>
  );
};

export const useGamification = () => {
  const context = useContext(GamificationContext);
  if (context === undefined) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
};
