import { useState, useEffect } from 'react';
import { useQuestionBanks } from '@/contexts/QuestionBankContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { QuestionBankTreeSelector } from '@/components/QuestionBankTreeSelector';
import { findMcqById } from '@/lib/question-bank-utils';
import { getExamLogFromDB, getAllExamLogsFromDB } from '@/lib/idb';
import { McqData, QuestionBankData } from '@/data/questionBanks';
import Header from '@/components/Header';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { ExamLog, ExamLogEntry } from '@/data/examLogs';

const mistakeReviewSchema = z.object({
  mcqLimit: z.coerce.number().int().min(1, "Must be at least 1 MCQ."),
  srsEnabled: z.boolean(),
  selectedBankIds: z.set(z.string()).min(1, "Please select at least one bank."),
});

type MistakeReviewFormValues = z.infer<typeof mistakeReviewSchema>;

const MistakeReviewSetupPage = () => {
  const { logId } = useParams<{ logId: string }>();
  const { questionBanks } = useQuestionBanks();
  const navigate = useNavigate();
  
  const [examLog, setExamLog] = useState<ExamLog | null>(null);
  const [incorrectMcqs, setIncorrectMcqs] = useState<McqData[]>([]);
  const [availableMcqs, setAvailableMcqs] = useState<McqData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageTitle, setPageTitle] = useState("Review Mistakes");
  const [pageDescription, setPageDescription] = useState("");

  const form = useForm<MistakeReviewFormValues>({
    resolver: zodResolver(mistakeReviewSchema),
    defaultValues: {
      mcqLimit: 20,
      srsEnabled: true,
      selectedBankIds: new Set(),
    },
  });

  const watchedValues = form.watch();

  useEffect(() => {
    const loadMistakes = async () => {
      setIsLoading(true);
      let mistakes: McqData[] = [];
      if (logId === 'all') {
        const logs = await getAllExamLogsFromDB();
        const mistakeMap = new Map<string, McqData>();
        logs.forEach((log: ExamLog) => {
          log.entries
            .filter((entry: ExamLogEntry) => !entry.isCorrect && entry.selectedOptionId !== null)
            .forEach((entry: ExamLogEntry) => {
              if (!mistakeMap.has(entry.mcq.id)) {
                mistakeMap.set(entry.mcq.id, entry.mcq);
              }
            });
        });
        mistakes = Array.from(mistakeMap.values());
        setPageTitle("Review All Mistakes");
        setPageDescription(`Create a practice session from the ${mistakes.length} unique questions you've answered incorrectly across all exams.`);
      } else if (logId) {
        const log = await getExamLogFromDB(logId);
        if (log) {
          setExamLog(log);
          mistakes = log.entries
            .filter((entry: ExamLogEntry) => !entry.isCorrect && entry.selectedOptionId !== null)
            .map((entry: ExamLogEntry) => entry.mcq);
          setPageTitle("Review Mistakes");
          setPageDescription(`Create a focused practice session from the ${mistakes.length} questions you answered incorrectly in "${log.name}".`);
        }
      }

      setIncorrectMcqs(mistakes);
      
      const mistakeBankIds = new Set<string>();
      mistakes.forEach(mcq => {
        const result = findMcqById(questionBanks, mcq.id);
        if (result) {
          mistakeBankIds.add(result.bankId);
        }
      });
      form.setValue('selectedBankIds', mistakeBankIds);
      setIsLoading(false);
    };

    loadMistakes();
  }, [logId, questionBanks, form]);

  useEffect(() => {
    if (incorrectMcqs.length > 0) {
      const { selectedBankIds } = watchedValues;
      if (!selectedBankIds || selectedBankIds.size === 0) {
        setAvailableMcqs([]);
        return;
      }

      const allSelectedAndSubBankIds = new Set<string>();
      const getSubBankIds = (bank: QuestionBankData) => {
        allSelectedAndSubBankIds.add(bank.id);
        bank.subBanks?.forEach(getSubBankIds);
      };

      const traverse = (banks: QuestionBankData[]) => {
        for (const bank of banks) {
          if (selectedBankIds.has(bank.id)) {
            getSubBankIds(bank);
          } else if (bank.subBanks) {
            traverse(bank.subBanks);
          }
        }
      };
      traverse(questionBanks);

      const filtered = incorrectMcqs.filter(mcq => {
        const result = findMcqById(questionBanks, mcq.id);
        return result && allSelectedAndSubBankIds.has(result.bankId);
      });
      setAvailableMcqs(filtered);
    }
  }, [watchedValues.selectedBankIds, incorrectMcqs, questionBanks]);

  const onSubmit = (values: MistakeReviewFormValues) => {
    if (availableMcqs.length === 0) {
      toast.error("No incorrect MCQs found in the selected banks.");
      return;
    }
    if (values.mcqLimit > availableMcqs.length) {
      toast.error(`You requested ${values.mcqLimit} questions, but only ${availableMcqs.length} are available.`);
      return;
    }

    const finalQueue = [...availableMcqs]
      .sort(() => Math.random() - 0.5)
      .slice(0, values.mcqLimit);

    toast.success(`Starting mistake review with ${finalQueue.length} MCQs.`);
    navigate('/mcq-practice/custom', {
      state: {
        queue: finalQueue,
        srsEnabled: values.srsEnabled,
        title: `Reviewing Mistakes: ${examLog?.name || 'All Exams'}`
      }
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!examLog && logId !== 'all') {
    return <div className="flex items-center justify-center min-h-screen">Exam log not found.</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader>
            <Button asChild variant="ghost" className="mb-4 -ml-4">
              <Link to="/exam-history"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Exam History</Link>
            </Button>
            <CardTitle className="text-2xl">{pageTitle}</CardTitle>
            <CardDescription>{pageDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                  control={form.control}
                  name="selectedBankIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Filter by Question Bank</FormLabel>
                      <FormControl>
                        <QuestionBankTreeSelector
                          banks={questionBanks}
                          selectedBankIds={field.value}
                          onSelectionChange={(newIds: Set<string>) => field.onChange(newIds)}
                        />
                      </FormControl>
                      <FormDescription>Select the topics you want to review mistakes from.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mcqLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <span>Number of questions</span>
                        <span className="text-muted-foreground font-normal">
                          ({availableMcqs.length} available)
                        </span>
                      </FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="srsEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Enable Spaced Repetition</FormLabel>
                        <FormDescription>If enabled, your answers will update your SRS data.</FormDescription>
                      </div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" size="lg">Start Review</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MistakeReviewSetupPage;