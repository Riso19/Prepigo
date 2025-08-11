import { useState, useMemo, useEffect } from 'react';
import { useQuestionBanks } from '@/contexts/QuestionBankContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { QuestionBankTreeSelector } from '@/components/QuestionBankTreeSelector';
import { TagEditor } from '@/components/TagEditor';
import { getAllTagsFromQuestionBanks, getAllMcqsFromBank } from '@/lib/question-bank-utils';
import { getAllMcqReviewLogsFromDB } from '@/lib/idb';
import { McqData, QuestionBankData } from '@/data/questionBanks';
import { Rating, State } from 'ts-fsrs';
import Header from '@/components/Header';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useExams } from '@/contexts/ExamsContext';
import { format } from 'date-fns';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const customMcqPracticeSchema = z.object({
  mode: z.enum(['practice', 'exam']),
  examName: z.string().optional(),
  timeLimit: z.coerce.number().int().optional(),
  marksPerCorrect: z.coerce.number().optional(),
  negativeMarksPerWrong: z.coerce.number().optional(),
  mcqLimit: z.coerce.number().int().min(1, "Must be at least 1 MCQ."),
  srsEnabled: z.boolean(),
  selectedBankIds: z.set(z.string()).min(1, "Please select at least one bank."),
  filterType: z.enum(['all', 'new', 'due', 'failed', 'difficulty']),
  failedDays: z.coerce.number().int().min(1).optional(),
  tags: z.array(z.string()),
  tagFilterType: z.enum(['any', 'all']),
  order: z.enum(['random', 'sequentialNewest', 'sequentialOldest']),
  filterDifficultyMin: z.number().min(1).max(10).optional(),
  filterDifficultyMax: z.number().min(1).max(10).optional(),
}).superRefine((data, ctx) => {
  if (data.mode === 'exam') {
    if (!data.examName || data.examName.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Exam name is required.", path: ["examName"] });
    }
    if (!data.timeLimit || data.timeLimit < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Time limit must be at least 1 minute.", path: ["timeLimit"] });
    }
    if (data.marksPerCorrect === undefined || data.marksPerCorrect < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Marks must be 0 or greater.", path: ["marksPerCorrect"] });
    }
    if (data.negativeMarksPerWrong === undefined || data.negativeMarksPerWrong < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Negative marks must be 0 or greater.", path: ["negativeMarksPerWrong"] });
    }
  }
});

type CustomMcqPracticeFormValues = z.infer<typeof customMcqPracticeSchema>;

const CustomMcqPracticeSetupPage = () => {
  const { questionBanks } = useQuestionBanks();
  const { settings } = useSettings();
  const { exams } = useExams();
  const allTags = useMemo(() => getAllTagsFromQuestionBanks(questionBanks), [questionBanks]);
  const navigate = useNavigate();
  const [availableMcqCount, setAvailableMcqCount] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [difficultyRange, setDifficultyRange] = useState([5, 10]);

  const form = useForm<CustomMcqPracticeFormValues>({
    resolver: zodResolver(customMcqPracticeSchema),
    defaultValues: {
      mode: 'practice',
      examName: '',
      timeLimit: 60,
      marksPerCorrect: 1,
      negativeMarksPerWrong: 0,
      mcqLimit: 20,
      srsEnabled: true,
      selectedBankIds: new Set(),
      filterType: 'all',
      failedDays: 7,
      tags: [],
      tagFilterType: 'any',
      order: 'random',
      filterDifficultyMin: 5,
      filterDifficultyMax: 10,
    },
  });

  const watchedValues = form.watch();
  const isExamMode = watchedValues.mode === 'exam';

  useEffect(() => {
    if (selectedExamId) {
        const selectedExam = exams.find(e => e.id === selectedExamId);
        if (selectedExam) {
            form.setValue('selectedBankIds', new Set(selectedExam.questionBankIds));
            form.setValue('tags', selectedExam.tags);
            form.setValue('tagFilterType', selectedExam.tagFilterType);
            form.setValue('filterType', selectedExam.filterMode);
            
            if (selectedExam.filterMode === 'difficulty') {
                const min = selectedExam.filterDifficultyMin || 5;
                const max = selectedExam.filterDifficultyMax || 10;
                form.setValue('filterDifficultyMin', min);
                form.setValue('filterDifficultyMax', max);
                setDifficultyRange([min, max]);
            }
        }
    }
  }, [selectedExamId, exams, form]);

  useEffect(() => {
    const calculateCount = async () => {
      setIsCalculating(true);
      const { selectedBankIds, filterType, failedDays, tags, tagFilterType } = watchedValues;

      if (!selectedBankIds || selectedBankIds.size === 0) {
        setAvailableMcqCount(0);
        setIsCalculating(false);
        return;
      }

      const getAllBanksFlat = (b: QuestionBankData[]): QuestionBankData[] => {
        return b.flatMap(bank => [bank, ...(bank.subBanks ? getAllBanksFlat(bank.subBanks) : [])]);
      };
      const allBanks = getAllBanksFlat(questionBanks);

      const mcqSet = new Set<McqData>();
      selectedBankIds.forEach(id => {
        const bank = allBanks.find(b => b.id === id);
        if (bank) {
          getAllMcqsFromBank(bank).forEach(mcq => mcqSet.add(mcq));
        }
      });
      let mcqsToFilter = Array.from(mcqSet);

      if (tags.length > 0) {
        mcqsToFilter = mcqsToFilter.filter(mcq => {
          if (!mcq.tags || mcq.tags.length === 0) return false;
          if (tagFilterType === 'any') {
            return tags.some(tag => mcq.tags!.includes(tag));
          } else {
            return tags.every(tag => mcq.tags!.includes(tag));
          }
        });
      }

      const now = new Date();
      const scheduler = settings.scheduler === 'sm2' ? 'fsrs' : settings.scheduler;
      switch (filterType) {
        case 'new':
          mcqsToFilter = mcqsToFilter.filter(m => {
            const srsData = scheduler === 'fsrs6' ? m.srs?.fsrs6 : m.srs?.fsrs;
            return !srsData || srsData.state === State.New;
          });
          break;
        case 'due':
          mcqsToFilter = mcqsToFilter.filter(m => {
            const srsData = scheduler === 'fsrs6' ? m.srs?.fsrs6 : m.srs?.fsrs;
            return !!srsData && new Date(srsData.due) <= now;
          });
          break;
        case 'failed':
          const days = failedDays || 7;
          const cutoffDate = new Date();
          cutoffDate.setDate(now.getDate() - days);
          const allLogs = await getAllMcqReviewLogsFromDB();
          const recentFailedMcqIds = new Set<string>();
          allLogs.forEach(log => {
            if (new Date(log.review) >= cutoffDate && (log.rating === Rating.Again || log.rating === Rating.Hard)) {
              recentFailedMcqIds.add(log.mcqId);
            }
          });
          mcqsToFilter = mcqsToFilter.filter(m => recentFailedMcqIds.has(m.id));
          break;
        case 'difficulty':
            const min = watchedValues.filterDifficultyMin || 1;
            const max = watchedValues.filterDifficultyMax || 10;
            mcqsToFilter = mcqsToFilter.filter(m => {
                const srsData = scheduler === 'fsrs6' ? m.srs?.fsrs6 : m.srs?.fsrs;
                if (!srsData || srsData.state === State.New) return false;
                const difficulty = srsData.difficulty;
                return difficulty >= min && difficulty <= max;
            });
            break;
      }

      setAvailableMcqCount(mcqsToFilter.length);
      setIsCalculating(false);
    };

    const handler = setTimeout(() => {
      calculateCount();
    }, 300);

    return () => clearTimeout(handler);
  }, [watchedValues, questionBanks, settings]);

  const onSubmit = async (values: CustomMcqPracticeFormValues) => {
    if (availableMcqCount === 0) {
        toast.error("No MCQs found matching your criteria.");
        return;
    }
    
    const loadingToast = toast.loading("Building session...");
    
    const getAllBanksFlat = (b: QuestionBankData[]): QuestionBankData[] => b.flatMap(bank => [bank, ...(bank.subBanks ? getAllBanksFlat(bank.subBanks) : [])]);
    const allBanks = getAllBanksFlat(questionBanks);
    const mcqSet = new Set<McqData>();
    values.selectedBankIds.forEach(id => {
        const bank = allBanks.find(b => b.id === id);
        if (bank) getAllMcqsFromBank(bank).forEach(mcq => mcqSet.add(mcq));
    });
    let filteredMcqs = Array.from(mcqSet);

    if (values.tags.length > 0) {
        filteredMcqs = filteredMcqs.filter(mcq => {
            if (!mcq.tags || mcq.tags.length === 0) return false;
            if (values.tagFilterType === 'any') return values.tags.some(tag => mcq.tags!.includes(tag));
            else return values.tags.every(tag => mcq.tags!.includes(tag));
        });
    }

    const now = new Date();
    const scheduler = settings.scheduler === 'sm2' ? 'fsrs' : settings.scheduler;
    switch (values.filterType) {
        case 'new':
            filteredMcqs = filteredMcqs.filter(m => {
                const srsData = scheduler === 'fsrs6' ? m.srs?.fsrs6 : m.srs?.fsrs;
                return !srsData || srsData.state === State.New;
            });
            break;
        case 'due':
            filteredMcqs = filteredMcqs.filter(m => {
                const srsData = scheduler === 'fsrs6' ? m.srs?.fsrs6 : m.srs?.fsrs;
                return !!srsData && new Date(srsData.due) <= now;
            });
            break;
        case 'failed':
            const failedDays = values.failedDays || 7;
            const cutoffDate = new Date();
            cutoffDate.setDate(now.getDate() - failedDays);
            const allLogs = await getAllMcqReviewLogsFromDB();
            const recentFailedMcqIds = new Set<string>(allLogs.filter(log => new Date(log.review) >= cutoffDate && (log.rating === Rating.Again || log.rating === Rating.Hard)).map(log => log.mcqId));
            filteredMcqs = filteredMcqs.filter(m => recentFailedMcqIds.has(m.id));
            break;
        case 'difficulty':
            const min = values.filterDifficultyMin || 1;
            const max = values.filterDifficultyMax || 10;
            filteredMcqs = filteredMcqs.filter(m => {
                const srsData = scheduler === 'fsrs6' ? m.srs?.fsrs6 : m.srs?.fsrs;
                if (!srsData || srsData.state === State.New) return false;
                const difficulty = srsData.difficulty;
                return difficulty >= min && difficulty <= max;
            });
            break;
    }

    switch (values.order) {
        case 'random':
            filteredMcqs.sort(() => Math.random() - 0.5);
            break;
        case 'sequentialNewest':
        case 'sequentialOldest':
            break;
    }

    const finalQueue = filteredMcqs.slice(0, values.mcqLimit);
    
    if (values.mode === 'exam') {
        toast.success(`Starting exam with ${finalQueue.length} questions.`, { id: loadingToast });
        navigate('/exam/session', {
            state: { 
                queue: finalQueue, 
                examSettings: {
                    name: values.examName,
                    timeLimit: values.timeLimit,
                    marksPerCorrect: values.marksPerCorrect,
                    negativeMarksPerWrong: values.negativeMarksPerWrong,
                }
            }
        });
    } else {
        toast.success(`Starting session with ${finalQueue.length} MCQs.`, { id: loadingToast });
        navigate('/mcq-practice/custom', {
            state: { queue: finalQueue, srsEnabled: values.srsEnabled, title: 'Custom Practice Session' }
        });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Custom MCQ Practice Session</CardTitle>
            <CardDescription>Create a temporary, filtered question bank for focused practice or a simulated exam.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                
                <FormField
                  control={form.control}
                  name="mode"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Exam Mode</FormLabel>
                        <FormDescription>Simulate a timed exam with scoring.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value === 'exam'}
                          onCheckedChange={(checked) => field.onChange(checked ? 'exam' : 'practice')}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {isExamMode && (
                  <Card className="bg-secondary/50">
                    <CardHeader><CardTitle>Exam Settings</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                      <FormField control={form.control} name="examName" render={({ field }) => (
                        <FormItem><FormLabel>Exam Name</FormLabel><FormControl><Input placeholder="e.g., Mid-term Practice Test" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField control={form.control} name="timeLimit" render={({ field }) => (
                          <FormItem><FormLabel>Time Limit (minutes)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="marksPerCorrect" render={({ field }) => (
                          <FormItem><FormLabel>Marks (Correct)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="negativeMarksPerWrong" render={({ field }) => (
                          <FormItem><FormLabel>Negative Marks (Wrong)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Separator />

                {exams.length > 0 && (
                    <div className="space-y-2">
                        <FormLabel>Load from Exam Schedule</FormLabel>
                        <Select onValueChange={setSelectedExamId} value={selectedExamId}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an exam to load its settings..." />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {exams.map(exam => (
                                    <SelectItem key={exam.id} value={exam.id}>
                                        {exam.name} ({format(new Date(exam.date), 'PPP')})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormDescription>
                            This will populate the filters below based on the selected exam.
                        </FormDescription>
                    </div>
                )}

                <FormField
                  control={form.control}
                  name="selectedBankIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Question Banks to include</FormLabel>
                      <div className={cn(selectedExamId && "opacity-50 pointer-events-none")}>
                        <FormControl>
                          <QuestionBankTreeSelector
                            banks={questionBanks}
                            selectedBankIds={field.value}
                            onSelectionChange={(newIds) => field.onChange(newIds)}
                          />
                        </FormControl>
                      </div>
                      {selectedExamId && (
                        <FormDescription>
                          Bank selection is managed by the chosen exam schedule.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="filterType" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Filter by MCQ state</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="all">All MCQs</SelectItem>
                                    <SelectItem value="new">New MCQs only</SelectItem>
                                    <SelectItem value="due">Due MCQs only</SelectItem>
                                    <SelectItem value="failed">Review failed in last X days</SelectItem>
                                    <SelectItem value="difficulty">Filter by difficulty (FSRS only)</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    {watchedValues.filterType === 'failed' && (
                        <FormField control={form.control} name="failedDays" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Number of days</FormLabel>
                                <FormControl><Input type="number" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    )}
                </div>

                {watchedValues.filterType === 'difficulty' && (
                    <div className="p-4 border rounded-md space-y-4">
                        <div className="flex justify-between">
                            <FormLabel>Difficulty Range</FormLabel>
                            <span className="text-sm font-medium">{difficultyRange[0]} - {difficultyRange[1]}</span>
                        </div>
                        <Slider
                            defaultValue={difficultyRange}
                            min={1} max={10} step={1}
                            onValueChange={(value) => {
                                setDifficultyRange(value);
                                form.setValue('filterDifficultyMin', value[0]);
                                form.setValue('filterDifficultyMax', value[1]);
                            }}
                        />
                        <FormDescription>1 is easiest, 10 is hardest. This only includes MCQs that have been reviewed at least once.</FormDescription>
                    </div>
                )}

                <div className="space-y-4">
                    <FormLabel>Filter by tags</FormLabel>
                    <FormField control={form.control} name="tags" render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <TagEditor tags={field.value} onTagsChange={field.onChange} allTags={allTags} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="tagFilterType" render={({ field }) => (
                        <FormItem>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="any">Match any of the selected tags</SelectItem>
                                    <SelectItem value="all">Match all of the selected tags</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="order" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Order</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="random">Random</SelectItem>
                                    <SelectItem value="sequentialOldest">Oldest first (as added)</SelectItem>
                                    <SelectItem value="sequentialNewest">Newest first (as added)</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="mcqLimit" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-2">
                                <span>Number of MCQs</span>
                                <span className="text-muted-foreground font-normal">
                                    {isCalculating ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        `(${availableMcqCount ?? 0} available)`
                                    )}
                                </span>
                            </FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>

                {!isExamMode && (
                  <FormField control={form.control} name="srsEnabled" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                              <FormLabel>Enable Spaced Repetition</FormLabel>
                              <FormDescription>If disabled, your answers won't be graded or affect scheduling.</FormDescription>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                  )} />
                )}

                <div className="flex justify-end">
                    <Button type="submit" size="lg">
                      {isExamMode ? 'Start Exam' : 'Start Custom Practice'}
                    </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CustomMcqPracticeSetupPage;