import { FlashcardData, DeckData } from '@/data/decks';
import { McqData, QuestionBankData } from '@/data/questionBanks';
import { SrsSettings } from '@/contexts/SettingsContext';
import {
  calculateDueStats,
  calculateAccuracy,
  calculateAverageRetention,
  calculateAtRiskItems,
  calculateDifficultyWeightedMastery,
  calculateTopicForgettingRate,
} from './analytics-utils';
import { getReviewLogsForCard, getReviewLogsForMcq } from './idb';

type McqReviewLog = {
  mcqId: string;
  rating: number;
  state: number;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  review: string;
  last_elapsed_days: number;
  duration?: number;
  cardId?: string;
};
import { ReviewLog } from '@/data/decks';
import type { ExamLog } from '@/data/examLogs';
import { subDays } from 'date-fns';

export interface AIInsight {
  type: 'recommendation' | 'performance' | 'optimization' | 'goal' | 'warning' | 'achievement';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  actionable?: boolean;
  data?: Record<string, unknown>;
}

export interface LearningPathStep {
  topic: string;
  reason: string;
  suggestedDurationMins?: number;
  interleaveWith?: string[];
}

export interface WeaknessDiagnostics {
  subtlePatterns?: string[]; // patterns in incorrect answers
  misconceptions?: string[]; // detected misconceptions
  predictedAtRiskTopics?: string[]; // likely to be forgotten next
  falsePositivesNote?: string; // about guessed-correct behavior
}

export interface StudyRecommendation {
  studyRecommendation: string;
  performanceInsight: string;
  optimizationTip: string;
  weeklyGoal: string;
  progressToGoal: number;
  insights: AIInsight[];
  // New optional fields for richer AI output (backwards compatible)
  learningPath?: LearningPathStep[];
  weaknessDiagnostics?: WeaknessDiagnostics;
  // Optional metadata for internal UI hints; backwards compatible
  meta?: {
    source: 'gemini' | 'local';
    generatedAt?: number;
  };
}

// ===== Exam-level AI Analysis =====
export interface ExamAIAnalysis {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  timeAnalysis: {
    pacingComment: string;
    avgSecondsPerQuestion: number;
  };
  topicBreakdown: Array<{ topic: string; accuracy: number; attempts: number }>;
  suggestions: string[];
  // New optional fields (backward compatible)
  incorrectPatterns?: string[]; // detected patterns from incorrect questions
  incorrectTopicFocus?: Array<{ topic: string; incorrectCount: number }>; // top tags where user missed most
  incorrectAnswerInsights?: string[]; // key points about incorrect answers patterns (Gemini-generated when available)
  meta?: { source: 'gemini' | 'local'; generatedAt?: number };
}

const buildExamSummary = (examLog: ExamLog) => {
  const { results, entries } = examLog;
  const answered = results.correctCount + results.incorrectCount;
  const avgSecondsPerQ = answered > 0 ? results.timeTaken / answered : 0;
  // Topic stats
  const tagStats: Record<string, { correct: number; total: number }> = {};
  for (const e of entries) {
    const tags = e.mcq.tags ?? [];
    for (const t of tags) {
      tagStats[t] = tagStats[t] || { correct: 0, total: 0 };
      tagStats[t].total += 1;
      if (e.isCorrect) tagStats[t].correct += 1;
    }
  }
  const topics = Object.entries(tagStats)
    .map(([topic, s]) => ({ topic, accuracy: (s.correct / s.total) * 100, attempts: s.total }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 12);
  return { avgSecondsPerQ, topics };
};

async function generateExamAIAnalysisWithService(
  examLog: ExamLog,
  apiKey: string,
): Promise<ExamAIAnalysis> {
  const base = buildExamSummary(examLog);
  const systemInstruction = `You are a medical exam tutor. Analyze exam results and provide focused, actionable feedback.
Respond strictly in JSON with keys: summary (string), strengths (string[]), weaknesses (string[]), timeAnalysis ({pacingComment, avgSecondsPerQuestion}), topicBreakdown ([{topic, accuracy, attempts}]), suggestions (string[]), incorrectPatterns (string[]), incorrectTopicFocus ([{topic, incorrectCount}]), incorrectAnswerInsights (string[]).`;
  const userPrompt = `Exam summary JSON:\n${JSON.stringify({
    score: examLog.results.score,
    total: examLog.settings.totalQuestions * examLog.settings.marksPerCorrect,
    correct: examLog.results.correctCount,
    incorrect: examLog.results.incorrectCount,
    skipped: examLog.results.skippedCount,
    avgSecondsPerQuestion: Number(base.avgSecondsPerQ.toFixed(1)),
    topicBreakdown: base.topics.map((t) => ({
      topic: t.topic,
      accuracy: Number(t.accuracy.toFixed(1)),
      attempts: t.attempts,
    })),
    incorrectTopicFocus: (() => {
      const counts: Record<string, number> = {};
      for (const e of examLog.entries) {
        if (!e.isCorrect && e.selectedOptionId !== null) {
          for (const tag of e.mcq.tags ?? []) counts[tag] = (counts[tag] || 0) + 1;
        }
      }
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([topic, incorrectCount]) => ({ topic, incorrectCount }));
    })(),
    incorrectSamples: (() => {
      return examLog.entries
        .filter((e) => !e.isCorrect && e.selectedOptionId !== null)
        .slice(0, 12)
        .map((e) => ({
          question: String(e.mcq.question ?? '').slice(0, 200),
          selected: String(e.mcq.options.find((o) => o.id === e.selectedOptionId)?.text ?? ''),
          correct: String(e.mcq.options.find((o) => o.isCorrect)?.text ?? ''),
          tags: (e.mcq.tags ?? []).slice(0, 5),
        }));
    })(),
  })}`;

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent' +
    `?key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: systemInstruction }] },
        { role: 'user', parts: [{ text: userPrompt }] },
      ],
      generationConfig: { response_mime_type: 'application/json' },
    }),
  });
  if (!resp.ok) throw new Error(`Gemini error: ${resp.status}`);
  const data = (await resp.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };
  const firstText: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  let parsed: Record<string, unknown> = {};
  try {
    parsed = firstText ? JSON.parse(firstText) : {};
  } catch {
    throw new Error('Non-JSON response from Gemini');
  }
  const coerceArr = (a: unknown): string[] => (Array.isArray(a) ? a.map(String).slice(0, 8) : []);
  interface TopicBreakdownItem {
    topic?: unknown;
    accuracy?: unknown;
    attempts?: unknown;
  }

  const topicArr = Array.isArray(parsed?.topicBreakdown)
    ? (parsed.topicBreakdown as TopicBreakdownItem[]).slice(0, 12).map((t) => ({
        topic: String(t?.topic ?? ''),
        accuracy:
          typeof t?.accuracy === 'number'
            ? Math.max(0, Math.min(100, Number(t.accuracy.toFixed(1))))
            : 0,
        attempts: typeof t?.attempts === 'number' ? Math.max(1, Math.round(t.attempts)) : 1,
      }))
    : base.topics;
  const incorrectPatterns = coerceArr(parsed?.incorrectPatterns);
  const incorrectAnswerInsights = coerceArr(parsed?.incorrectAnswerInsights);
  interface IncorrectTopicItem {
    topic?: unknown;
    incorrectCount?: unknown;
  }

  const incorrectTopicFocus = Array.isArray(parsed?.incorrectTopicFocus)
    ? (parsed.incorrectTopicFocus as IncorrectTopicItem[]).slice(0, 8).map((t) => ({
        topic: String(t?.topic ?? ''),
        incorrectCount:
          typeof t?.incorrectCount === 'number' ? Math.max(1, Math.round(t.incorrectCount)) : 1,
      }))
    : undefined;
  const parsedTimeAnalysis = parsed?.timeAnalysis as
    | { pacingComment?: unknown; avgSecondsPerQuestion?: unknown }
    | undefined;

  return {
    summary: String(parsed?.summary ?? 'Exam analysis generated.'),
    strengths: coerceArr(parsed?.strengths as unknown),
    weaknesses: coerceArr(parsed?.weaknesses as unknown),
    timeAnalysis: {
      pacingComment: String(parsedTimeAnalysis?.pacingComment ?? ''),
      avgSecondsPerQuestion:
        typeof parsedTimeAnalysis?.avgSecondsPerQuestion === 'number'
          ? parsedTimeAnalysis.avgSecondsPerQuestion
          : Number(base.avgSecondsPerQ.toFixed(1)),
    },
    topicBreakdown: topicArr,
    suggestions: coerceArr(parsed?.suggestions as unknown),
    incorrectPatterns,
    incorrectTopicFocus,
    incorrectAnswerInsights,
    meta: { source: 'gemini' as const, generatedAt: Date.now() },
  };
}

export async function generateExamAIAnalysis(
  examLog: ExamLog,
  settings: SrsSettings,
): Promise<ExamAIAnalysis> {
  const apiKey = settings?.geminiApiKey as string | undefined;
  if (apiKey && apiKey.trim()) {
    try {
      return await generateExamAIAnalysisWithService(examLog, apiKey);
    } catch (e) {
      console.warn('[ExamAnalysis] Gemini failed, falling back to local analytics:', e);
    }
  }
  // Local analytics fallback
  const base = buildExamSummary(examLog);
  const pct =
    examLog.settings.totalQuestions > 0
      ? (examLog.results.correctCount / examLog.settings.totalQuestions) * 100
      : 0;
  const summary = `You scored ${examLog.results.correctCount}/${examLog.settings.totalQuestions} (${pct.toFixed(1)}%). Focus on your weakest topics first and watch pacing.`;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  // Heuristics: top 2 topics with highest accuracy and at least 3 attempts -> strengths; bottom 3 -> weaknesses
  const sorted = [...base.topics].sort((a, b) => b.accuracy - a.accuracy);
  strengths.push(
    ...sorted
      .filter((t) => t.attempts >= 3)
      .slice(0, 2)
      .map((t) => `${t.topic}: ${t.accuracy.toFixed(1)}% accuracy`),
  );
  weaknesses.push(
    ...[...base.topics].slice(0, 3).map((t) => `${t.topic}: ${t.accuracy.toFixed(1)}% accuracy`),
  );
  const pacingComment =
    base.avgSecondsPerQ > 90
      ? 'You spent a lot of time per question. Consider flagging and moving on, then returning.'
      : base.avgSecondsPerQ < 30
        ? 'Fast pacing may reduce accuracy. Slow down on tougher questions.'
        : 'Pacing looks reasonable.';
  const suggestions = [
    'Review weakest topics with targeted practice sets (10-15 questions).',
    'Revisit explanations for incorrect answers to address misconceptions.',
    'Simulate exam conditions and practice time management strategies.',
  ];

  // Incorrect question pattern heuristics
  const incorrectEntries = examLog.entries.filter(
    (e) => !e.isCorrect && e.selectedOptionId !== null,
  );
  const tagMissCounts: Record<string, number> = {};
  const patterns: string[] = [];
  let longStemMisses = 0;
  let negativeStemMisses = 0;
  let closeWordConfusions = 0;
  const avgTime = base.avgSecondsPerQ || 0;
  let slowMisses = 0;

  for (const e of incorrectEntries) {
    for (const t of e.mcq.tags ?? []) tagMissCounts[t] = (tagMissCounts[t] || 0) + 1;
    const q = (e.mcq.question || '').trim();
    if (q.length > 220) longStemMisses++;
    if (/\b(NOT|EXCEPT|LEAST|FALSE)\b/.test(q)) negativeStemMisses++;
    const selected = e.mcq.options.find((o) => o.id === e.selectedOptionId)?.text ?? '';
    const correct = e.mcq.options.find((o) => o.isCorrect)?.text ?? '';
    if (selected && correct) {
      const s = selected.toLowerCase();
      const c = correct.toLowerCase();
      // crude similarity: common words overlap
      const sWords = new Set(s.split(/[^a-z0-9]+/).filter(Boolean));
      const cWords = new Set(c.split(/[^a-z0-9]+/).filter(Boolean));
      let overlap = 0;
      for (const w of sWords) if (cWords.has(w)) overlap++;
      if (overlap >= 3) closeWordConfusions++;
    }
    const tTaken = 'timeTaken' in e ? ((e as { timeTaken?: number }).timeTaken ?? 0) : 0;
    if (avgTime > 0 && tTaken > avgTime * 1.5) slowMisses++;
  }

  const topMissTags = Object.entries(tagMissCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic, incorrectCount]) => ({ topic, incorrectCount }));

  if (longStemMisses >= 2)
    patterns.push(
      'Struggling with long multi-step questions. Practice summarizing stems and identifying the ask.',
    );
  if (negativeStemMisses >= 2)
    patterns.push(
      'Negative wording (NOT/EXCEPT/LEAST) caused errors. Highlight negatives and rephrase before answering.',
    );
  if (closeWordConfusions >= 2)
    patterns.push(
      'Confusion between closely worded options. Focus on discriminating key terms and qualifiers.',
    );
  if (slowMisses >= 2)
    patterns.push(
      'Time pressure on difficult items. Consider skipping and returning to avoid sunk time.',
    );

  return {
    summary,
    strengths,
    weaknesses,
    timeAnalysis: { pacingComment, avgSecondsPerQuestion: Number(base.avgSecondsPerQ.toFixed(1)) },
    topicBreakdown: base.topics.map((t) => ({
      topic: t.topic,
      accuracy: Number(t.accuracy.toFixed(1)),
      attempts: t.attempts,
    })),
    suggestions,
    incorrectPatterns: patterns.slice(0, 5),
    incorrectTopicFocus: topMissTags,
    incorrectAnswerInsights: patterns.slice(0, 4),
    meta: { source: 'local', generatedAt: Date.now() },
  };
}

// Helper functions to extract all items from nested structures
const getAllFlashcards = (decks: DeckData[]): FlashcardData[] => {
  const cards: FlashcardData[] = [];
  const traverse = (deck: DeckData) => {
    cards.push(...deck.flashcards);
    if (deck.subDecks) {
      deck.subDecks.forEach(traverse);
    }
  };
  decks.forEach(traverse);
  return cards;
};

// Build a compact summary of SRS analytics to feed Gemini
const buildSrsSummary = async (
  flashcards: FlashcardData[],
  mcqs: McqData[],
  settings: SrsSettings,
) => {
  const allItems = [...flashcards, ...mcqs];
  const recentLogs7 = await getRecentReviewLogs(allItems, 7);
  const recentLogs30 = await getRecentReviewLogs(allItems, 30);

  const dueStats = calculateDueStats(allItems, settings);
  const avgRetention = calculateAverageRetention(allItems, settings);
  const masteryScore = calculateDifficultyWeightedMastery(allItems, settings);
  const atRisk = calculateAtRiskItems(allItems, settings) || 0;
  const topicRates =
    recentLogs30.length > 0 ? calculateTopicForgettingRate(allItems, recentLogs30) : [];
  const topTopics = topicRates
    .sort((a, b) => b.forgetRate - a.forgetRate)
    .slice(0, 5)
    .map((t) => ({ name: t.name, forgetRate: Number(t.forgetRate.toFixed(1)) }));

  // Build compact samples for Gemini analysis
  const incorrectMcqIds = new Set(
    recentLogs30
      .filter((l): l is McqReviewLog => 'mcqId' in l && l.rating === 1) // Rating.Again === 1 in ts-fsrs
      .map((l) => l.mcqId),
  );
  const incorrectMcqSamples = mcqs
    .filter((m) => incorrectMcqIds.has(m.id))
    .slice(0, 10)
    .map((m) => ({
      id: m.id,
      question: m.question,
      tags: m.tags?.slice(0, 5) ?? [],
      correctOption: m.options.find((o) => o.isCorrect)?.text ?? null,
      optionCount: m.options.length,
    }));

  // Difficult flashcards heuristic: high FSRS difficulty or many lapses in logs
  const flashLogsById = new Map<string, ReviewLog[]>();
  for (const l of recentLogs30) {
    if ('cardId' in l && l.cardId) {
      const id = l.cardId;
      if (!flashLogsById.has(id)) {
        flashLogsById.set(id, []);
      }
      flashLogsById.get(id)!.push(l as ReviewLog);
    }
  }
  const difficultFlashcardSamples = flashcards
    .map((c) => {
      const srsData =
        c.srs?.fsrs6 ?? c.srs?.fsrs ?? (c.srs?.sm2 as { difficulty?: number } | undefined);
      const difficulty = srsData?.difficulty ?? null;
      const logs = flashLogsById.get(c.id) ?? [];
      const lapses = logs.filter((l) => l.rating === 1).length;
      const score = (typeof difficulty === 'number' ? difficulty : 0) + lapses * 2;
      return { c, difficulty, lapses, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ c, difficulty, lapses }) => ({
      id: c.id,
      type: c.type,
      tags: c.tags?.slice(0, 5) ?? [],
      prompt:
        ('question' in c ? (c as { question?: string }).question : null) ??
        ('text' in c ? (c as { text?: string }).text : null) ??
        'image-occlusion',
      answer:
        ('answer' in c ? (c as { answer?: string }).answer : null) ??
        ('description' in c ? (c as { description?: string }).description : null) ??
        undefined,
      srsDifficulty:
        typeof difficulty === 'number' ? Number((difficulty as number).toFixed(2)) : null,
      recentLapses: lapses,
    }));

  return {
    counts: {
      totalItems: allItems.length,
      dueToday: dueStats.dueToday,
      overdue: dueStats.overdue,
      recentLogs7: recentLogs7.length,
      recentLogs30: recentLogs30.length,
    },
    performance: {
      avgRetention: avgRetention ? Number(avgRetention.toFixed(1)) : null,
      masteryScore: masteryScore ? Number(masteryScore.toFixed(1)) : null,
      atRisk,
    },
    topics: topTopics,
    samples: {
      incorrectMcqs: incorrectMcqSamples,
      difficultFlashcards: difficultFlashcardSamples,
    },
    settings: {
      maxReviewsPerDay: settings.maxReviewsPerDay,
      mcqMaxReviewsPerDay: settings.mcqMaxReviewsPerDay,
    },
  };
};

// Call Gemini to generate insights based on SRS summary
async function generateAIInsightsWithService(
  decks: DeckData[],
  questionBanks: QuestionBankData[],
  settings: SrsSettings,
): Promise<StudyRecommendation> {
  const flashcards = getAllFlashcards(decks);
  const mcqs = getAllMcqs(questionBanks);
  const srsSummary = await buildSrsSummary(flashcards, mcqs, settings);

  const systemInstruction = `You are an expert spaced-repetition learning coach.
Respond STRICTLY as JSON with keys:
- studyRecommendation (string)
- performanceInsight (string)
- optimizationTip (string)
- weeklyGoal (string)
- progressToGoal (number 0-100)
- insights (array of {type,title,message,priority,actionable})
- learningPath (array of {topic, reason, suggestedDurationMins?, interleaveWith?[]})
- weaknessDiagnostics ({subtlePatterns?[], misconceptions?[], predictedAtRiskTopics?[], falsePositivesNote?})`;

  const userPrompt = `Using the following SRS analytics summary, produce personalized, concrete, and educational study insights.
Emphasize: actionable steps, time budgeting, topic focus, and habits. Avoid fluff. Keep all outputs safe for UI.

Additionally, analyze the provided samples:
- incorrectMcqs: find content patterns in wrong answers (e.g., confusing distractors, similar terms, multi-step reasoning). Output 3-4 insights labeled "Error Pattern Analysis" with specific guidance.
- difficultFlashcards: infer likely reasons for difficulty (abstractness, multi-fact recall, interference). Output 3-5 insights labeled "Difficult Flashcards Diagnosis" with concrete practice tips.

SRS Summary JSON:
${JSON.stringify(srsSummary)}`;

  const apiKey = settings?.geminiApiKey;
  if (!apiKey) {
    throw new Error('Missing Gemini API key');
  }

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent' +
    `?key=${encodeURIComponent(apiKey)}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: systemInstruction }] },
        { role: 'user', parts: [{ text: userPrompt }] },
      ],
      generationConfig: { response_mime_type: 'application/json' },
    }),
  });
  if (!resp.ok) throw new Error(`Gemini error: ${resp.status}`);
  interface GeminiResponse {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inline_data?: string;
        }>;
      };
    }>;
  }

  const data = (await resp.json()) as GeminiResponse;
  const firstText: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    data?.candidates?.[0]?.content?.parts?.[0]?.inline_data;

  type ParsedResponse = Partial<{
    studyRecommendation: unknown;
    performanceInsight: unknown;
    optimizationTip: unknown;
    weeklyGoal: unknown;
    progressToGoal: unknown;
    insights: unknown;
    learningPath: unknown;
    weaknessDiagnostics: unknown;
  }>;

  let parsed: ParsedResponse = {};
  if (typeof firstText === 'string') {
    try {
      parsed = JSON.parse(firstText);
    } catch {
      throw new Error('Non-JSON response from Gemini');
    }
  } else if (firstText && typeof firstText === 'object') {
    parsed = firstText;
  }

  // Basic validation and sane defaults
  const fallback: StudyRecommendation = {
    studyRecommendation: 'Study consistently and prioritize overdue items.',
    performanceInsight: 'Build more data for accurate insights by reviewing daily.',
    optimizationTip: 'Break down difficult topics and use shorter sessions.',
    weeklyGoal: 'Complete a week of consistent reviews',
    progressToGoal: 0,
    insights: [],
    learningPath: [],
    weaknessDiagnostics: {},
  };

  const coerceNumber = (n: unknown): number =>
    typeof n === 'number' ? Math.max(0, Math.min(100, Math.round(n))) : 0;

  const coerceInsights = (arr: unknown): AIInsight[] => {
    if (!Array.isArray(arr)) return [];

    return arr
      .map((it: unknown) => {
        const item = it as {
          type?: unknown;
          title?: unknown;
          message?: unknown;
          priority?: AIInsight['priority'];
          actionable?: unknown;
          data?: unknown;
        };

        return {
          type: (
            [
              'recommendation',
              'performance',
              'optimization',
              'goal',
              'warning',
              'achievement',
            ] as const
          ).includes(item?.type as AIInsight['type'])
            ? (item.type as AIInsight['type'])
            : 'recommendation',
          title: String(item?.title ?? 'Insight'),
          message: String(item?.message ?? ''),
          priority: (['high', 'medium', 'low'] as const).includes(
            item?.priority as AIInsight['priority'],
          )
            ? (item.priority as AIInsight['priority'])
            : 'low',
          actionable: Boolean(item?.actionable ?? false),
          data: item?.data as Record<string, unknown> | undefined,
        };
      })
      .slice(0, 10);
  };

  const coerceLearningPath = (arr: unknown): LearningPathStep[] =>
    Array.isArray(arr)
      ? arr.slice(0, 8).map((s: unknown) => {
          const item = s as {
            topic?: unknown;
            reason?: unknown;
            suggestedDurationMins?: unknown;
            interleaveWith?: unknown;
          };
          return {
            topic: String(item?.topic ?? 'General Review'),
            reason: String(item?.reason ?? ''),
            suggestedDurationMins:
              typeof item?.suggestedDurationMins === 'number'
                ? Math.max(5, Math.min(180, Math.round(item.suggestedDurationMins)))
                : undefined,
            interleaveWith: Array.isArray(item?.interleaveWith)
              ? item.interleaveWith.slice(0, 4).map(String)
              : undefined,
          };
        })
      : [];

  const coerceWeakness = (obj: unknown): WeaknessDiagnostics => {
    const input = obj as {
      subtlePatterns?: unknown;
      misconceptions?: unknown;
      predictedAtRiskTopics?: unknown;
      falsePositivesNote?: unknown;
    };
    return {
      subtlePatterns: Array.isArray(input?.subtlePatterns)
        ? input.subtlePatterns.slice(0, 6).map(String)
        : undefined,
      misconceptions: Array.isArray(input?.misconceptions)
        ? input.misconceptions.slice(0, 6).map(String)
        : undefined,
      predictedAtRiskTopics: Array.isArray(input?.predictedAtRiskTopics)
        ? input.predictedAtRiskTopics.slice(0, 6).map(String)
        : undefined,
      falsePositivesNote:
        typeof input?.falsePositivesNote === 'string' ? input.falsePositivesNote : undefined,
    };
  };

  return {
    studyRecommendation:
      typeof parsed.studyRecommendation === 'string'
        ? parsed.studyRecommendation
        : fallback.studyRecommendation,
    performanceInsight:
      typeof parsed.performanceInsight === 'string'
        ? parsed.performanceInsight
        : fallback.performanceInsight,
    optimizationTip:
      typeof parsed.optimizationTip === 'string'
        ? parsed.optimizationTip
        : fallback.optimizationTip,
    weeklyGoal: typeof parsed.weeklyGoal === 'string' ? parsed.weeklyGoal : fallback.weeklyGoal,
    progressToGoal: coerceNumber(parsed.progressToGoal),
    insights: coerceInsights(parsed.insights),
    learningPath: coerceLearningPath(parsed.learningPath),
    weaknessDiagnostics: coerceWeakness(parsed.weaknessDiagnostics ?? {}),
    meta: { source: 'gemini', generatedAt: Date.now() },
  };
}

const getAllMcqs = (questionBanks: QuestionBankData[]): McqData[] => {
  const mcqs: McqData[] = [];
  const traverse = (bank: QuestionBankData) => {
    mcqs.push(...bank.mcqs);
    if (bank.subBanks) {
      bank.subBanks.forEach(traverse);
    }
  };
  questionBanks.forEach(traverse);
  return mcqs;
};

// Get recent review logs for analysis
const getRecentReviewLogs = async (
  items: (FlashcardData | McqData)[],
  days = 30,
): Promise<Array<ReviewLog | McqReviewLog>> => {
  const cutoffDate = subDays(new Date(), days);
  const allLogs: Array<ReviewLog | McqReviewLog> = [];

  for (const item of items) {
    try {
      const isMcq = 'question' in item;
      const logs = isMcq ? await getReviewLogsForMcq(item.id) : await getReviewLogsForCard(item.id);

      const recentLogs = logs.filter((log) => {
        // Handle both ReviewLog and McqReviewLog types
        const reviewDate = 'review' in log ? new Date(log.review) : new Date();
        return reviewDate >= cutoffDate;
      });

      allLogs.push(...recentLogs);
    } catch (error) {
      console.debug(`[getRecentReviewLogs] Error fetching logs for item ${item.id}:`, error);
      continue;
    }
  }

  return allLogs;
};

// Compute weekly goal progress based on number of days with at least one review
// Goal definition: "Complete daily reviews 6/7 days this week"
const computeWeeklyProgress = async (items: (FlashcardData | McqData)[]): Promise<number> => {
  const logs = await getRecentReviewLogs(items, 7);
  if (logs.length === 0) return 0;
  const daysWithActivity = new Set<string>();
  for (const l of logs) {
    const d = new Date(l.review);
    // Use YYYY-MM-DD to bucket per day in local time
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    daysWithActivity.add(key);
  }
  const active = daysWithActivity.size;
  const targetDays = 6; // 6 of 7 days
  const pct = Math.round(Math.max(0, Math.min(100, (active / targetDays) * 100)));
  return pct;
};

// Generate study priority recommendations based on SRS data
const generateStudyPriority = (
  flashcards: FlashcardData[],
  mcqs: McqData[],
  settings: SrsSettings,
): string => {
  const flashcardDueStats = calculateDueStats(flashcards, settings);
  const mcqDueStats = calculateDueStats(mcqs, settings);

  const totalDue = flashcardDueStats.dueToday + mcqDueStats.dueToday;
  const totalOverdue = flashcardDueStats.overdue + mcqDueStats.overdue;

  if (totalOverdue > 20) {
    return `You have ${totalOverdue} overdue items! Focus on catching up with overdue reviews first, then tackle the ${totalDue} items due today.`;
  } else if (totalDue > 50) {
    return `Heavy study day ahead with ${totalDue} reviews due. Consider breaking this into 2-3 sessions of 15-20 minutes each.`;
  } else if (totalDue > 0) {
    return `You have ${totalDue} items ready for review. Perfect time to strengthen your memory!`;
  } else {
    return "Great job! You're caught up with reviews. Consider studying new material or reviewing difficult topics.";
  }
};

// Generate performance insights from recent activity
const generatePerformanceInsight = async (
  flashcards: FlashcardData[],
  mcqs: McqData[],
  settings: SrsSettings,
): Promise<string> => {
  const allItems = [...flashcards, ...mcqs];
  const recentLogs = await getRecentReviewLogs(allItems, 7);

  if (recentLogs.length === 0) {
    return 'No recent study activity. Regular practice is key to long-term retention!';
  }

  const itemIds = new Set(allItems.map((item) => item.id));
  const accuracy = calculateAccuracy(itemIds, recentLogs);

  if (accuracy === null) {
    return 'Keep studying to build up performance data for insights!';
  }

  const avgRetention = calculateAverageRetention(allItems, settings);

  let insight = `Your accuracy this week: ${accuracy.toFixed(1)}%`;

  if (accuracy >= 85) {
    insight += ' - Excellent performance! 🎉';
  } else if (accuracy >= 70) {
    insight += ' - Good progress, keep it up!';
  } else {
    insight += ' - Focus on understanding rather than speed.';
  }

  if (avgRetention !== null && avgRetention < 80) {
    insight += ` Average retention: ${avgRetention.toFixed(1)}% - consider reviewing more frequently.`;
  }

  return insight;
};

// ...

export const generateAIInsights = async (
  decks: DeckData[],
  questionBanks: QuestionBankData[],
  settings: SrsSettings,
): Promise<StudyRecommendation> => {
  // Try Gemini-powered insights when API key is available; fallback to local analytics
  const geminiApiKey = (settings as { geminiApiKey?: string }).geminiApiKey;
  const hasApiKey = geminiApiKey && geminiApiKey.trim().length > 0;
  if (hasApiKey) {
    try {
      const service = await generateAIInsightsWithService(decks, questionBanks, settings);
      // Normalize weekly goal wording and progress to be consistent
      const flashcards = getAllFlashcards(decks);
      const mcqs = getAllMcqs(questionBanks);
      const allItems = [...flashcards, ...mcqs];
      const progress = await computeWeeklyProgress(allItems);
      return {
        ...service,
        weeklyGoal: 'Complete daily reviews 6/7 days this week',
        progressToGoal: progress,
        meta: {
          ...(service.meta ?? { source: 'gemini' as const }),
          source: 'gemini',
          generatedAt: Date.now(),
        },
      };
    } catch (e) {
      console.warn('[Insights] Gemini failed, falling back to local analytics:', e);
    }
  }

  const flashcards = getAllFlashcards(decks);
  const mcqs = getAllMcqs(questionBanks);
  const allItems = [...flashcards, ...mcqs];

  const studyRecommendation = generateStudyPriority(flashcards, mcqs, settings);
  const performanceInsight = await generatePerformanceInsight(flashcards, mcqs, settings);
  const dueStats = calculateDueStats(allItems, settings);
  const optimizationTip =
    dueStats.overdue > 0
      ? `Prioritize ${dueStats.overdue} overdue items first, then batch today's ${dueStats.dueToday} reviews into short sessions.`
      : `Batch today's ${dueStats.dueToday} reviews into 2-3 focused sessions to reduce fatigue.`;
  const weeklyGoal = 'Complete daily reviews 6/7 days this week';
  const insights: AIInsight[] = [];
  const progress = await computeWeeklyProgress(allItems);

  return {
    studyRecommendation,
    performanceInsight,
    optimizationTip,
    weeklyGoal,
    progressToGoal: progress,
    insights,
    meta: { source: 'local', generatedAt: Date.now() },
  };
};

// ...
export const generateQuickStats = (
  decks: DeckData[],
  questionBanks: QuestionBankData[],
  settings: SrsSettings,
) => {
  const flashcards = getAllFlashcards(decks);
  const mcqs = getAllMcqs(questionBanks);
  const allItems = [...flashcards, ...mcqs];

  const dueStats = calculateDueStats(allItems, settings);
  const avgRetention = calculateAverageRetention(allItems, settings);
  const masteryScore = calculateDifficultyWeightedMastery(allItems, settings);

  return {
    totalItems: allItems.length,
    dueToday: dueStats.dueToday,
    overdue: dueStats.overdue,
    avgRetention: avgRetention ? Math.round(avgRetention) : null,
    masteryScore: masteryScore ? Math.round(masteryScore) : null,
    hasData: allItems.some((item) => item.srs && Object.keys(item.srs).length > 0),
  };
};
