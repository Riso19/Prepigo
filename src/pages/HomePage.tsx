import { useState, useEffect, useMemo } from 'react';
import {
  Brain,
  TrendingUp,
  Target,
  Clock,
  BookOpen,
  BarChart3,
  Lightbulb,
  Settings,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import { useDecks } from '@/contexts/DecksContext';
import { useQuestionBanks } from '@/contexts/QuestionBankContext';
import { useSettings } from '@/contexts/SettingsContext';
import { GamificationHeader } from '@/components/gamification/GamificationHeader';
import {
  generateAIInsights,
  generateQuickStats,
  type StudyRecommendation,
} from '@/lib/ai-insights';
import { getLatestAIInsights, saveAIInsights } from '@/lib/dexie-db';

const HomePage = () => {
  const { decks } = useDecks();
  const { questionBanks } = useQuestionBanks();
  const { settings } = useSettings();
  const [aiInsights, setAiInsights] = useState<StudyRecommendation | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);

  const loadCachedInsightsFromDexie = async () => {
    const rec = await getLatestAIInsights();
    if (rec?.data && typeof rec.data === 'object') {
      const d = rec.data as StudyRecommendation;
      setAiInsights(d);
      setGeneratedAt(d.meta?.generatedAt ?? rec.createdAt ?? null);
    }
  };

  // Calculate statistics using the new analytics system
  const quickStats = generateQuickStats(decks, questionBanks, settings);
  const hasApiKey = settings.geminiApiKey && settings.geminiApiKey.trim().length > 0;

  const generateAiInsights = async () => {
    setIsLoadingInsights(true);
    try {
      const insights = await generateAIInsights(decks, questionBanks, settings);
      setAiInsights(insights);
      setGeneratedAt(insights.meta?.generatedAt ?? Date.now());
      await saveAIInsights(insights);
    } catch (error) {
      console.error('Failed to generate AI insights:', error);
      // Fallback to basic insights if there's an error
      const now = Date.now();
      const fallback: StudyRecommendation = {
        studyRecommendation:
          'Unable to generate detailed insights. Check your study data and try again.',
        performanceInsight: 'Keep studying regularly to build up data for AI insights!',
        optimizationTip: 'Consistent daily practice is the key to long-term retention.',
        weeklyGoal: 'Complete daily reviews 6/7 days this week',
        progressToGoal: 0,
        insights: [],
        meta: { source: 'local', generatedAt: now },
      };
      setAiInsights(fallback);
      setGeneratedAt(now);
      await saveAIInsights(fallback);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  useEffect(() => {
    // Load cached insights immediately for faster UX (no auto-refresh; explicit by user)
    loadCachedInsightsFromDexie();
  }, []);

  const generatedTimeLabel = useMemo(() => {
    if (!generatedAt) return '';
    try {
      const d = new Date(generatedAt);
      return d.toLocaleString();
    } catch {
      return '';
    }
  }, [generatedAt]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8 bg-secondary/50 rounded-lg my-4">
        <div className="space-y-6">
          {/* Gamification Header */}
          <GamificationHeader />

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Brain className="h-8 w-8 text-primary" />
                AI Study Insights
              </h1>
              <p className="text-muted-foreground mt-1">
                Personalized recommendations to optimize your learning
              </p>
            </div>
            <div className="flex items-center gap-2">
              {aiInsights?.meta?.source && (
                <Badge
                  variant={aiInsights.meta.source === 'gemini' ? 'default' : 'secondary'}
                  title={
                    aiInsights.meta.source === 'gemini' ? 'Powered by Gemini' : 'Generated locally'
                  }
                >
                  {aiInsights.meta.source === 'gemini' ? 'Gemini AI' : 'Local Insights'}
                </Badge>
              )}
              {generatedTimeLabel && (
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 mr-1" />
                  Generated {generatedTimeLabel}
                </div>
              )}
              {!hasApiKey && (
                <Button asChild variant="outline">
                  <Link to="/settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Setup AI
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* API Key Setup Notice */}
          {!hasApiKey && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                      AI Insights Not Configured
                    </h3>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      To get personalized AI study recommendations, please add your Gemini API key
                      in settings.
                    </p>
                    <Button asChild size="sm" className="mt-3" variant="outline">
                      <Link to="/settings">Configure AI Settings</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Study Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{quickStats.totalItems}</div>
                <p className="text-xs text-muted-foreground">Flashcards & MCQs</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Due Today</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{quickStats.dueToday}</div>
                <p className="text-xs text-muted-foreground">Ready to review</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${quickStats.overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  {quickStats.overdue}
                </div>
                <p className="text-xs text-muted-foreground">Need attention</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Retention</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {quickStats.avgRetention ? `${quickStats.avgRetention}%` : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">Average retention</p>
              </CardContent>
            </Card>
          </div>

          {/* AI Insights Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                SRS Analytics & Insights
              </h2>
              <Button
                onClick={generateAiInsights}
                disabled={isLoadingInsights}
                size="sm"
                variant="outline"
              >
                {isLoadingInsights ? 'Analyzing...' : 'Refresh Insights'}
              </Button>
            </div>

            {isLoadingInsights ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-3 text-muted-foreground">Analyzing SRS data...</span>
                  </div>
                </CardContent>
              </Card>
            ) : aiInsights ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="h-5 w-5 text-green-600" />
                        Study Recommendation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{aiInsights.studyRecommendation}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                        Performance Insight
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{aiInsights.performanceInsight}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-amber-600" />
                        Optimization Tip
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{aiInsights.optimizationTip}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="h-5 w-5 text-purple-600" />
                        Weekly Goal
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <p className="text-sm">{aiInsights.weeklyGoal}</p>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{aiInsights.progressToGoal}%</span>
                          </div>
                          <Progress value={aiInsights.progressToGoal} className="h-2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Additional Insights */}
                {aiInsights.insights && aiInsights.insights.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Detailed Insights</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {aiInsights.insights.map((insight, index) => (
                        <Card
                          key={index}
                          className={`border-l-4 ${
                            insight.priority === 'high'
                              ? 'border-l-red-500'
                              : insight.priority === 'medium'
                                ? 'border-l-yellow-500'
                                : 'border-l-green-500'
                          }`}
                        >
                          <CardContent className="pt-4">
                            <div className="flex items-start gap-3">
                              {insight.type === 'warning' && (
                                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                              )}
                              {insight.type === 'achievement' && (
                                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                              )}
                              {insight.type === 'recommendation' && (
                                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                              )}
                              {insight.type === 'optimization' && (
                                <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5" />
                              )}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium">{insight.title}</h4>
                                  <Badge
                                    variant={
                                      insight.priority === 'high'
                                        ? 'destructive'
                                        : insight.priority === 'medium'
                                          ? 'default'
                                          : 'secondary'
                                    }
                                  >
                                    {insight.priority}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {insight.message}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Learning Path Recommendations */}
                {aiInsights.learningPath && aiInsights.learningPath.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Target className="h-5 w-5 text-green-600" /> Personalized Learning Path
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {aiInsights.learningPath.map((step, idx) => (
                        <Card key={idx}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h4 className="font-medium">{step.topic}</h4>
                                <p className="text-sm text-muted-foreground mt-1">{step.reason}</p>
                                {step.interleaveWith && step.interleaveWith.length > 0 && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Interleave with: {step.interleaveWith.join(', ')}
                                  </p>
                                )}
                              </div>
                              {typeof step.suggestedDurationMins === 'number' && (
                                <Badge variant="outline">~{step.suggestedDurationMins} min</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Advanced Weakness Diagnostics */}
                {aiInsights.weaknessDiagnostics && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" /> Advanced Weakness
                      Identification
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {aiInsights.weaknessDiagnostics.subtlePatterns &&
                        aiInsights.weaknessDiagnostics.subtlePatterns.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">Subtle Error Patterns</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-2">
                              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                {aiInsights.weaknessDiagnostics.subtlePatterns.map((p, i) => (
                                  <li key={i}>{p}</li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        )}
                      {aiInsights.weaknessDiagnostics.misconceptions &&
                        aiInsights.weaknessDiagnostics.misconceptions.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">Detected Misconceptions</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-2">
                              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                {aiInsights.weaknessDiagnostics.misconceptions.map((m, i) => (
                                  <li key={i}>{m}</li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        )}
                      {(aiInsights.weaknessDiagnostics.predictedAtRiskTopics &&
                        aiInsights.weaknessDiagnostics.predictedAtRiskTopics.length > 0) ||
                      aiInsights.weaknessDiagnostics.falsePositivesNote ? (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Predictions & Notes</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-2 space-y-2">
                            {aiInsights.weaknessDiagnostics.predictedAtRiskTopics &&
                              aiInsights.weaknessDiagnostics.predictedAtRiskTopics.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium">
                                    Likely to be forgotten next:
                                  </p>
                                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground mt-1">
                                    {aiInsights.weaknessDiagnostics.predictedAtRiskTopics.map(
                                      (t, i) => (
                                        <li key={i}>{t}</li>
                                      ),
                                    )}
                                  </ul>
                                </div>
                              )}
                            {aiInsights.weaknessDiagnostics.falsePositivesNote && (
                              <p className="text-sm text-muted-foreground">
                                {aiInsights.weaknessDiagnostics.falsePositivesNote}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No insights available yet.</p>
                    <Button onClick={generateAiInsights} className="mt-3" size="sm">
                      Generate Insights
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button asChild variant="outline" className="h-auto py-3">
                  <Link to="/custom-study" className="flex flex-col items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    <span className="text-sm">Study Cards</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto py-3">
                  <Link to="/mcq-practice/setup" className="flex flex-col items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    <span className="text-sm">Practice MCQs</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto py-3">
                  <Link to="/statistics" className="flex flex-col items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    <span className="text-sm">View Stats</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto py-3">
                  <Link to="/settings" className="flex flex-col items-center gap-2">
                    <Settings className="h-5 w-5" />
                    <span className="text-sm">Settings</span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
