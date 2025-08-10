import { useMemo } from 'react';
import { useDecks } from '@/contexts/DecksContext';
import { useQuestionBanks } from '@/contexts/QuestionBankContext';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts';
import { getAllFlashcardsFromDeck } from '@/lib/card-utils';
import { getAllMcqsFromBank } from '@/lib/question-bank-utils';
import { getItemStatus, ItemStatus } from '@/lib/srs-utils';
import { useSettings } from '@/contexts/SettingsContext';
import { useQuery } from '@tanstack/react-query';
import { getAllReviewLogsFromDB, getAllMcqReviewLogsFromDB } from '@/lib/idb';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const StatisticsPage = () => {
  const { decks } = useDecks();
  const { questionBanks } = useQuestionBanks();
  const { settings } = useSettings();
  const isMobile = useIsMobile();

  // --- Data Fetching for Review Logs ---
  const { data: reviewLogs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['reviewLogs'],
    queryFn: async () => {
      const cardLogs = await getAllReviewLogsFromDB();
      const mcqLogs = await getAllMcqReviewLogsFromDB();
      return [...cardLogs, ...mcqLogs];
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
    if (!reviewLogs) return [];
    const today = startOfDay(new Date());
    const days = Array.from({ length: 30 }, (_, i) => subDays(today, i)).reverse();
    
    return days.map(day => {
      const count = reviewLogs.filter(log => isSameDay(new Date(log.review), day)).length;
      return {
        date: format(day, 'MMM d'),
        reviews: count,
      };
    });
  }, [reviewLogs]);

  // --- Charting Constants ---
  const PIE_COLORS: Record<ItemStatus, string> = {
    New: '#3b82f6', // blue-500
    Learning: '#f97316', // orange-500
    Relearning: '#eab308', // yellow-500
    Young: '#84cc16', // lime-500
    Mature: '#14b8a6', // teal-500
    Suspended: '#6b7280', // gray-500
  };

  const renderPieChart = (data: Record<ItemStatus, number>, title: string) => {
    const chartData = Object.entries(data)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));

    if (chartData.length === 0) {
      return <div className="flex items-center justify-center h-full text-muted-foreground">No data to display</div>;
    }

    return (
      <>
        <CardTitle>{title}</CardTitle>
        <ResponsiveContainer width="100%" height={isMobile ? 200 : 250}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={isMobile ? 60 : 80}>
              {chartData.map((entry) => (
                <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[entry.name as ItemStatus]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-6">Statistics</h1>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Review Activity</CardTitle>
              <CardDescription>Reviews completed in the last 30 days.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                  <BarChart data={reviewHistoryData}>
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
              {renderPieChart(maturityData.flashcardStatusCounts, "Flashcard Maturity")}
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              {renderPieChart(maturityData.mcqStatusCounts, "MCQ Maturity")}
            </CardHeader>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default StatisticsPage;