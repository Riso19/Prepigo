import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import Header from '@/components/Header';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSettings, SrsSettings } from '@/contexts/SettingsContext';
import { showSuccess } from '@/utils/toast';

const settingsSchema = z.object({
  initialEaseFactor: z.coerce.number().min(1.3, "Must be at least 1.3"),
  learningSteps: z.string().regex(/^\d+(,\s*\d+)*$/, "Must be comma-separated numbers"),
  minEaseFactor: z.coerce.number().min(1.0, "Must be at least 1.0"),
});

const SettingsPage = () => {
  const { settings, setSettings, isLoading } = useSettings();

  const form = useForm<SrsSettings>({
    resolver: zodResolver(settingsSchema),
    values: settings,
  });

  const onSubmit = (data: SrsSettings) => {
    setSettings(data);
    showSuccess("Settings saved successfully!");
  };

  if (isLoading) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8 bg-secondary/50 rounded-lg my-4">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Settings</CardTitle>
            <CardDescription>
              Configure your study experience and repetition algorithms.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Spaced Repetition System (SM-2)</h3>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <FormField
                    control={form.control}
                    name="initialEaseFactor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Initial Ease Factor</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} />
                        </FormControl>
                        <FormDescription>The starting ease for new cards. Default: 2.5</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="learningSteps"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Learning Steps (in days)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>Comma-separated intervals for the first few reviews. Default: "1, 6"</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minEaseFactor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Ease Factor</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} />
                        </FormControl>
                        <FormDescription>The lowest ease factor a card can have. Default: 1.3</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center justify-between">
                    <Button asChild variant="outline">
                      <Link to="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to My Decks
                      </Link>
                    </Button>
                    <Button type="submit">Save Settings</Button>
                  </div>
                </form>
              </Form>
            </div>
          </CardContent>
        </Card>
      </main>
      <MadeWithDyad />
    </div>
  );
};

export default SettingsPage;