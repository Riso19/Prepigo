import { useState, useMemo, useEffect } from 'react';
import { useDecks } from '@/contexts/DecksContext';
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
import { DeckTreeSelector } from '@/components/DeckTreeSelector';
import { TagEditor } from '@/components/TagEditor';
import { getAllFlashcardsFromDeck, getAllTags } from '@/lib/deck-utils';
import { getAllReviewLogsFromDB } from '@/lib/idb';
import { FlashcardData, DeckData } from '@/data/decks';
import { Rating, State } from 'ts-fsrs';
import Header from '@/components/Header';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useExams } from '@/contexts/ExamsContext';
import { format } from 'date-fns';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

const customStudySchema = z.object({
  cardLimit: z.coerce.number().int().min(1, "Must be at least 1 card."),
  srsEnabled: z.boolean(),
  selectedDeckIds: z.set(z.string()).min(1, "Please select at least one deck."),
  filterType: z.enum(['all', 'new', 'due', 'failed', 'difficulty']),
  failedDays: z.coerce.number().int().min(1).optional(),
  tags: z.array(z.string()),
  tagFilterType: z.enum(['any', 'all']),
  order: z.enum(['random', 'sequentialNewest', 'sequentialOldest']),
  filterDifficultyMin: z.number().min(1).max(10).optional(),
  filterDifficultyMax: z.number().min(1).max(10).optional(),
});

type CustomStudyFormValues = z.infer<typeof customStudySchema>;

const CustomStudySetupPage = () => {
  const { decks } = useDecks();
  const { settings } = useSettings();
  const { exams } = useExams();
  const allTags = useMemo(() => getAllTags(decks), [decks]);
  const navigate = useNavigate();
  const [availableCardCount, setAvailableCardCount] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [difficultyRange, setDifficultyRange] = useState([5, 10]);

  const form = useForm<CustomStudyFormValues>({
    resolver: zodResolver(customStudySchema),
    defaultValues: {
      cardLimit: 20,
      srsEnabled: true,
      selectedDeckIds: new Set(),
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

  useEffect(() => {
    if (selectedExamId) {
        const selectedExam = exams.find(e => e.id === selectedExamId);
        if (selectedExam) {
            form.setValue('selectedDeckIds', new Set(selectedExam.deckIds));
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
      const { selectedDeckIds, filterType, failedDays, tags, tagFilterType } = watchedValues;

      if (!selectedDeckIds || selectedDeckIds.size === 0) {
        setAvailableCardCount(0);
        setIsCalculating(false);
        return;
      }

      const getAllDecksFlat = (d: DeckData[]): DeckData[] => {
        return d.flatMap(deck => [deck, ...(deck.subDecks ? getAllDecksFlat(deck.subDecks) : [])]);
      };
      const allDecks = getAllDecksFlat(decks);

      const cardSet = new Set<FlashcardData>();
      selectedDeckIds.forEach(id => {
        const deck = allDecks.find(d => d.id === id);
        if (deck) {
          deck.flashcards.forEach(card => cardSet.add(card));
        }
      });
      let cardsToFilter = Array.from(cardSet);

      if (tags.length > 0) {
        cardsToFilter = cardsToFilter.filter(card => {
          if (!card.tags || card.tags.length === 0) return false;
          if (tagFilterType === 'any') {
            return tags.some(tag => card.tags!.includes(tag));
          } else {
            return tags.every(tag => card.tags!.includes(tag));
          }
        });
      }

      const now = new Date();
      switch (filterType) {
        case 'new':
          cardsToFilter = cardsToFilter.filter(c => {
            if (settings.scheduler === 'sm2') {
              return !c.srs?.sm2 || c.srs.sm2.state === 'new' || !c.srs.sm2.state;
            }
            const srsData = settings.scheduler === 'fsrs6' ? c.srs?.fsrs6 : c.srs?.fsrs;
            return !srsData || srsData.state === State.New;
          });
          break;
        case 'due':
          cardsToFilter = cardsToFilter.filter(c => {
            if (settings.scheduler === 'sm2') {
              return !!c.srs?.sm2 && new Date(c.srs.sm2.due) <= now;
            }
            const srsData = settings.scheduler === 'fsrs6' ? c.srs?.fsrs6 : c.srs?.fsrs;
            return !!srsData && new Date(srsData.due) <= now;
          });
          break;
        case 'failed':
          const days = failedDays || 7;
          const cutoffDate = new Date();
          cutoffDate.setDate(now.getDate() - days);
          const allLogs = await getAllReviewLogsFromDB();
          const recentFailedCardIds = new Set<string>();
          allLogs.forEach(log => {
            if (new Date(log.review) >= cutoffDate && (log.rating === Rating.Again || log.rating === Rating.Hard)) {
              recentFailedCardIds.add(log.cardId);
            }
          });
          cardsToFilter = cardsToFilter.filter(c => recentFailedCardIds.has(c.id));
          break;
        case 'difficulty':
            const min = watchedValues.filterDifficultyMin || 1;
            const max = watchedValues.filterDifficultyMax || 10;
            cardsToFilter = cardsToFilter.filter(c => {
                const srsData = settings.scheduler === 'fsrs6' ? c.srs?.fsrs6 : c.srs?.fsrs;
                if (!srsData || srsData.state === State.New) return false;
                const difficulty = srsData.difficulty;
                return difficulty >= min && difficulty <= max;
            });
            break;
      }

      setAvailableCardCount(cardsToFilter.length);
      setIsCalculating(false);
    };

    const handler = setTimeout(() => {
      calculateCount();
    }, 300);

    return () => clearTimeout(handler);
  }, [watchedValues, decks, settings]);

  const onSubmit = async (values: CustomStudyFormValues) => {
    if (availableCardCount === 0) {
        toast.error("No cards found matching your criteria.");
        return;
    }
    
    const loadingToast = toast.loading("Building custom study session...");
    
    const getAllDecksFlat = (d: DeckData[]): DeckData[] => d.flatMap(deck => [deck, ...(deck.subDecks ? getAllDecksFlat(deck.subDecks) : [])]);
    const allDecks = getAllDecksFlat(decks);
    const cardSet = new Set<FlashcardData>();
    values.selectedDeckIds.forEach(id => {
        const deck = allDecks.find(d => d.id === id);
        if (deck) deck.flashcards.forEach(card => cardSet.add(card));
    });
    let filteredCards = Array.from(cardSet);

    if (values.tags.length > 0) {
        filteredCards = filteredCards.filter(card => {
            if (!card.tags || card.tags.length === 0) return false;
            if (values.tagFilterType === 'any') return values.tags.some(tag => card.tags!.includes(tag));
            else return values.tags.every(tag => card.tags!.includes(tag));
        });
    }

    const now = new Date();
    switch (values.filterType) {
        case 'new':
            filteredCards = filteredCards.filter(c => {
                if (settings.scheduler === 'sm2') {
                    return !c.srs?.sm2 || c.srs.sm2.state === 'new' || !c.srs.sm2.state;
                }
                const srsData = settings.scheduler === 'fsrs6' ? c.srs?.fsrs6 : c.srs?.fsrs;
                return !srsData || srsData.state === State.New;
            });
            break;
        case 'due':
            filteredCards = filteredCards.filter(c => {
                if (settings.scheduler === 'sm2') {
                    return !!c.srs?.sm2 && new Date(c.srs.sm2.due) <= now;
                }
                const srsData = settings.scheduler === 'fsrs6' ? c.srs?.fsrs6 : c.srs?.fsrs;
                return !!srsData && new Date(srsData.due) <= now;
            });
            break;
        case 'failed':
            const failedDays = values.failedDays || 7;
            const cutoffDate = new Date();
            cutoffDate.setDate(now.getDate() - failedDays);
            const allLogs = await getAllReviewLogsFromDB();
            const recentFailedCardIds = new Set<string>(allLogs.filter(log => new Date(log.review) >= cutoffDate && (log.rating === Rating.Again || log.rating === Rating.Hard)).map(log => log.cardId));
            filteredCards = filteredCards.filter(c => recentFailedCardIds.has(c.id));
            break;
        case 'difficulty':
            const min = values.filterDifficultyMin || 1;
            const max = values.filterDifficultyMax || 10;
            filteredCards = filteredCards.filter(c => {
                const srsData = settings.scheduler === 'fsrs6' ? c.srs?.fsrs6 : c.srs?.fsrs;
                if (!srsData || srsData.state === State.New) return false;
                const difficulty = srsData.difficulty;
                return difficulty >= min && difficulty <= max;
            });
            break;
    }

    switch (values.order) {
        case 'random':
            filteredCards.sort(() => Math.random() - 0.5);
            break;
        case 'sequentialNewest':
            filteredCards.sort((a, b) => (b.srs?.newCardOrder || 0) - (a.srs?.newCardOrder || 0));
            break;
        case 'sequentialOldest':
            filteredCards.sort((a, b) => (a.srs?.newCardOrder || 0) - (b.srs?.newCardOrder || 0));
            break;
    }

    const finalQueue = filteredCards.slice(0, values.cardLimit);
    toast.success(`Starting session with ${finalQueue.length} cards.`, { id: loadingToast });

    navigate('/study/custom', {
        state: { queue: finalQueue, srsEnabled: values.srsEnabled, title: 'Custom Study Session' }
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Custom Study Session</CardTitle>
            <CardDescription>Create a temporary, filtered deck for focused study.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                
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
                  name="selectedDeckIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Decks to include</FormLabel>
                      <div className={cn(selectedExamId && "opacity-50 pointer-events-none")}>
                        <FormControl>
                          <DeckTreeSelector
                            decks={decks}
                            selectedDeckIds={field.value}
                            onSelectionChange={(newIds) => field.onChange(newIds)}
                          />
                        </FormControl>
                      </div>
                      {selectedExamId && (
                        <FormDescription>
                          Deck selection is managed by the chosen exam schedule.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="filterType" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Filter by card state</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="all">All cards</SelectItem>
                                    <SelectItem value="new">New cards only</SelectItem>
                                    <SelectItem value="due">Due cards only</SelectItem>
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
                        <FormDescription>1 is easiest, 10 is hardest. This only includes cards that have been reviewed at least once.</FormDescription>
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
                                    <SelectItem value="sequentialOldest">Oldest first</SelectItem>
                                    <SelectItem value="sequentialNewest">Newest first</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="cardLimit" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-2">
                                <span>Number of cards</span>
                                <span className="text-muted-foreground font-normal">
                                    {isCalculating ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        `(${availableCardCount ?? 0} available)`
                                    )}
                                </span>
                            </FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>

                <FormField control={form.control} name="srsEnabled" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <FormLabel>Enable Spaced Repetition</FormLabel>
                            <FormDescription>If disabled, your answers won't be graded or affect scheduling.</FormDescription>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                )} />

                <div className="flex justify-end">
                    <Button type="submit" size="lg">Start Custom Study</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CustomStudySetupPage;