import { useState, useMemo } from 'react';
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

const customStudySchema = z.object({
  cardLimit: z.coerce.number().int().min(1, "Must be at least 1 card."),
  srsEnabled: z.boolean(),
  selectedDeckIds: z.set(z.string()).min(1, "Please select at least one deck."),
  filterType: z.enum(['all', 'new', 'due', 'failed']),
  failedDays: z.coerce.number().int().min(1).optional(),
  tags: z.array(z.string()),
  tagFilterType: z.enum(['any', 'all']),
  order: z.enum(['random', 'sequentialNewest', 'sequentialOldest']),
});

type CustomStudyFormValues = z.infer<typeof customStudySchema>;

const CustomStudySetupPage = () => {
  const { decks } = useDecks();
  const allTags = useMemo(() => getAllTags(decks), [decks]);
  const navigate = useNavigate();

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
    },
  });

  const filterType = form.watch('filterType');

  const onSubmit = async (values: CustomStudyFormValues) => {
    const loadingToast = toast.loading("Building custom study session...");
    
    let filteredCards: FlashcardData[] = [];
    const selectedDecks = decks.filter(d => values.selectedDeckIds.has(d.id));
    selectedDecks.forEach(deck => {
        filteredCards.push(...getAllFlashcardsFromDeck(deck));
    });
    
    const subDecksToSearch = decks.flatMap(d => d.subDecks || []);
    const findAndAdd = (currentDecks: DeckData[]) => {
        currentDecks.forEach(deck => {
            if(values.selectedDeckIds.has(deck.id) && !selectedDecks.find(d => d.id === deck.id)) {
                filteredCards.push(...getAllFlashcardsFromDeck(deck));
            }
            if (deck.subDecks) findAndAdd(deck.subDecks);
        })
    }
    findAndAdd(subDecksToSearch);

    filteredCards = [...new Set(filteredCards)];

    if (values.tags.length > 0) {
        filteredCards = filteredCards.filter(card => {
            if (!card.tags || card.tags.length === 0) return false;
            if (values.tagFilterType === 'any') {
                return values.tags.some(tag => card.tags!.includes(tag));
            } else {
                return values.tags.every(tag => card.tags!.includes(tag));
            }
        });
    }

    const now = new Date();
    switch (values.filterType) {
        case 'new':
            filteredCards = filteredCards.filter(c => !c.srs?.fsrs || c.srs.fsrs.state === State.New);
            break;
        case 'due':
            filteredCards = filteredCards.filter(c => c.srs?.fsrs && new Date(c.srs.fsrs.due) <= now);
            break;
        case 'failed':
            const failedDays = values.failedDays || 7;
            const cutoffDate = new Date();
            cutoffDate.setDate(now.getDate() - failedDays);
            
            const allLogs = await getAllReviewLogsFromDB();
            const recentFailedCardIds = new Set<string>();
            
            allLogs.forEach(log => {
                if (new Date(log.review) >= cutoffDate && (log.rating === Rating.Again || log.rating === Rating.Hard)) {
                    recentFailedCardIds.add(log.cardId);
                }
            });
            
            filteredCards = filteredCards.filter(c => recentFailedCardIds.has(c.id));
            break;
    }

    if (filteredCards.length === 0) {
        toast.error("No cards found matching your criteria.", { id: loadingToast });
        return;
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
        state: {
            queue: finalQueue,
            srsEnabled: values.srsEnabled,
            title: 'Custom Study Session'
        }
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
                
                <FormField
                  control={form.control}
                  name="selectedDeckIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Decks to include</FormLabel>
                      <FormControl>
                        <DeckTreeSelector
                          decks={decks}
                          selectedDeckIds={field.value}
                          onSelectionChange={(newIds) => field.onChange(newIds)}
                        />
                      </FormControl>
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
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    {filterType === 'failed' && (
                        <FormField control={form.control} name="failedDays" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Number of days</FormLabel>
                                <FormControl><Input type="number" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    )}
                </div>

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
                            <FormLabel>Number of cards</FormLabel>
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