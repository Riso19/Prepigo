import { useState, useMemo } from 'react';
import { useDecks } from '@/contexts/DecksContext';
import { useExams } from '@/contexts/ExamsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DeckTreeSelector } from '@/components/DeckTreeSelector';
import { TagEditor } from '@/components/TagEditor';
import { getAllFlashcardsFromDeck, getAllTags, findDeckById } from '@/lib/deck-utils';
import { filterCardsForExam, generateSchedule } from '@/lib/exam-scheduler-utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ArrowLeft } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const createExamSchema = z.object({
  name: z.string().min(1, "Exam name is required."),
  examDate: z.date({ required_error: "Exam date is required." }),
  selectedDeckIds: z.set(z.string()).min(1, "Please select at least one deck."),
  tags: z.array(z.string()),
  filterMode: z.enum(['all', 'due']),
  studyMode: z.enum(['srs', 'cram']),
});

type CreateExamFormValues = z.infer<typeof createExamSchema>;

const CreateExamPage = () => {
  const { decks } = useDecks();
  const { setExams } = useExams();
  const { settings } = useSettings();
  const allTags = useMemo(() => getAllTags(decks), [decks]);
  const navigate = useNavigate();

  const form = useForm<CreateExamFormValues>({
    resolver: zodResolver(createExamSchema),
    defaultValues: {
      name: '',
      selectedDeckIds: new Set(),
      tags: [],
      filterMode: 'all',
      studyMode: 'srs',
    },
  });

  const onSubmit = (values: CreateExamFormValues) => {
    const loadingToast = toast.loading("Generating exam schedule...");

    try {
      const allSelectedCards = Array.from(values.selectedDeckIds).flatMap(deckId => {
        const deck = findDeckById(decks, deckId);
        return deck ? getAllFlashcardsFromDeck(deck) : [];
      });
      
      let cards = [...new Map(allSelectedCards.map(item => [item.id, item])).values()];

      if (values.tags.length > 0) {
        cards = cards.filter(card => 
          values.tags.every(tag => card.tags?.includes(tag))
        );
      }

      const filteredCards = filterCardsForExam(cards, values.filterMode, settings);

      if (filteredCards.length === 0) {
        toast.error("No cards match the selected criteria.", { id: loadingToast });
        return;
      }

      const schedule = generateSchedule(filteredCards, values.examDate, values.studyMode);

      const newExam = {
        id: `exam-${Date.now()}`,
        name: values.name,
        examDate: format(values.examDate, 'yyyy-MM-dd'),
        targetDeckIds: Array.from(values.selectedDeckIds),
        targetTags: values.tags,
        filterMode: values.filterMode,
        studyMode: values.studyMode,
        schedule: schedule,
      };

      setExams(prev => [...prev, newExam]);
      toast.success("Exam schedule created successfully!", { id: loadingToast });
      navigate('/exams');
    } catch (error) {
      console.error(error);
      toast.error("Failed to create schedule.", { id: loadingToast });
    }
  };

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl">
        <Button variant="ghost" onClick={() => navigate("/exams")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Exams
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create New Exam Schedule</CardTitle>
            <CardDescription>Plan your study sessions to be fully prepared for your exam.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Exam Name</FormLabel><FormControl><Input placeholder="e.g., Final Exam" {...field} /></FormControl><FormMessage /></FormItem>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="filterMode" render={({ field }) => (
                    <FormItem><FormLabel>Card Filter</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="all">All selected cards</SelectItem>
                          <SelectItem value="due">Due cards only</SelectItem>
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="studyMode" render={({ field }) => (
                    <FormItem><FormLabel>Study Mode</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="srs">Standard SRS</SelectItem>
                          <SelectItem value="cram">Cram Mode</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Cram mode ensures you see every card before the exam.</FormDescription>
                    <FormMessage /></FormItem>
                  )} />
                </div>

                <div className="flex justify-end">
                  <Button type="submit">Create Schedule</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateExamPage;