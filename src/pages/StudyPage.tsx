import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useDecks } from "@/contexts/DecksContext";
import { findDeckById, getAllFlashcardsFromDeck, updateFlashcard } from "@/lib/deck-utils";
import { sm2 } from "@/lib/srs";
import { FlashcardData } from "@/data/decks";
import { showSuccess } from "@/utils/toast";
import Flashcard from "@/components/Flashcard";
import ClozePlayer from "@/components/ClozePlayer";
import ImageOcclusionPlayer from "@/components/ImageOcclusionPlayer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

const StudyPage = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { decks, setDecks } = useDecks();
  const navigate = useNavigate();

  const deck = useMemo(() => (deckId ? findDeckById(decks, deckId) : null), [decks, deckId]);
  const allFlashcards = useMemo(() => (deck ? getAllFlashcardsFromDeck(deck) : []), [deck]);

  const dueFlashcards = useMemo(() => {
    const now = new Date().toISOString();
    return allFlashcards
      .filter(card => {
        if (!card.nextReviewDate) return true; // New cards are always due
        return card.nextReviewDate <= now;
      })
      .sort(() => Math.random() - 0.5); // Shuffle due cards
  }, [allFlashcards]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleRating = useCallback((rating: number) => {
    const currentCard = dueFlashcards[currentIndex];
    if (!currentCard) return;

    // Map button rating (1-4) to SM-2 quality (0-5)
    // 1: Again -> q=0, 2: Hard -> q=3, 3: Good -> q=4, 4: Easy -> q=5
    const quality = rating === 1 ? 0 : rating + 1;

    const srsData = {
      repetitions: currentCard.repetitions || 0,
      easeFactor: currentCard.easeFactor || 2.5,
      interval: currentCard.interval || 0,
    };

    const newSrsData = sm2(srsData, quality);

    const now = new Date();
    const nextReviewDate = new Date(new Date().setDate(now.getDate() + newSrsData.interval));

    const updatedCard: FlashcardData = {
      ...currentCard,
      ...newSrsData,
      nextReviewDate: nextReviewDate.toISOString(),
    };
    
    setDecks(prevDecks => updateFlashcard(prevDecks, updatedCard));

    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex + 1 >= dueFlashcards.length) {
        showSuccess("Congratulations! You've finished your review session.");
        navigate('/');
      } else {
        setCurrentIndex(prev => prev + 1);
      }
    }, 150);
  }, [currentIndex, dueFlashcards, setDecks, navigate]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isFlipped) {
        event.preventDefault();
        setIsFlipped(true);
        return;
      }

      if (isFlipped) {
        switch (event.key) {
          case '1': handleRating(1); break;
          case '2': handleRating(2); break;
          case '3': handleRating(3); break;
          case '4': handleRating(4); break;
          default: break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, handleRating]);

  if (!deck) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold mb-4">Deck not found</h2>
        <p className="text-muted-foreground mb-6">The deck you're looking for doesn't exist.</p>
        <Button asChild>
          <Link to="/"><Home className="mr-2 h-4 w-4" /> Go back to My Decks</Link>
        </Button>
      </div>
    );
  }

  if (allFlashcards.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold mb-4">This deck is empty!</h2>
        <p className="text-muted-foreground mb-6">Add some flashcards to this deck to start studying.</p>
        <Button asChild>
          <Link to="/"><Home className="mr-2 h-4 w-4" /> Go back to My Decks</Link>
        </Button>
      </div>
    );
  }

  if (dueFlashcards.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold mb-4">All caught up!</h2>
        <p className="text-muted-foreground mb-6">You have no cards due for review in this deck.</p>
        <Button asChild>
          <Link to="/"><Home className="mr-2 h-4 w-4" /> Go back to My Decks</Link>
        </Button>
      </div>
    );
  }

  const currentCard = dueFlashcards[currentIndex];

  const handleCardClick = () => {
    if (!isFlipped) {
      setIsFlipped(true);
    }
  };

  const renderCard = () => {
    switch (currentCard.type) {
      case 'basic':
        return <Flashcard question={currentCard.question} answer={currentCard.answer} isFlipped={isFlipped} onClick={handleCardClick} />;
      case 'cloze':
        return <ClozePlayer text={currentCard.text} description={currentCard.description} isFlipped={isFlipped} onClick={handleCardClick} />;
      case 'imageOcclusion':
        return <ImageOcclusionPlayer imageUrl={currentCard.imageUrl} occlusions={currentCard.occlusions} questionOcclusionId={currentCard.questionOcclusionId} description={currentCard.description} isFlipped={isFlipped} onClick={handleCardClick} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
       <Button variant="ghost" onClick={() => navigate("/")} className="absolute top-4 left-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Decks
      </Button>
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold text-center">Studying: {deck.name}</h1>
        
        {renderCard()}

        <div className="text-sm text-muted-foreground">
          Card {currentIndex + 1} of {dueFlashcards.length}
        </div>
        
        <div className="w-full mt-4">
          {isFlipped ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
              <Button onClick={() => handleRating(1)} className="relative bg-red-500 hover:bg-red-600 text-white font-bold h-16 text-base">
                Again
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">1</span>
              </Button>
              <Button onClick={() => handleRating(2)} className="relative bg-orange-400 hover:bg-orange-500 text-white font-bold h-16 text-base">
                Hard
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">2</span>
              </Button>
              <Button onClick={() => handleRating(3)} className="relative bg-green-500 hover:bg-green-600 text-white font-bold h-16 text-base">
                Good
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">3</span>
              </Button>
              <Button onClick={() => handleRating(4)} className="relative bg-blue-500 hover:bg-blue-600 text-white font-bold h-16 text-base">
                Easy
                <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">4</span>
              </Button>
            </div>
          ) : (
            <Button onClick={() => setIsFlipped(true)} className="w-full h-16 text-lg relative">
              Show Answer
              <span className="absolute bottom-1 right-1 text-xs p-1 bg-black/20 rounded-sm">Space</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudyPage;