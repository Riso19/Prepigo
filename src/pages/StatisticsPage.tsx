import { useMemo, useState } from 'react';
import { useDecks } from '@/contexts/DecksContext';
import { useQuestionBanks } from '@/contexts/QuestionBankContext';
import Header from '@/components/Header';
// removed unused Card UI imports
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
  LabelList,
  LineChart,
  Line,
} from 'recharts';
import { getAllFlashcardsFromDeck } from '@/lib/card-utils';
import { getAllMcqsFromBank } from '@/lib/question-bank-utils';
import { getItemStatus, ItemStatus } from '@/lib/srs-utils';
import { useSettings } from '@/contexts/SettingsContext';
import { useQuery } from '@tanstack/react-query';
import { getAllReviewLogsFromDB, getAllMcqReviewLogsFromDB } from '@/lib/idb';
import { subDays, startOfDay, isSameDay, differenceInDays } from 'date-fns';
import {
  Loader2,
  TrendingUp,
  CalendarDays,
  Flame,
  BookOpen,
  HelpCircle,
  AlertTriangle,
  BrainCircuit,
  Activity,
  Hourglass,
  BrainCog,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { State } from 'ts-fsrs';
import { FlashcardData } from '@/data/decks';
import { McqData } from '@/data/questionBanks';
import { PerformanceAnalytics } from '@/components/PerformanceAnalytics';
import { PerformanceGraph } from '@/components/PerformanceGraph';
import {
  calculateAccuracy,
  calculateDueStats,
  calculateIntervalGrowth,
  calculateRetentionDistribution,
  calculateForecast,
  calculateLearningCurve,
  calculateForgettingCurve,
  calculateStabilityOverTime,
  calculateMemoryDecayVelocity,
  calculateAverageKnowledgeHalfLife,
  calculateDifficultyWeightedMastery,
  calculateTopicForgettingRate,
} from '@/lib/analytics-utils';
import { ForgettingCurveChart } from '@/components/ForgettingCurveChart';
import { StabilityTrendChart } from '@/components/StabilityTrendChart';
import { AnimatedCard } from '@/components/AnimatedCard';
// removed unused DifficultyTrendChart import
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { TopicForgettingRateChart } from '@/components/TopicForgettingRateChart';

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      value: number;
    };
  }>;
  label?: string;
}

const ForecastTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-white p-2 shadow-sm">
        <p className="text-sm font-bold text-gray-800">{label}</p>
        <p className="text-sm text-gray-600">
          Reviews:{' '}
          <span className="font-bold ml-2" style={{ color: '#8884d8' }}>
            {payload[0].value}
          </span>
        </p>
      </div>
    );
  }
  return null;
};

const StatisticsPage = () => {
  const { decks } = useDecks();
  const { questionBanks } = useQuestionBanks();
  const { settings } = useSettings();
  const [showAdvanced, setShowAdvanced] = useState(true);
  const isMobile = useIsMobile();

  const { data: logs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['allReviewLogs'],
    queryFn: async () => {
      const cardLogs = await getAllReviewLogsFromDB();
      const mcqLogs = await getAllMcqReviewLogsFromDB();
      return { cardLogs, mcqLogs };
    },
  });

  const collectionStats = useMemo(() => {
    const allFlashcards = decks.flatMap(getAllFlashcardsFromDeck);
    const allMcqs = questionBanks.flatMap(getAllMcqsFromBank);
    return { allFlashcards, allMcqs, totalDecks: decks.length, totalQBanks: questionBanks.length };
  }, [decks, questionBanks]);

  const progressStats = useMemo(() => {
    if (!logs) return null;
    const reviewLogs = [...logs.cardLogs, ...logs.mcqLogs];
    const today = startOfDay(new Date());
    const reviewsToday = reviewLogs.filter((log) => isSameDay(new Date(log.review), today)).length;
    const reviewsPast7Days = reviewLogs.filter(
      (log) => differenceInDays(today, new Date(log.review)) < 7,
    ).length;
    const reviewsPast30Days = reviewLogs.filter(
      (log) => differenceInDays(today, new Date(log.review)) < 30,
    ).length;

    const uniqueDays = [
      ...new Set(reviewLogs.map((log) => startOfDay(new Date(log.review)).getTime())),
    ].sort((a, b) => a - b);
    let currentStreak = 0,
      longestStreak = 0,
      currentSequence = 0;

    if (uniqueDays.length > 0) {
      const lastDay = new Date(uniqueDays[uniqueDays.length - 1]);
      if (isSameDay(lastDay, today) || isSameDay(lastDay, subDays(today, 1))) {
        currentStreak = 1;
        for (let i = uniqueDays.length - 2; i >= 0; i--) {
          if (differenceInDays(new Date(uniqueDays[i + 1]), new Date(uniqueDays[i])) === 1)
            currentStreak++;
          else break;
        }
      }
      for (let i = 0; i < uniqueDays.length; i++) {
        if (i > 0 && differenceInDays(new Date(uniqueDays[i]), new Date(uniqueDays[i - 1])) === 1)
          currentSequence++;
        else currentSequence = 1;
        if (currentSequence > longestStreak) longestStreak = currentSequence;
      }
    }
    return { reviewsToday, reviewsPast7Days, reviewsPast30Days, currentStreak, longestStreak };
  }, [logs]);

  const dueStats = useMemo(() => {
    if (!logs) return null;
    const flashcardDues = calculateDueStats(collectionStats.allFlashcards, settings);
    const mcqDues = calculateDueStats(collectionStats.allMcqs, settings);
    return {
      total: {
        dueToday: flashcardDues.dueToday + mcqDues.dueToday,
        overdue: flashcardDues.overdue + mcqDues.overdue,
        weightedOverdueLoad: flashcardDues.weightedOverdueLoad + mcqDues.weightedOverdueLoad,
      },
    };
  }, [logs, collectionStats, settings]);

  const intervalGrowthStats = useMemo(() => {
    if (!logs) return null;
    return {
      flashcards: calculateIntervalGrowth(logs.cardLogs),
      mcqs: calculateIntervalGrowth(logs.mcqLogs),
    };
  }, [logs]);

  const stabilityStats = useMemo(() => {
    if (!logs) return null;
    const flashcardStabilityTrend = calculateStabilityOverTime(logs.cardLogs);
    const mcqStabilityTrend = calculateStabilityOverTime(logs.mcqLogs);
    return {
      flashcards: {
        trend: flashcardStabilityTrend,
        velocity: calculateMemoryDecayVelocity(flashcardStabilityTrend),
      },
      mcqs: { trend: mcqStabilityTrend, velocity: calculateMemoryDecayVelocity(mcqStabilityTrend) },
    };
  }, [logs]);

  const advancedFSRSStats = useMemo(() => {
    if (!logs || settings.scheduler === 'sm2') return null;
    const mcqScheduler = settings.scheduler;
    const mcqSettings = { ...settings, scheduler: mcqScheduler };
    return {
      flashcards: {
        halfLife: calculateAverageKnowledgeHalfLife(collectionStats.allFlashcards, settings),
        mastery: calculateDifficultyWeightedMastery(collectionStats.allFlashcards, settings),
      },
      mcqs: {
        halfLife: calculateAverageKnowledgeHalfLife(collectionStats.allMcqs, mcqSettings),
        mastery: calculateDifficultyWeightedMastery(collectionStats.allMcqs, mcqSettings),
      },
    };
  }, [logs, settings, collectionStats]);

  const topicForgettingRates = useMemo(() => {
    if (!logs) return null;
    const combinedItems = [...collectionStats.allFlashcards, ...collectionStats.allMcqs];
    const combinedLogs = [...logs.cardLogs, ...logs.mcqLogs];
    return calculateTopicForgettingRate(combinedItems, combinedLogs);
  }, [logs, collectionStats]);

  const forecastData = useMemo(
    () =>
      calculateForecast([...collectionStats.allFlashcards, ...collectionStats.allMcqs], settings),
    [collectionStats, settings],
  );
  const forgettingCurveData = useMemo(
    () => (logs ? calculateForgettingCurve([...logs.cardLogs, ...logs.mcqLogs]) : null),
    [logs],
  );
  const learningCurveData = useMemo(
    () =>
      logs
        ? {
            flashcards: calculateLearningCurve(logs.cardLogs),
            mcqs: calculateLearningCurve(logs.mcqLogs),
          }
        : null,
    [logs],
  );
  const retentionDistribution = useMemo(() => {
    const mcqScheduler = settings.scheduler === 'sm2' ? 'fsrs' : settings.scheduler;
    const mcqSettings = { ...settings, scheduler: mcqScheduler };
    return {
      flashcards: calculateRetentionDistribution(collectionStats.allFlashcards, settings),
      mcqs: calculateRetentionDistribution(collectionStats.allMcqs, mcqSettings),
    };
  }, [collectionStats, settings]);

  const calculateDifficulty = (items: (FlashcardData | McqData)[], scheduler: 'fsrs' | 'fsrs6') => {
    const reviewedItems = items.filter((item) => {
      const srsData = scheduler === 'fsrs6' ? item.srs?.fsrs6 : item.srs?.fsrs;
      return srsData && srsData.state !== State.New;
    });
    if (reviewedItems.length === 0) return { chartData: [], averageDifficulty: 0 };
    const bins = Array.from({ length: 10 }, () => 0);
    let totalDifficulty = 0;
    reviewedItems.forEach((item) => {
      const srsData = scheduler === 'fsrs6' ? item.srs?.fsrs6 : item.srs?.fsrs;
      const difficulty = srsData!.difficulty;
      totalDifficulty += difficulty;
      bins[Math.max(0, Math.min(9, Math.floor(difficulty) - 1))]++;
    });
    return {
      chartData: bins.map((count, index) => ({
        name: `${(index + 1) * 10}%`,
        count,
        difficulty: index + 1,
      })),
      averageDifficulty: Math.round((totalDifficulty / reviewedItems.length) * 10),
    };
  };

  const cardDifficultyDistribution = useMemo(
    () =>
      settings.scheduler !== 'sm2'
        ? calculateDifficulty(collectionStats.allFlashcards, settings.scheduler)
        : null,
    [collectionStats.allFlashcards, settings.scheduler],
  );
  const mcqDifficultyDistribution = useMemo(
    () =>
      calculateDifficulty(
        collectionStats.allMcqs,
        settings.scheduler === 'sm2' ? 'fsrs' : settings.scheduler,
      ),
    [collectionStats.allMcqs, settings.scheduler],
  );

  const maturityData = useMemo(() => {
    const flashcardStatusCounts: Record<ItemStatus, number> = {
      New: 0,
      Learning: 0,
      Relearning: 0,
      Young: 0,
      Mature: 0,
      Suspended: 0,
    };
    collectionStats.allFlashcards.forEach(
      (card) =>
        flashcardStatusCounts[
          getItemStatus(card, settings.scheduler, settings.maturityThresholdDays)
        ]++,
    );
    const mcqStatusCounts: Record<ItemStatus, number> = {
      New: 0,
      Learning: 0,
      Relearning: 0,
      Young: 0,
      Mature: 0,
      Suspended: 0,
    };
    collectionStats.allMcqs.forEach(
      (mcq) =>
        mcqStatusCounts[
          getItemStatus(
            mcq,
            settings.scheduler === 'sm2' ? 'fsrs' : settings.scheduler,
            settings.maturityThresholdDays,
          )
        ]++,
    );
    return { flashcardStatusCounts, mcqStatusCounts };
  }, [collectionStats, settings.scheduler, settings.maturityThresholdDays]);

  const performanceGraphData = useMemo(() => {
    if (!logs) return { deckPerformance: [], qBankPerformance: [] };

    const deckPerformance = decks
      .map((deck) => {
        const allFlashcardIds = new Set(getAllFlashcardsFromDeck(deck).map((c) => c.id));
        const accuracy = calculateAccuracy(allFlashcardIds, logs.cardLogs);
        return { name: deck.name, accuracy: accuracy ?? 0 };
      })
      .filter((d) => d.accuracy > 0);

    const qBankPerformance = questionBanks
      .map((bank) => {
        const allMcqIds = new Set(getAllMcqsFromBank(bank).map((m) => m.id));
        const accuracy = calculateAccuracy(allMcqIds, logs.mcqLogs);
        return { name: bank.name, accuracy: accuracy ?? 0 };
      })
      .filter((b) => b.accuracy > 0);

    return { deckPerformance, qBankPerformance };
  }, [logs, decks, questionBanks]);

  const PIE_COLORS: Record<ItemStatus, string> = {
    New: '#3b82f6',
    Learning: '#f97316',
    Relearning: '#eab308',
    Young: '#84cc16',
    Mature: '#14b8a6',
    Suspended: '#6b7280',
  };
  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 3) return 'hsl(48, 96%, 51%)';
    if (difficulty <= 5) return 'hsl(38, 92%, 56%)';
    if (difficulty <= 7) return 'hsl(25, 95%, 53%)';
    if (difficulty <= 9) return 'hsl(13, 84%, 53%)';
    return 'hsl(0, 72%, 51%)';
  };

  const renderPieChart = (data: Record<ItemStatus, number>) => {
    const chartData = Object.entries(data)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
    if (chartData.length === 0)
      return (
        <div className="flex items-center justify-center h-[250px] text-muted-foreground">
          No data to display
        </div>
      );
    return (
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx={isMobile ? '35%' : '50%'}
            cy="50%"
            outerRadius={isMobile ? 60 : 80}
          >
            {chartData.map((entry) => (
              <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[entry.name as ItemStatus]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend
            layout={isMobile ? 'vertical' : 'horizontal'}
            verticalAlign={isMobile ? 'middle' : 'bottom'}
            align={isMobile ? 'right' : 'center'}
            formatter={(value, entry) => {
              const count = (entry as { payload?: { value: number } })?.payload?.value ?? 0;
              return `${value} (${count})`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Statistics</h1>
            <p className="text-muted-foreground">
              An overview of your collection, progress, and memory performance.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/statistics/guide">
              <HelpCircle className="mr-2 h-4 w-4" />
              Guide
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-6">
          <AnimatedCard delay={0}>
            <CardHeader>
              <CardTitle>Total Decks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl sm:text-4xl font-bold">{collectionStats.totalDecks}</p>
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={0.1}>
            <CardHeader>
              <CardTitle>Total Flashcards</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl sm:text-4xl font-bold">
                {collectionStats.allFlashcards.length}
              </p>
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={0.2}>
            <CardHeader>
              <CardTitle>Total Q-Banks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl sm:text-4xl font-bold">{collectionStats.totalQBanks}</p>
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={0.3}>
            <CardHeader>
              <CardTitle>Total MCQs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl sm:text-4xl font-bold">{collectionStats.allMcqs.length}</p>
            </CardContent>
          </AnimatedCard>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold mt-8 mb-4">Learning Progress</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <AnimatedCard delay={0.4}>
            <CardHeader>
              <CardTitle>Reviews</CardTitle>
              <CardDescription>Your review activity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingLogs ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      Today
                    </span>
                    <span className="font-bold">{progressStats?.reviewsToday}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      Past 7 days
                    </span>
                    <span className="font-bold">{progressStats?.reviewsPast7Days}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      Past 30 days
                    </span>
                    <span className="font-bold">{progressStats?.reviewsPast30Days}</span>
                  </div>
                </>
              )}
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={0.5}>
            <CardHeader>
              <CardTitle>Study Streak</CardTitle>
              <CardDescription>Your consistency.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingLogs ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Flame className="h-4 w-4 text-orange-500" />
                      Current
                    </span>
                    <span className="font-bold">{progressStats?.currentStreak} days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Flame className="h-4 w-4" />
                      Longest
                    </span>
                    <span className="font-bold">{progressStats?.longestStreak} days</span>
                  </div>
                </>
              )}
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={0.6}>
            <CardHeader>
              <CardTitle>Due & Overdue</CardTitle>
              <CardDescription>Your current workload.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingLogs ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-4 w-4 text-green-500" />
                      Due Today
                    </span>
                    <span className="font-bold">{dueStats?.total.dueToday}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Overdue
                    </span>
                    <span className="font-bold">{dueStats?.total.overdue}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t mt-2">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <BrainCircuit className="h-4 w-4 text-purple-500" />
                      Weighted Load
                    </span>
                    <span className="font-bold">
                      {dueStats?.total.weightedOverdueLoad.toFixed(1)}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={0.7}>
            <CardHeader>
              <CardTitle>Interval Growth</CardTitle>
              <CardDescription>Efficiency of reviews.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingLogs ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <BookOpen className="h-4 w-4" />
                      Flashcards
                    </span>
                    <span className="font-bold">{intervalGrowthStats?.flashcards.toFixed(2)}x</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <HelpCircle className="h-4 w-4" />
                      MCQs
                    </span>
                    <span className="font-bold">{intervalGrowthStats?.mcqs.toFixed(2)}x</span>
                  </div>
                </>
              )}
            </CardContent>
          </AnimatedCard>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold mt-8 mb-4">Performance Analytics</h2>
        <PerformanceAnalytics />

        <div className="flex items-center justify-between mt-8 mb-4">
          <h2 className="text-xl sm:text-2xl font-bold">FSRS-Specific Metrics</h2>
          <Button variant="ghost" size="sm" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? 'Hide' : 'Show'} Advanced
          </Button>
        </div>
        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <AnimatedCard delay={0.8}>
              <CardHeader>
                <CardTitle>Decay Velocity</CardTitle>
                <CardDescription>Rate of change of avg. stability (30d).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingLogs ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Activity className="h-4 w-4" />
                        Flashcards
                      </span>
                      <span
                        className={`font-bold ${(stabilityStats?.flashcards.velocity ?? 0 < 0) ? 'text-red-500' : 'text-green-500'}`}
                      >
                        {stabilityStats?.flashcards.velocity.toFixed(2)} d/d
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Activity className="h-4 w-4" />
                        MCQs
                      </span>
                      <span
                        className={`font-bold ${(stabilityStats?.mcqs.velocity ?? 0 < 0) ? 'text-red-500' : 'text-green-500'}`}
                      >
                        {stabilityStats?.mcqs.velocity.toFixed(2)} d/d
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </AnimatedCard>
            <AnimatedCard delay={0.9}>
              <CardHeader>
                <CardTitle>Knowledge Half-Life</CardTitle>
                <CardDescription>Time for memory to decay to 50% recall.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingLogs ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Hourglass className="h-4 w-4" />
                        Flashcards
                      </span>
                      <span className="font-bold">
                        {advancedFSRSStats?.flashcards.halfLife?.toFixed(1) ?? 'N/A'} days
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Hourglass className="h-4 w-4" />
                        MCQs
                      </span>
                      <span className="font-bold">
                        {advancedFSRSStats?.mcqs.halfLife?.toFixed(1) ?? 'N/A'} days
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </AnimatedCard>
            <AnimatedCard delay={1.0}>
              <CardHeader>
                <CardTitle>Difficulty-Weighted Mastery</CardTitle>
                <CardDescription>
                  Overall knowledge score, penalizing for difficulty.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingLogs ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <BrainCog className="h-4 w-4" />
                        Flashcards
                      </span>
                      <span className="font-bold">
                        {advancedFSRSStats?.flashcards.mastery?.toFixed(1) ?? 'N/A'}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <BrainCog className="h-4 w-4" />
                        MCQs
                      </span>
                      <span className="font-bold">
                        {advancedFSRSStats?.mcqs.mastery?.toFixed(1) ?? 'N/A'}%
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </AnimatedCard>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-6">
          <AnimatedCard delay={1.1}>
            <CardHeader>
              <CardTitle>Flashcard Stability Trend</CardTitle>
              <CardDescription>Avg. memory strength over time.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : !stabilityStats || stabilityStats.flashcards.trend.length < 2 ? (
                <p className="text-sm text-muted-foreground">Not enough data.</p>
              ) : (
                <StabilityTrendChart data={stabilityStats.flashcards.trend} />
              )}
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={1.2}>
            <CardHeader>
              <CardTitle>MCQ Stability Trend</CardTitle>
              <CardDescription>Avg. memory strength over time.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : !stabilityStats || stabilityStats.mcqs.trend.length < 2 ? (
                <p className="text-sm text-muted-foreground">Not enough data.</p>
              ) : (
                <StabilityTrendChart data={stabilityStats.mcqs.trend} />
              )}
            </CardContent>
          </AnimatedCard>
          {cardDifficultyDistribution && (
            <AnimatedCard delay={1.3}>
              <CardHeader>
                <CardTitle>Flashcard Difficulty</CardTitle>
                <CardDescription>Distribution of FSRS difficulty scores.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={cardDifficultyDistribution.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                    <Bar dataKey="count">
                      {cardDifficultyDistribution.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getDifficultyColor(entry.difficulty)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-center font-semibold text-muted-foreground mt-4">
                  Avg. difficulty: {cardDifficultyDistribution.averageDifficulty}%
                </p>
              </CardContent>
            </AnimatedCard>
          )}
          {mcqDifficultyDistribution && (
            <AnimatedCard delay={1.4}>
              <CardHeader>
                <CardTitle>MCQ Difficulty</CardTitle>
                <CardDescription>Distribution of FSRS difficulty scores.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={mcqDifficultyDistribution.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                    <Bar dataKey="count">
                      {mcqDifficultyDistribution.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getDifficultyColor(entry.difficulty)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-center font-semibold text-muted-foreground mt-4">
                  Avg. difficulty: {mcqDifficultyDistribution.averageDifficulty}%
                </p>
              </CardContent>
            </AnimatedCard>
          )}
        </div>

        <h2 className="text-xl sm:text-2xl font-bold mt-8 mb-4">Topic Analysis</h2>
        <div className="grid grid-cols-1 gap-4 md:gap-6">
          <AnimatedCard delay={1.5}>
            <CardHeader>
              <CardTitle>Topic Forgetting Rate</CardTitle>
              <CardDescription>
                Topics you are most likely to forget, based on your review history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : !topicForgettingRates ? (
                <p className="text-sm text-muted-foreground">Not enough data.</p>
              ) : (
                <TopicForgettingRateChart data={topicForgettingRates} />
              )}
            </CardContent>
          </AnimatedCard>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold mt-8 mb-4">Deeper Insights & Trends</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <AnimatedCard delay={1.6}>
            <CardHeader>
              <CardTitle>Deck Performance</CardTitle>
              <CardDescription>Accuracy per deck.</CardDescription>
            </CardHeader>
            <CardContent>
              <PerformanceGraph data={performanceGraphData.deckPerformance} />
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={1.7}>
            <CardHeader>
              <CardTitle>Question Bank Performance</CardTitle>
              <CardDescription>Accuracy per question bank.</CardDescription>
            </CardHeader>
            <CardContent>
              <PerformanceGraph data={performanceGraphData.qBankPerformance} />
            </CardContent>
          </AnimatedCard>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold mt-8 mb-4">Forecast & Distribution</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-6">
          <AnimatedCard delay={1.8} className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Review Forecast</CardTitle>
              <CardDescription>Upcoming reviews for the next 30 days.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                  <BarChart data={forecastData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip content={<ForecastTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                    <Bar dataKey="reviews" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={1.9} className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Forgetting Curve</CardTitle>
              <CardDescription>Actual retention based on time since last review.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : !forgettingCurveData ? (
                <p className="text-sm text-muted-foreground">Not enough data.</p>
              ) : (
                <ForgettingCurveChart data={forgettingCurveData} />
              )}
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={2.0}>
            <CardHeader>
              <CardTitle>Flashcard Learning Curve</CardTitle>
              <CardDescription>Accuracy by review number after a lapse.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : !learningCurveData || learningCurveData.flashcards.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not enough data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={learningCurveData.flashcards}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="review" allowDecimals={false} />
                    <YAxis domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} />
                    <Tooltip
                      formatter={(value) => [`${(value as number).toFixed(1)}%`, 'Accuracy']}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="accuracy" stroke="#8884d8" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={2.1}>
            <CardHeader>
              <CardTitle>MCQ Learning Curve</CardTitle>
              <CardDescription>Accuracy by review number after a lapse.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : !learningCurveData || learningCurveData.mcqs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not enough data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={learningCurveData.mcqs}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="review" allowDecimals={false} />
                    <YAxis domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} />
                    <Tooltip
                      formatter={(value) => [`${(value as number).toFixed(1)}%`, 'Accuracy']}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="accuracy" stroke="#82ca9d" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={2.2}>
            <CardHeader>
              <CardTitle>Predicted Retention (Flashcards)</CardTitle>
              <CardDescription>Current predicted recall probability.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : !retentionDistribution.flashcards ? (
                <p className="text-sm text-muted-foreground">Not available for SM-2.</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={retentionDistribution.flashcards}
                    layout="vertical"
                    margin={{ left: 10, right: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8">
                      <LabelList dataKey="count" position="right" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={2.3}>
            <CardHeader>
              <CardTitle>Predicted Retention (MCQs)</CardTitle>
              <CardDescription>Current predicted recall probability.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : !retentionDistribution.mcqs ? (
                <p className="text-sm text-muted-foreground">No review data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={retentionDistribution.mcqs}
                    layout="vertical"
                    margin={{ left: 10, right: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#82ca9d">
                      <LabelList dataKey="count" position="right" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={2.4}>
            <CardHeader>
              <CardTitle>Flashcard Maturity</CardTitle>
              <CardDescription>Breakdown by learning stage.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {renderPieChart(maturityData.flashcardStatusCounts)}
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={2.5}>
            <CardHeader>
              <CardTitle>MCQ Maturity</CardTitle>
              <CardDescription>Breakdown by learning stage.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {renderPieChart(maturityData.mcqStatusCounts)}
            </CardContent>
          </AnimatedCard>
        </div>
      </main>
    </div>
  );
};

export default StatisticsPage;
