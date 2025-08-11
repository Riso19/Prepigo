import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Header from '@/components/Header';
import { useSettings, SrsSettings, clearSettingsDB, srsSettingsSchema } from '@/contexts/SettingsContext';
import { showSuccess, showError } from '@/utils/toast';
import { Separator } from '@/components/ui/separator';
import { useRef, useState, useEffect } from 'react';
import { useDecks } from '@/contexts/DecksContext';
import { DeckData, decksSchema, FlashcardData } from '@/data/decks';
import { clearDecksDB, getReviewLogsForCard, saveMediaToDB, clearMediaDB, clearQuestionBanksDB, clearMcqReviewLogsDB, getMediaFromDB, saveSingleMediaToDB, getReviewLogsForMcq } from '@/lib/idb';
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
import { updateFlashcard, mergeDecks } from '@/lib/deck-utils';
import { getAllFlashcardsFromDeck } from '@/lib/card-utils';
import { fsrs, createEmptyCard, generatorParameters, Card as FsrsCard, Rating } from 'ts-fsrs';
import { fsrs6, Card as Fsrs6Card, generatorParameters as fsrs6GeneratorParameters } from '@/lib/fsrs6';
import { toast } from 'sonner';
import { importAnkiFile } from '@/lib/anki-importer';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { importAnkiTxtFile } from '@/lib/anki-txt-importer';
import { useQuestionBanks } from '@/contexts/QuestionBankContext';
import { QuestionBankData, questionBanksSchema } from '@/data/questionBanks';
import { mergeQuestionBanks, updateMcq, collectMediaFilenamesFromMcqs, addMcqToBank } from '@/lib/question-bank-utils';
import { getAllMcqsFromBank } from '@/lib/question-bank-utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import JSZip from 'jszip';
import { importHtmlMcqs } from '@/lib/html-mcq-importer';

const parseSteps = (steps: string): number[] => {
  return steps.trim().split(/\s+/).filter(s => s).map(stepStr => {
    const value = parseFloat(stepStr);
    if (isNaN(value)) return 1;
    if (stepStr.endsWith('d')) return value * 24 * 60;
    if (stepStr.endsWith('h')) return value * 60;
    if (stepStr.endsWith('s')) return Math.max(1, value / 60);
    return value;
  });
};

const SettingsPage = () => {
  const { settings, setSettings, isLoading } = useSettings();
  const { decks, setDecks } = useDecks();
  const { questionBanks, setQuestionBanks } = useQuestionBanks();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mcqFileInputRef = useRef<HTMLInputElement>(null);
  const htmlFileInputRef = useRef<HTMLInputElement>(null);

  const [isResetAlertOpen, setIsResetAlertOpen] = useState(false);
  
  const [isImportAlertOpen, setIsImportAlertOpen] = useState(false);
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const [includeScheduling, setIncludeScheduling] = useState(true);
  const [replaceOnImport, setReplaceOnImport] = useState(false);
  
  const [isMcqImportAlertOpen, setIsMcqImportAlertOpen] = useState(false);
  const [fileToImportMcq, setFileToImportMcq] = useState<File | null>(null);
  const [replaceOnMcqImport, setReplaceOnMcqImport] = useState(false);

  const [isHtmlImportAlertOpen, setIsHtmlImportAlertOpen] = useState(false);
  const [fileToImportHtml, setFileToImportHtml] = useState<File | null>(null);
  const [targetBankId, setTargetBankId] = useState<string>('');
  const [flatBanks, setFlatBanks] = useState<{ id: string; name: string }[]>([]);

  const [rescheduleOnSave, setRescheduleOnSave] = useState(false);

  const form = useForm<SrsSettings>({
    resolver: zodResolver(srsSettingsSchema),
    values: settings,
    defaultValues: settings,
  });

  const scheduler = form.watch('scheduler');

  useEffect(() => {
    const flattenBanks = (banksToFlatten: QuestionBankData[], level = 0): { id: string; name: string }[] => {
        let result: { id: string; name: string }[] = [];
        for (const bank of banksToFlatten) {
            result.push({ id: bank.id, name: '—'.repeat(level) + (level > 0 ? ' ' : '') + bank.name });
            if (bank.subBanks) {
                result = result.concat(flattenBanks(bank.subBanks, level + 1));
            }
        }
        return result;
    };
    setFlatBanks(flattenBanks(questionBanks));
  }, [questionBanks]);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const base64ToBlob = (base64: string): Blob => {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  };

  const onSubmit = async (data: SrsSettings) => {
    const oldScheduler = settings.scheduler;
    const newScheduler = data.scheduler;
    const schedulerChanged = oldScheduler !== newScheduler;

    if (data.newCardInsertionOrder !== settings.newCardInsertionOrder) {
        const loadingToast = toast.loading("Updating new card order...");
        const updateOrderRecursive = (decksToUpdate: DeckData[]): DeckData[] => {
            return decksToUpdate.map(deck => {
                const updatedFlashcards = deck.flashcards.map(fc => {
                    const isNew = !fc.srs?.sm2 || fc.srs.sm2.state === 'new';
                    if (isNew) {
                        const newOrder = data.newCardInsertionOrder === 'sequential' 
                            ? Date.now() + Math.random()
                            : Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
                        return { ...fc, srs: { ...fc.srs, newCardOrder: newOrder } };
                    }
                    return fc;
                });
                const updatedSubDecks = deck.subDecks ? updateOrderRecursive(deck.subDecks) : [];
                return { ...deck, flashcards: updatedFlashcards, subDecks: updatedSubDecks };
            });
        };
        setDecks(prevDecks => updateOrderRecursive(prevDecks));
        toast.success("New card order updated.", { id: loadingToast });
    }

    setSettings(data);
    showSuccess("Settings saved successfully!");

    if (rescheduleOnSave || schedulerChanged) {
      const toastId = toast.loading(schedulerChanged ? "Scheduler changed, starting full reschedule..." : "Starting reschedule...");
      try {
        await new Promise(resolve => setTimeout(resolve, 50));

        // Reschedule Flashcards
        if (newScheduler === 'fsrs' || newScheduler === 'fsrs6') {
          const allFlashcards: FlashcardData[] = decks.flatMap(deck => getAllFlashcardsFromDeck(deck));
          const totalCards = allFlashcards.length;
          const fsrsInstance = newScheduler === 'fsrs6' 
            ? fsrs6(fsrs6GeneratorParameters(data.fsrs6Parameters), { learning: parseSteps(data.learningSteps), relearning: parseSteps(data.relearningSteps) })
            : fsrs(generatorParameters(data.fsrsParameters));
          
          let currentDecks = decks;
          let processedCount = 0;

          for (const card of allFlashcards) {
            processedCount++;
            const reviewLogs = await getReviewLogsForCard(card.id);
            if (reviewLogs.length > 0) {
              reviewLogs.sort((a, b) => new Date(a.review).getTime() - new Date(b.review).getTime());
              let fsrsCard: FsrsCard | Fsrs6Card = createEmptyCard(new Date(reviewLogs[0].review));
              for (const log of reviewLogs) {
                const rating = log.rating as Rating;
                const schedulingResult = fsrsInstance.repeat(fsrsCard, new Date(log.review));
                fsrsCard = schedulingResult[rating].card;
              }
              const updatedSrsData = { ...fsrsCard, due: fsrsCard.due.toISOString(), last_review: fsrsCard.last_review?.toISOString() };
              const updatedCard: FlashcardData = {
                ...card,
                srs: { ...card.srs, ...(newScheduler === 'fsrs6' ? { fsrs6: updatedSrsData } : { fsrs: updatedSrsData }) }
              };
              currentDecks = updateFlashcard(currentDecks, updatedCard);
            }
            if (processedCount % 10 === 0 || processedCount === totalCards) {
              toast.loading(`Rescheduling flashcards... (${processedCount}/${totalCards})`, { id: toastId });
            }
          }
          setDecks(currentDecks);
        }

        // Reschedule MCQs
        const mcqScheduler = newScheduler === 'sm2' ? 'fsrs' : newScheduler;
        const allMcqs = questionBanks.flatMap(getAllMcqsFromBank);
        const totalMcqs = allMcqs.length;
        const mcqFsrsInstance = mcqScheduler === 'fsrs6'
            ? fsrs6(fsrs6GeneratorParameters(data.mcqFsrs6Parameters), { learning: parseSteps(data.learningSteps), relearning: parseSteps(data.relearningSteps) })
            : fsrs(data.mcqFsrsParameters);
        
        let currentQuestionBanks = questionBanks;
        let processedMcqs = 0;

        for (const mcq of allMcqs) {
            processedMcqs++;
            const reviewLogs = await getReviewLogsForMcq(mcq.id);
            if (reviewLogs.length > 0) {
                reviewLogs.sort((a, b) => new Date(a.review).getTime() - new Date(b.review).getTime());
                let fsrsCard: FsrsCard | Fsrs6Card = createEmptyCard(new Date(reviewLogs[0].review));
                for (const log of reviewLogs) {
                    const rating = log.rating as Rating;
                    const schedulingResult = mcqFsrsInstance.repeat(fsrsCard, new Date(log.review));
                    fsrsCard = schedulingResult[rating].card;
                }
                const updatedSrsData = { ...fsrsCard, due: fsrsCard.due.toISOString(), last_review: fsrsCard.last_review?.toISOString() };
                const updatedMcq = {
                    ...mcq,
                    srs: { ...mcq.srs, ...(mcqScheduler === 'fsrs6' ? { fsrs6: updatedSrsData } : { fsrs: updatedSrsData }) }
                };
                currentQuestionBanks = updateMcq(currentQuestionBanks, updatedMcq);
            }
            if (processedMcqs % 10 === 0 || processedMcqs === totalMcqs) {
                toast.loading(`Rescheduling MCQs... (${processedMcqs}/${totalMcqs})`, { id: toastId });
            }
        }
        setQuestionBanks(currentQuestionBanks);

        toast.success(`Rescheduling complete!`, { id: toastId });
      } catch (error) {
        console.error("Failed to reschedule cards:", error);
        toast.error("An error occurred during rescheduling.", { id: toastId });
      }
    }
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

    if (!file.name.endsWith('.json') && !file.name.endsWith('.apkg') && !file.name.endsWith('.anki2') && !file.name.endsWith('.anki21') && !file.name.endsWith('.txt')) {
      showError("Unsupported file type. Please select a .json, .apkg, .anki, or .txt file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFileToImport(file);
    setIsImportAlertOpen(true);
  };

  const confirmImport = async () => {
    if (!fileToImport) return;
    setIsImportAlertOpen(false);

    const toastId = toast.loading("Starting import...");
    const onProgress = (progress: { message: string; value: number }) => {
        toast.loading(
            <div className="flex flex-col gap-2">
                <p>{progress.message}</p>
                <Progress value={progress.value} className="w-full" />
            </div>,
            { id: toastId }
        );
    };

    try {
      let importedDecks: DeckData[] | null = null;
      let importedMedia: Map<string, Blob> | null = null;
      
      const fileName = fileToImport.name.toLowerCase();

      if (fileName.endsWith('.txt')) {
        const result = await importAnkiTxtFile(fileToImport, onProgress);
        importedDecks = result.decks;
        importedMedia = result.media;
      } else if (fileName.endsWith('.apkg') || fileName.endsWith('.anki2') || fileName.endsWith('.anki21')) {
        const result = await importAnkiFile(fileToImport, includeScheduling, onProgress);
        importedDecks = result.decks;
        importedMedia = result.media;
      } else if (fileName.endsWith('.json')) {
        onProgress({ message: 'Reading backup file...', value: 10 });
        const content = await fileToImport.text();
        let parsedData;
        try {
          parsedData = JSON.parse(content);
        } catch (jsonError) {
          throw new Error(`Invalid JSON format. Parser error: ${(jsonError as Error).message}`);
        }
        
        const validation = decksSchema.safeParse(parsedData);
        if (!validation.success) {
          const errorDetails = validation.error.flatten().formErrors.join(', ');
          console.error("JSON validation failed:", validation.error.flatten());
          throw new Error(`Backup file has incorrect data structure. Details: ${errorDetails}`);
        }
        importedDecks = validation.data;
        onProgress({ message: 'Backup file read successfully!', value: 100 });
      } else {
        throw new Error("Unsupported file type. Please select a .json, .apkg, .anki, or .txt file.");
      }

      if (importedDecks) {
        onProgress({ message: 'Saving decks to database...', value: 98 });
        if (replaceOnImport) {
          setDecks(importedDecks);
        } else {
          setDecks(prevDecks => mergeDecks(prevDecks, importedDecks!));
        }
        if (importedMedia && importedMedia.size > 0) {
            await saveMediaToDB(importedMedia);
        }
        toast.success("Data imported successfully!", { id: toastId });
      } else {
        throw new Error("File processed, but no valid decks were found to import.");
      }
    } catch (error) {
      const err = error as Error;
      console.error("Import Error:", err);
      toast.error(`Import failed: ${err.message}`, { id: toastId, duration: 15000 });
    } finally {
      setFileToImport(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setReplaceOnImport(false);
    }
  };

  const handleExportMcqs = async () => {
    const toastId = toast.loading("Preparing MCQ export...");
    try {
      const zip = new JSZip();

      const metadata = {
        exportDate: new Date().toISOString(),
        appName: 'Prepigo',
        appVersion: '1.0.0',
        format: 'zip-v1'
      };

      const mediaFilenames = collectMediaFilenamesFromMcqs(questionBanks);

      const exportData = { metadata, questionBanks };
      zip.file("data.json", JSON.stringify(exportData, null, 2));

      if (mediaFilenames.size > 0) {
        const mediaFolder = zip.folder("media");
        if (mediaFolder) {
          let processed = 0;
          for (const filename of mediaFilenames) {
            const blob = await getMediaFromDB(filename);
            if (blob) {
              mediaFolder.file(filename, blob);
            }
            processed++;
            toast.loading(`Packaging media... (${processed}/${mediaFilenames.size})`, { id: toastId });
          }
        }
      }

      toast.loading("Generating download...", { id: toastId });
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `prepigo_mcq_backup_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      toast.success("MCQ data exported successfully!", { id: toastId });
    } catch (error) {
      console.error("Export failed", error);
      toast.error("Failed to export MCQ data.", { id: toastId });
    }
  };

  const handleMcqFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json') && !file.name.endsWith('.zip')) {
      showError("Unsupported file type. Please select a .json or .zip file for MCQs.");
      if (mcqFileInputRef.current) mcqFileInputRef.current.value = "";
      return;
    }

    setFileToImportMcq(file);
    setIsMcqImportAlertOpen(true);
  };

  const confirmMcqImport = async () => {
    if (!fileToImportMcq) return;
    setIsMcqImportAlertOpen(false);

    const toastId = toast.loading("Importing MCQs...");
    try {
        let importedBanks: QuestionBankData[];
        const fileName = fileToImportMcq.name.toLowerCase();

        if (fileName.endsWith('.zip')) {
            toast.loading("Unzipping package...", { id: toastId });
            const zip = await JSZip.loadAsync(fileToImportMcq);
            const dataFile = zip.file("data.json");
            if (!dataFile) throw new Error("data.json not found in zip archive.");

            const content = await dataFile.async("string");
            const parsedData = JSON.parse(content);
            importedBanks = parsedData.questionBanks;

            const mediaFolder = zip.folder("media");
            if (mediaFolder) {
                const mediaFiles = Object.values(mediaFolder.files).filter(f => !f.dir);
                let processed = 0;
                for (const file of mediaFiles) {
                    const blob = await file.async("blob");
                    await saveSingleMediaToDB(file.name.replace('media/', ''), blob);
                    processed++;
                    toast.loading(`Importing media... (${processed}/${mediaFiles.length})`, { id: toastId });
                }
            }
        } else { // Legacy JSON format
            const content = await fileToImportMcq.text();
            const parsedData = JSON.parse(content);
            
            if (parsedData.version === 2 && parsedData.questionBanks && parsedData.media) {
              toast.loading("Importing media files...", { id: toastId });
              const mediaMap = parsedData.media as { [key: string]: string };
              for (const fileName in mediaMap) {
                const base64Data = mediaMap[fileName];
                const blob = base64ToBlob(base64Data);
                await saveSingleMediaToDB(fileName, blob);
              }
              importedBanks = parsedData.questionBanks;
            } else {
              importedBanks = Array.isArray(parsedData) ? parsedData : parsedData.questionBanks;
            }
        }

        if (!importedBanks) {
            throw new Error("Could not find question bank data in the file.");
        }

        const validation = questionBanksSchema.safeParse(importedBanks);
        if (!validation.success) {
            const errorDetails = validation.error.flatten().formErrors.join(', ');
            console.error("MCQ JSON validation failed:", validation.error.flatten());
            throw new Error(`Backup file has incorrect data structure. Details: ${errorDetails}`);
        }
        
        const validBanks = validation.data;

        toast.loading("Saving question banks...", { id: toastId });
        if (replaceOnMcqImport) {
            setQuestionBanks(validBanks);
        } else {
            setQuestionBanks(prevBanks => mergeQuestionBanks(prevBanks, validBanks));
        }
        
        toast.success("MCQ data imported successfully!", { id: toastId });
    } catch (error) {
        const err = error as Error;
        console.error("MCQ Import Error:", err);
        toast.error(`MCQ import failed: ${err.message}`, { id: toastId, duration: 15000 });
    } finally {
        setFileToImportMcq(null);
        if (mcqFileInputRef.current) mcqFileInputRef.current.value = "";
        setReplaceOnMcqImport(false);
    }
  };

  const handleHtmlFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.html')) {
      showError("Please select an HTML file.");
      if (htmlFileInputRef.current) htmlFileInputRef.current.value = "";
      return;
    }

    setFileToImportHtml(file);
    if (questionBanks.length > 0) {
        setTargetBankId(questionBanks[0].id);
    }
    setIsHtmlImportAlertOpen(true);
  };

  const confirmHtmlImport = async () => {
    if (!fileToImportHtml || !targetBankId) {
        showError("No file or target bank selected.");
        return;
    }
    setIsHtmlImportAlertOpen(false);

    const toastId = toast.loading("Starting HTML import...");
    const onProgress = (progress: { message: string; value: number }) => {
        toast.loading(
            <div className="flex flex-col gap-2">
                <p>{progress.message}</p>
                <Progress value={progress.value} className="w-full" />
            </div>,
            { id: toastId }
        );
    };

    try {
        const content = await fileToImportHtml.text();
        const importedMcqs = await importHtmlMcqs(content, onProgress);

        if (importedMcqs.length > 0) {
            let currentBanks = questionBanks;
            for (const mcq of importedMcqs) {
                currentBanks = addMcqToBank(currentBanks, targetBankId, mcq);
            }
            setQuestionBanks(currentBanks);
            toast.success(`Successfully imported ${importedMcqs.length} MCQs!`, { id: toastId });
        } else {
            throw new Error("No valid MCQs were found in the file.");
        }
    } catch (error) {
        const err = error as Error;
        console.error("HTML Import Error:", err);
        toast.error(`Import failed: ${err.message}`, { id: toastId, duration: 15000 });
    } finally {
        setFileToImportHtml(null);
        if (htmlFileInputRef.current) htmlFileInputRef.current.value = "";
    }
  };

  const handleReset = async () => {
    setIsResetAlertOpen(false);
    const toastId = toast.loading("Resetting all data...");
    try {
        await clearDecksDB();
        await clearQuestionBanksDB();
        await clearSettingsDB();
        await clearMediaDB();
        await clearMcqReviewLogsDB();
        toast.success("All data has been reset. The app will now reload.", { id: toastId });
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch (error) {
        toast.error("Failed to reset data.", { id: toastId });
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
                              <SelectItem value="fsrs">FSRS-4.5 (Recommended)</SelectItem>
                              <SelectItem value="fsrs6">FSRS-6 (Experimental)</SelectItem>
                              <SelectItem value="sm2">SM-2 (Legacy)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            FSRS is a modern, evidence-based algorithm. SM-2 is a classic, simpler alternative. Changing this will automatically reschedule all items.
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
                      <CardTitle>FSRS-4.5 Parameters</CardTitle>
                      <CardDescription>
                        These settings only apply if FSRS-4.5 is selected as the scheduler. It's recommended to keep the defaults unless you know what you're doing.
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
                    <CardFooter>
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm w-full">
                        <div className="space-y-0.5">
                          <FormLabel>Reschedule cards on change</FormLabel>
                          <FormDescription>
                            Recalculates all card schedules. This can cause many cards to become due. Use sparingly and create a backup first.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={rescheduleOnSave}
                            onCheckedChange={setRescheduleOnSave}
                          />
                        </FormControl>
                      </FormItem>
                    </CardFooter>
                  </Card>
                )}

                {scheduler === 'fsrs6' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>FSRS-6 Parameters (Experimental)</CardTitle>
                      <CardDescription>
                        This is an experimental scheduler based on the latest FSRS research. The default parameters are placeholders and not yet optimized.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={form.control} name="fsrs6Parameters.request_retention" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Requested Retention</FormLabel>
                          <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                          <FormDescription>The probability of recalling a card you want to aim for.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="fsrs6Parameters.maximum_interval" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Interval (days)</FormLabel>
                          <FormControl><Input type="number" {...field} /></FormControl>
                          <FormDescription>The longest possible interval between reviews.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </CardContent>
                     <CardFooter>
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm w-full">
                        <div className="space-y-0.5">
                          <FormLabel>Reschedule cards on change</FormLabel>
                          <FormDescription>
                            Recalculates all card schedules. This can cause many cards to become due. Use sparingly and create a backup first.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={rescheduleOnSave}
                            onCheckedChange={setRescheduleOnSave}
                          />
                        </FormControl>
                      </FormItem>
                    </CardFooter>
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
                            <FormLabel>Learning Steps</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormDescription>Delays for new cards (e.g., "1m 10m 1d").</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="sm2GraduatingInterval" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Graduating Interval (days)</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormDescription>Interval after the final "Good" learning step.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="sm2EasyInterval" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Easy Interval (days)</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormDescription>Interval for cards immediately rated "Easy".</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>SM-2: Reviews</CardTitle>
                        <CardDescription>Fine-tune the SM-2 scheduling algorithm for review cards.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="sm2StartingEase" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Starting Ease</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                            <FormDescription>Initial ease factor for new cards (default: 2.50).</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="sm2EasyBonus" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Easy Bonus</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                            <FormDescription>A multiplier for "Easy" reviews (default: 1.30).</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="sm2IntervalModifier" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Interval Modifier</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                            <FormDescription>A global multiplier for all intervals (default: 1.00).</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="sm2HardIntervalMultiplier" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hard Interval Multiplier</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                            <FormDescription>Multiplier for the previous interval on "Hard" (default: 1.20).</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="sm2MaximumInterval" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Maximum Interval (days)</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormDescription>The longest a review interval can be (default: 365).</FormDescription>
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
                            <FormLabel>Relearning Steps</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormDescription>Steps for cards you forget during review.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="sm2LapsedIntervalMultiplier" render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Interval Multiplier</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                            <FormDescription>Multiplier for a lapsed card's interval (default: 0.60).</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="sm2MinimumInterval" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum Interval (days)</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormDescription>The minimum interval after a lapse (default: 1).</FormDescription>
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
                  <CardFooter className="flex flex-col gap-4 pt-4">
                    <FormField control={form.control} name="newCardsIgnoreReviewLimit" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm w-full">
                          <div className="space-y-0.5">
                            <FormLabel>New cards ignore review limit</FormLabel>
                            <FormDescription>If enabled, new cards will be shown regardless of the review limit.</FormDescription>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="limitsStartFromTop" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm w-full">
                          <div className="space-y-0.5">
                            <FormLabel>Limits start from top</FormLabel>
                            <FormDescription>If enabled, limits from the top-level deck will apply to subdeck study sessions.</FormDescription>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )}
                    />
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Display Order</CardTitle>
                    <CardDescription>Control how cards are gathered, sorted, and mixed during study.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <FormField control={form.control} name="newCardInsertionOrder" render={({ field }) => (
                      <FormItem>
                        <FormLabel>New card insertion order</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="sequential">Sequential (order added)</SelectItem>
                            <SelectItem value="random">Random</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>Controls how new cards are ordered when they are created.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="newCardGatherOrder" render={({ field }) => (
                      <FormItem>
                        <FormLabel>New card gather order</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="deck">Deck</SelectItem>
                            <SelectItem value="ascending">Ascending position</SelectItem>
                            <SelectItem value="descending">Descending position</SelectItem>
                            <SelectItem value="randomNotes">Random notes</SelectItem>
                            <SelectItem value="randomCards">Random cards</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>How new cards are collected from your decks.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="newCardSortOrder" render={({ field }) => (
                      <FormItem>
                        <FormLabel>New card sort order</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="gathered">Order gathered</SelectItem>
                            <SelectItem value="typeThenGathered">Card type, then order gathered</SelectItem>
                            <SelectItem value="typeThenRandom">Card type, then random</SelectItem>
                            <SelectItem value="randomNote">Random note, then card type</SelectItem>
                            <SelectItem value="random">Random</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>How gathered new cards are sorted before showing.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="newReviewOrder" render={({ field }) => (
                      <FormItem>
                        <FormLabel>New/review order</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="mix">Mix with reviews</SelectItem>
                            <SelectItem value="after">Show after reviews</SelectItem>
                            <SelectItem value="before">Show before reviews</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>When to show new cards in relation to reviews.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="interdayLearningReviewOrder" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interday learning/review order</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="mix">Mix with reviews</SelectItem>
                            <SelectItem value="after">Show after reviews</SelectItem>
                            <SelectItem value="before">Show before reviews</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>When to show learning cards that cross a day boundary.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
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
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Burying</CardTitle>
                    <CardDescription>Control how sibling cards are hidden during study.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                    <FormField control={form.control} name="buryInterdayLearningSiblings" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Bury interday learning siblings</FormLabel>
                            <FormDescription>Hide other learning cards from the same note (due tomorrow or later) until the next day.</FormDescription>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Appearance</CardTitle>
                    <CardDescription>Customize the look and feel of the app.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <Label>Theme</Label>
                        <p className="text-sm text-muted-foreground">Select the application theme.</p>
                      </div>
                      <ThemeToggle />
                    </div>
                    <FormField control={form.control} name="disableFlipAnimation" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Disable flip animation</FormLabel>
                            <FormDescription>Instantly show the back of the card without an animation.</FormDescription>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2 p-4 border rounded-lg">
                        <h4 className="font-medium">Flashcards</h4>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button onClick={handleExport} variant="outline" type="button" className="flex-1">Export Decks</Button>
                            <Button asChild variant="outline" type="button" className="flex-1"><Label htmlFor="import-file" className="cursor-pointer w-full text-center">Import Decks</Label></Button>
                            <Input id="import-file" type="file" className="hidden" onChange={handleFileSelect} accept=".json,.apkg,.anki2,.anki21,.txt" ref={fileInputRef} />
                        </div>
                    </div>
                    <div className="space-y-2 p-4 border rounded-lg">
                        <h4 className="font-medium">MCQs</h4>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button onClick={handleExportMcqs} variant="outline" type="button" className="flex-1">Export MCQs</Button>
                            <Button asChild variant="outline" type="button" className="flex-1"><Label htmlFor="import-mcq-file" className="cursor-pointer w-full text-center">Import MCQs</Label></Button>
                            <Input id="import-mcq-file" type="file" className="hidden" onChange={handleMcqFileSelect} accept=".json,.zip" ref={mcqFileInputRef} />
                        </div>
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg mt-6 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800/50">
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-300">Temporary HTML MCQ Importer</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-4">
                      This is a temporary tool to import MCQs from a specific HTML format.
                    </p>
                    <Button asChild variant="outline" type="button" className="w-full sm:w-auto">
                      <Label htmlFor="import-html-file" className="cursor-pointer w-full text-center">
                        Import from HTML
                      </Label>
                    </Button>
                    <Input id="import-html-file" type="file" className="hidden" onChange={handleHtmlFileSelect} accept=".html" ref={htmlFileInputRef} />
                  </div>
                  <div className="p-4 border rounded-lg mt-6">
                    <h4 className="font-medium">Application Data</h4>
                    <p className="text-sm text-muted-foreground mb-4">This will permanently delete all decks, MCQs, and settings.</p>
                    <Button variant="destructive" onClick={() => setIsResetAlertOpen(true)} type="button" className="w-full sm:w-auto">Reset All Data</Button>
                  </div>
                </div>

                <div className="flex items-center justify-start pt-4">
                  <Button asChild variant="outline" type="button"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Back to My Decks</Link></Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </main>

      <AlertDialog open={isImportAlertOpen} onOpenChange={setIsImportAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import Data</AlertDialogTitle>
            <AlertDialogDescription>
              You can merge the imported decks with your existing ones, or replace everything. Merging will add new decks and cards, but will not overwrite existing ones with the same name or ID.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="replace-on-import"
                checked={replaceOnImport}
                onCheckedChange={(checked) => setReplaceOnImport(!!checked)}
              />
              <Label htmlFor="replace-on-import" className="cursor-pointer font-semibold text-destructive">
                Replace all existing data with this import
              </Label>
            </div>
            {(fileToImport?.name.endsWith('.apkg') || fileToImport?.name.endsWith('.anki2') || fileToImport?.name.endsWith('.anki21')) && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-scheduling"
                  checked={includeScheduling}
                  onCheckedChange={(checked) => setIncludeScheduling(!!checked)}
                />
                <Label htmlFor="include-scheduling" className="cursor-pointer">
                  Import learning progress
                </Label>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFileToImport(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmImport}>Import</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isMcqImportAlertOpen} onOpenChange={setIsMcqImportAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Import MCQ Data</AlertDialogTitle>
                <AlertDialogDescription>
                    You can merge the imported question banks with your existing ones, or replace everything. Merging will add new banks and MCQs, but will not overwrite existing ones with the same name or ID.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 pt-2">
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="replace-on-mcq-import"
                        checked={replaceOnMcqImport}
                        onCheckedChange={(checked) => setReplaceOnMcqImport(!!checked)}
                    />
                    <Label htmlFor="replace-on-mcq-import" className="cursor-pointer font-semibold text-destructive">
                        Replace all existing MCQ data with this import
                    </Label>
                </div>
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setFileToImportMcq(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmMcqImport}>Import</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isHtmlImportAlertOpen} onOpenChange={setIsHtmlImportAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import MCQs from HTML</AlertDialogTitle>
            <AlertDialogDescription>
              Select a question bank to import the new MCQs into. This will add the questions to the selected bank.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 pt-2">
            <Label htmlFor="target-bank-select">Target Question Bank</Label>
            <Select
              value={targetBankId}
              onValueChange={setTargetBankId}
              disabled={questionBanks.length === 0}
            >
              <SelectTrigger id="target-bank-select">
                <SelectValue placeholder="Select a bank..." />
              </SelectTrigger>
              <SelectContent>
                {flatBanks.length > 0 ? (
                  flatBanks.map(bank => (
                    <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>
                  ))
                ) : (
                  <SelectItem value="disabled" disabled>No question banks found. Please create one first.</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFileToImportHtml(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmHtmlImport} disabled={!targetBankId}>Import</AlertDialogAction>
          </AlertDialogFooter>
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