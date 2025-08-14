import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuestionBanks } from "@/contexts/QuestionBankContext";
import { McqData } from "@/data/questionBanks";
import { moveMcq } from "@/lib/question-bank-utils";
import { QuestionBankTreeRadioSelector } from './QuestionBankTreeRadioSelector';
import { showSuccess, showError } from '@/utils/toast';

interface MoveMcqDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  mcqToMove: McqData | null;
  sourceBankId: string | null;
}

export const MoveMcqDialog = ({ isOpen, onOpenChange, mcqToMove, sourceBankId }: MoveMcqDialogProps) => {
  const { questionBanks, setQuestionBanks } = useQuestionBanks();
  const [destinationBankId, setDestinationBankId] = useState<string | null>(null);

  const handleMove = () => {
    if (!mcqToMove || !destinationBankId) {
      showError("Please select a destination bank.");
      return;
    }

    setQuestionBanks(prevBanks => moveMcq(prevBanks, mcqToMove.id, destinationBankId));
    showSuccess("MCQ moved successfully.");
    onOpenChange(false);
    setDestinationBankId(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        setDestinationBankId(null);
      }
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Move MCQ</DialogTitle>
          <DialogDescription>
            Select a new question bank for this MCQ.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <QuestionBankTreeRadioSelector
            banks={questionBanks}
            selectedBankId={destinationBankId}
            onSelectionChange={setDestinationBankId}
            currentBankId={sourceBankId || undefined}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleMove} disabled={!destinationBankId}>Move MCQ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};