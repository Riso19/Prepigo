import { useParams, Link } from "react-router-dom";
import { useExams } from "@/contexts/ExamsContext";
import { useDecks } from "@/contexts/DecksContext";
import { useQuestionBanks } from "@/contexts/QuestionBankContext";
import type { DeckData, FlashcardData } from "@/data/decks";
import type { QuestionBankData, McqData } from "@/data/questionBanks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft } from "lucide-react";
import Header from "@/components/Header";

function flattenDecks(root: DeckData): DeckData[] {
  const acc: DeckData[] = [root];
  if (root.subDecks && root.subDecks.length) {
    for (const sd of root.subDecks) acc.push(...flattenDecks(sd));
  }
  return acc;
}

function allFlashcardsOf(deck: DeckData): FlashcardData[] {
  let cards: FlashcardData[] = [...(deck.flashcards || [])];
  if (deck.subDecks && deck.subDecks.length) {
    for (const sd of deck.subDecks) cards = cards.concat(allFlashcardsOf(sd));
  }
  return cards;
}

function flattenBanks(root: QuestionBankData): QuestionBankData[] {
  const acc: QuestionBankData[] = [root];
  if (root.subBanks && root.subBanks.length) {
    for (const sb of root.subBanks) acc.push(...flattenBanks(sb));
  }
  return acc;
}

function allMcqsOf(bank: QuestionBankData): McqData[] {
  let mcqs: McqData[] = [...(bank.mcqs || [])];
  if (bank.subBanks && bank.subBanks.length) {
    for (const sb of bank.subBanks) mcqs = mcqs.concat(allMcqsOf(sb));
  }
  return mcqs;
}

function isDueAfterExam(srs: FlashcardData["srs"] | McqData["srs"], examDateISO: string): boolean {
  if (!srs) return false;
  const examDate = new Date(examDateISO);
  const dues: (string | undefined)[] = [
    srs.fsrs?.due,
    srs.fsrs6?.due,
    srs.sm2?.due,
  ];
  return dues.some(d => {
    if (!d) return false;
    const dueDate = new Date(d);
    return isFinite(dueDate.getTime()) && dueDate > examDate;
  });
}

function countStudiedFlashcards(cards: FlashcardData[], examDateISO: string) {
  // Stricter rule: "studied" only if any due date is after the exam date
  const studied = cards.filter(c => isDueAfterExam(c.srs, examDateISO)).length;
  return { studied, total: cards.length };
}

function countStudiedMcqs(mcqs: McqData[], examDateISO: string) {
  const studied = mcqs.filter(m => isDueAfterExam(m.srs, examDateISO)).length;
  return { studied, total: mcqs.length };
}

const ExamProgressPage = () => {
  const { examId } = useParams();
  const { exams } = useExams();
  const { decks } = useDecks();
  const { questionBanks } = useQuestionBanks();

  const exam = exams.find(e => e.id === (examId || ""));

  if (!exam) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="container mx-auto p-4 md:p-8 flex-1">
          <div className="mb-4">
            <Button variant="ghost" asChild>
              <Link to="/exams" className="inline-flex items-center gap-2">
                <ChevronLeft className="h-4 w-4" /> Back to Exams
              </Link>
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Exam not found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">The requested exam does not exist.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Map selected decks (including subdecks if user selected by subdeck id)
  const deckMap: Record<string, DeckData> = {};
  for (const root of decks) for (const d of flattenDecks(root)) deckMap[d.id] = d;
  const selectedDecks: DeckData[] = exam.deckIds.map(id => deckMap[id]).filter(Boolean);

  // Map selected banks
  const bankMap: Record<string, QuestionBankData> = {};
  for (const root of questionBanks) for (const b of flattenBanks(root)) bankMap[b.id] = b;
  const selectedBanks: QuestionBankData[] = exam.questionBankIds.map(id => bankMap[id]).filter(Boolean);

  // Aggregate totals
  const deckSummaries = selectedDecks.map(d => {
    const cards = allFlashcardsOf(d);
    const { studied, total } = countStudiedFlashcards(cards, exam.date);
    const pct = total ? Math.round((studied / total) * 100) : 0;
    return { id: d.id, name: d.name, studied, total, pct };
  });

  const bankSummaries = selectedBanks.map(b => {
    const mcqs = allMcqsOf(b);
    const { studied, total } = countStudiedMcqs(mcqs, exam.date);
    const pct = total ? Math.round((studied / total) * 100) : 0;
    return { id: b.id, name: b.name, studied, total, pct };
  });

  const totalDeckStudied = deckSummaries.reduce((a, s) => a + s.studied, 0);
  const totalDeckTotal = deckSummaries.reduce((a, s) => a + s.total, 0);
  const totalDeckPct = totalDeckTotal ? Math.round((totalDeckStudied / totalDeckTotal) * 100) : 0;

  const totalBankStudied = bankSummaries.reduce((a, s) => a + s.studied, 0);
  const totalBankTotal = bankSummaries.reduce((a, s) => a + s.total, 0);
  const totalBankPct = totalBankTotal ? Math.round((totalBankStudied / totalBankTotal) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container mx-auto p-4 md:p-8 flex-1">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/exams" className="inline-flex items-center gap-2">
                <ChevronLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Exam Progress</h1>
          </div>
          <Badge variant="secondary">{exam.name}</Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Decks Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Overall</span>
                  <span className="font-medium">{totalDeckStudied}/{totalDeckTotal} ({totalDeckPct}%)</span>
                </div>
                <Progress value={totalDeckPct} />
              </div>
              <Separator />
              {deckSummaries.length === 0 && (
                <p className="text-sm text-muted-foreground">No decks selected.</p>
              )}
              <ul className="space-y-3">
                {deckSummaries.map(s => (
                  <li key={s.id} className="p-3 border rounded-md bg-card">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-sm text-muted-foreground">{s.studied}/{s.total} ({s.pct}%)</span>
                    </div>
                    <Progress value={s.pct} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Question Banks Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Overall</span>
                  <span className="font-medium">{totalBankStudied}/{totalBankTotal} ({totalBankPct}%)</span>
                </div>
                <Progress value={totalBankPct} />
              </div>
              <Separator />
              {bankSummaries.length === 0 && (
                <p className="text-sm text-muted-foreground">No question banks selected.</p>
              )}
              <ul className="space-y-3">
                {bankSummaries.map(s => (
                  <li key={s.id} className="p-3 border rounded-md bg-card">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-sm text-muted-foreground">{s.studied}/{s.total} ({s.pct}%)</span>
                    </div>
                    <Progress value={s.pct} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 text-sm text-muted-foreground">
          <p>
            Progress counts a card or MCQ as <span className="font-medium">studied</span> only if it has SRS data whose due date is after the exam date ({new Date(exam.date).toLocaleDateString()}).
          </p>
        </div>
      </main>
    </div>
  );
};

export default ExamProgressPage;
