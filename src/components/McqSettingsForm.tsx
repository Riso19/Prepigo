import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSettings, SrsSettings, srsSettingsSchema } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { showSuccess } from '@/utils/toast';

const mcqSettingsSubSchema = z.object({
    mcqFsrsParameters: srsSettingsSchema.shape.mcqFsrsParameters
});

export const McqSettingsForm = ({ setDialogOpen }: { setDialogOpen: (isOpen: boolean) => void }) => {
  const { settings, setSettings } = useSettings();

  const form = useForm<z.infer<typeof mcqSettingsSubSchema>>({
    resolver: zodResolver(mcqSettingsSubSchema),
    defaultValues: {
      mcqFsrsParameters: settings.mcqFsrsParameters,
    },
  });

  const onSubmit = (data: z.infer<typeof mcqSettingsSubSchema>) => {
    setSettings({
      ...settings,
      mcqFsrsParameters: data.mcqFsrsParameters,
    });
    showSuccess("MCQ settings saved!");
    setDialogOpen(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 py-4">
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                These settings use a separate FSRS configuration optimized for multiple-choice questions. They do not affect your regular flashcards.
            </p>
            <FormField
                control={form.control}
                name="mcqFsrsParameters.request_retention"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Requested Retention</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormDescription>The probability of recalling a card you want to aim for (e.g., 0.82 for 82%).</FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="mcqFsrsParameters.maximum_interval"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Maximum Interval (days)</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormDescription>The longest possible interval between reviews.</FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>
        <div className="flex justify-end">
          <Button type="submit">Save MCQ Settings</Button>
        </div>
      </form>
    </Form>
  );
};