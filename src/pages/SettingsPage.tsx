import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Header from '@/components/Header';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSettings, SrsSettings, clearSettingsDB } from '@/contexts/SettingsContext';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Separator } from '@/components/ui/separator';
import { useRef, useState } from 'react';
import { useDecks } from '@/contexts/DecksContext';
import { DeckData, decksSchema } from '@/data/decks';
import { clearDecksDB } from '@/lib/idb';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const fsrsParametersSchema = z.object({
    request_retention: z.coerce.number().min(0.7, "Must be at least 0.7").max(0.99, "Must be less than 1.0"),
    maximum_interval: z.coerce.number().int().min(1, "Must be at least 1 day"),
    w: z.array(z.number()),
});

const settingsSchema = z.object({
  scheduler: z.enum(['fsrs', 'sm2']),
  fsrsParameters: fsrsParametersSchema,
  sm2InitialEasinessFactor: z.coerce.number().min(1.3, "Must be at least 1.3"),
  sm2MinEasinessFactor: z.coerce.number().min(1.3, "Must be at least 1.3"),
  sm2FirstInterval: z.coerce.number().int().min(1, "Must be at least 1 day"),
  sm2SecondInterval: z.coerce.number().int().min(1, "Must be at least 1 day"),
  learningSteps: z.string().regex(/^(\d+\s*)*\d+$/, "Must be space-separated numbers"),
  relearningSteps: z.string().regex(/^(\d+\s*)*\d+$/, "Must be space-separated numbers"),
  leechThreshold: z.coerce.number().int().min(1, "Must be at least 1"),
  leechAction: z.enum(['tag', 'suspend']),
  newCardsPerDay: z.coerce.number().int().min(0, "Must be 0 or greater"),
  maxReviewsPerDay: z.coerce.number().int().min(0, "Must be 0 or greater"),
  newCardGatherOrder: z.enum(['deck', 'ascending', 'descending', 'randomNotes', 'randomCards']),
  newCardSortOrder: z.enum(['gathered', 'typeThenGathered', 'typeThenRandom', 'randomNote', 'random']),
  newReviewOrder: z.enum(['mix', 'after', 'before']),
  interdayLearningReviewOrder: z.enum(['mix', 'after', 'before']),
  reviewSortOrder: z.enum(['dueDateRandom', 'dueDateDeck', 'overdue']),
  buryNewSiblings: z.boolean(),
  buryReviewSiblings: z.boolean(),
});

const SettingsPage = () => {
  const { settings, setSettings, isLoading } = useSettings();
  const { decks, setDecks } = useDecks();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isResetAlertOpen, setIsResetAlertOpen] = useState(false);
  const [isImportAlertOpen, setIsImportAlertOpen] = useState(false);
  const [importedDecks, setImportedDecks] = useState<DeckData[] | null>(null);

  const form = useForm<SrsSettings>({
    resolver: zodResolver(settingsSchema),
    values: settings,
    defaultValues: settings,
  });

  const scheduler = form.watch('scheduler');

  const onSubmit = (data: SrsSettings) => {
    setSettings(data);
    showSuccess("Settings saved successfully!");
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(decks, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prepigo_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showSuccess("Data exported successfully!");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const content = event.target?.result;
            const parsedData = JSON.parse(content as string);
            const validation = decksSchema.safeParse(parsedData);
            if (!validation.success) {
                console.error(validation.error);
                showError("Invalid file format. Please select a valid backup file.");
                return;
            }
            setImportedDecks(validation.data);
            setIsImportAlertOpen(true);
        } catch (error) {
            showError("Failed to read or parse the file.");
        } finally {
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (importedDecks) {
        setDecks(importedDecks);
        showSuccess("Data imported successfully! Your decks have been replaced.");
        setIsImportAlertOpen(false);
        setImportedDecks(null);
    }
  };

  const handleReset = async () => {
    setIsResetAlertOpen(false);
    const loadingToast = showLoading("Resetting all data...");
    try {
        await clearDecksDB();
        await clearSettingsDB();
        dismissToast(loadingToast);
        showSuccess("All data has been reset. The app will now reload.");
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch (error) {
        dismissToast(loadingToast);
        showError("Failed to reset data.");
    }
  };

  if (isLoading) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8 bg-secondary/50 rounded-lg my-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card className="w-full max-w-4xl mx-auto">
              <CardHeader>
                <CardTitle className="text-2xl">Settings</CardTitle>
                <CardDescription>
                  Configure your study experience.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8 pt-6">
                
                <Card>
                  <CardHeader>
                    <CardTitle>Spaced Repetition Algorithm</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="scheduler"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scheduler</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a scheduler" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="fsrs">FSRS (Recommended)</SelectItem>
                              <SelectItem value="sm2">SM-2 (Legacy)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            FSRS is a modern, evidence-based algorithm. SM-2 is a classic, simpler alternative.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {scheduler === 'fsrs' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>FSRS Parameters</CardTitle>
                      <CardDescription>
                        These settings only apply if FSRS is selected as the scheduler. It's recommended to keep the defaults unless you know what you're doing.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={form.control} name="fsrsParameters.request_retention" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Requested Retention</FormLabel>
                          <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                          <FormDescription>The probability of recalling a card you want to aim for.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="fsrsParameters.maximum_interval" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Interval (days)</FormLabel>
                          <FormControl><Input type="number" {...field} /></FormControl>
                          <FormDescription>The longest possible interval between reviews.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </CardContent>
                  </Card>
                )}

                {scheduler === 'sm2' && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>SM-2: New Cards</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="learningSteps" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Learning Steps (minutes)</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormDescription>Space-separated list of intervals.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>SM-2: Lapses</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="relearningSteps" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Relearning Steps (minutes)</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormDescription>Steps for cards you forget.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="leechThreshold" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Leech Threshold</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormDescription>Number of lapses to mark as leech.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="leechAction" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Leech Action</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="tag">Tag Only</SelectItem>
                                <SelectItem value="suspend">Suspend Card</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>Action when a card becomes a leech.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </CardContent>
                    </Card>
                  </>
                )}

                <Card>
                  <CardHeader><CardTitle>Daily Limits</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="newCardsPerDay" render={({ field }) => (
                      <FormItem><FormLabel>New cards/day</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="maxReviewsPerDay" render={({ field }) => (
                      <FormItem><FormLabel>Maximum reviews/day</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Display & Burying</CardTitle>
                    <CardDescription>Control how cards are ordered and hidden during study.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <FormField control={form.control} name="reviewSortOrder" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Review sort order</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="dueDateRandom">Due date, then random</SelectItem>
                            <SelectItem value="dueDateDeck">Due date, then deck</SelectItem>
                            <SelectItem value="overdue">Relative overdueness</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>The order review cards are shown in.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="buryNewSiblings" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Bury new siblings</FormLabel>
                            <FormDescription>Hide other new cards from the same note until the next day.</FormDescription>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="buryReviewSiblings" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Bury review siblings</FormLabel>
                            <FormDescription>Hide other review cards from the same note until the next day.</FormDescription>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button type="submit" size="lg">Save All Settings</Button>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Data Management</h3>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <Button onClick={handleExport} variant="outline" type="button">Export Data</Button>
                    <Button asChild variant="outline" type="button"><Label htmlFor="import-file" className="cursor-pointer">Import Data</Label></Button>
                    <Input id="import-file" type="file" className="hidden" onChange={handleFileSelect} accept=".json" ref={fileInputRef} />
                    <Button variant="destructive" onClick={() => setIsResetAlertOpen(true)} className="sm:ml-auto" type="button">Reset All Data</Button>
                  </div>
                  <p className="text-sm text-muted-foreground">Export your decks, or import from a backup. Resetting restores the app to its initial state.</p>
                </div>

                <div className="flex items-center justify-start pt-4">
                  <Button asChild variant="outline" type="button"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Back to My Decks</Link></Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </main>
      <MadeWithDyad />

      <AlertDialog open={isImportAlertOpen} onOpenChange={setIsImportAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Import Data?</AlertDialogTitle><AlertDialogDescription>This will overwrite all your current decks and flashcards. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmImport}>Import</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isResetAlertOpen} onOpenChange={setIsResetAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete all your decks, flashcards, and settings. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, reset everything</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsPage;