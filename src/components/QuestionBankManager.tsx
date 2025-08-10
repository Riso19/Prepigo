import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, Settings } from "lucide-react";
import { useQuestionBanks } from "@/contexts/QuestionBankContext";
import QuestionBankItem from "@/components/QuestionBankItem";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { AddQuestionBankDialog } from "./AddQuestionBankDialog";
import { DndContext, DragEndEvent, useDroppable } from "@dnd-kit/core";
import { moveQuestionBank, buildMcqSessionQueue } from "@/lib/question-bank-utils";
import { Link } from "react-router-dom";
import { useSettings } from "@/contexts/SettingsContext";
import { useExams } from "@/contexts/ExamsContext";

const RootDroppable = () => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'root-droppable-qb',
  });

  return (
    <div
      ref={setNodeRef}
      className={`mt-4 p-4 border-2 border-dashed rounded-lg text-center text-muted-foreground transition-colors ${
        isOver ? 'bg-primary/10 border-primary' : ''
      }`}
    >
      Drop here to move a bank to the root
    </div>
  );
};

const QuestionBankManager = () => {
  const { questionBanks, mcqIntroductionsToday, setQuestionBanks } = useQuestionBanks();
  const { settings } = useSettings();
  const { exams } = useExams();
  const [isAddBankOpen, setIsAddBankOpen] = useState(false);
  const [dueMcqCount, setDueMcqCount] = useState(0);

  useEffect(() => {
    if (questionBanks.length > 0) {
      const { queue } = buildMcqSessionQueue(questionBanks, questionBanks, settings, mcqIntroductionsToday, exams);
      setDueMcqCount(queue.length);
    } else {
      setDueMcqCount(0);
    }
  }, [questionBanks, settings, mcqIntroductionsToday, exams]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setQuestionBanks((prevBanks) => moveQuestionBank(prevBanks, active.id as string, over.id as string));
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-2xl">My Question Banks</CardTitle>
            <div className="flex items-center gap-2">
              {dueMcqCount > 0 && (
                <Button asChild className="relative">
                  <Link to="/mcq-review/all">
                    Review MCQs
                    <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                      {dueMcqCount}
                    </span>
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link to="/question-bank/all/practice">Practice Now</Link>
              </Button>
              <Button onClick={() => setIsAddBankOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Bank
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <Link to="/settings/mcq">
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">MCQ Settings</span>
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {questionBanks.length > 0 ? (
            <div className="space-y-2">
              {questionBanks.map((bank) => (
                <QuestionBankItem key={bank.id} bank={bank} />
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              <p className="mb-2">You don't have any question banks yet.</p>
              <p>Click "Add New Bank" to get started!</p>
            </div>
          )}
          {questionBanks.length > 0 && <RootDroppable />}
        </CardContent>
      </Card>
      <AddQuestionBankDialog isOpen={isAddBankOpen} onOpenChange={setIsAddBankOpen} />
    </DndContext>
  );
};

export default QuestionBankManager;