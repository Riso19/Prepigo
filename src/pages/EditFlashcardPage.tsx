import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDecks } from "@/contexts/DecksContext";
import { findFlashcardById, updateFlashcard } from "@/lib/deck-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FlashcardData, FlashcardType } from "@/data/decks";
import { ArrowLeft } from "lucide-react";
import HtmlEditor from "@/components/HtmlEditor";
import { showError, showSuccess } from "@/utils/toast";

const EditFlashcardPage = () => {
  const { deckId, flashcardId } = useParams<{ deckId: string; flashcardId: string }>();
  const { decks, setDecks } = useDecks();
  const navigate = useNavigate();

  const [cardType, setCardType] = useState<FlashcardType | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [clozeText, setClozeText] = useState("");
  const [description, setDescription] = useState("");
  const [originalCard, setOriginalCard] = useState<FlashcardData | null>(null);

  useEffect(() => {
    if (flashcardId) {
      const result = findFlashcardById(decks, flashcardId);
      if (result) {
        const { flashcard } = result;
        setOriginalCard(flashcard);
        setCardType(flashcard.type);
        switch (flashcard.type) {
          case 'basic':
            setQuestion(flashcard.question);
            setAnswer(flashcard.answer);
            break;
          case 'cloze':
            setClozeText(flashcard.text);
            setDescription(flashcard.description || "");
            break;
          case 'imageOcclusion':
            setDescription(flashcard.description || "");
            break;
        }
      }
    }
  }, [flashcardId, decks]);

  const handleSave = () => {
    if (!deckId || !flashcardId || !originalCard) return;

    let updatedCard: FlashcardData | null = null;

    switch (originalCard.type) {
      case 'basic':
        if (!question || !answer) {
          showError("Question and Answer cannot be empty.");
          return;
        }
        updatedCard = { ...originalCard, question, answer };
        break;
      case 'cloze':
        if (!clozeText) {
          showError("Cloze text cannot be empty.");
          return;
        }
        updatedCard = { ...originalCard, text: clozeText, description };
        break;
      case 'imageOcclusion':
        updatedCard = { ...originalCard, description };
        break;
    }

    if (updatedCard) {
      setDecks(prevDecks => updateFlashcard(prevDecks, updatedCard!));
      showSuccess("Flashcard updated successfully!");
      navigate(`/deck/${deckId}/view`);
    }
  };

  if (!originalCard) {
    return <div>Loading flashcard...</div>;
  }

  if (cardType === 'imageOcclusion') {
    return (
      <div className="min-h-screen w-full bg-secondary/50 flex flex-col items-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-4xl">
          <Button variant="ghost" onClick={() => navigate(`/deck/${deckId}/view`)} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Deck View
          </Button>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Edit Image Occlusion Card</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <p className="text-muted-foreground">Editing the image and occlusions is not supported yet. You can edit the extra info below.</p>
              <div className="space-y-2">
                <Label>Extra Info (Optional)</Label>
                <HtmlEditor value={description} onChange={setDescription} placeholder="Add a hint or extra context..."/>
              </div>
              <div className="flex justify-end mt-6">
                <Button onClick={handleSave}>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl">
        <Button variant="ghost" onClick={() => navigate(`/deck/${deckId}/view`)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Deck View
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Edit Flashcard</CardTitle>
            <p className="text-muted-foreground pt-2">Card Type: <span className="font-semibold capitalize">{cardType}</span></p>
          </CardHeader>
          <CardContent>
            {cardType === 'basic' && (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Front (Question)</Label>
                  <HtmlEditor value={question} onChange={setQuestion} placeholder="Who was the first person on the moon?" />
                </div>
                <div className="space-y-2">
                  <Label>Back (Answer)</Label>
                  <HtmlEditor value={answer} onChange={setAnswer} placeholder="Neil Armstrong" />
                </div>
              </div>
            )}
            {cardType === 'cloze' && (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Text</Label>
                  <HtmlEditor value={clozeText} onChange={setClozeText} placeholder="Text with {{c1::cloze}} deletion." />
                </div>
                <div className="space-y-2">
                  <Label>Extra Info (Optional)</Label>
                  <HtmlEditor value={description} onChange={setDescription} placeholder="Add a hint or extra context..."/>
                </div>
              </div>
            )}
            <div className="flex justify-end mt-6">
              <Button onClick={handleSave}>Save Changes</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditFlashcardPage;