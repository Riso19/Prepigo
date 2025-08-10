import { useMemo } from 'react';
import { useDecks } from '@/contexts/DecksContext';
import { useQuestionBanks } from '@/contexts/QuestionBankContext';
import { useQuery } from '@tanstack/react-query';
import { getAllReviewLogsFromDB, getAllMcqReviewLogsFromDB, McqReviewLog } from '@/lib/idb';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Target, Repeat, Clock, AlertTriangle, Tag } from 'lucide-react';
import { getAllFlashcardsFromDeck } from '@/lib/card-utils';
import { getAllMcqsFromBank } from '@/lib/question-bank-utils';
import { FlashcardData, ReviewLog } from '@/data/decks';
import { McqData } from '@/data/questionBanks';
import { Rating } from 'ts-fsrs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { TagHeatmap } from './TagHeatmap';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

const LEECH_THRESHOLD_FSRS = 4;

const calculateAnalytics = (
  items: (FlashcardData | McqData)[],
  logs: (ReviewLog | McqReviewLog)[]
) => {
  if (logs.length === 0) {
    return null;
  }

  const itemMap = new Map(items.map(item => [item.id, item]));

  // Overall Accuracy & Avg Recall Time
  let correctReviews = 0;
  let totalDuration = 0;
  logs.forEach(log => {
    if (log.rating > Rating.Again) {
      correctReviews++;
      totalDuration += log.duration || 0;
    }
  });
  const overallAccuracy = (correctReviews / logs.length) * 100;
  const avgRecallTime = correctReviews > 0 ? (totalDuration / correctReviews) / 1000 : 0;

  // First-Pass Accuracy
  const firstReviews = new Map<string, ReviewLog | McqReviewLog>();
  logs.forEach(log => {
    const id = 'cardId' in log ? log.cardId : (log as McqReviewLog).mcqId;
    if (!firstReviews.has(id) || new Date(log.review) < new Date(firstReviews.get(id)!.review)) {
      firstReviews.set(id, log);
    }
  });
  let firstPassCorrect = 0;
  firstReviews.forEach(log => {
    if (log.rating > Rating.Again) {
      firstPassCorrect++;
    }
  });
  const firstPassAccuracy = firstReviews.size > 0 ? (firstPassCorrect / firstReviews.size) * 100 : 0;

  // Leech Count
  const leechCount = items.filter(item => {
    if (item.srs?.fsrs?.lapses && item.srs.fsrs.lapses >= LEECH_THRESHOLD_FSRS) return true;
    if (item.srs?.fsrs6?.lapses && item.srs.fsrs6.lapses >= LEECH_THRESHOLD_FSRS) return true;
    if (item.tags?.includes('leech')) return true;
    return false;
  }).length;

  // Accuracy per Tag
  const tagStats: Record<string, { correct: number; total: number }> = {};
  logs.forEach(log => {
    const id = 'cardId' in log ? log.cardId : (log as McqReviewLog).mcqId;
    const item = itemMap.get(id);
    if (item?.tags) {
      item.tags.forEach(tag => {
        if (!tagStats[tag]) tagStats[tag] = { correct: 0, total: 0 };
        tagStats[tag].total++;
        if (log.rating > Rating.Again) tagStats[tag].correct++;
      });
    }
  });

  const allTagAnalytics = Object.entries(tagStats)
    .map(([tag, stats]) => ({
      tag,
      accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
      reviews: stats.total,
    }))
    .filter(t => t.reviews >= 1)
    .sort((a, b) => a.accuracy - b.accuracy);

  const weakestTags = allTagAnalytics
    .filter(t => t.reviews >= 5)
    .slice(0, 5);

  return {
    overallAccuracy,
    avgRecallTime,
    firstPassAccuracy,
    leechCount,
    weakestTags,
    allTagAnalytics,
  };
};

export const PerformanceAnalytics = () => {
  const { decks } = useDecks();
  const { questionBanks } = useQuestionBanks();
  const { data: logs, isLoading } = useQuery({
    queryKey: ['allReviewLogs'],
    queryFn: async () => {
      const cardLogs = await getAllReviewLogsFromDB();
      const mcqLogs = await getAllMcqReviewLogsFromDB();
      return { cardLogs, mcqLogs };
    }
  });

  const { flashcardAnalytics, mcqAnalytics } = useMemo(() => {
    if (!logs) return { flashcardAnalytics: null, mcqAnalytics: null };
    const allFlashcards = decks.flatMap(getAllFlashcardsFromDeck);
    const allMcqs = questionBanks.flatMap(getAllMcqsFromBank);
    
    return {
      flashcardAnalytics: calculateAnalytics(allFlashcards, logs.cardLogs),
      mcqAnalytics: calculateAnalytics(allMcqs, logs.mcqLogs),
    };
  }, [logs, decks, questionBanks]);

  const renderAnalyticsCard = (title: string, data: ReturnType<typeof calculateAnalytics>) => {
    if (!data) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>No review data available yet.</CardDescription>
          </CardHeader>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Key metrics for your {title.toLowerCase()} performance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2"><Target className="h-4 w-4 text-green-500" /><span className="text-muted-foreground">Accuracy (Retention)</span><span className="font-bold ml-auto">{data.overallAccuracy.toFixed(1)}%</span></div>
              </TooltipTrigger>
              <TooltipContent><p>The percentage of correct reviews (Hard, Good, or Easy).</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2"><Repeat className="h-4 w-4 text-blue-500" /><span className="text-muted-foreground">First-Pass Accuracy</span><span className="font-bold ml-auto">{data.firstPassAccuracy.toFixed(1)}%</span></div>
              </TooltipTrigger>
              <TooltipContent><p>Your accuracy on the very first time you review an item.</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-purple-500" /><span className="text-muted-foreground">Avg. Recall Time</span><span className="font-bold ml-auto">{data.avgRecallTime.toFixed(2)}s</span></div>
              </TooltipTrigger>
              <TooltipContent><p>The average time taken for correct reviews.</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /><span className="text-muted-foreground">Leech Count</span><span className="font-bold ml-auto">{data.leechCount}</span></div>
              </TooltipTrigger>
              <TooltipContent><p>The number of items you have failed multiple times.</p></TooltipContent>
            </Tooltip>
          </div>
          
          <Accordion type="single" collapsible className="w-full pt-4 border-t">
            <AccordionItem value="heatmap">
              <AccordionTrigger className="text-base font-semibold">Weakest Tags & Heatmap</AccordionTrigger>
              <AccordionContent className="pt-2 space-y-4">
                {data.weakestTags.length > 0 ? (
                  <div className="space-y-2 text-sm">
                    {data.weakestTags.map(t => (
                      <div key={t.tag} className="flex items-center justify-between">
                        <span className="font-medium">{t.tag}</span>
                        <span className="text-muted-foreground">{t.accuracy.toFixed(1)}% accuracy ({t.reviews} reviews)</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No tags with enough reviews to identify weak spots yet.</p>}
                <TagHeatmap tags={data.allTagAnalytics} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
      {renderAnalyticsCard("Flashcard Analytics", flashcardAnalytics)}
      {renderAnalyticsCard("MCQ Analytics", mcqAnalytics)}
    </div>
  );
};