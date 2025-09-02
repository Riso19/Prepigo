import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getExamLogFromDB } from '@/lib/idb';
import { ExamLog } from '@/data/examLogs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Home, CheckCircle, XCircle, AlertCircle, Clock, RefreshCcw } from 'lucide-react';
import McqPlayer from '@/components/McqPlayer';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { PerformanceGraph } from '@/components/PerformanceGraph';
// removed unused cn import
import { useSettings } from '@/contexts/SettingsContext';
import { generateExamAIAnalysis, type ExamAIAnalysis } from '@/lib/ai-insights';
import { getExamAIAnalysis as dbGetExamAIAnalysis, saveExamAIAnalysis } from '@/lib/dexie-db';

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const ExamResultsPage = () => {
  const { logId } = useParams<{ logId: string }>();
  const [examLog, setExamLog] = useState<ExamLog | null>(null);
  const [reviewFilter, setReviewFilter] = useState<
    'all' | 'correct' | 'incorrect' | 'skipped' | 'marked'
  >('all');
  const { settings: appSettings } = useSettings();
  const [ai, setAi] = useState<{ analysis: ExamAIAnalysis; createdAt?: number } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (logId) {
      getExamLogFromDB(logId).then((log: unknown) => {
        if (log) setExamLog(log as ExamLog);
      });
    }
  }, [logId]);

  const loadOrGenerateAI = useCallback(async () => {
    if (!logId || !examLog) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const cached = await dbGetExamAIAnalysis(logId);
      if (cached?.data) {
        setAi({ analysis: cached.data as ExamAIAnalysis, createdAt: cached.createdAt });
        setAiLoading(false);
        return;
      }
      const analysis = await generateExamAIAnalysis(examLog, appSettings);
      await saveExamAIAnalysis(logId, analysis);
      setAi({ analysis, createdAt: Date.now() });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setAiError(msg || 'Failed to generate AI analysis');
    } finally {
      setAiLoading(false);
    }
  }, [examLog, logId, appSettings]);

  const regenerateAI = useCallback(async () => {
    if (!logId || !examLog) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const analysis = await generateExamAIAnalysis(examLog, appSettings);
      await saveExamAIAnalysis(logId, analysis);
      setAi({ analysis, createdAt: Date.now() });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setAiError(msg || 'Failed to regenerate AI analysis');
    } finally {
      setAiLoading(false);
    }
  }, [examLog, logId, appSettings]);

  useEffect(() => {
    if (examLog && logId) {
      loadOrGenerateAI();
    }
  }, [examLog, logId, loadOrGenerateAI]);

  const analysis = useMemo(() => {
    if (!examLog) return null;
    const { results, settings, entries } = examLog;
    if (!results || !settings) {
      return {
        time: { totalTaken: 0, totalLimit: 0, avgPerQuestion: 0 },
        tagPerformance: [],
      };
    }

    // Time Analysis
    const answeredCount = results.correctCount + results.incorrectCount;
    const avgTimePerQuestion = answeredCount > 0 ? results.timeTaken / answeredCount : 0;

    // Tag Analysis
    const stats: Record<string, { correct: number; total: number }> = {};
    const entriesArr = Array.isArray(entries) ? entries : ([] as ExamLog['entries']);
    entriesArr.forEach((entry) => {
      entry.mcq.tags?.forEach((tag: string) => {
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
    if (!examLog) return [] as ExamLog['entries'];
    const all = Array.isArray(examLog.entries) ? examLog.entries : ([] as ExamLog['entries']);
    switch (reviewFilter) {
      case 'correct':
        return all.filter((e) => e.isCorrect);
      case 'incorrect':
        return all.filter((e) => !e.isCorrect && e.selectedOptionId !== null);
      case 'skipped':
        return all.filter((e) => e.selectedOptionId === null);
      case 'marked':
        return all.filter((e) => e.status === 'marked');
      default:
        return all;
    }
  }, [examLog, reviewFilter]);

  // Build incorrect answers insights and a compact Q&A sample list
  const incorrectInsights = useMemo(() => {
    const entriesArr: ExamLog['entries'] = Array.isArray(examLog?.entries)
      ? (examLog?.entries ?? [])
      : [];
    const incorrect = entriesArr.filter((e) => !e.isCorrect && e.selectedOptionId !== null);
    if (incorrect.length === 0)
      return {
        keyPoints: [] as string[],
        sample: [] as { id: string; question: string; selected: string; correct: string }[],
      };

    const tagCounts: Record<string, number> = {};
    let negativeStemMisses = 0;
    let longStemMisses = 0;

    for (const e of incorrect) {
      const q: string = String(e.mcq.question ?? '').trim();
      if (q.length > 220) longStemMisses++;
      if (/\b(NOT|EXCEPT|LEAST|FALSE)\b/i.test(q)) negativeStemMisses++;
      const tags: string[] = Array.isArray(e.mcq.tags) ? e.mcq.tags : [];
      for (const t of tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
    }

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t, c]) => `${t} (${c})`);

    const keyPoints: string[] = [];
    if (topTags.length > 0) keyPoints.push(`Most misses clustered in: ${topTags.join(', ')}`);
    if (negativeStemMisses >= 2)
      keyPoints.push(
        'Negative wording (NOT/EXCEPT/LEAST/FALSE) frequently led to errors — highlight negatives before answering.',
      );
    if (longStemMisses >= 2)
      keyPoints.push(
        'Long multi-step question stems caused mistakes — practice summarizing stems first.',
      );
    if (keyPoints.length === 0)
      keyPoints.push('No strong error clusters detected. Review explanations for incorrect items.');

    // Build a concise Q&A sample list (up to 8)
    const sample = incorrect.slice(0, 8).map((e) => {
      const question = String(e.mcq.question ?? '')
        .replace(/\s+/g, ' ')
        .slice(0, 140);
      const selected = e.mcq.options?.find((o) => o.id === e.selectedOptionId)?.text ?? '';
      const correct = e.mcq.options?.find((o) => o.isCorrect)?.text ?? '';
      return {
        id: e.mcq.id ?? Math.random().toString(36).slice(2),
        question,
        selected: String(selected).slice(0, 160),
        correct: String(correct).slice(0, 160),
      };
    });

    return { keyPoints, sample };
  }, [examLog]);

  if (!examLog) {
    return <div className="flex items-center justify-center min-h-screen">Loading results...</div>;
  }

  const entriesSafe = examLog.entries ?? [];
  const resultsSafe = examLog.results;
  const settingsSafe = examLog.settings;
  const totalMarks = settingsSafe.totalQuestions * settingsSafe.marksPerCorrect;
  const percentage = totalMarks > 0 ? (resultsSafe.score / totalMarks) * 100 : 0;

  const pieData = [
    { name: 'Correct', value: resultsSafe.correctCount, fill: '#22c55e' },
    { name: 'Incorrect', value: resultsSafe.incorrectCount, fill: '#ef4444' },
    { name: 'Skipped', value: resultsSafe.skippedCount, fill: '#6b7280' },
  ];

  const filterButtons = [
    { label: 'All', value: 'all', count: entriesSafe.length },
    { label: 'Correct', value: 'correct', count: resultsSafe.correctCount },
    { label: 'Incorrect', value: 'incorrect', count: resultsSafe.incorrectCount },
    { label: 'Skipped', value: 'skipped', count: resultsSafe.skippedCount },
    {
      label: 'Marked',
      value: 'marked',
      count: entriesSafe.filter((e) => e.status === 'marked').length,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-secondary/50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-3xl">Exam Results: {examLog.name}</CardTitle>
                <CardDescription>
                  {(() => {
                    const d = new Date(examLog.date);
                    return !Number.isNaN(d.getTime())
                      ? `Completed on ${format(d, 'PPP p')}`
                      : 'Completed on —';
                  })()}
                </CardDescription>
              </div>
              <Button asChild variant="outline">
                <Link to="/exam-history">
                  <Home className="mr-2 h-4 w-4" /> Back to History
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-5xl font-bold">
                  {resultsSafe.score.toFixed(2)} / {totalMarks}
                </p>
                <p className="text-2xl font-semibold text-primary">{percentage.toFixed(1)}%</p>
              </div>
              <Progress value={percentage} />
              <div className="grid grid-cols-3 text-center text-sm">
                <div>
                  <p className="font-bold text-green-600">{resultsSafe.correctCount}</p>
                  <p className="text-muted-foreground">Correct</p>
                </div>
                <div>
                  <p className="font-bold text-red-600">{resultsSafe.incorrectCount}</p>
                  <p className="text-muted-foreground">Incorrect</p>
                </div>
                <div>
                  <p className="font-bold">{resultsSafe.skippedCount}</p>
                  <p className="text-muted-foreground">Skipped</p>
                </div>
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    label
                  >
                    {pieData.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>AI Analysis</CardTitle>
                <CardDescription>
                  {ai?.createdAt
                    ? `Generated ${format(new Date(ai.createdAt), 'PPP p')}`
                    : aiLoading
                      ? 'Generating…'
                      : aiError
                        ? 'Error'
                        : '—'}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={regenerateAI} disabled={aiLoading}>
                <RefreshCcw className="mr-2 h-4 w-4" /> {aiLoading ? 'Generating' : 'Regenerate'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiError && (
              <div className="text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {aiError}
              </div>
            )}
            {aiLoading && !ai && (
              <p className="text-sm text-muted-foreground">Analyzing your exam…</p>
            )}
            {ai?.analysis && (
              <div className="space-y-4">
                <p className="text-sm leading-6">{ai.analysis.summary}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Strengths</h4>
                    {(ai.analysis.strengths?.length ?? 0) > 0 ? (
                      <ul className="list-disc pl-5 text-sm space-y-1">
                        {(ai.analysis.strengths ?? []).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No strengths detected yet.</p>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Weaknesses</h4>
                    {(ai.analysis.weaknesses?.length ?? 0) > 0 ? (
                      <ul className="list-disc pl-5 text-sm space-y-1">
                        {(ai.analysis.weaknesses ?? []).map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No weaknesses detected.</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Pacing</h4>
                    <p className="text-sm">{ai.analysis.timeAnalysis?.pacingComment ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      Avg: {(ai.analysis.timeAnalysis?.avgSecondsPerQuestion ?? 0).toFixed(1)}s /
                      question
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">Topic Breakdown</h4>
                    {(ai.analysis.topicBreakdown?.length ?? 0) > 0 ? (
                      <ul className="text-sm space-y-1">
                        {(ai.analysis.topicBreakdown ?? []).slice(0, 8).map((t) => (
                          <li key={t.topic} className="flex justify-between">
                            <span className="truncate mr-2">{t.topic}</span>
                            <span className="text-muted-foreground">
                              {t.accuracy.toFixed(1)}% • {t.attempts} q
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No topic data.</p>
                    )}
                  </div>
                </div>
                {(ai.analysis.incorrectPatterns?.length || 0) > 0 ||
                (ai.analysis.incorrectTopicFocus?.length || 0) > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold">Incorrect Question Patterns</h4>
                      {ai.analysis.incorrectPatterns && ai.analysis.incorrectPatterns.length > 0 ? (
                        <ul className="list-disc pl-5 text-sm space-y-1">
                          {ai.analysis.incorrectPatterns.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No recurring error patterns detected.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">Top Missed Topics</h4>
                      {ai.analysis.incorrectTopicFocus &&
                      ai.analysis.incorrectTopicFocus.length > 0 ? (
                        <ul className="text-sm space-y-1">
                          {ai.analysis.incorrectTopicFocus.slice(0, 8).map((t) => (
                            <li key={t.topic} className="flex justify-between">
                              <span className="truncate mr-2">{t.topic}</span>
                              <span className="text-muted-foreground">
                                {t.incorrectCount} misses
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No concentrated misses by topic.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Incorrect Answers — Key Insights</h4>
                    {(() => {
                      const insights = ai?.analysis?.incorrectAnswerInsights;
                      const list =
                        Array.isArray(insights) && insights.length > 0
                          ? insights
                          : incorrectInsights.keyPoints;
                      return list.length > 0 ? (
                        <ul className="list-disc pl-5 text-sm space-y-1">
                          {list.map((k, i) => (
                            <li key={i}>{k}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">No notable patterns found.</p>
                      );
                    })()}
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">Incorrect Q&A (sample)</h4>
                    {incorrectInsights.sample.length > 0 ? (
                      <ul className="text-sm space-y-2">
                        {incorrectInsights.sample.map((it) => (
                          <li key={it.id} className="border rounded-md p-2 bg-muted/30">
                            <p className="font-medium mb-1 truncate" title={it.question}>
                              {it.question}
                            </p>
                            <p className="text-xs">
                              <span className="text-muted-foreground">Selected:</span>{' '}
                              {it.selected || '—'}
                            </p>
                            <p className="text-xs">
                              <span className="text-muted-foreground">Correct:</span>{' '}
                              {it.correct || '—'}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No incorrect answers to summarize.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Suggestions</h4>
                  {(ai.analysis.suggestions?.length ?? 0) > 0 ? (
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {(ai.analysis.suggestions ?? []).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No suggestions available.</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Time Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Time Taken
                </span>
                <span className="font-bold">{formatTime(analysis?.time.totalTaken || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Time Limit
                </span>
                <span className="font-bold">{formatTime(analysis?.time.totalLimit || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Avg. Time / Question
                </span>
                <span className="font-bold">
                  {(analysis?.time.avgPerQuestion || 0).toFixed(1)}s
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Topic Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {analysis && analysis.tagPerformance.length > 0 ? (
                <PerformanceGraph data={analysis.tagPerformance} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No tagged questions in this exam to analyze.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Review Answers</CardTitle>
            <CardDescription>
              Go through each question to see your answers and explanations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {filterButtons.map((btn) => (
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
              {filteredEntries.map((entry, index: number) => (
                <AccordionItem key={entry.mcq.id} value={`${entry.mcq.id}-${index}`}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-4">
                      {entry.isCorrect ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : entry.selectedOptionId ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-gray-500" />
                      )}
                      <span>
                        Question{' '}
                        {(() => {
                          const oi = entriesSafe.findIndex((e) => e.mcq.id === entry.mcq.id);
                          return oi >= 0 ? oi + 1 : index + 1;
                        })()}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4">
                    <McqPlayer
                      mcq={entry.mcq}
                      selectedOptionId={null}
                      isSubmitted={false}
                      onOptionSelect={() => {}}
                      isExamMode
                      examAnswer={{
                        selectedOptionId: entry.selectedOptionId,
                        isCorrect: entry.isCorrect,
                      }}
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            {filteredEntries.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No questions match the current filter.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExamResultsPage;
