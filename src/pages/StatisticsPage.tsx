import { useMemo } from 'react';
import { useDecks } from '@/contexts/DecksContext';
import { useQuestionBanks } from '@/contexts/QuestionBankContext';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid, LabelList, LineChart, Line } from 'recharts';
import { getAllFlashcardsFromDeck } from '@/lib/card-utils';
import { getAllMcqsFromBank } from '@/lib/question-bank-utils';
import { getItemStatus, ItemStatus } from '@/lib/srs-utils';
import { useSettings } from '@/contexts/SettingsContext';
import { useQuery } from '@tanstack/react-query';
import { getAllReviewLogsFromDB, getAllMcqReviewLogsFromDB, McqReviewLog } from '@/lib/idb';
import { format, subDays, startOfDay, isSameDay, differenceInDays } from 'date-fns';
import { Loader2, TrendingUp, CalendarDays, Flame, BookOpen, Clock, Zap, HelpCircle, AlertTriangle, BrainCircuit, ShieldAlert, BarChartBig, Lightbulb, Activity, ChevronsRight, ChevronsLeft, Hourglass, Repeat2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { State } from 'ts-fsrs';
import { DeckData, FlashcardData, ReviewLog } from '@/data/decks';
import { McqData, QuestionBankData } from '@/data/questionBanks';
import { PerformanceAnalytics } from '@/components/PerformanceAnalytics';
import { PerformanceGraph } from '@/components/PerformanceGraph';
import { calculateAccuracy, calculateDueStats, calculateIntervalGrowth, calculateRetentionDistribution, calculateForecast, calculateAverageRetention, calculateAtRiskItems, calculateCumulativeStabilityGrowth, calculateSuspectedGuesses, calculateLearningCurve, calculateForgettingCurve, calculateStabilityOverTime, calculateMemoryDecayVelocity, calculateAverageKnowledgeHalfLife, calculateDifficultyDelta, calculateOverlearningRatio, calculateReviewTimeDistribution, calculateDailySummary, calculateTopicForgettingRate, calculateDifficultyWeightedMastery } from '@/lib/analytics-utils';
import { ForgettingCurveChart } from '@/components/ForgettingCurveChart';
import { StabilityTrendChart } from '@/components/StabilityTrendChart';
import { AnimatedCard } from '@/components/AnimatedCard';
import { ReviewTimeDistributionChart } from '@/components/ReviewTimeDistributionChart';
import { DailyActivityChart } from '@/components/DailyActivityChart';
import { DifficultyTrendChart } from '@/components/DifficultyTrendChart';

const StatisticsPage = () => {
  const { decks } = useDecks();
  const { questionBanks } = useQuestionBanks();
  const { settings } = useSettings();
  const isMobile = useIsMobile();

  // --- Data Fetching for Review Logs ---
  const { data: logs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['allReviewLogs'],
    queryFn: async () => {
      const cardLogs = await getAllReviewLogsFromDB();
      const mcqLogs = await getAllMcqReviewLogsFromDB();
      return { cardLogs, mcqLogs };
    }
  });

  // --- Memoized Calculations ---
  const collectionStats = useMemo(() => {
    const allFlashcards = decks.flatMap(getAllFlashcardsFromDeck);
    const allMcqs = questionBanks.flatMap(getAllMcqsFromBank);
    const totalDecks = decks.length;
    const totalQBanks = questionBanks.length;
    return {
      totalFlashcards: allFlashcards.length,
      totalMcqs: allMcqs.length,
      totalDecks,
      totalQBanks,
      allFlashcards,
      allMcqs,
    };
  }, [decks, questionBanks]);

  const progressStats = useMemo(() => {
    if (!logs) return null;
    const reviewLogs = [...logs.cardLogs, ...logs.mcqLogs];
    const today = startOfDay(new Date());
    const reviewsToday = reviewLogs.filter(log => isSameDay(new Date(log.review), today)).length;
    const reviewsPast7Days = reviewLogs.filter(log => differenceInDays(today, new Date(log.review)) < 7).length;
    const reviewsPast30Days = reviewLogs.filter(log => differenceInDays(today, new Date(log.review)) < 30).length;

    const uniqueDays = [...new Set(reviewLogs.map(log => startOfDay(new Date(log.review)).getTime()))].sort((a, b) => a - b);
    let currentStreak = 0;
    let longestStreak = 0;
    let currentSequence = 0;

    if (uniqueDays.length > 0) {
      const lastDay = new Date(uniqueDays[uniqueDays.length - 1]);
      if (isSameDay(lastDay, today) || isSameDay(lastDay, subDays(today, 1))) {
        currentStreak = 1;
        for (let i = uniqueDays.length - 2; i >= 0; i--) {
          const day = new Date(uniqueDays[i]);
          const prevDay = new Date(uniqueDays[i + 1]);
          if (differenceInDays(prevDay, day) === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }

      for (let i = 0; i < uniqueDays.length; i++) {
        if (i > 0 && differenceInDays(new Date(uniqueDays[i]), new Date(uniqueDays[i - 1])) === 1) {
          currentSequence++;
        } else {
          currentSequence = 1;
        }
        if (currentSequence > longestStreak) {
          longestStreak = currentSequence;
        }
      }
    }

    return { reviewsToday, reviewsPast7Days, reviewsPast30Days, currentStreak, longestStreak };
  }, [logs]);

  const maturityData = useMemo(() => {
    const flashcardStatusCounts: Record<ItemStatus, number> = { New: 0, Learning: 0, Relearning: 0, Young: 0, Mature: 0, Suspended: 0 };
    collectionStats.allFlashcards.forEach(card => {
      const status = getItemStatus(card, settings.scheduler);
      flashcardStatusCounts[status]++;
    });

    const mcqStatusCounts: Record<ItemStatus, number> = { New: 0, Learning: 0, Relearning: 0, Young: 0, Mature: 0, Suspended: 0 };
    collectionStats.allMcqs.forEach(mcq => {
      const status = getItemStatus(mcq, settings.scheduler === 'sm2' ? 'fsrs' : settings.scheduler);
      mcqStatusCounts[status]++;
    });

    return { flashcardStatusCounts, mcqStatusCounts };
  }, [collectionStats, settings.scheduler]);

  const performanceGraphData = useMemo(() => {
    if (!logs) return { deckPerformance: [], qBankPerformance: [] };

    const getDeckPerformance = (deckList: DeckData[], path: string[] = []): { name: string; accuracy: number }[] => {
        return deckList.flatMap(deck => {
            const currentPath = [...path, deck.name];
            const deckFlashcardIds = new Set(deck.flashcards.map(c => c.id));
            let currentDeckPerformance: { name: string; accuracy: number }[] = [];
            
            if (deckFlashcardIds.size > 0) {
                const accuracy = calculateAccuracy(deckFlashcardIds, logs.cardLogs);
                if (accuracy !== null) {
                    currentDeckPerformance.push({ name: currentPath.join(' / '), accuracy });
                }
            }

            const subDeckPerformance = deck.subDecks ? getDeckPerformance(deck.subDecks, currentPath) : [];
            return [...currentDeckPerformance, ...subDeckPerformance];
        });
    };

    const getQBankPerformance = (bankList: QuestionBankData[], path: string[] = []): { name: string; accuracy: number }[] => {
        return bankList.flatMap(bank => {
            const currentPath = [...path, bank.name];
            const bankMcqIds = new Set(bank.mcqs.map(m => m.id));
            let currentBankPerformance: { name: string; accuracy: number }[] = [];

            if (bankMcqIds.size > 0) {
                const accuracy = calculateAccuracy(bankMcqIds, logs.mcqLogs);
                if (accuracy !== null) {
                    currentBankPerformance.push({ name: currentPath.join(' / '), accuracy });
                }
            }

            const subBankPerformance = bank.subBanks ? getQBankPerformance(bank.subBanks, currentPath) : [];
            return [...currentBankPerformance, ...subBankPerformance];
        });
    };

    return {
        deckPerformance: getDeckPerformance(decks),
        qBankPerformance: getQBankPerformance(questionBanks),
    };
  }, [logs, decks, questionBanks]);

  const calculateDifficulty = (items: (FlashcardData | McqData)[], scheduler: 'fsrs' | 'fsrs6') => {
    const reviewedItems = items.filter(item => {
      const srsData = scheduler === 'fsrs6' ? item.srs?.fsrs6 : item.srs?.fsrs;
      return srsData && srsData.state !== State.New;
    });

    if (reviewedItems.length === 0) {
      return { chartData: [], averageDifficulty: 0, reviewedCount: 0 };
    }

    const bins = Array.from({ length: 10 }, () => 0);
    let totalDifficulty = 0;

    reviewedItems.forEach(item => {
      const srsData = scheduler === 'fsrs6' ? item.srs?.fsrs6 : item.srs?.fsrs;
      const difficulty = srsData!.difficulty;
      totalDifficulty += difficulty;
      const binIndex = Math.max(0, Math.min(9, Math.floor(difficulty) - 1));
      bins[binIndex]++;
    });

    const averageDifficulty = totalDifficulty / reviewedItems.length;

    const chartData = bins.map((count, index) => ({
      name: `${(index + 1) * 10}%`,
      count: count,
      difficulty: index + 1,
    }));

    return {
      chartData,
      averageDifficulty: Math.round(averageDifficulty * 10),
      reviewedCount: reviewedItems.length,
    };
  };

  const cardDifficultyDistribution = useMemo(() => {
    if (settings.scheduler === 'sm2') return null;
    return calculateDifficulty(collectionStats.allFlashcards, settings.scheduler);
  }, [collectionStats.allFlashcards, settings.scheduler]);

  const mcqDifficultyDistribution = useMemo(() => {
    const mcqScheduler = settings.scheduler === 'sm2' ? 'fsrs' : settings.scheduler;
    return calculateDifficulty(collectionStats.allMcqs, mcqScheduler);
  }, [collectionStats.allMcqs, settings.scheduler]);

  const dueStats = useMemo(() => {
    if (!logs) return null;
    const flashcardDues = calculateDueStats(collectionStats.allFlashcards, settings);
    const mcqDues = calculateDueStats(collectionStats.allMcqs, settings);
    return {
        flashcards: flashcardDues,
        mcqs: mcqDues,
        total: {
            dueToday: flashcardDues.dueToday + mcqDues.dueToday,
            overdue: flashcardDues.overdue + mcqDues.overdue,
            weightedOverdueLoad: flashcardDues.weightedOverdueLoad + mcqDues.weightedOverdueLoad,
        }
    };
  }, [logs, collectionStats, settings]);

  const intervalGrowthStats = useMemo(() => {
      if (!logs) return null;
      const flashcardGrowth = calculateIntervalGrowth(logs.cardLogs);
      const mcqGrowth = calculateIntervalGrowth(logs.mcqLogs);
      return { flashcards: flashcardGrowth, mcqs: mcqGrowth };
  }, [logs]);

  const retentionDistribution = useMemo(() => {
      const flashcardDist = calculateRetentionDistribution(collectionStats.allFlashcards, settings);
      const mcqScheduler = settings.scheduler === 'sm2' ? 'fsrs' : settings.scheduler;
      const mcqSettings = {...settings, scheduler: mcqScheduler};
      const mcqDist = calculateRetentionDistribution(collectionStats.allMcqs, mcqSettings);
      return { flashcards: flashcardDist, mcqs: mcqDist };
  }, [collectionStats, settings]);

  const forecastData = useMemo(() => {
      const combinedItems = [...collectionStats.allFlashcards, ...collectionStats.allMcqs];
      return calculateForecast(combinedItems, settings);
  }, [collectionStats, settings]);

  const advancedStats = useMemo(() => {
    if (!logs) return null;
    const mcqScheduler = settings.scheduler === 'sm2' ? 'fsrs' : settings.scheduler;
    const mcqSettings = {...settings, scheduler: mcqScheduler};
    return {
        flashcards: {
            avgRetention: calculateAverageRetention(collectionStats.allFlashcards, settings),
            atRisk: calculateAtRiskItems(collectionStats.allFlashcards, settings),
            stabilityGrowth: calculateCumulativeStabilityGrowth(logs.cardLogs),
            guesses: calculateSuspectedGuesses(logs.cardLogs),
            halfLife: calculateAverageKnowledgeHalfLife(collectionStats.allFlashcards, settings),
            difficultyDelta: calculateDifficultyDelta(logs.cardLogs),
            overlearning: calculateOverlearningRatio(logs.cardLogs, settings),
        },
        mcqs: {
            avgRetention: calculateAverageRetention(collectionStats.allMcqs, mcqSettings),
            atRisk: calculateAtRiskItems(collectionStats.allMcqs, mcqSettings),
            stabilityGrowth: calculateCumulativeStabilityGrowth(logs.mcqLogs),
            guesses: calculateSuspectedGuesses(logs.mcqLogs),
            halfLife: calculateAverageKnowledgeHalfLife(collectionStats.allMcqs, mcqSettings),
            difficultyDelta: calculateDifficultyDelta(logs.mcqLogs),
            overlearning: calculateOverlearningRatio(logs.mcqLogs, mcqSettings),
        },
    };
  }, [logs, collectionStats, settings]);

  const learningCurveData = useMemo(() => {
    if (!logs) return null;
    const combinedLogs = [...logs.cardLogs, ...logs.mcqLogs];
    return calculateLearningCurve(combinedLogs);
  }, [logs]);

  const forgettingCurveData = useMemo(() => {
    if (!logs) return null;
    const combinedLogs = [...logs.cardLogs, ...logs.mcqLogs];
    return calculateForgettingCurve(combinedLogs);
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
      mcqs: {
        trend: mcqStabilityTrend,
        velocity: calculateMemoryDecayVelocity(mcqStabilityTrend),
      },
    };
  }, [logs]);

  const reviewTimeData = useMemo(() => {
    if (!logs) return null;
    return {
      flashcards: calculateReviewTimeDistribution(logs.cardLogs),
      mcqs: calculateReviewTimeDistribution(logs.mcqLogs),
    };
  }, [logs]);

  const dailySummaryData = useMemo(() => {
    if (!logs) return null;
    return {
      flashcards: calculateDailySummary(logs.cardLogs),
      mcqs: calculateDailySummary(logs.mcqLogs),
    };
  }, [logs]);

  // --- Charting Constants ---
  const PIE_COLORS: Record<ItemStatus, string> = {
    New: '#3b82f6', // blue-500
    Learning: '#f97316', // orange-500
    Relearning: '#eab308', // yellow-500
    Young: '#84cc16', // lime-500
    Mature: '#14b8a6', // teal-500
    Suspended: '#6b7280', // gray-500
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 3) return 'hsl(48, 96%, 51%)'; // yellow-400
    if (difficulty <= 5) return 'hsl(38, 92%, 56%)'; // orange-400
    if (difficulty <= 7) return 'hsl(25, 95%, 53%)'; // orange-500
    if (difficulty <= 9) return 'hsl(13, 84%, 53%)'; // red-500
    return 'hsl(0, 72%, 51%)'; // red-600
  };

  const renderPieChart = (data: Record<ItemStatus, number>) => {
    const chartData = Object.entries(data)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));

    if (chartData.length === 0) {
      return <div className="flex items-center justify-center h-[250px] text-muted-foreground">No data to display</div>;
    }

    return (
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie 
            data={chartData} 
            dataKey="value" 
            nameKey="name" 
            cx={isMobile ? "35%" : "50%"} 
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
            formatter={(value, entry) => `${value} (${entry.payload.value})`} 
          />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Statistics</h1>
        <p className="text-muted-foreground mb-6">An overview of your collection, progress, and memory performance.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <AnimatedCard delay={0}>
            <CardHeader><CardTitle>Total Decks</CardTitle></CardHeader>
            <CardContent><p className="text-3xl sm:text-4xl font-bold">{collectionStats.totalDecks}</p></CardContent>
          </AnimatedCard>
          <AnimatedCard delay={0.1}>
            <CardHeader><CardTitle>Total Flashcards</CardTitle></CardHeader>
            <CardContent><p className="text-3xl sm:text-4xl font-bold">{collectionStats.totalFlashcards}</p></CardContent>
          </AnimatedCard>
          <AnimatedCard delay={0.2}>
            <CardHeader><CardTitle>Total Q-Banks</CardTitle></CardHeader>
            <CardContent><p className="text-3xl sm:text-4xl font-bold">{collectionStats.totalQBanks}</p></CardContent>
          </AnimatedCard>
          <AnimatedCard delay={0.3}>
            <CardHeader><CardTitle>Total MCQs</CardTitle></CardHeader>
            <CardContent><p className="text-3xl sm:text-4xl font-bold">{collectionStats.totalMcqs}</p></CardContent>
          </AnimatedCard>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold mt-8 mb-4">Learning Progress</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <AnimatedCard delay={0.4}>
            <CardHeader>
              <CardTitle>Reviews</CardTitle>
              <CardDescription>Your review activity over different time periods.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : <>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><TrendingUp className="h-4 w-4" />Today</span><span className="font-bold">{progressStats?.reviewsToday}</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" />Past 7 days</span><span className="font-bold">{progressStats?.reviewsPast7Days}</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" />Past 30 days</span><span className="font-bold">{progressStats?.reviewsPast30Days}</span></div>
              </>}
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={0.5}>
            <CardHeader>
              <CardTitle>Study Streak</CardTitle>
              <CardDescription>Your consistency with daily study sessions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : <>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Flame className="h-4 w-4 text-orange-500" />Current Streak</span><span className="font-bold">{progressStats?.currentStreak} days</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Flame className="h-4 w-4" />Longest Streak</span><span className="font-bold">{progressStats?.longestStreak} days</span></div>
              </>}
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={0.6}>
            <CardHeader>
              <CardTitle>Due & Overdue</CardTitle>
              <CardDescription>Your current review workload and backlog difficulty.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : <>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4 text-green-500" />Due Today</span><span className="font-bold">{dueStats?.total.dueToday}</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><AlertTriangle className="h-4 w-4 text-red-500" />Overdue</span><span className="font-bold">{dueStats?.total.overdue}</span></div>
                <div className="flex items-center justify-between pt-2 border-t mt-2"><span className="flex items-center gap-2 text-muted-foreground"><BrainCircuit className="h-4 w-4 text-purple-500" />Weighted Load</span><span className="font-bold">{dueStats?.total.weightedOverdueLoad.toFixed(1)}</span></div>
              </>}
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={0.7}>
            <CardHeader>
              <CardTitle>Interval Growth Efficiency</CardTitle>
              <CardDescription>How efficiently review intervals are growing. Higher is better.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : <>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><BookOpen className="h-4 w-4" />Flashcards</span><span className="font-bold">{intervalGrowthStats?.flashcards.toFixed(2)}x</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><HelpCircle className="h-4 w-4" />MCQs</span><span className="font-bold">{intervalGrowthStats?.mcqs.toFixed(2)}x</span></div>
              </>}
            </CardContent>
          </AnimatedCard>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold mt-8 mb-4">Performance Analytics</h2>
        <PerformanceAnalytics />

        <h2 className="text-xl sm:text-2xl font-bold mt-8 mb-4">Memory Stability</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <AnimatedCard delay={0.8}>
            <CardHeader>
              <CardTitle>Flashcard Stability Trend</CardTitle>
              <CardDescription>Average stability (long-term memory strength) of reviewed items over time.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                !stabilityStats || stabilityStats.flashcards.trend.length < 2 ? <p className="text-sm text-muted-foreground">Not enough data to show stability trend.</p> :
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Decay Velocity (30d):</span>
                    <span className={`font-bold ${stabilityStats.flashcards.velocity < 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {stabilityStats.flashcards.velocity.toFixed(2)} days/day
                    </span>
                  </div>
                  <StabilityTrendChart data={stabilityStats.flashcards.trend} />
                </>
              }
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={0.9}>
            <CardHeader>
              <CardTitle>MCQ Stability Trend</CardTitle>
              <CardDescription>Average stability (long-term memory strength) of reviewed items over time.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                !stabilityStats || stabilityStats.mcqs.trend.length < 2 ? <p className="text-sm text-muted-foreground">Not enough data to show stability trend.</p> :
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Decay Velocity (30d):</span>
                    <span className={`font-bold ${stabilityStats.mcqs.velocity < 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {stabilityStats.mcqs.velocity.toFixed(2)} days/day
                    </span>
                  </div>
                  <StabilityTrendChart data={stabilityStats.mcqs.trend} />
                </>
              }
            </CardContent>
          </AnimatedCard>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold mt-8 mb-4">Advanced Memory Stats</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <AnimatedCard delay={1.0}>
                <CardHeader>
                  <CardTitle>Knowledge Half-Life</CardTitle>
                  <CardDescription>Estimated time for memory of an average item to decay to 50% retention.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : <>
                        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Hourglass className="h-4 w-4" />Flashcards</span><span className="font-bold">{advancedStats?.flashcards.halfLife?.toFixed(1) ?? 'N/A'} days</span></div>
                        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Hourglass className="h-4 w-4" />MCQs</span><span className="font-bold">{advancedStats?.mcqs.halfLife?.toFixed(1) ?? 'N/A'} days</span></div>
                    </>}
                </CardContent>
            </AnimatedCard>
            <AnimatedCard delay={1.1}>
                <CardHeader>
                  <CardTitle>Storage vs. Retrieval</CardTitle>
                  <CardDescription>Storage is long-term memory; Retrieval is current recall probability.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : <>
                        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><ChevronsRight className="h-4 w-4" />Retrieval (FC)</span><span className="font-bold">{advancedStats?.flashcards.avgRetention?.toFixed(1) ?? 'N/A'}%</span></div>
                        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><ChevronsLeft className="h-4 w-4" />Storage (FC)</span><span className="font-bold">{advancedStats?.flashcards.stabilityGrowth?.toFixed(1) ?? 'N/A'}d</span></div>
                        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><ChevronsRight className="h-4 w-4" />Retrieval (MCQ)</span><span className="font-bold">{advancedStats?.mcqs.avgRetention?.toFixed(1) ?? 'N/A'}%</span></div>
                        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><ChevronsLeft className="h-4 w-4" />Storage (MCQ)</span><span className="font-bold">{advancedStats?.mcqs.stabilityGrowth?.toFixed(1) ?? 'N/A'}d</span></div>
                    </>}
                </CardContent>
            </AnimatedCard>
            <AnimatedCard delay={1.2}>
                <CardHeader>
                  <CardTitle>Difficulty Delta</CardTitle>
                  <CardDescription>Avg. change in FSRS difficulty per review. Negative is better.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : <>
                        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><TrendingUp className="h-4 w-4" />Flashcards</span><span className="font-bold">{advancedStats?.flashcards.difficultyDelta?.toFixed(3)}</span></div>
                        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><TrendingUp className="h-4 w-4" />MCQs</span><span className="font-bold">{advancedStats?.mcqs.difficultyDelta?.toFixed(3)}</span></div>
                    </>}
                </CardContent>
            </AnimatedCard>
            <AnimatedCard delay={1.3}>
                <CardHeader>
                  <CardTitle>Overlearning Ratio</CardTitle>
                  <CardDescription>% of reviews on items with &gt;95% retention. High values may be inefficient.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : <>
                        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Repeat2 className="h-4 w-4" />Flashcards</span><span className="font-bold">{advancedStats?.flashcards.overlearning?.toFixed(1) ?? 'N/A'}%</span></div>
                        <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Repeat2 className="h-4 w-4" />MCQs</span><span className="font-bold">{advancedStats?.mcqs.overlearning?.toFixed(1) ?? 'N/A'}%</span></div>
                    </>}
                </CardContent>
            </AnimatedCard>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold mt-8 mb-4">Deeper Insights & Trends</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <AnimatedCard>
            <CardHeader><CardTitle>Flashcard Burnout Risk</CardTitle><CardDescription>Daily review load vs. accuracy.</CardDescription></CardHeader>
            <CardContent>
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                !dailySummaryData || dailySummaryData.flashcards.length < 2 ? <p className="text-sm text-muted-foreground">Not enough data.</p> :
                <DailyActivityChart data={dailySummaryData.flashcards} />
              }
            </CardContent>
          </AnimatedCard>
          <AnimatedCard>
            <CardHeader><CardTitle>MCQ Burnout Risk</CardTitle><CardDescription>Daily review load vs. accuracy.</CardDescription></CardHeader>
            <CardContent>
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                !dailySummaryData || dailySummaryData.mcqs.length < 2 ? <p className="text-sm text-muted-foreground">Not enough data.</p> :
                <DailyActivityChart data={dailySummaryData.mcqs} />
              }
            </CardContent>
          </AnimatedCard>
          <AnimatedCard>
            <CardHeader><CardTitle>Flashcard Difficulty Trend</CardTitle><CardDescription>Average FSRS difficulty over time.</CardDescription></CardHeader>
            <CardContent>
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                !dailySummaryData || dailySummaryData.flashcards.length < 2 ? <p className="text-sm text-muted-foreground">Not enough data.</p> :
                <DifficultyTrendChart data={dailySummaryData.flashcards} />
              }
            </CardContent>
          </AnimatedCard>
          <AnimatedCard>
            <CardHeader><CardTitle>MCQ Difficulty Trend</CardTitle><CardDescription>Average FSRS difficulty over time.</CardDescription></CardHeader>
            <CardContent>
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                !dailySummaryData || dailySummaryData.mcqs.length < 2 ? <p className="text-sm text-muted-foreground">Not enough data.</p> :
                <DifficultyTrendChart data={dailySummaryData.mcqs} />
              }
            </CardContent>
          </AnimatedCard>
          <AnimatedCard>
            <CardHeader><CardTitle>Flashcard Review Time</CardTitle><CardDescription>Distribution of time spent per review.</CardDescription></CardHeader>
            <CardContent>
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                !reviewTimeData || !reviewTimeData.flashcards ? <p className="text-sm text-muted-foreground">Not enough data.</p> :
                <ReviewTimeDistributionChart data={reviewTimeData.flashcards} />
              }
            </CardContent>
          </AnimatedCard>
          <AnimatedCard>
            <CardHeader><CardTitle>MCQ Review Time</CardTitle><CardDescription>Distribution of time spent per review.</CardDescription></CardHeader>
            <CardContent>
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                !reviewTimeData || !reviewTimeData.mcqs ? <p className="text-sm text-muted-foreground">Not enough data.</p> :
                <ReviewTimeDistributionChart data={reviewTimeData.mcqs} />
              }
            </CardContent>
          </AnimatedCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-6">
          <AnimatedCard delay={1.4}>
            <CardHeader>
              <CardTitle>Deck Performance</CardTitle>
              <CardDescription>Accuracy per deck and sub-deck.</CardDescription>
            </CardHeader>
            <CardContent>
              <PerformanceGraph data={performanceGraphData.deckPerformance} />
            </CardContent>
          </AnimatedCard>
          <AnimatedCard delay={1.5}>
            <CardHeader>
              <CardTitle>Question Bank Performance</CardTitle>
              <CardDescription>Accuracy per question bank and sub-bank.</CardDescription>
            </CardHeader>
            <CardContent>
              <PerformanceGraph data={performanceGraphData.qBankPerformance} />
            </CardContent>
          </AnimatedCard>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold mt-8 mb-4">Forecast & Distribution</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-6">
          <AnimatedCard delay={1.6} className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Review Forecast</CardTitle>
              <CardDescription>Upcoming reviews for the next 30 days.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                  <BarChart data={forecastData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="reviews" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={1.7} className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Forgetting Curve</CardTitle>
              <CardDescription>Actual retention based on time since last review.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                !forgettingCurveData ? <p className="text-sm text-muted-foreground">Not enough review data to plot the forgetting curve.</p> :
                <ForgettingCurveChart data={forgettingCurveData} />
              }
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={1.8}>
            <CardHeader>
              <CardTitle>Learning Curve</CardTitle>
              <CardDescription>Accuracy by review number for all items.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                !learningCurveData || learningCurveData.length === 0 ? <p className="text-sm text-muted-foreground">Not enough data for a learning curve.</p> :
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={learningCurveData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="review" allowDecimals={false} />
                    <YAxis domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} />
                    <Tooltip formatter={(value) => [`${(value as number).toFixed(1)}%`, 'Accuracy']} />
                    <Legend />
                    <Line type="monotone" dataKey="accuracy" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              }
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={1.9}>
            <CardHeader>
              <CardTitle>Predicted Retention (Flashcards)</CardTitle>
              <CardDescription>Snapshot of current predicted recall probability.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                !retentionDistribution.flashcards ? <p className="text-sm text-muted-foreground">Not available for SM-2 or no review data.</p> :
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={retentionDistribution.flashcards} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8">
                      <LabelList dataKey="count" position="right" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              }
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={2.0}>
            <CardHeader>
              <CardTitle>Predicted Retention (MCQs)</CardTitle>
              <CardDescription>Snapshot of current predicted recall probability.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                !retentionDistribution.mcqs ? <p className="text-sm text-muted-foreground">No review data available.</p> :
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={retentionDistribution.mcqs} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#82ca9d">
                      <LabelList dataKey="count" position="right" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              }
            </CardContent>
          </AnimatedCard>

          {cardDifficultyDistribution && cardDifficultyDistribution.reviewedCount > 0 && (
            <AnimatedCard delay={2.1}>
                <CardHeader>
                    <CardTitle>Flashcard Difficulty</CardTitle>
                    <CardDescription>Distribution of FSRS difficulty scores for reviewed items.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
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
                        Average difficulty: {cardDifficultyDistribution.averageDifficulty}%
                    </p>
                </CardContent>
            </AnimatedCard>
          )}

          {mcqDifficultyDistribution && mcqDifficultyDistribution.reviewedCount > 0 && (
            <AnimatedCard delay={2.2}>
                <CardHeader>
                    <CardTitle>MCQ Difficulty</CardTitle>
                    <CardDescription>Distribution of FSRS difficulty scores for reviewed items.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
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
                        Average difficulty: {mcqDifficultyDistribution.averageDifficulty}%
                    </p>
                </CardContent>
            </AnimatedCard>
          )}

          <AnimatedCard delay={2.3}>
            <CardHeader>
              <CardTitle>Flashcard Maturity</CardTitle>
              <CardDescription>A breakdown of your collection by learning stage.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {renderPieChart(maturityData.flashcardStatusCounts)}
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={2.4}>
            <CardHeader>
              <CardTitle>MCQ Maturity</CardTitle>
              <CardDescription>A breakdown of your collection by learning stage.</CardDescription>
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