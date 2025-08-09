import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDecks } from '@/contexts/DecksContext';
import { findDeckById, getAllFlashcardsFromDeck, deleteFlashcard, findDeckPathById } from '@/lib/deck-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { ArrowLeft, Home, Pencil, Trash2, PlusCircle } from 'lucide-react';
import { FlashcardData } from '@/data/decks';
import { showSuccess } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';

const DeckViewPage = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { decks, setDecks } = useDecks();
  const navigate = useNavigate();
  const [cardToDelete, setCardToDelete] = useState<FlashcardData | null>(null);
  const isMobile = useIsMobile();

  const deck = useMemo(() => (deckId ? findDeckById(decks, deckId) : null), [decks, deckId]);
  const deckPath = useMemo(() => (deckId ? findDeckPathById(decks, deckId)?.join(' / ') : null), [decks, deckId]);
  const flashcards = useMemo(() => (deck ? getAllFlashcardsFromDeck(deck) : []), [deck]);

  const handleDeleteConfirm = () => {
    if (cardToDelete) {
      setDecks(prevDecks => deleteFlashcard(prevDecks, cardToDelete.id));
      showSuccess("Flashcard deleted successfully.");
      setCardToDelete(null);
    }
  };

  if (!deck) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold mb-4">Deck not found</h2>
        <Button asChild>
          <Link to="/"><Home className="mr-2 h-4 w-4" /> Go back to My Decks</Link>
        </Button>
      </div>
    );
  }

  const renderDesktopView = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Type</TableHead>
          <TableHead>Front / Question</TableHead>
          <TableHead>Back / Answer</TableHead>
          <TableHead className="text-right w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {flashcards.map(card => (
          <TableRow key={card.id}>
            <TableCell className="capitalize font-medium">{card.type === 'imageOcclusion' ? 'Image' : card.type}</TableCell>
            <TableCell>
              {card.type === 'imageOcclusion' ? (
                <img src={card.imageUrl} alt="Occlusion preview" className="h-16 w-auto rounded-md object-contain bg-muted" />
              ) : (
                <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: card.type === 'basic' ? card.question : card.text }} />
              )}
            </TableCell>
            <TableCell>
              {card.type === 'basic' ? (
                <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: card.answer }} />
              ) : (
                <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: card.description || '' }} />
              )}
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
                    <Button variant="ghost" size="icon" onClick={() => setCardToDelete(card)} className="text-destructive hover:text-destructive focus:text-destructive focus:bg-destructive/10">
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
  );

  const renderMobileView = () => (
    <div className="space-y-4">
      {flashcards.map(card => (
        <Card key={card.id}>
          <CardContent className="p-4 space-y-4">
            <div className="flex justify-between items-start gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-semibold capitalize">{card.type === 'imageOcclusion' ? 'Image' : card.type}</p>
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
                    <Button variant="ghost" size="icon" onClick={() => setCardToDelete(card)} className="text-destructive hover:text-destructive focus:text-destructive focus:bg-destructive/10">
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
                <img src={card.imageUrl} alt="Occlusion preview" className="w-full h-auto rounded-md object-contain bg-muted" />
              ) : (
                <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: card.type === 'basic' ? card.question : card.text }} />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Back / Answer</p>
              {card.type === 'basic' ? (
                <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: card.answer }} />
              ) : (
                <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: card.description || '' }} />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-6xl">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Decks
        </Button>
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="text-2xl">Manage: {deck.name}</CardTitle>
                    <CardDescription>
                        Path: {deckPath || deck.name}
                        <br />
                        {flashcards.length} card(s) in this deck and its sub-decks.
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
            {flashcards.length > 0 ? (
              isMobile ? renderMobileView() : renderDesktopView()
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <p className="mb-2">This deck is empty.</p>
                <p>Click "Add New Flashcard" to get started!</p>
              </div>
            )}
          </CardContent>
        </Card>
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