import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDecks } from '@/contexts/DecksContext';
import {
  findDeckById,
  deleteFlashcard,
  findDeckPathById,
  getEffectiveSrsSettings,
} from '@/lib/deck-utils';
import { getAllFlashcardsWithDeckPath, FlashcardWithContext } from '@/lib/card-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { ArrowLeft, Home, Pencil, Trash2, PlusCircle, Settings } from 'lucide-react';
import { FlashcardData } from '@/data/decks';
import { showSuccess } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { MediaAwareImage } from '@/components/MediaAwareImage';
import { HtmlRenderer } from '@/components/HtmlRenderer';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { DeckSettingsForm } from '@/components/DeckSettingsForm';
import { useSettings } from '@/contexts/SettingsContext';
import { FlashcardStatus } from '@/components/FlashcardStatus';
import { State } from 'ts-fsrs';
import { DynamicDueDate } from '@/components/DynamicDueDate';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import ConflictCenter from '@/components/ConflictCenter';

const DeckViewPage = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { decks, setDecks } = useDecks();
  const navigate = useNavigate();
  const [cardToDelete, setCardToDelete] = useState<FlashcardData | null>(null);
  const [visibleCount, setVisibleCount] = useState(100);
  const isMobile = useIsMobile();
  const { settings: globalSettings } = useSettings();

  const deck = useMemo(() => (deckId ? findDeckById(decks, deckId) : null), [decks, deckId]);
  const deckPath = useMemo(
    () => (deckId ? findDeckPathById(decks, deckId)?.join(' / ') : null),
    [decks, deckId],
  );

  const flashcardsWithContext = useMemo(
    () => (deck ? getAllFlashcardsWithDeckPath(deck) : []),
    [deck],
  );
  const visibleFlashcardsWithContext = useMemo(
    () => flashcardsWithContext.slice(0, visibleCount),
    [flashcardsWithContext, visibleCount],
  );

  const effectiveSettings = useMemo(() => {
    if (deck) {
      return getEffectiveSrsSettings(decks, deck.id, globalSettings);
    }
    return globalSettings;
  }, [deck, decks, globalSettings]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 100);
  };

  const handleDeleteConfirm = () => {
    if (cardToDelete) {
      setDecks((prevDecks) => deleteFlashcard(prevDecks, cardToDelete.id));
      showSuccess('Flashcard deleted successfully.');
      setCardToDelete(null);
    }
  };

  if (!deck) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold mb-4">Deck not found</h2>
        <Button asChild>
          <Link to="/">
            <Home className="mr-2 h-4 w-4" /> Go back to My Decks
          </Link>
        </Button>
      </div>
    );
  }

  const renderDesktopView = (cards: FlashcardWithContext[]) => {
    return (
      <ScrollArea className="w-full rounded-md border overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead>Front / Question</TableHead>
              <TableHead>Back / Answer</TableHead>
              <TableHead>Path</TableHead>
              <TableHead className="hidden xl:table-cell">Tags</TableHead>
              <TableHead className="hidden lg:table-cell">Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.map(({ flashcard: card, deckPath }) => (
              <TableRow key={card.id} className="text-xs sm:text-sm md:text-base hover:bg-muted/40">
                <TableCell className="capitalize font-medium align-top">
                  {card.type === 'imageOcclusion' ? 'Image' : card.type}
                </TableCell>
                <TableCell className="align-top break-words">
                  {card.type === 'imageOcclusion' ? (
                    <MediaAwareImage
                      src={card.imageUrl}
                      alt="Occlusion preview"
                      className="h-20 md:h-24 w-auto rounded-md object-contain bg-muted"
                    />
                  ) : (
                    <HtmlRenderer
                      html={card.type === 'basic' ? card.question : card.text}
                      className="prose prose-sm md:prose dark:prose-invert max-w-none break-words"
                    />
                  )}
                </TableCell>
                <TableCell className="align-top break-words">
                  {card.type === 'basic' ? (
                    <HtmlRenderer
                      html={card.answer}
                      className="prose prose-sm md:prose dark:prose-invert max-w-none break-words"
                    />
                  ) : (
                    <HtmlRenderer
                      html={card.description || ''}
                      className="prose prose-sm md:prose dark:prose-invert max-w-none break-words"
                    />
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs truncate max-w-[300px] align-top">
                  {deckPath.join(' / ')}
                </TableCell>
                <TableCell className="hidden xl:table-cell align-top">
                  <div className="flex flex-wrap gap-1 max-w-[300px]">
                    {card.tags?.map((tag) => (
                      <Badge key={tag} variant="outline" className="font-normal">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell align-top">
                  <FlashcardStatus card={card} scheduler={effectiveSettings.scheduler} />
                </TableCell>
                <TableCell>
                  {(() => {
                    const scheduler = effectiveSettings.scheduler;
                    let dueDate: string | undefined;
                    let isNew = true;

                    if (scheduler === 'sm2') {
                      dueDate = card.srs?.sm2?.due;
                      isNew = !card.srs?.sm2 || card.srs.sm2.state === 'new' || !card.srs.sm2.state;
                    } else {
                      const srsData = scheduler === 'fsrs6' ? card.srs?.fsrs6 : card.srs?.fsrs;
                      dueDate = srsData?.due;
                      isNew = !srsData || srsData.state === State.New;
                    }

                    return (
                      <DynamicDueDate
                        dueDate={dueDate}
                        isNew={isNew}
                        isSuspended={card.srs?.isSuspended}
                      />
                    );
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/deck/${deck.id}/edit/${card.id}`}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCardToDelete(card)}
                          className="text-destructive hover:text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    );
  };

  const renderMobileView = (cards: FlashcardWithContext[]) => {
    return (
      <div className="space-y-4">
        {cards.map(({ flashcard: card, deckPath }) => (
          <Card key={card.id}>
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-semibold capitalize">
                    {card.type === 'imageOcclusion' ? 'Image' : card.type}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 flex-shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/deck/${deck.id}/edit/${card.id}`}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCardToDelete(card)}
                        className="text-destructive hover:text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Front / Question</p>
                {card.type === 'imageOcclusion' ? (
                  <MediaAwareImage
                    src={card.imageUrl}
                    alt="Occlusion preview"
                    className="w-full h-auto rounded-md object-contain bg-muted"
                  />
                ) : (
                  <HtmlRenderer
                    html={card.type === 'basic' ? card.question : card.text}
                    className="prose dark:prose-invert max-w-none"
                  />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Back / Answer</p>
                {card.type === 'basic' ? (
                  <HtmlRenderer html={card.answer} className="prose dark:prose-invert max-w-none" />
                ) : (
                  <HtmlRenderer
                    html={card.description || ''}
                    className="prose dark:prose-invert max-w-none"
                  />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Path</p>
                <p className="text-sm text-muted-foreground">{deckPath.join(' / ')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {card.tags?.map((tag) => (
                    <Badge key={tag} variant="outline" className="font-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <FlashcardStatus card={card} scheduler={effectiveSettings.scheduler} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Due Date</p>
                <div>
                  {(() => {
                    const scheduler = effectiveSettings.scheduler;
                    let dueDate: string | undefined;
                    let isNew = true;

                    if (scheduler === 'sm2') {
                      dueDate = card.srs?.sm2?.due;
                      isNew = !card.srs?.sm2 || card.srs.sm2.state === 'new' || !card.srs.sm2.state;
                    } else {
                      const srsData = scheduler === 'fsrs6' ? card.srs?.fsrs6 : card.srs?.fsrs;
                      dueDate = srsData?.due;
                      isNew = !srsData || srsData.state === State.New;
                    }

                    return (
                      <DynamicDueDate
                        dueDate={dueDate}
                        isNew={isNew}
                        isSuspended={card.srs?.isSuspended}
                      />
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-6xl">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Decks
        </Button>

        <Accordion type="single" collapsible className="w-full mb-6">
          <AccordionItem value="deck-settings">
            <AccordionTrigger>
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Settings className="h-5 w-5" />
                Deck Specific Settings
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <DeckSettingsForm deck={deck} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-2xl">Manage: {deck.name}</CardTitle>
                <CardDescription>
                  Path: {deckPath || deck.name}
                  <br />
                  {flashcardsWithContext.length} card(s) in this deck and its sub-decks.
                </CardDescription>
              </div>
              <Button asChild>
                <Link to={`/deck/${deck.id}/add`}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New Flashcard
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {flashcardsWithContext.length > 0 ? (
              <>
                {isMobile
                  ? renderMobileView(visibleFlashcardsWithContext)
                  : renderDesktopView(visibleFlashcardsWithContext)}
                {visibleCount < flashcardsWithContext.length && (
                  <div className="mt-6 flex justify-center">
                    <Button onClick={handleLoadMore}>
                      Load More ({flashcardsWithContext.length - visibleCount} remaining)
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <p className="mb-2">This deck is empty.</p>
                <p>Click "Add New Flashcard" to get started!</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="fixed bottom-4 right-4">
          <ConflictCenter />
        </div>
      </div>

      <AlertDialog open={!!cardToDelete} onOpenChange={() => setCardToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the flashcard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DeckViewPage;
