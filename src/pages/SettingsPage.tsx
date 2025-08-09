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

const settingsSchema = z.object({
  initialEaseFactor: z.coerce.number().min(1.3, "Must be at least 1.3"),
  learningSteps: z.string().regex(/^\d+(,\s*\d+)*$/, "Must be comma-separated numbers"),
  minEaseFactor: z.coerce.number().min(1.0, "Must be at least 1.0"),
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
                  <div className="flex justify-end">
                    <Button type="submit">Save SRS Settings</Button>
                  </div>
                </form>
              </Form>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Data Management</h3>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Button onClick={handleExport} variant="outline">Export Data</Button>
                <Button asChild variant="outline">
                  <Label htmlFor="import-file" className="cursor-pointer">Import Data</Label>
                </Button>
                <Input id="import-file" type="file" className="hidden" onChange={handleFileSelect} accept=".json" ref={fileInputRef} />
                <Button variant="destructive" onClick={() => setIsResetAlertOpen(true)} className="sm:ml-auto">Reset All Data</Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Export your decks to a JSON file, or import from a backup. Resetting will restore the app to its initial state.
              </p>
            </div>

            <div className="flex items-center justify-start pt-4">
              <Button asChild variant="outline">
                <Link to="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to My Decks
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <MadeWithDyad />

      <AlertDialog open={isImportAlertOpen} onOpenChange={setIsImportAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite all your current decks and flashcards. This action cannot be undone. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmImport}>Import</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isResetAlertOpen} onOpenChange={setIsResetAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your decks, flashcards, and settings. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, reset everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsPage;