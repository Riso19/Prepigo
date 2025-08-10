import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useDecks } from '@/contexts/DecksContext';
import { useExams } from '@/contexts/ExamsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { ExamData, examDataSchema } from '@/data/exams';
import { getAllTags } from '@/lib/deck-utils';
import { getCardsForExam } from '@/lib/exam-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { DeckTreeSelector } from '@/components/DeckTreeSelector';
import { TagEditor } from '@/components/TagEditor';
import Header from '@/components/Header';
import { cn } from '@/lib/utils';
import { CalendarIcon, ArrowLeft } from 'lucide-react';
import { format, startOfToday } from 'date-fns';
import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EditExamPage = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { exams, updateExam } = useExams();
  const { decks } = useDecks();
  const { settings } = useSettings();
  const allTags = useMemo(() => getAllTags(decks), [decks]);
  
  const exam = useMemo(() => exams.find(e => e.id === examId), [exams, examId]);

  const [difficultyRange, setDifficultyRange] = useState([exam?.filterDifficultyMin || 5, exam?.filterDifficultyMax || 10]);

  const form = useForm<ExamData>({
    resolver: zodResolver(examDataSchema),
    defaultValues: exam,
  });

  useEffect(() => {
    if (exam) {
      form.reset({
        ...exam,
        deckIds: Array.isArray(exam.deckIds) ? exam.deckIds : [],
      });
      setDifficultyRange([exam.filterDifficultyMin || 5, exam.filterDifficultyMax || 10]);
    }
  }, [exam, form]);

  const watchedValues = form.watch();
  const cardsInScope = useMemo(() => {
    const examData = { ...watchedValues, deckIds: Array.from(watchedValues.deckIds || []) };
    return getCardsForExam(examData as ExamData, decks, settings);
  }, [watchedValues, decks, settings]);

  const onSubmit = (data: ExamData) => {
    if (cardsInScope.length === 0) {
      toast.error("No cards match the selected filters. Please adjust the scope.");
      return;
    }
    const finalData = { ...data, deckIds: Array.from(data.deckIds) };
    updateExam(finalData);
    toast.success(`Exam "${data.name}" updated!`);
    navigate('/exams');
  };

  if (!exam) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Header />
        <main className="flex-grow container mx-auto p-4 md:p-8 text-center">
          <h2 className="text-2xl font-bold">Exam not found</h2>
          <Button onClick={() => navigate('/exams')} className="mt-4">Back to Exams</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <div className="w-full max-w-3xl mx-auto">
          <Button variant="ghost" onClick={() => navigate('/exams')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Exams
          </Button>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Edit Exam</CardTitle>
              <CardDescription>Update your study plan for this exam.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Exam Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Exam Date</FormLabel>
                      <Popover><PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className={cn("w-[240px] pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={(date) => field.onChange(date?.toISOString())} disabled={(date) => date < startOfToday()} />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="deckIds" render={({ field }) => (
                    <FormItem><FormLabel>Decks</FormLabel><FormControl><DeckTreeSelector decks={decks} selectedDeckIds={new Set(field.value)} onSelectionChange={(ids) => field.onChange(Array.from(ids))} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="space-y-4"><FormLabel>Tags</FormLabel>
                    <FormField control={form.control} name="tags" render={({ field }) => (<FormItem><FormControl><TagEditor tags={field.value} onTagsChange={field.onChange} allTags={allTags} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="tagFilterType" render={({ field }) => (<FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="any">Match any selected tag</SelectItem><SelectItem value="all">Match all selected tags</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                  </div>
                  <FormField control={form.control} name="filterMode" render={({ field }) => (
                    <FormItem className="space-y-3"><FormLabel>Card Filters</FormLabel>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                          <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="all" /></FormControl><FormLabel className="font-normal">All cards in scope</FormLabel></FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="due" /></FormControl><FormLabel className="font-normal">Due cards only</FormLabel></FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="difficulty" /></FormControl><FormLabel className="font-normal">Filter by difficulty (FSRS only)</FormLabel></FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {watchedValues.filterMode === 'difficulty' && (
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
                      <FormDescription>1 is easiest, 10 is hardest. This only includes cards that have been reviewed at least once.</FormDescription>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-4 border-t">
                    <div className="text-lg font-bold">
                      Total Cards in Plan: {cardsInScope.length}
                    </div>
                    <Button type="submit" size="lg">Update Exam</Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default EditExamPage;