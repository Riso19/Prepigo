import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { QuestionBankData } from '@/data/questionBanks';
import { SrsSettings, srsSettingsSchema, useSettings } from '@/contexts/SettingsContext';
import { useQuestionBanks } from '@/contexts/QuestionBankContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateQuestionBank, getEffectiveMcqSrsSettingsWithSource } from '@/lib/question-bank-utils';
import { showSuccess } from '@/utils/toast';
import { useEffect, useMemo } from 'react';

interface QuestionBankSettingsFormProps {
  bank: QuestionBankData;
}

export const QuestionBankSettingsForm = ({ bank }: QuestionBankSettingsFormProps) => {
  const { questionBanks, setQuestionBanks } = useQuestionBanks();
  const { settings: globalSettings } = useSettings();

  const { settings: effectiveSettings, sourceName } = useMemo(() => {
    return getEffectiveMcqSrsSettingsWithSource(questionBanks, bank.id, globalSettings);
  }, [questionBanks, bank.id, globalSettings]);

  const form = useForm<SrsSettings>({
    resolver: zodResolver(srsSettingsSchema),
    values: effectiveSettings,
  });

  const scheduler = form.watch('scheduler');

  useEffect(() => {
    form.reset(effectiveSettings);
  }, [effectiveSettings, form]);

  const onSubmit = (data: SrsSettings) => {
    const updatedBank = {
      ...bank,
      srsSettings: data,
    };
    setQuestionBanks(prevBanks => updateQuestionBank(prevBanks, updatedBank));
    showSuccess("Question bank settings saved!");
  };

  const handleToggleCustomSettings = (enabled: boolean) => {
    const updatedBank = {
      ...bank,
      hasCustomSettings: enabled,
      srsSettings: enabled ? effectiveSettings : undefined,
    };
    setQuestionBanks(prevBanks => updateQuestionBank(prevBanks, updatedBank));
  };

  const getSourceDescription = () => {
    if (bank.hasCustomSettings) {
      return "These are custom settings for this question bank.";
    }
    if (sourceName === 'Global') {
      return "These are the global application settings for MCQs.";
    }
    return `These settings are inherited from the "${sourceName}" bank.`;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Custom Bank Settings</CardTitle>
                <CardDescription>Override global settings for this bank and its sub-banks.</CardDescription>
              </div>
              <Switch
                checked={bank.hasCustomSettings}
                onCheckedChange={handleToggleCustomSettings}
              />
            </div>
            <p className="text-sm text-muted-foreground pt-2 italic">{getSourceDescription()}</p>
          </CardHeader>
          {bank.hasCustomSettings && (
            <CardContent className="space-y-8 pt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Spaced Repetition Algorithm</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField control={form.control} name="scheduler" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scheduler for MCQs</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="fsrs">FSRS-4.5 (Recommended)</SelectItem>
                          <SelectItem value="fsrs6">FSRS-6 (Experimental)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>SM-2 is not supported for MCQs.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              {scheduler === 'fsrs' && (
                <Card>
                  <CardHeader><CardTitle>FSRS-4.5 Parameters</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="mcqFsrsParameters.request_retention" render={({ field }) => (<FormItem><FormLabel>Requested Retention</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="mcqFsrsParameters.maximum_interval" render={({ field }) => (<FormItem><FormLabel>Maximum Interval (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </CardContent>
                </Card>
              )}

              {scheduler === 'fsrs6' && (
                <Card>
                  <CardHeader><CardTitle>FSRS-6 Parameters (Experimental)</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="mcqFsrs6Parameters.request_retention" render={({ field }) => (<FormItem><FormLabel>Requested Retention</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="mcqFsrs6Parameters.maximum_interval" render={({ field }) => (<FormItem><FormLabel>Maximum Interval (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle>Daily Limits for MCQs</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="mcqNewCardsPerDay" render={({ field }) => (<FormItem><FormLabel>New MCQs/day</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="mcqMaxReviewsPerDay" render={({ field }) => (<FormItem><FormLabel>Maximum reviews/day</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>MCQ Display & Mixing</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="mcqDisplayOrder" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Order</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select order" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="sequential">Sequential</SelectItem>
                          <SelectItem value="random">Random</SelectItem>
                          <SelectItem value="byTag">By Tag</SelectItem>
                          <SelectItem value="byDifficulty">By Difficulty</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Controls order when practicing a bank directly.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="mcqNewVsReviewOrder" render={({ field }) => (
                    <FormItem>
                      <FormLabel>New vs Review Mix</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select mix" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="mix">Mix</SelectItem>
                          <SelectItem value="newFirst">New First</SelectItem>
                          <SelectItem value="reviewFirst">Review First</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Controls mixing of new and review cards in sessions.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="mcqReviewSortOrder" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Review Sort Order</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select review order" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="dueDate">By Due Date</SelectItem>
                          <SelectItem value="overdueFirst">Overdue First</SelectItem>
                          <SelectItem value="random">Random</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>How to sort due reviews before mixing with new.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="mcqShuffleOptions" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Shuffle Answer Options</FormLabel>
                        <FormDescription className="text-muted-foreground">Randomize answer option order per question.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="mcqInterleaveBanks" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Interleave Banks</FormLabel>
                        <FormDescription className="text-muted-foreground">Round-robin interleave when studying multiple banks.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="mcqBurySiblings" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Bury Siblings</FormLabel>
                        <FormDescription className="text-muted-foreground">Avoid adjacent questions from the same bank.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button type="submit">Save Bank Settings</Button>
              </div>
            </CardContent>
          )}
        </Card>
      </form>
    </Form>
  );
};