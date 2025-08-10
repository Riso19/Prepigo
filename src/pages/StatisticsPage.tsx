import { useMemo } from 'react';
import { useDecks } from '@/contexts/DecksContext';
import { useQuestionBanks } from '@/contexts/QuestionBankContext';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid, LabelList } from 'recharts';
import { getAllFlashcardsFromDeck } from '@/lib/card-utils';
import { getAllMcqsFromBank } from '@/lib/question-bank-utils';
import { getItemStatus, ItemStatus } from '@/lib/srs-utils';
import { useSettings } from '@/contexts/SettingsContext';
import { useQuery } from '@tanstack/react-query';
import { getAllReviewLogsFromDB, getAllMcqReviewLogsFromDB, McqReviewLog } from '@/lib/idb';
import { format, subDays, startOfDay, isSameDay, differenceInDays } from 'date-fns';
import { Loader2, TrendingUp, CalendarDays, Flame, BookOpen, Clock, Zap, HelpCircle, AlertTriangle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { State } from 'ts-fsrs';
import { DeckData, FlashcardData, ReviewLog } from '@/data/decks';
import { McqData, QuestionBankData } from '@/data/questionBanks';
import { PerformanceAnalytics } from '@/components/PerformanceAnalytics';
import { PerformanceGraph } from '@/components/PerformanceGraph';
import { calculateAccuracy, calculateDueStats, calculateIntervalGrowth, calculateRetentionDistribution, calculateForecast } from '@/lib/analytics-utils';

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

  const timeStats = useMemo(() => {
    const calculateMetrics = (logSet: (ReviewLog | McqReviewLog)[]) => {
      if (!logSet || logSet.length === 0) {
        return {
          totalTimeFormatted: "0h 0m",
          avgPerHour: 0,
        };
      }

      const totalDurationMs = logSet.reduce((acc, log) => acc + (log.duration || 0), 0);
      const totalDurationHours = totalDurationMs / (1000 * 60 * 60);

      const hours = Math.floor(totalDurationHours);
      const minutes = Math.round((totalDurationHours - hours) * 60);
      const totalTimeFormatted = `${hours}h ${minutes}m`;

      const avgPerHour = totalDurationHours > 0 ? Math.round(logSet.length / totalDurationHours) : 0;

      return { totalTimeFormatted, avgPerHour };
    };

    if (!logs) {
      return {
        flashcards: { totalTimeFormatted: "0h 0m", avgPerHour: 0 },
        mcqs: { totalTimeFormatted: "0h 0m", avgPerHour: 0 },
      };
    }

    return {
      flashcards: calculateMetrics(logs.cardLogs),
      mcqs: calculateMetrics(logs.mcqLogs),
    };
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

  const reviewHistoryData = useMemo(() => {
    if (!logs) return [];
    const reviewLogs = [...logs.cardLogs, ...logs.mcqLogs];
    const today = startOfDay(new Date());
    const days = Array.from({ length: 30 }, (_, i) => subDays(today, i)).reverse();
    
    return days.map(day => {
      const count = reviewLogs.filter(log => isSameDay(new Date(log.review), day)).length;
      return {
        date: format(day, 'MMM d'),
        reviews: count,
      };
    });
  }, [logs]);

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
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Statistics</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Card>
            <CardHeader><CardTitle>Total Decks</CardTitle></CardHeader>
            <CardContent><p className="text-3xl sm:text-4xl font-bold">{collectionStats.totalDecks}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total Flashcards</CardTitle></CardHeader>
            <CardContent><p className="text-3xl sm:text-4xl font-bold">{collectionStats.totalFlashcards}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total Q-Banks</CardTitle></CardHeader>
            <CardContent><p className="text-3xl sm:text-4xl font-bold">{collectionStats.totalQBanks}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Total MCQs</CardTitle></CardHeader>
            <CardContent><p className="text-3xl sm:text-4xl font-bold">{collectionStats.totalMcqs}</p></CardContent>
          </Card>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold mt-8 mb-4">Learning Progress</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Card>
            <CardHeader><CardTitle>Reviews</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : <>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><TrendingUp className="h-4 w-4" />Today</span><span className="font-bold">{progressStats?.reviewsToday}</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" />Past 7 days</span><span className="font-bold">{progressStats?.reviewsPast7Days}</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" />Past 30 days</span><span className="font-bold">{progressStats?.reviewsPast30Days}</span></div>
              </>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Study Streak</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : <>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Flame className="h-4 w-4 text-orange-500" />Current Streak</span><span className="font-bold">{progressStats?.currentStreak} days</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Flame className="h-4 w-4" />Longest Streak</span><span className="font-bold">{progressStats?.longestStreak} days</span></div>
              </>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Due & Overdue</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : <>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4 text-green-500" />Due Today</span><span className="font-bold">{dueStats?.total.dueToday}</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><AlertTriangle className="h-4 w-4 text-red-500" />Overdue</span><span className="font-bold">{dueStats?.total.overdue}</span></div>
              </>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Avg. Interval Growth</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {isLoadingLogs ? <Loader2 className="h-6 w-6 animate-spin" /> : <>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><BookOpen className="h-4 w-4" />Flashcards</span><span className="font-bold">{intervalGrowthStats?.flashcards.toFixed(2)}x</span></div>
                <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><HelpCircle className="h-4 w-4" />MCQs</span><span className="font-bold">{intervalGrowthStats?.mcqs.toFixed(2)}x</span></div>
              </>}
            </CardContent>
          </Card>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold mt-8 mb-4">Performance Analytics</h2>
        <PerformanceAnalytics />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Deck Performance</CardTitle>
              <CardDescription>Accuracy per deck and sub-deck.</CardDescription>
            </CardHeader>
            <CardContent>
              <PerformanceGraph data={performanceGraphData.deckPerformance} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Question Bank Performance</CardTitle>
              <CardDescription>Accuracy per question bank and sub-bank.</CardDescription>
            </CardHeader>
            <CardContent>
              <PerformanceGraph data={performanceGraphData.qBankPerformance} />
            </CardContent>
          </Card>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold mt-8 mb-4">Forecast & Distribution</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-6">
          <Card className="lg:col-span-2">
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
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Predicted Retention (Flashcards)</CardTitle>
              <CardDescription>Based on FSRS model.</CardDescription>
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
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Predicted Retention (MCQs)</CardTitle>
              <CardDescription>Based on FSRS model.</CardDescription>
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
          </Card>

          {cardDifficultyDistribution && cardDifficultyDistribution.reviewedCount > 0 && (
            <Card>
                <CardHeader>
                    <CardTitle>Flashcard Difficulty</CardTitle>
                    <CardDescription>Difficulty distribution for reviewed flashcards.</CardDescription>
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
            </Card>
          )}

          {mcqDifficultyDistribution && mcqDifficultyDistribution.reviewedCount > 0 && (
            <Card>
                <CardHeader>
                    <CardTitle>MCQ Difficulty</CardTitle>
                    <CardDescription>Difficulty distribution for reviewed MCQs.</CardDescription>
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
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Flashcard Maturity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {renderPieChart(maturityData.flashcardStatusCounts)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>MCQ Maturity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {renderPieChart(maturityData.mcqStatusCounts)}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default StatisticsPage;