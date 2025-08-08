import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDecks } from "@/contexts/DecksContext";
import { findDeckById, addFlashcardToDeck } from "@/lib/deck-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { BasicFlashcard, ClozeFlashcard, FlashcardType, ImageOcclusionFlashcard, Occlusion } from "@/data/decks";
import { ArrowLeft } from "lucide-react";
import ImageOcclusionEditor from "@/components/ImageOcclusionEditor";

const CreateFlashcardPage = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const { decks, setDecks } = useDecks();
  const navigate = useNavigate();

  const [cardType, setCardType] = useState<FlashcardType | 'imageOcclusion'>("basic");
  
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [createReverse, setCreateReverse] = useState(false);
  const [clozeText, setClozeText] = useState("");
  const clozeTextareaRef = useRef<HTMLTextAreaElement>(null);

  const deck = deckId ? findDeckById(decks, deckId) : null;

  const handleClozeClick = () => {
    const textarea = clozeTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);

    if (selectedText) {
      const clozeRegex = /{{c(\d+)::/g;
      let maxId = 0;
      let match;
      while ((match = clozeRegex.exec(clozeText)) !== null) {
        maxId = Math.max(maxId, parseInt(match[1], 10));
      }
      const newId = maxId + 1;

      const newCloze = `{{c${newId}::${selectedText}}}`;
      const newText = 
          textarea.value.substring(0, start) + 
          newCloze + 
          textarea.value.substring(end);
      
      setClozeText(newText);
    }
  };

  const handleSaveBasic = () => {
    if (!deckId) return;
    const newCard: BasicFlashcard = { id: `f${Date.now()}`, type: "basic", question, answer };
    setDecks(decks => addFlashcardToDeck(decks, deckId, newCard));
    if (createReverse) {
      const reverseCard: BasicFlashcard = { id: `f${Date.now() + 1}`, type: "basic", question: answer, answer: question };
      setDecks(decks => addFlashcardToDeck(decks, deckId, reverseCard));
    }
    navigate("/");
  };

  const handleSaveCloze = () => {
    if (!deckId) return;
    const newCard: ClozeFlashcard = { id: `f${Date.now()}`, type: "cloze", text: clozeText };
    setDecks(decks => addFlashcardToDeck(decks, deckId, newCard));
    navigate("/");
  };

  const handleSaveImageOcclusion = (imageUrl: string, occlusions: Occlusion[]) => {
    if (!deckId) return;
    let currentDecks = decks;
    occlusions.forEach(occ => {
      const newCard: ImageOcclusionFlashcard = {
        id: `f${Date.now()}-${occ.id}`,
        type: "imageOcclusion",
        imageUrl,
        occlusions,
        questionOcclusionId: occ.id,
      };
      currentDecks = addFlashcardToDeck(currentDecks, deckId, newCard);
    });
    setDecks(currentDecks);
    navigate("/");
  };

  if (!deck) {
    return <div>Deck not found</div>;
  }

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Decks
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Add Flashcard to "{deck.name}"</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={cardType} onValueChange={(value) => setCardType(value as FlashcardType)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="cloze">Cloze</TabsTrigger>
                <TabsTrigger value="imageOcclusion">Image Occlusion</TabsTrigger>
              </TabsList>
              <TabsContent value="basic" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="question">Front (Question)</Label>
                  <Textarea id="question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Who was the first person on the moon?" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="answer">Back (Answer)</Label>
                  <Textarea id="answer" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Neil Armstrong" />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="reverse" checked={createReverse} onCheckedChange={(checked) => setCreateReverse(!!checked)} />
                  <Label htmlFor="reverse">Create reverse card</Label>
                </div>
                <div className="flex justify-end mt-6">
                  <Button onClick={handleSaveBasic}>Save Flashcard</Button>
                </div>
              </TabsContent>
              <TabsContent value="cloze" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="cloze-text">Text</Label>
                    <Button variant="outline" size="sm" onClick={handleClozeClick}>
                      Make Cloze [...]
                    </Button>
                  </div>
                  <Textarea
                    ref={clozeTextareaRef}
                    id="cloze-text"
                    value={clozeText}
                    onChange={(e) => setClozeText(e.target.value)}
                    rows={6}
                    placeholder="Highlight text and click 'Make Cloze'..."
                  />
                  <p className="text-sm text-muted-foreground">
                    Or manually wrap text like this: {`{{c1::your text}}`}
                  </p>
                </div>
                <div className="flex justify-end mt-6">
                  <Button onClick={handleSaveCloze}>Save Flashcard</Button>
                </div>
              </TabsContent>
              <TabsContent value="imageOcclusion" className="pt-4">
                <ImageOcclusionEditor onSave={handleSaveImageOcclusion} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateFlashcardPage;