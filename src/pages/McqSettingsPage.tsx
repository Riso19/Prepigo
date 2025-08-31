import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSettings, srsSettingsSchema } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { showSuccess } from '@/utils/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Header from '@/components/Header';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';

const mcqSettingsSubSchema = z.object({
    scheduler: srsSettingsSchema.shape.scheduler,
    mcqFsrsParameters: srsSettingsSchema.shape.mcqFsrsParameters,
    mcqFsrs6Parameters: srsSettingsSchema.shape.mcqFsrs6Parameters,
    mcqNewCardsPerDay: srsSettingsSchema.shape.mcqNewCardsPerDay,
    mcqMaxReviewsPerDay: srsSettingsSchema.shape.mcqMaxReviewsPerDay,
    mcqDisplayOrder: srsSettingsSchema.shape.mcqDisplayOrder,
    mcqNewVsReviewOrder: srsSettingsSchema.shape.mcqNewVsReviewOrder,
    mcqReviewSortOrder: srsSettingsSchema.shape.mcqReviewSortOrder,
    mcqBurySiblings: srsSettingsSchema.shape.mcqBurySiblings,
    mcqInterleaveBanks: srsSettingsSchema.shape.mcqInterleaveBanks,
    mcqShuffleOptions: srsSettingsSchema.shape.mcqShuffleOptions,
});

const McqSettingsPage = () => {
  const { settings, setSettings } = useSettings();
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof mcqSettingsSubSchema>>({
    resolver: zodResolver(mcqSettingsSubSchema),
    defaultValues: {
      scheduler: settings.scheduler,
      mcqFsrsParameters: settings.mcqFsrsParameters,
      mcqFsrs6Parameters: settings.mcqFsrs6Parameters,
      mcqNewCardsPerDay: settings.mcqNewCardsPerDay,
      mcqMaxReviewsPerDay: settings.mcqMaxReviewsPerDay,
      mcqDisplayOrder: settings.mcqDisplayOrder,
      mcqNewVsReviewOrder: settings.mcqNewVsReviewOrder,
      mcqReviewSortOrder: settings.mcqReviewSortOrder,
      mcqBurySiblings: settings.mcqBurySiblings,
      mcqInterleaveBanks: settings.mcqInterleaveBanks,
      mcqShuffleOptions: settings.mcqShuffleOptions,
    },
  });

  const scheduler = form.watch('scheduler');

  const onSubmit = (data: z.infer<typeof mcqSettingsSubSchema>) => {
    setSettings({
      ...settings,
      scheduler: data.scheduler,
      mcqFsrsParameters: data.mcqFsrsParameters,
      mcqFsrs6Parameters: data.mcqFsrs6Parameters,
      mcqNewCardsPerDay: data.mcqNewCardsPerDay,
      mcqMaxReviewsPerDay: data.mcqMaxReviewsPerDay,
      mcqDisplayOrder: data.mcqDisplayOrder,
      mcqNewVsReviewOrder: data.mcqNewVsReviewOrder,
      mcqReviewSortOrder: data.mcqReviewSortOrder,
      mcqBurySiblings: data.mcqBurySiblings,
      mcqInterleaveBanks: data.mcqInterleaveBanks,
      mcqShuffleOptions: data.mcqShuffleOptions,
    });
    showSuccess("MCQ settings saved!");
    navigate('/question-bank');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8 bg-secondary/50 rounded-lg my-4">
        <div className="w-full max-w-4xl mx-auto">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">MCQ Spaced Repetition Settings</CardTitle>
                  <CardDescription>
                    These settings control the spaced repetition algorithm for multiple-choice questions. You can use a different scheduler for MCQs than for your regular flashcards.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 py-4">
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

                  <Card>
                      <CardHeader><CardTitle>Daily Limits for MCQs</CardTitle></CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField control={form.control} name="mcqNewCardsPerDay" render={({ field }) => (
                              <FormItem><FormLabel>New MCQs/day</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="mcqMaxReviewsPerDay" render={({ field }) => (
                              <FormItem><FormLabel>Maximum reviews/day</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                      </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>MCQ Display & Review Behavior</CardTitle></CardHeader>
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
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="mcqNewVsReviewOrder" render={({ field }) => (
                        <FormItem>
                          <FormLabel>New vs Review Ordering</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select mix" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="mix">Mix</SelectItem>
                              <SelectItem value="newFirst">New First</SelectItem>
                              <SelectItem value="reviewFirst">Review First</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="mcqReviewSortOrder" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Review Sort Order</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select review order" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="dueDate">Due Date</SelectItem>
                              <SelectItem value="overdueFirst">Overdue First</SelectItem>
                              <SelectItem value="random">Random</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
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
                      <FormField control={form.control} name="mcqInterleaveBanks" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Interleave Banks</FormLabel>
                            <FormDescription className="text-muted-foreground">Round-robin interleave across selected banks.</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="mcqShuffleOptions" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Shuffle Options</FormLabel>
                            <FormDescription className="text-muted-foreground">Randomize the order of answer options.</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )} />
                    </CardContent>
                  </Card>

                  <div className="flex justify-end">
                    <Button type="submit">Save MCQ Settings</Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </Form>
        </div>
      </main>
    </div>
  );
};

export default McqSettingsPage;