import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getExamLogFromDB } from '@/lib/idb';
import { ExamLog } from '@/data/examLogs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Home, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import McqPlayer from '@/components/McqPlayer';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { PerformanceGraph } from '@/components/PerformanceGraph';
// removed unused cn import

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const ExamResultsPage = () => {
  const { logId } = useParams<{ logId: string }>();
  const [examLog, setExamLog] = useState<ExamLog | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'correct' | 'incorrect' | 'skipped' | 'marked'>('all');

  useEffect(() => {
    if (logId) {
      getExamLogFromDB(logId).then((log: unknown) => {
        if (log) setExamLog(log as ExamLog);
      });
    }
  }, [logId]);

  const analysis = useMemo(() => {
    if (!examLog) return null;

    const { results, settings, entries } = examLog;

    // Time Analysis
    const answeredCount = results.correctCount + results.incorrectCount;
    const avgTimePerQuestion = answeredCount > 0 ? results.timeTaken / answeredCount : 0;

    // Tag Analysis
    const stats: Record<string, { correct: number; total: number }> = {};
    entries.forEach(entry => {
      entry.mcq.tags?.forEach(tag => {
        if (!stats[tag]) stats[tag] = { correct: 0, total: 0 };
        stats[tag].total++;
        if (entry.isCorrect) stats[tag].correct++;
      });
    });
    const tagAnalysis = Object.entries(stats)
      .map(([tag, data]) => ({
        name: tag,
        accuracy: (data.correct / data.total) * 100,
        count: data.total,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);

    return {
      time: {
        totalTaken: results.timeTaken,
        totalLimit: settings.timeLimit * 60,
        avgPerQuestion: avgTimePerQuestion,
      },
      tagPerformance: tagAnalysis,
    };
  }, [examLog]);

  const filteredEntries = useMemo(() => {
    if (!examLog) return [];
    switch (reviewFilter) {
      case 'correct':
        return examLog.entries.filter(e => e.isCorrect);
      case 'incorrect':
        return examLog.entries.filter(e => !e.isCorrect && e.selectedOptionId !== null);
      case 'skipped':
        return examLog.entries.filter(e => e.selectedOptionId === null);
      case 'marked':
        return examLog.entries.filter(e => e.status === 'marked');
      default:
        return examLog.entries;
    }
  }, [examLog, reviewFilter]);

  if (!examLog) {
    return <div className="flex items-center justify-center min-h-screen">Loading results...</div>;
  }

  const { settings, results } = examLog;
  const totalMarks = settings.totalQuestions * settings.marksPerCorrect;
  const percentage = totalMarks > 0 ? (results.score / totalMarks) * 100 : 0;

  const pieData = [
    { name: 'Correct', value: results.correctCount, fill: '#22c55e' },
    { name: 'Incorrect', value: results.incorrectCount, fill: '#ef4444' },
    { name: 'Skipped', value: results.skippedCount, fill: '#6b7280' },
  ];

  const filterButtons = [
    { label: 'All', value: 'all', count: examLog.entries.length },
    { label: 'Correct', value: 'correct', count: results.correctCount },
    { label: 'Incorrect', value: 'incorrect', count: results.incorrectCount },
    { label: 'Skipped', value: 'skipped', count: results.skippedCount },
    { label: 'Marked', value: 'marked', count: examLog.entries.filter(e => e.status === 'marked').length },
  ] as const;

  return (
    <div className="min-h-screen bg-secondary/50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-3xl">Exam Results: {examLog.name}</CardTitle>
                <CardDescription>Completed on {format(new Date(examLog.date), 'PPP p')}</CardDescription>
              </div>
              <Button asChild variant="outline"><Link to="/exam-history"><Home className="mr-2 h-4 w-4" /> Back to History</Link></Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-5xl font-bold">{results.score.toFixed(2)} / {totalMarks}</p>
                <p className="text-2xl font-semibold text-primary">{percentage.toFixed(1)}%</p>
              </div>
              <Progress value={percentage} />
              <div className="grid grid-cols-3 text-center text-sm">
                <div><p className="font-bold text-green-600">{results.correctCount}</p><p className="text-muted-foreground">Correct</p></div>
                <div><p className="font-bold text-red-600">{results.incorrectCount}</p><p className="text-muted-foreground">Incorrect</p></div>
                <div><p className="font-bold">{results.skippedCount}</p><p className="text-muted-foreground">Skipped</p></div>
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                    {pieData.map((entry) => <Cell key={`cell-${entry.name}`} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Time Analysis</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" /> Time Taken</span>
                <span className="font-bold">{formatTime(analysis?.time.totalTaken || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" /> Time Limit</span>
                <span className="font-bold">{formatTime(analysis?.time.totalLimit || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" /> Avg. Time / Question</span>
                <span className="font-bold">{(analysis?.time.avgPerQuestion || 0).toFixed(1)}s</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Topic Performance</CardTitle></CardHeader>
            <CardContent>
              {analysis && analysis.tagPerformance.length > 0 ? (
                <PerformanceGraph data={analysis.tagPerformance} />
              ) : <p className="text-muted-foreground text-sm">No tagged questions in this exam to analyze.</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Review Answers</CardTitle>
            <CardDescription>Go through each question to see your answers and explanations.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {filterButtons.map(btn => (
                <Button
                  key={btn.value}
                  variant={reviewFilter === btn.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setReviewFilter(btn.value)}
                >
                  {btn.label} ({btn.count})
                </Button>
              ))}
            </div>
            <Accordion type="single" collapsible className="w-full">
              {filteredEntries.map((entry, index) => (
                <AccordionItem key={entry.mcq.id} value={`${entry.mcq.id}-${index}`}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-4">
                      {entry.isCorrect ? <CheckCircle className="h-5 w-5 text-green-500" /> : (entry.selectedOptionId ? <XCircle className="h-5 w-5 text-red-500" /> : <AlertCircle className="h-5 w-5 text-gray-500" />)}
                      <span>Question {examLog.entries.findIndex(e => e.mcq.id === entry.mcq.id) + 1}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4">
                    <McqPlayer mcq={entry.mcq} selectedOptionId={null} isSubmitted={false} onOptionSelect={() => {}} isExamMode examAnswer={{ selectedOptionId: entry.selectedOptionId, isCorrect: entry.isCorrect }} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            {filteredEntries.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No questions match the current filter.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExamResultsPage;