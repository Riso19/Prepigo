import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getExamLogFromDB } from '@/lib/idb';
import { ExamLog, ExamLogEntry } from '@/data/examLogs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Home, CheckCircle, XCircle, AlertCircle, Tag } from 'lucide-react';
import McqPlayer from '@/components/McqPlayer';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const ExamResultsPage = () => {
  const { logId } = useParams<{ logId: string }>();
  const [examLog, setExamLog] = useState<ExamLog | null>(null);

  useEffect(() => {
    if (logId) {
      getExamLogFromDB(logId).then(log => {
        if (log) setExamLog(log);
      });
    }
  }, [logId]);

  const tagAnalysis = useMemo(() => {
    if (!examLog) return [];
    const stats: Record<string, { correct: number; total: number }> = {};
    examLog.entries.forEach(entry => {
      entry.mcq.tags?.forEach(tag => {
        if (!stats[tag]) stats[tag] = { correct: 0, total: 0 };
        stats[tag].total++;
        if (entry.isCorrect) stats[tag].correct++;
      });
    });
    return Object.entries(stats)
      .map(([tag, data]) => ({
        tag,
        accuracy: (data.correct / data.total) * 100,
        count: data.total,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [examLog]);

  if (!examLog) {
    return <div className="flex items-center justify-center min-h-screen">Loading results...</div>;
  }

  const { settings, results, entries } = examLog;
  const totalMarks = settings.totalQuestions * settings.marksPerCorrect;
  const percentage = totalMarks > 0 ? (results.score / totalMarks) * 100 : 0;

  const pieData = [
    { name: 'Correct', value: results.correctCount, fill: '#22c55e' },
    { name: 'Incorrect', value: results.incorrectCount, fill: '#ef4444' },
    { name: 'Skipped', value: results.skippedCount, fill: '#6b7280' },
  ];

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

        <Card>
          <CardHeader><CardTitle>Weak Areas</CardTitle><CardDescription>Topics to focus on based on your performance.</CardDescription></CardHeader>
          <CardContent>
            {tagAnalysis.length > 0 ? (
              <ul className="space-y-2">
                {tagAnalysis.slice(0, 5).map(({ tag, accuracy, count }) => (
                  <li key={tag} className="flex items-center justify-between p-2 rounded-md bg-secondary">
                    <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-muted-foreground" /><span>{tag}</span></div>
                    <div className="text-right"><p className="font-bold">{accuracy.toFixed(1)}%</p><p className="text-xs text-muted-foreground">{count} questions</p></div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted-foreground">No tagged questions in this exam to analyze.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Review Answers</CardTitle><CardDescription>Go through each question to see your answers and explanations.</CardDescription></CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {entries.map((entry, index) => (
                <AccordionItem key={entry.mcq.id} value={entry.mcq.id}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-4">
                      {entry.isCorrect ? <CheckCircle className="h-5 w-5 text-green-500" /> : (entry.selectedOptionId ? <XCircle className="h-5 w-5 text-red-500" /> : <AlertCircle className="h-5 w-5 text-gray-500" />)}
                      <span>Question {index + 1}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4">
                    <McqPlayer mcq={entry.mcq} selectedOptionId={null} isSubmitted={false} onOptionSelect={() => {}} isExamMode examAnswer={{ selectedOptionId: entry.selectedOptionId, isCorrect: entry.isCorrect }} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExamResultsPage;