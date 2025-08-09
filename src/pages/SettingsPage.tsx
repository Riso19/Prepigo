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
import { Checkbox } from '@/components/ui/checkbox';

const settingsSchema = z.object({
  // Daily Limits
  newCardsPerDay: z.coerce.number().int().min(0, "Must be 0 or greater"),
  maxReviewsPerDay: z.coerce.number().int().min(0, "Must be 0 or greater"),

  // New Cards
  learningSteps: z.string().min(1, "Learning steps cannot be empty."),
  graduatingInterval: z.coerce.number().int().min(1, "Must be at least 1 day"),
  easyInterval: z.coerce.number().int().min(1, "Must be at least 1 day"),
  insertionOrder: z.enum(['sequential', 'random']),

  // Lapses
  relearningSteps: z.string().min(1, "Relearning steps cannot be empty."),
  minimumInterval: z.coerce.number().int().min(1, "Must be at least 1 day"),
  leechThreshold: z.coerce.number().int().min(1, "Must be at least 1"),
  leechAction: z.enum(['tagOnly', 'suspend']),

  // Burying
  buryNewSiblings: z.boolean(),
  buryReviewSiblings: z.boolean(),
  buryInterdayLearningSiblings: z.boolean(),

  // Advanced
  maximumInterval: z.coerce.number().int().min(1, "Must be at least 1 day"),
  initialEaseFactor: z.coerce.number().min(1.3, "Must be at least 1.3"),
  easyBonus: z.coerce.number().min(1, "Must be at least 1.0"),
  intervalModifier: z.coerce.number().min(0.1, "Must be at least 0.1"),
  hardInterval: z.coerce.number().min(0.1, "Must be at least 0.1"),
  newInterval: z.coerce.number().min(0, "Must be between 0.0 and 1.0").max(1, "Must be between 0.0 and 1.0"),
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
                  Configure your study experience and repetition algorithms.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8 pt-6">
                
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
                  <CardHeader><CardTitle>New Cards</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="learningSteps" render={({ field }) => (
                      <FormItem><FormLabel>Learning steps</FormLabel><FormControl><Input {...field} /></FormControl><FormDescription>Space-separated intervals (e.g., 10m 1d 3d).</FormDescription><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="graduatingInterval" render={({ field }) => (
                      <FormItem><FormLabel>Graduating interval (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="easyInterval" render={({ field }) => (
                      <FormItem><FormLabel>Easy interval (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="insertionOrder" render={({ field }) => (
                      <FormItem><FormLabel>Insertion order</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="sequential">Sequential (oldest first)</SelectItem><SelectItem value="random">Random</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                    )} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Lapses</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="relearningSteps" render={({ field }) => (
                      <FormItem><FormLabel>Relearning steps</FormLabel><FormControl><Input {...field} /></FormControl><FormDescription>Intervals for cards you forget.</FormDescription><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="minimumInterval" render={({ field }) => (
                      <FormItem><FormLabel>Minimum interval (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="leechThreshold" render={({ field }) => (
                      <FormItem><FormLabel>Leech threshold</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Number of lapses before a card is marked as a leech.</FormDescription><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="leechAction" render={({ field }) => (
                      <FormItem><FormLabel>Leech action</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="tagOnly">Tag Only</SelectItem><SelectItem value="suspend">Suspend Card</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                    )} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Burying</CardTitle><CardDescription>Control whether sibling cards are shown on the same day.</CardDescription></CardHeader>
                  <CardContent className="space-y-6 pt-4">
                    <FormField control={form.control} name="buryNewSiblings" render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Bury new siblings</FormLabel><FormDescription>Delay other new cards from the same note until the next day.</FormDescription></div></FormItem>
                    )} />
                    <FormField control={form.control} name="buryReviewSiblings" render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Bury review siblings</FormLabel><FormDescription>Delay other review cards from the same note until the next day.</FormDescription></div></FormItem>
                    )} />
                    <FormField control={form.control} name="buryInterdayLearningSiblings" render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Bury interday learning siblings</FormLabel><FormDescription>Delay other learning cards (interval &gt; 1 day) from the same note until the next day.</FormDescription></div></FormItem>
                    )} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Advanced</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="maximumInterval" render={({ field }) => (
                      <FormItem><FormLabel>Maximum interval (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="initialEaseFactor" render={({ field }) => (
                      <FormItem><FormLabel>Starting ease</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="easyBonus" render={({ field }) => (
                      <FormItem><FormLabel>Easy bonus</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="intervalModifier" render={({ field }) => (
                      <FormItem><FormLabel>Interval modifier</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="hardInterval" render={({ field }) => (
                      <FormItem><FormLabel>Hard interval</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="newInterval" render={({ field }) => (
                      <FormItem><FormLabel>New interval</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
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