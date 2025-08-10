import { McqData } from "@/data/questionBanks";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { HtmlRenderer } from "./HtmlRenderer";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "./ui/badge";

interface McqPlayerProps {
  mcq: McqData;
  selectedOptionId: string | null;
  isSubmitted: boolean;
  onOptionSelect: (optionId: string) => void;
}

const McqPlayer = ({ mcq, selectedOptionId, isSubmitted, onOptionSelect }: McqPlayerProps) => {
  const getOptionClass = (optionId: string, isCorrect: boolean) => {
    if (!isSubmitted) {
      return "border-muted-foreground/50 hover:border-primary";
    }
    if (isCorrect) {
      return "border-green-500 bg-green-500/10 text-green-800 dark:text-green-300";
    }
    if (optionId === selectedOptionId && !isCorrect) {
      return "border-red-500 bg-red-500/10 text-red-800 dark:text-red-300";
    }
    return "border-muted-foreground/50 opacity-70";
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          <HtmlRenderer html={mcq.question} className="prose dark:prose-invert max-w-none" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedOptionId || undefined}
          onValueChange={onOptionSelect}
          disabled={isSubmitted}
        >
          <div className="space-y-4">
            {mcq.options.map((option, index) => (
              <Label
                key={option.id}
                htmlFor={option.id}
                className={cn(
                  "flex items-start gap-4 rounded-lg border p-4 transition-all cursor-pointer relative",
                  getOptionClass(option.id, option.isCorrect)
                )}
              >
                <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                <div className="flex-grow">
                  <HtmlRenderer html={option.text} className="prose dark:prose-invert max-w-none" />
                </div>
                {isSubmitted && option.isCorrect && <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />}
                {isSubmitted && !option.isCorrect && selectedOptionId === option.id && <XCircle className="h-6 w-6 text-red-500 flex-shrink-0" />}
                {!isSubmitted && (
                  <Badge variant="outline" className="absolute -top-2 -right-2 text-xs font-mono bg-background">
                    {index + 1}
                  </Badge>
                )}
              </Label>
            ))}
          </div>
        </RadioGroup>
      </CardContent>
      {isSubmitted && (
        <CardFooter className="flex-col items-start gap-4 pt-6 border-t">
          <h3 className="text-lg font-semibold">Explanation</h3>
          <HtmlRenderer html={mcq.explanation} className="prose dark:prose-invert max-w-none text-muted-foreground" />
        </CardFooter>
      )}
    </Card>
  );
};

export default McqPlayer;