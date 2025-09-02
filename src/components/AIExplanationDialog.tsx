import { useState } from 'react';
import { McqData } from '@/data/questionBanks';
import {
  AIExplanation,
  generateAIExplanation,
  deleteAIExplanation,
  clearExplanationCache,
} from '@/lib/ai-explanation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Brain, Lightbulb, AlertCircle } from 'lucide-react';
import { HtmlRenderer } from './HtmlRenderer';

interface AIExplanationDialogProps {
  mcq: McqData;
  children?: React.ReactNode;
}

const AIExplanationDialog = ({ mcq, children }: AIExplanationDialogProps) => {
  const [explanation, setExplanation] = useState<AIExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleGenerateExplanation = async () => {
    if (explanation) return; // Already have explanation

    setIsLoading(true);
    setError(null);

    try {
      const aiExplanation = await generateAIExplanation(mcq);
      setExplanation(aiExplanation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate AI explanation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Clear cache and DB entry to force fresh generation
      await deleteAIExplanation(mcq.id);
      clearExplanationCache();
      setExplanation(null);
      const aiExplanation = await generateAIExplanation(mcq);
      setExplanation(aiExplanation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate AI explanation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !explanation && !isLoading) {
      handleGenerateExplanation();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <Sparkles className="h-4 w-4" />
            AI Explanation
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Explanation
          </DialogTitle>
          <DialogDescription>
            Get detailed insights and explanations powered by AI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Question Display */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Question</CardTitle>
            </CardHeader>
            <CardContent>
              <HtmlRenderer
                html={mcq.question}
                className="prose dark:prose-invert prose-sm max-w-none"
              />
            </CardContent>
          </Card>

          {/* Loading State */}
          {isLoading && (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Generating AI explanation...
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error State */}
          {error && (
            <Card className="border-destructive/50">
              <CardContent className="flex items-center gap-3 py-4">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Failed to generate explanation
                  </p>
                  <p className="text-xs text-muted-foreground">{error}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateExplanation}
                  className="ml-auto"
                >
                  Retry
                </Button>
                <Button variant="secondary" size="sm" onClick={handleRegenerate}>
                  Regenerate
                </Button>
              </CardContent>
            </Card>
          )}

          {/* AI Explanation Content */}
          {explanation && (
            <div className="space-y-4">
              {/* Main Explanation */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Detailed Explanation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <HtmlRenderer
                    html={explanation.explanation}
                    className="prose dark:prose-invert prose-sm max-w-none"
                  />
                </CardContent>
              </Card>

              {/* Reasoning */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Reasoning
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <HtmlRenderer
                    html={explanation.reasoning}
                    className="prose dark:prose-invert prose-sm max-w-none"
                  />
                </CardContent>
              </Card>

              {/* Key Points */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Key Learning Points
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {explanation.keyPoints.map((point, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Badge
                          variant="secondary"
                          className="text-xs font-mono min-w-6 h-6 flex items-center justify-center"
                        >
                          {index + 1}
                        </Badge>
                        <span className="text-sm">{point}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Actions + Metadata */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                <div className="flex items-center gap-2">
                  <span>Generated by AI</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={isLoading}
                  >
                    Regenerate
                  </Button>
                </div>
                <span>
                  {new Date(explanation.createdAt).toLocaleDateString()} at{' '}
                  {new Date(explanation.createdAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIExplanationDialog;
