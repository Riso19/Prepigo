import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDecks } from '@/contexts/DecksContext';
import { findDeckById, getAllFlashcardsFromDeck, deleteFlashcard } from '@/lib/deck-utils';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, Home, MoreHorizontal, Pencil, Trash2, PlusCircle } from 'lucide-react';
import { FlashcardData } from '@/data/decks';
import { showSuccess } from '@/utils/toast';

const DeckViewPage = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { decks, setDecks } = useDecks();
  const navigate = useNavigate();
  const [cardToDelete, setCardToDelete] = useState<FlashcardData | null>(null);

  const deck = useMemo(() => (deckId ? findDeckById(decks, deckId) : null), [decks, deckId]);
  const flashcards = useMemo(() => (deck ? getAllFlashcardsFromDeck(deck) : []), [deck]);

  const handleDeleteConfirm = () => {
    if (cardToDelete) {
      setDecks(prevDecks => deleteFlashcard(prevDecks, cardToDelete.id));
      showSuccess("Flashcard deleted successfully.");
      setCardToDelete(null);
    }
  };

  const getCardSummary = (card: FlashcardData) => {
    switch (card.type) {
      case 'basic':
        return card.question;
      case 'cloze':
        return card.text;
      case 'imageOcclusion':
        return 'Image Occlusion Card';
      default:
        return 'Unknown card type';
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
                    <CardTitle className="text-2xl">Manage Deck: {deck.name}</CardTitle>
                    <CardDescription>{flashcards.length} card(s) in this deck and its sub-decks.</CardDescription>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Content Preview</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flashcards.map(card => (
                    <TableRow key={card.id}>
                      <TableCell className="capitalize font-medium">{card.type === 'imageOcclusion' ? 'Image' : card.type}</TableCell>
                      <TableCell>
                        <p className="truncate max-w-md" dangerouslySetInnerHTML={{ __html: getCardSummary(card) }} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/deck/${deck.id}/edit/${card.id}`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setCardToDelete(card)} className="text-destructive focus:text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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