import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useQuestionBanks } from "@/contexts/QuestionBankContext";
import QuestionBankItem from "@/components/QuestionBankItem";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { AddQuestionBankDialog } from "./AddQuestionBankDialog";
import { DndContext, DragEndEvent, useDroppable } from "@dnd-kit/core";
import { moveQuestionBank } from "@/lib/question-bank-utils";

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
  const { questionBanks, setQuestionBanks } = useQuestionBanks();
  const [isAddBankOpen, setIsAddBankOpen] = useState(false);

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
              <Button onClick={() => {}}>
                Practice Now
              </Button>
              <Button onClick={() => setIsAddBankOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Bank
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