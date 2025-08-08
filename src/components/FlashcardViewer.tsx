import { useState } from "react";
import { medicalFlashcards } from "@/data/medical-flashcards";
import Flashcard from "./Flashcard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";

const FlashcardViewer = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleNext = () => {
    setIsFlipped(false);
    // A short delay to allow the card to flip back before changing content
    setTimeout(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % medicalFlashcards.length);
    }, 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prevIndex) =>
        prevIndex === 0 ? medicalFlashcards.length - 1 : prevIndex - 1
      );
    }, 150);
  };

  const currentCard = medicalFlashcards[currentIndex];

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-6">
      <Flashcard
        question={currentCard.question}
        answer={currentCard.answer}
        isFlipped={isFlipped}
        onClick={() => setIsFlipped(!isFlipped)}
      />

      <div className="text-sm text-muted-foreground">
        Card {currentIndex + 1} of {medicalFlashcards.length}
      </div>

      <div className="flex items-center justify-center gap-4 w-full">
        <Button variant="outline" size="icon" onClick={handlePrev} aria-label="Previous Card">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => setIsFlipped(!isFlipped)} className="flex-grow">
          {isFlipped ? "Show Question" : "Show Answer"}
        </Button>
        <Button variant="outline" size="icon" onClick={handleNext} aria-label="Next Card">
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center justify-center gap-4 w-full">
        <Button variant="destructive" className="flex-grow" onClick={handleNext}>
          <X className="mr-2 h-4 w-4" /> Incorrect
        </Button>
        <Button className="flex-grow bg-green-500 hover:bg-green-600 text-white" onClick={handleNext}>
          <Check className="mr-2 h-4 w-4" /> Correct
        </Button>
      </div>
    </div>
  );
};

export default FlashcardViewer;