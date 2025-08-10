import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DeckData } from '@/data/decks';
import { SrsSettings, srsSettingsSchema, useSettings } from '@/contexts/SettingsContext';
import { useDecks } from '@/contexts/DecksContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateDeck } from '@/lib/deck-utils';
import { showSuccess } from '@/utils/toast';
import { useEffect } from 'react';

interface DeckSettingsFormProps {
  deck: DeckData;
}

export const DeckSettingsForm = ({ deck }: DeckSettingsFormProps) => {
  const { setDecks } = useDecks();
  const { settings: globalSettings } = useSettings();

  const form = useForm<SrsSettings>({
    resolver: zodResolver(srsSettingsSchema),
    values: deck.srsSettings ?? globalSettings,
  });

  const scheduler = form.watch('scheduler');

  useEffect(() => {
    form.reset(deck.srsSettings ?? globalSettings);
  }, [deck, globalSettings, form]);

  const onSubmit = (data: SrsSettings) => {
    const updatedDeck = {
      ...deck,
      srsSettings: data,
    };
    setDecks(prevDecks => updateDeck(prevDecks, updatedDeck));
    showSuccess("Deck settings saved!");
  };

  const handleToggleCustomSettings = (enabled: boolean) => {
    const updatedDeck = {
      ...deck,
      hasCustomSettings: enabled,
      srsSettings: enabled ? (deck.srsSettings ?? globalSettings) : undefined,
    };
    setDecks(prevDecks => updateDeck(prevDecks, updatedDeck));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Custom Deck Settings</CardTitle>
                <CardDescription>Override global settings for this deck and its sub-decks.</CardDescription>
              </div>
              <Switch
                checked={deck.hasCustomSettings}
                onCheckedChange={handleToggleCustomSettings}
              />
            </div>
          </CardHeader>
          {deck.hasCustomSettings && (
            <CardContent className="space-y-8 pt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Spaced Repetition Algorithm</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField control={form.control} name="scheduler" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scheduler</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="fsrs">FSRS (Recommended)</SelectItem>
                          <SelectItem value="sm2">SM-2 (Legacy)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              {scheduler === 'fsrs' && (
                <Card>
                  <CardHeader><CardTitle>FSRS Parameters</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="fsrsParameters.request_retention" render={({ field }) => (<FormItem><FormLabel>Requested Retention</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="fsrsParameters.maximum_interval" render={({ field }) => (<FormItem><FormLabel>Maximum Interval (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </CardContent>
                </Card>
              )}

              {scheduler === 'sm2' && (
                <>
                  <Card><CardHeader><CardTitle>SM-2: New Cards</CardTitle></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6"><FormField control={form.control} name="learningSteps" render={({ field }) => (<FormItem><FormLabel>Learning Steps</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="sm2GraduatingInterval" render={({ field }) => (<FormItem><FormLabel>Graduating Interval (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="sm2EasyInterval" render={({ field }) => (<FormItem><FormLabel>Easy Interval (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} /></CardContent></Card>
                  <Card><CardHeader><CardTitle>SM-2: Reviews</CardTitle></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6"><FormField control={form.control} name="sm2StartingEase" render={({ field }) => (<FormItem><FormLabel>Starting Ease</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="sm2EasyBonus" render={({ field }) => (<FormItem><FormLabel>Easy Bonus</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="sm2IntervalModifier" render={({ field }) => (<FormItem><FormLabel>Interval Modifier</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="sm2HardIntervalMultiplier" render={({ field }) => (<FormItem><FormLabel>Hard Interval Multiplier</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="sm2MaximumInterval" render={({ field }) => (<FormItem><FormLabel>Maximum Interval (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} /></CardContent></Card>
                  <Card><CardHeader><CardTitle>SM-2: Lapses</CardTitle></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6"><FormField control={form.control} name="relearningSteps" render={({ field }) => (<FormItem><FormLabel>Relearning Steps</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="sm2LapsedIntervalMultiplier" render={({ field }) => (<FormItem><FormLabel>New Interval Multiplier</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="sm2MinimumInterval" render={({ field }) => (<FormItem><FormLabel>Minimum Interval (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="leechThreshold" render={({ field }) => (<FormItem><FormLabel>Leech Threshold</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="leechAction" render={({ field }) => (<FormItem><FormLabel>Leech Action</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="tag">Tag Only</SelectItem><SelectItem value="suspend">Suspend Card</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} /></CardContent></Card>
                </>
              )}

              <Card><CardHeader><CardTitle>Daily Limits</CardTitle></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6"><FormField control={form.control} name="newCardsPerDay" render={({ field }) => (<FormItem><FormLabel>New cards/day</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={form.control} name="maxReviewsPerDay" render={({ field }) => (<FormItem><FormLabel>Maximum reviews/day</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} /></CardContent></Card>
              <Card><CardHeader><CardTitle>Display Order</CardTitle></CardHeader><CardContent className="space-y-6"><FormField control={form.control} name="newCardInsertionOrder" render={({ field }) => (<FormItem><FormLabel>New card insertion order</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="sequential">Sequential</SelectItem><SelectItem value="random">Random</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} /><FormField control={form.control} name="newReviewOrder" render={({ field }) => (<FormItem><FormLabel>New/review order</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="mix">Mix with reviews</SelectItem><SelectItem value="after">Show after reviews</SelectItem><SelectItem value="before">Show before reviews</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} /></CardContent></Card>
              <Card><CardHeader><CardTitle>Burying</CardTitle></CardHeader><CardContent className="space-y-4"><FormField control={form.control} name="buryNewSiblings" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Bury new siblings</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} /><FormField control={form.control} name="buryReviewSiblings" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Bury review siblings</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} /></CardContent></Card>

              <div className="flex justify-end">
                <Button type="submit">Save Deck Settings</Button>
              </div>
            </CardContent>
          )}
        </Card>
      </form>
    </Form>
  );
};