import { useState } from 'react';
import { McqData } from '@/data/questionBanks';
import {
  AIExplanation,
  generateAIExplanation,
  deleteAIExplanation,
  clearExplanationCache,
} from '@/lib/ai-explanation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Brain, BookOpen } from 'lucide-react';
import { HtmlRenderer } from './HtmlRenderer';

interface Props {
  mcq: McqData;
}

export default function AIExplanationDropdown({ mcq }: Props) {
  const [aiExp, setAiExp] = useState<AIExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAi = async () => {
    if (aiExp || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await generateAIExplanation(mcq);
      setAiExp(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load AI explanation');
    } finally {
      setLoading(false);
    }
  };

  const regenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      await deleteAIExplanation(mcq.id);
      clearExplanationCache();
      setAiExp(null);
      const res = await generateAIExplanation(mcq);
      setAiExp(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate AI explanation');
    } finally {
      setLoading(false);
    }
  };

  // Auto-load AI explanation if user opens AI section
  const handleChange = (value: string | string[]) => {
    const isOpen = Array.isArray(value) ? value.includes('ai') : value === 'ai';
    if (isOpen) {
      void loadAi();
    }
  };

  return (
    <Accordion type="single" collapsible className="w-full" onValueChange={handleChange}>
      <AccordionItem value="official">
        <AccordionTrigger className="text-left">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Official Explanation
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <Card>
            <CardContent className="pt-4">
              <HtmlRenderer
                html={mcq.explanation}
                className="prose dark:prose-invert max-w-none text-muted-foreground"
              />
            </CardContent>
          </Card>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="ai">
        <AccordionTrigger className="text-left">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            AI Explanation
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <Card>
            <CardContent className="pt-4 space-y-4">
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating AI explanation...
                </div>
              )}

              {error && (
                <div className="flex items-center gap-3 py-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">{error}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={() => void loadAi()}
                  >
                    Retry
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void regenerate()}>
                    Regenerate
                  </Button>
                </div>
              )}

              {aiExp && (
                <div className="space-y-4">
                  <HtmlRenderer
                    html={aiExp.explanation}
                    className="prose dark:prose-invert prose-sm max-w-none"
                  />

                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">Reasoning</div>
                    <HtmlRenderer
                      html={aiExp.reasoning}
                      className="prose dark:prose-invert prose-sm max-w-none"
                    />
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">
                      Key Learning Points
                    </div>
                    <div className="space-y-2">
                      {aiExp.keyPoints.map((p, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Badge
                            variant="secondary"
                            className="text-xs font-mono min-w-6 h-6 flex items-center justify-center"
                          >
                            {i + 1}
                          </Badge>
                          <span className="text-sm">{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <span>Generated by AI</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void regenerate()}
                        disabled={loading}
                      >
                        Regenerate
                      </Button>
                    </div>
                    <span>
                      {new Date(aiExp.createdAt).toLocaleDateString()} at{' '}
                      {new Date(aiExp.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
