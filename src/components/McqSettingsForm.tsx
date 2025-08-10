import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSettings, SrsSettings, srsSettingsSchema } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { showSuccess } from '@/utils/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const mcqSettingsSubSchema = z.object({
    scheduler: srsSettingsSchema.shape.scheduler,
    mcqFsrsParameters: srsSettingsSchema.shape.mcqFsrsParameters,
    mcqFsrs6Parameters: srsSettingsSchema.shape.mcqFsrs6Parameters,
});

export const McqSettingsForm = ({ setDialogOpen }: { setDialogOpen: (isOpen: boolean) => void }) => {
  const { settings, setSettings } = useSettings();

  const form = useForm<z.infer<typeof mcqSettingsSubSchema>>({
    resolver: zodResolver(mcqSettingsSubSchema),
    defaultValues: {
      scheduler: settings.scheduler,
      mcqFsrsParameters: settings.mcqFsrsParameters,
      mcqFsrs6Parameters: settings.mcqFsrs6Parameters,
    },
  });

  const scheduler = form.watch('scheduler');

  const onSubmit = (data: z.infer<typeof mcqSettingsSubSchema>) => {
    setSettings({
      ...settings,
      scheduler: data.scheduler,
      mcqFsrsParameters: data.mcqFsrsParameters,
      mcqFsrs6Parameters: data.mcqFsrs6Parameters,
    });
    showSuccess("MCQ settings saved!");
    setDialogOpen(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 py-4">
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                These settings control the spaced repetition algorithm for multiple-choice questions. You can use a different scheduler for MCQs than for your regular flashcards.
            </p>
            <FormField
                control={form.control}
                name="scheduler"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Scheduler for MCQs</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="fsrs">FSRS-4.5 (Recommended)</SelectItem>
                                <SelectItem value="fsrs6">FSRS-6 (Experimental)</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        {scheduler === 'fsrs' && (
            <Card>
                <CardHeader><CardTitle>FSRS-4.5 Parameters</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <FormField control={form.control} name="mcqFsrsParameters.request_retention" render={({ field }) => (
                        <FormItem><FormLabel>Requested Retention</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="mcqFsrsParameters.maximum_interval" render={({ field }) => (
                        <FormItem><FormLabel>Maximum Interval (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </CardContent>
            </Card>
        )}

        {scheduler === 'fsrs6' && (
            <Card>
                <CardHeader><CardTitle>FSRS-6 Parameters (Experimental)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <FormField control={form.control} name="mcqFsrs6Parameters.request_retention" render={({ field }) => (
                        <FormItem><FormLabel>Requested Retention</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="mcqFsrs6Parameters.maximum_interval" render={({ field }) => (
                        <FormItem><FormLabel>Maximum Interval (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </CardContent>
            </Card>
        )}

        <div className="flex justify-end">
          <Button type="submit">Save MCQ Settings</Button>
        </div>
      </form>
    </Form>
  );
};