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