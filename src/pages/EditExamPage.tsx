import { useMemo, useEffect } from 'react';
import { useDecks } from '@/contexts/DecksContext';
import { useExams } from '@/contexts/ExamsContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DeckTreeSelector } from '@/components/DeckTreeSelector';
import { TagEditor } from '@/components/TagEditor';
import { getAllTags } from '@/lib/deck-utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ArrowLeft } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { ExamData } from '@/data/exams';

const editExamSchema = z.object({
  name: z.string().min(1, "Exam name is required."),
  examDate: z.date({ required_error: "Exam date is required." }),
  selectedDeckIds: z.set(z.string()).min(1, "Please select at least one deck."),
  tags: z.array(z.string()),
  filterMode: z.enum(['all', 'due', 'difficulty']),
  filterDifficulty: z.array(z.number()).optional(),
});

type EditExamFormValues = z.infer<typeof editExamSchema>;

const EditExamPage = () => {
  const { examId } = useParams<{ examId: string }>();
  const { exams, setExams } = useExams();
  const { decks } = useDecks();
  const allTags = useMemo(() => getAllTags(decks), [decks]);
  const navigate = useNavigate();

  const examToEdit = useMemo(() => exams.find(e => e.id === examId), [exams, examId]);

  const form = useForm<EditExamFormValues>({
    resolver: zodResolver(editExamSchema),
  });

  const filterMode = form.watch('filterMode');

  useEffect(() => {
    if (examToEdit) {
      form.reset({
        name: examToEdit.name,
        examDate: parseISO(examToEdit.examDate),
        selectedDeckIds: new Set(examToEdit.targetDeckIds),
        tags: examToEdit.targetTags,
        filterMode: examToEdit.filterMode,
        filterDifficulty: [examToEdit.filterDifficultyMin ?? 7, examToEdit.filterDifficultyMax ?? 10],
      });
    }
  }, [examToEdit, form]);

  const onSubmit = (values: EditExamFormValues) => {
    if (!examToEdit) return;

    const loadingToast = toast.loading("Updating exam schedule...");

    try {
      const updatedExam: ExamData = {
        ...examToEdit,
        name: values.name,
        examDate: format(values.examDate, 'yyyy-MM-dd'),
        targetDeckIds: Array.from(values.selectedDeckIds),
        targetTags: values.tags,
        filterMode: values.filterMode,
        filterDifficultyMin: values.filterMode === 'difficulty' ? values.filterDifficulty?.[0] : undefined,
        filterDifficultyMax: values.filterMode === 'difficulty' ? values.filterDifficulty?.[1] : undefined,
      };

      setExams(prev => prev.map(e => e.id === examId ? updatedExam : e));
      toast.success("Exam schedule updated successfully!", { id: loadingToast });
      navigate(`/exams/${examId}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update schedule.", { id: loadingToast });
    }
  };

  if (!examToEdit) {
    return <div>Loading exam data or exam not found...</div>;
  }

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl">
        <Button variant="ghost" onClick={() => navigate(`/exams/${examId}`)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Exam
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Edit Exam Schedule</CardTitle>
            <CardDescription>Modify your study plan details.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Exam Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                
                <FormField control={form.control} name="examDate" render={({ field }) => (
                  <FormItem className="flex flex-col"><FormLabel>Exam Date</FormLabel>
                    <Popover><PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={"outline"} className={cn("w-[240px] pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date()} initialFocus />
                    </PopoverContent></Popover>
                  <FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="selectedDeckIds" render={({ field }) => (
                  <FormItem><FormLabel>Decks to Include</FormLabel>
                    <FormControl><DeckTreeSelector decks={decks} selectedDeckIds={field.value} onSelectionChange={field.onChange} /></FormControl>
                  <FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="tags" render={({ field }) => (
                  <FormItem><FormLabel>Filter by Tags (Optional)</FormLabel>
                    <FormControl><TagEditor tags={field.value} onTagsChange={field.onChange} allTags={allTags} /></FormControl>
                    <FormDescription>Only cards with ALL selected tags will be included.</FormDescription>
                  <FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="filterMode" render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Card Filter</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormItem className="flex items-center space-x-3 space-y-0 p-4 border rounded-md has-[:checked]:border-primary">
                          <FormControl><RadioGroupItem value="all" /></FormControl>
                          <FormLabel className="font-normal">All Cards</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0 p-4 border rounded-md has-[:checked]:border-primary">
                          <FormControl><RadioGroupItem value="due" /></FormControl>
                          <FormLabel className="font-normal">Due Cards Only</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0 p-4 border rounded-md has-[:checked]:border-primary">
                          <FormControl><RadioGroupItem value="difficulty" /></FormControl>
                          <FormLabel className="font-normal">By Difficulty</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {filterMode === 'difficulty' && (
                  <FormField control={form.control} name="filterDifficulty" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Difficulty Range (1=Easy, 10=Hard)</FormLabel>
                      <FormControl>
                        <Slider
                          value={field.value}
                          onValueChange={field.onChange}
                          max={10}
                          min={1}
                          step={1}
                          className="py-4"
                        />
                      </FormControl>
                      <FormDescription>
                        Selected range: {field.value?.[0]} - {field.value?.[1]}
                      </FormDescription>
                    </FormItem>
                  )} />
                )}

                <div className="flex justify-end">
                  <Button type="submit">Update Schedule</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditExamPage;