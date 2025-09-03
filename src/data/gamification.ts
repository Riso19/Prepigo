import * as z from 'zod';

// Achievement Types
export const achievementTypeSchema = z.enum([
  'study_streak',
  'exam_performance',
  'total_cards_reviewed',
  'perfect_exam',
  'consistency',
  'milestone',
  'speed',
  'accuracy',
  'dedication',
  'study_time',
  'flashcards_reviewed',
  'mcq_answered',
  'mcq_accuracy',
  'special',
  'exam_marathon',
]);

// Requirement types
export const requirementTypeSchema = z.enum([
  'count',
  'streak',
  'percentage',
  'time',
  'accuracy',
  'speed',
  'time_of_day',
  'weekend_streak',
  'duration',
]);

export const achievementTierSchema = z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond']);

export const achievementSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: achievementTypeSchema,
  tier: achievementTierSchema,
  icon: z.string(), // Lucide icon name
  xpReward: z.number(),
  requirement: z.union([
    // Count-based requirements (e.g., review X cards, answer X MCQs)
    z.object({
      type: z.literal('count'),
      value: z.number(),
      timeframe: z.enum(['daily', 'weekly', 'monthly', 'all_time']).optional(),
    }),
    // Streak requirements (e.g., X days in a row)
    z.object({
      type: z.literal('streak'),
      value: z.number(),
      goal: z.string().optional(), // e.g., 'daily' for daily goal streaks
    }),
    // Percentage requirements (e.g., score 90%+ on exams)
    z.object({
      type: z.literal('percentage'),
      value: z.number(),
      count: z.number().optional(), // number of times to achieve this percentage
    }),
    // Time-based requirements (e.g., study X minutes)
    z.object({
      type: z.literal('time'),
      value: z.number(), // in minutes
      timeframe: z.enum(['daily', 'weekly', 'monthly', 'all_time']).optional(),
    }),
    // Accuracy requirements (e.g., X% accuracy on MCQs)
    z.object({
      type: z.literal('accuracy'),
      value: z.number(), // percentage
      count: z.number().optional(), // number of times to achieve this accuracy
    }),
    // Speed requirements (e.g., answer in X seconds)
    z.object({
      type: z.literal('speed'),
      value: z.number(), // seconds
      count: z.number().optional(), // number of times to achieve this speed
    }),
    // Time of day requirements (e.g., study before/after certain hour)
    z.object({
      type: z.literal('time_of_day'),
      value: z.number(), // hour (0-23)
      comparison: z.enum(['before', 'after']),
    }),
    // Weekend streak requirements
    z.object({
      type: z.literal('weekend_streak'),
      value: z.number(), // number of weekend streaks
    }),
    // Duration requirements (e.g., study session length)
    z.object({
      type: z.literal('duration'),
      value: z.number(), // in minutes
    }),
  ]),
  isSecret: z.boolean().default(false),
  createdAt: z.number(),
});

export const userAchievementSchema = z.object({
  id: z.string(),
  achievementId: z.string(),
  userId: z.string().default('default'),
  unlockedAt: z.number(),
  progress: z.number().default(0), // 0-100 percentage
  isCompleted: z.boolean().default(false),
  notificationShown: z.boolean().default(false),
});

// XP and Leveling
export const xpEventSchema = z.object({
  id: z.string(),
  userId: z.string().default('default'),
  type: z.enum([
    'card_reviewed',
    'mcq_answered',
    'exam_completed',
    'perfect_exam',
    'study_streak',
    'achievement_unlocked',
    'daily_goal_met',
    'weekly_goal_met',
  ]),
  xpGained: z.number(),
  timestamp: z.number(),
  metadata: z.record(z.unknown()).optional(),
});

export const userLevelSchema = z.object({
  userId: z.string().default('default'),
  currentLevel: z.number().default(1),
  totalXp: z.number().default(0),
  xpToNextLevel: z.number().default(100),
  levelUpAt: z.number().optional(),
});

// Streaks
export const streakTypeSchema = z.enum(['study', 'exam', 'login', 'perfect_score']);

export const streakSchema = z.object({
  id: z.string(),
  userId: z.string().default('default'),
  type: streakTypeSchema,
  currentStreak: z.number().default(0),
  longestStreak: z.number().default(0),
  lastActivityDate: z.string(), // ISO date string (YYYY-MM-DD)
  isActive: z.boolean().default(true),
  createdAt: z.number(),
  updatedAt: z.number(),
});

// Daily/Weekly Goals
export const goalTypeSchema = z.enum(['daily', 'weekly']);
export const goalMetricSchema = z.enum([
  'cards_reviewed',
  'exams_completed',
  'study_time',
  'xp_earned',
]);

export const goalSchema = z.object({
  id: z.string(),
  userId: z.string().default('default'),
  type: goalTypeSchema,
  metric: goalMetricSchema,
  target: z.number(),
  current: z.number().default(0),
  isCompleted: z.boolean().default(false),
  period: z.string(), // ISO date string for the period (YYYY-MM-DD for daily, YYYY-WW for weekly)
  createdAt: z.number(),
  updatedAt: z.number(),
});

// Leaderboard
export const leaderboardEntrySchema = z.object({
  userId: z.string(),
  username: z.string().default('Anonymous'),
  totalXp: z.number(),
  level: z.number(),
  weeklyXp: z.number().default(0),
  monthlyXp: z.number().default(0),
  rank: z.number(),
  lastActive: z.number(),
});

// User Stats
export const userStatsSchema = z.object({
  userId: z.string().default('default'),
  totalCardsReviewed: z.number().default(0),
  // Total MCQs answered across Practice/Review flows (new; backward-compatible with default)
  totalMcqsAnswered: z.number().default(0),
  totalExamsCompleted: z.number().default(0),
  totalStudyTimeMinutes: z.number().default(0),
  perfectExams: z.number().default(0),
  averageExamScore: z.number().default(0),
  favoriteSubject: z.string().optional(),
  studyStreakRecord: z.number().default(0),
  lastStudyDate: z.string().optional(), // ISO date
  createdAt: z.number(),
  updatedAt: z.number(),
});

// Notification
export const notificationSchema = z.object({
  id: z.string(),
  userId: z.string().default('default'),
  type: z.enum(['achievement', 'level_up', 'streak_milestone', 'goal_completed', 'reminder']),
  title: z.string(),
  message: z.string(),
  icon: z.string().optional(),
  isRead: z.boolean().default(false),
  createdAt: z.number(),
  expiresAt: z.number().optional(),
});

// Type exports
export type AchievementType = z.infer<typeof achievementTypeSchema>;
export type AchievementTier = z.infer<typeof achievementTierSchema>;
export type Achievement = z.infer<typeof achievementSchema>;
export type UserAchievement = z.infer<typeof userAchievementSchema>;
export type XpEvent = z.infer<typeof xpEventSchema>;
export type UserLevel = z.infer<typeof userLevelSchema>;
export type StreakType = z.infer<typeof streakTypeSchema>;
export type Streak = z.infer<typeof streakSchema>;
export type GoalType = z.infer<typeof goalTypeSchema>;
export type GoalMetric = z.infer<typeof goalMetricSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export type UserStats = z.infer<typeof userStatsSchema>;
export type GamificationNotification = z.infer<typeof notificationSchema>;

// XP calculation constants
export const XP_REWARDS = {
  CARD_REVIEWED: 5,
  MCQ_ANSWERED: 5,
  EXAM_COMPLETED: 50,
  PERFECT_EXAM: 100,
  STUDY_STREAK_BONUS: 10, // per day in streak
  DAILY_GOAL_MET: 25,
  WEEKLY_GOAL_MET: 100,
  ACHIEVEMENT_MULTIPLIER: {
    bronze: 1,
    silver: 1.5,
    gold: 2,
    platinum: 3,
    diamond: 5,
  },
} as const;

// Level calculation
export const calculateXpForLevel = (level: number): number => {
  // Cumulative XP needed to reach the START of a given level.
  // Level 1 starts at 0 XP. We model growth with a quadratic curve on (level - 1).
  // This keeps per-level cost increasing while providing a simple closed form.
  const n = Math.max(0, level - 1);
  return Math.floor(Math.pow(n, 2) * 100);
};

// Level metadata (names and Tailwind color classes) up to level 50
// Backward-compatible: purely additive and optional for UI use
export type LevelMeta = { name: string; colorClass: string };

const LEVEL_META: Record<number, LevelMeta> = {
  1: { name: 'Novice', colorClass: 'bg-slate-500 text-white' },
  2: { name: 'Apprentice I', colorClass: 'bg-slate-600 text-white' },
  3: { name: 'Apprentice II', colorClass: 'bg-slate-700 text-white' },
  4: { name: 'Apprentice III', colorClass: 'bg-slate-800 text-white' },
  5: { name: 'Journeyman I', colorClass: 'bg-blue-500 text-white' },
  6: { name: 'Journeyman II', colorClass: 'bg-blue-600 text-white' },
  7: { name: 'Journeyman III', colorClass: 'bg-blue-700 text-white' },
  8: { name: 'Journeyman IV', colorClass: 'bg-blue-800 text-white' },
  9: { name: 'Adept I', colorClass: 'bg-indigo-500 text-white' },
  10: { name: 'Adept II', colorClass: 'bg-indigo-600 text-white' },
  11: { name: 'Adept III', colorClass: 'bg-indigo-700 text-white' },
  12: { name: 'Adept IV', colorClass: 'bg-indigo-800 text-white' },
  13: { name: 'Scholar I', colorClass: 'bg-violet-500 text-white' },
  14: { name: 'Scholar II', colorClass: 'bg-violet-600 text-white' },
  15: { name: 'Scholar III', colorClass: 'bg-violet-700 text-white' },
  16: { name: 'Scholar IV', colorClass: 'bg-violet-800 text-white' },
  17: { name: 'Expert I', colorClass: 'bg-purple-500 text-white' },
  18: { name: 'Expert II', colorClass: 'bg-purple-600 text-white' },
  19: { name: 'Expert III', colorClass: 'bg-purple-700 text-white' },
  20: { name: 'Expert IV', colorClass: 'bg-purple-800 text-white' },
  21: { name: 'Mentor I', colorClass: 'bg-fuchsia-500 text-white' },
  22: { name: 'Mentor II', colorClass: 'bg-fuchsia-600 text-white' },
  23: { name: 'Mentor III', colorClass: 'bg-fuchsia-700 text-white' },
  24: { name: 'Mentor IV', colorClass: 'bg-fuchsia-800 text-white' },
  25: { name: 'Master I', colorClass: 'bg-rose-500 text-white' },
  26: { name: 'Master II', colorClass: 'bg-rose-600 text-white' },
  27: { name: 'Master III', colorClass: 'bg-rose-700 text-white' },
  28: { name: 'Master IV', colorClass: 'bg-rose-800 text-white' },
  29: { name: 'Grandmaster I', colorClass: 'bg-red-500 text-white' },
  30: { name: 'Grandmaster II', colorClass: 'bg-red-600 text-white' },
  31: { name: 'Grandmaster III', colorClass: 'bg-red-700 text-white' },
  32: { name: 'Grandmaster IV', colorClass: 'bg-red-800 text-white' },
  33: { name: 'Sage I', colorClass: 'bg-orange-500 text-white' },
  34: { name: 'Sage II', colorClass: 'bg-orange-600 text-white' },
  35: { name: 'Sage III', colorClass: 'bg-orange-700 text-white' },
  36: { name: 'Sage IV', colorClass: 'bg-orange-800 text-white' },
  37: { name: 'Oracle I', colorClass: 'bg-amber-500 text-black' },
  38: { name: 'Oracle II', colorClass: 'bg-amber-600 text-black' },
  39: { name: 'Oracle III', colorClass: 'bg-amber-700 text-white' },
  40: { name: 'Oracle IV', colorClass: 'bg-amber-800 text-white' },
  41: { name: 'Luminary I', colorClass: 'bg-yellow-500 text-black' },
  42: { name: 'Luminary II', colorClass: 'bg-yellow-600 text-black' },
  43: { name: 'Luminary III', colorClass: 'bg-yellow-700 text-white' },
  44: { name: 'Luminary IV', colorClass: 'bg-yellow-800 text-white' },
  45: { name: 'Virtuoso I', colorClass: 'bg-lime-500 text-black' },
  46: { name: 'Virtuoso II', colorClass: 'bg-lime-600 text-black' },
  47: { name: 'Virtuoso III', colorClass: 'bg-lime-700 text-white' },
  48: { name: 'Virtuoso IV', colorClass: 'bg-lime-800 text-white' },
  49: { name: 'Ascendant', colorClass: 'bg-emerald-600 text-white' },
  50: { name: 'Transcendent', colorClass: 'bg-teal-600 text-white' },
};

export const getLevelMeta = (level: number): LevelMeta => {
  if (level < 1) return LEVEL_META[1];
  if (level > 50) return { ...LEVEL_META[50], name: `Transcendent ${level - 49}` };
  return LEVEL_META[level];
};

export const calculateLevelFromXp = (totalXp: number): { level: number; xpToNextLevel: number } => {
  // Find the highest level such that cumulative XP threshold for next level is greater than totalXp
  let level = 1;
  while (calculateXpForLevel(level + 1) <= totalXp) {
    level++;
  }

  const nextLevelXp = calculateXpForLevel(level + 1);
  const xpToNextLevel = Math.max(0, nextLevelXp - totalXp);

  return { level, xpToNextLevel };
};

// Default achievements
export const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  // ===== Study Streak Achievements =====
  {
    id: 'streak_3_days',
    name: 'Getting Started',
    description: 'Study for 3 consecutive days',
    type: 'study_streak',
    tier: 'bronze',
    icon: 'Flame',
    xpReward: 50,
    requirement: { type: 'streak', value: 3 },
    isSecret: false,
    createdAt: Date.now(),
  },
  {
    id: 'streak_7_days',
    name: 'Week Warrior',
    description: 'Study for 7 consecutive days',
    type: 'study_streak',
    tier: 'silver',
    icon: 'Flame',
    xpReward: 100,
    requirement: { type: 'streak', value: 7 },
    isSecret: false,
    createdAt: Date.now(),
  },
  {
    id: 'streak_30_days',
    name: 'Month Master',
    description: 'Study for 30 consecutive days',
    type: 'study_streak',
    tier: 'gold',
    icon: 'Flame',
    xpReward: 300,
    requirement: { type: 'streak', value: 30 },
    isSecret: false,
    createdAt: Date.now(),
  },
  {
    id: 'streak_90_days',
    name: 'Trimester Titan',
    description: 'Study for 90 consecutive days',
    type: 'study_streak',
    tier: 'platinum',
    icon: 'Flame',
    xpReward: 1000,
    requirement: { type: 'streak', value: 90 },
    isSecret: false,
    createdAt: Date.now(),
  },

  // ===== Study Time Milestones =====
  {
    id: 'study_time_1h',
    name: 'Time Investor',
    description: 'Log 1 hour of study time',
    type: 'study_time',
    tier: 'bronze',
    icon: 'Clock',
    xpReward: 25,
    requirement: { type: 'time', value: 60, timeframe: 'all_time' },
    isSecret: false,
    createdAt: Date.now(),
  },
  {
    id: 'study_time_10h',
    name: 'Dedicated Scholar',
    description: 'Log 10 hours of study time',
    type: 'study_time',
    tier: 'silver',
    icon: 'Clock',
    xpReward: 100,
    requirement: { type: 'time', value: 600, timeframe: 'all_time' },
    isSecret: false,
    createdAt: Date.now(),
  },
  {
    id: 'study_time_50h',
    name: 'Knowledge Seeker',
    description: 'Log 50 hours of study time',
    type: 'study_time',
    tier: 'gold',
    icon: 'Clock',
    xpReward: 500,
    requirement: { type: 'time', value: 3000, timeframe: 'all_time' },
    isSecret: false,
    createdAt: Date.now(),
  },

  // ===== Flashcard Achievements =====
  {
    id: 'flashcards_100',
    name: 'Flashcard Novice',
    description: 'Review 100 flashcards',
    type: 'flashcards_reviewed',
    tier: 'bronze',
    icon: 'FileText',
    xpReward: 50,
    requirement: { type: 'count', value: 100 },
    isSecret: false,
    createdAt: Date.now(),
  },
  {
    id: 'flashcards_1000',
    name: 'Flashcard Master',
    description: 'Review 1,000 flashcards',
    type: 'flashcards_reviewed',
    tier: 'silver',
    icon: 'FileText',
    xpReward: 250,
    requirement: { type: 'count', value: 1000 },
    isSecret: false,
    createdAt: Date.now(),
  },
  {
    id: 'flashcards_10000',
    name: 'Flashcard Legend',
    description: 'Review 10,000 flashcards',
    type: 'flashcards_reviewed',
    tier: 'diamond',
    icon: 'FileText',
    xpReward: 1000,
    requirement: { type: 'count', value: 10000 },
    isSecret: false,
    createdAt: Date.now(),
  },

  // ===== MCQ Achievements =====
  {
    id: 'mcq_50',
    name: 'MCQ Novice',
    description: 'Answer 50 MCQs',
    type: 'mcq_answered',
    tier: 'bronze',
    icon: 'ListChecks',
    xpReward: 50,
    requirement: { type: 'count', value: 50 },
    isSecret: false,
    createdAt: Date.now(),
  },
  {
    id: 'mcq_500',
    name: 'MCQ Expert',
    description: 'Answer 500 MCQs',
    type: 'mcq_answered',
    tier: 'silver',
    icon: 'ListChecks',
    xpReward: 250,
    requirement: { type: 'count', value: 500 },
    isSecret: false,
    createdAt: Date.now(),
  },
  {
    id: 'mcq_90pct',
    name: 'MCQ Master',
    description: 'Score 90%+ on 10 different MCQ sets',
    type: 'mcq_accuracy',
    tier: 'gold',
    icon: 'Award',
    xpReward: 500,
    requirement: { type: 'accuracy', value: 90, count: 10 },
    isSecret: false,
    createdAt: Date.now(),
  },

  // ===== Speed Achievements =====
  {
    id: 'speed_10_sec',
    name: 'Speed Demon',
    description: 'Answer 10 MCQs in under 10 seconds each',
    type: 'speed',
    tier: 'silver',
    icon: 'Zap',
    xpReward: 200,
    requirement: { type: 'speed', value: 10, count: 10 },
    isSecret: true,
    createdAt: Date.now(),
  },

  // ===== Special Achievements =====
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Study before 6 AM',
    type: 'special',
    tier: 'bronze',
    icon: 'Sunrise',
    xpReward: 100,
    requirement: { type: 'time_of_day', value: 6, comparison: 'before' },
    isSecret: true,
    createdAt: Date.now(),
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Study after 11 PM',
    type: 'special',
    tier: 'bronze',
    icon: 'Moon',
    xpReward: 100,
    requirement: { type: 'time_of_day', value: 23, comparison: 'after' },
    isSecret: true,
    createdAt: Date.now(),
  },
  {
    id: 'weekend_warrior',
    name: 'Weekend Warrior',
    description: 'Study on both weekend days in the same week',
    type: 'special',
    tier: 'silver',
    icon: 'Calendar',
    xpReward: 150,
    requirement: { type: 'weekend_streak', value: 1 },
    isSecret: true,
    createdAt: Date.now(),
  },

  // ===== Exam Achievements =====
  {
    id: 'exam_perfect',
    name: 'Perfect Score',
    description: 'Score 100% on an exam',
    type: 'exam_performance',
    tier: 'gold',
    icon: 'Award',
    xpReward: 500,
    requirement: { type: 'percentage', value: 100 },
    isSecret: false,
    createdAt: Date.now(),
  },
  {
    id: 'exam_90pct',
    name: 'Ace Student',
    description: 'Score 90%+ on 5 different exams',
    type: 'exam_performance',
    tier: 'silver',
    icon: 'Award',
    xpReward: 250,
    requirement: { type: 'percentage', value: 90, count: 5 },
    isSecret: false,
    createdAt: Date.now(),
  },
  {
    id: 'exam_marathon',
    name: 'Exam Marathoner',
    description: 'Complete 3+ hour study session',
    type: 'exam_marathon',
    tier: 'gold',
    icon: 'Clock',
    xpReward: 300,
    requirement: { type: 'duration', value: 180 },
    isSecret: true,
    createdAt: Date.now(),
  },

  // ===== Consistency Achievements =====
  {
    id: 'daily_goal_7',
    name: 'Weekly Champion',
    description: 'Reach daily goal 7 days in a row',
    type: 'consistency',
    tier: 'silver',
    icon: 'Trophy',
    xpReward: 200,
    requirement: { type: 'streak', value: 7, goal: 'daily' },
    isSecret: false,
    createdAt: Date.now(),
  },
  {
    id: 'daily_goal_30',
    name: 'Monthly Legend',
    description: 'Reach daily goal 30 days in a row',
    type: 'consistency',
    tier: 'platinum',
    icon: 'Trophy',
    xpReward: 1000,
    requirement: { type: 'streak', value: 30, goal: 'daily' },
    isSecret: false,
    createdAt: Date.now(),
  },
  {
    id: 'streak_30_days',
    name: 'Monthly Master',
    description: 'Study for 30 consecutive days',
    type: 'study_streak',
    tier: 'gold',
    icon: 'Flame',
    xpReward: 300,
    requirement: { type: 'streak', value: 30 },
    isSecret: false,
    createdAt: Date.now(),
  },

  // Exam Performance
  {
    id: 'perfect_exam_first',
    name: 'Perfectionist',
    description: 'Score 100% on your first exam',
    type: 'perfect_exam',
    tier: 'bronze',
    icon: 'Trophy',
    xpReward: 100,
    requirement: { type: 'percentage', value: 100 },
    isSecret: false,
    createdAt: Date.now(),
  },
  {
    id: 'perfect_exam_5',
    name: 'Flawless Five',
    description: 'Score 100% on 5 different exams',
    type: 'perfect_exam',
    tier: 'gold',
    icon: 'Crown',
    xpReward: 250,
    requirement: { type: 'count', value: 5 },
    isSecret: false,
    createdAt: Date.now(),
  },

  // Card Review Milestones
  {
    id: 'cards_100',
    name: 'Centurion',
    description: 'Review 100 flashcards',
    type: 'total_cards_reviewed',
    tier: 'bronze',
    icon: 'BookOpen',
    xpReward: 75,
    requirement: { type: 'count', value: 100 },
    isSecret: false,
    createdAt: Date.now(),
  },
  {
    id: 'cards_1000',
    name: 'Knowledge Seeker',
    description: 'Review 1,000 flashcards',
    type: 'total_cards_reviewed',
    tier: 'silver',
    icon: 'BookOpen',
    xpReward: 200,
    requirement: { type: 'count', value: 1000 },
    isSecret: false,
    createdAt: Date.now(),
  },
  {
    id: 'cards_10000',
    name: 'Master Scholar',
    description: 'Review 10,000 flashcards',
    type: 'total_cards_reviewed',
    tier: 'diamond',
    icon: 'GraduationCap',
    xpReward: 1000,
    requirement: { type: 'count', value: 10000 },
    isSecret: false,
    createdAt: Date.now(),
  },

  // Speed Achievements
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Complete an exam in under 30 seconds per question',
    type: 'speed',
    tier: 'silver',
    icon: 'Zap',
    xpReward: 150,
    requirement: { type: 'time', value: 30 },
    isSecret: false,
    createdAt: Date.now(),
  },

  // Secret Achievements
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Study between 11 PM and 5 AM',
    type: 'dedication',
    tier: 'bronze',
    icon: 'Moon',
    xpReward: 50,
    requirement: { type: 'time', value: 23 }, // 11 PM
    isSecret: true,
    createdAt: Date.now(),
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Study before 6 AM',
    type: 'dedication',
    tier: 'bronze',
    icon: 'Sunrise',
    xpReward: 50,
    requirement: { type: 'time', value: 6 },
    isSecret: true,
    createdAt: Date.now(),
  },
];
