import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuestionBanks } from '@/contexts/QuestionBankContext';
import { findQuestionBankById, getAllMcqsFromBank, deleteMcq, findQuestionBankPathById, findParentBankOfMcq } from '@/lib/question-bank-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { ArrowLeft, Home, PlusCircle, Settings } from 'lucide-react';
import { McqData } from '@/data/questionBanks';
import { showSuccess, showError } from '@/utils/toast';
import { McqListItem } from '@/components/McqListItem';
import { useSettings } from '@/contexts/SettingsContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { QuestionBankSettingsForm } from '@/components/QuestionBankSettingsForm';
import { MoveMcqDialog } from '@/components/MoveMcqDialog';

const QuestionBankViewPage = () => {
  const { bankId } = useParams<{ bankId: string }>();
  const { questionBanks, setQuestionBanks } = useQuestionBanks();
  const navigate = useNavigate();
  const [mcqToDelete, setMcqToDelete] = useState<McqData | null>(null);
  const { settings } = useSettings();
  const [mcqToMove, setMcqToMove] = useState<McqData | null>(null);
  const [sourceBankId, setSourceBankId] = useState<string | null>(null);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);

  const bank = useMemo(() => (bankId ? findQuestionBankById(questionBanks, bankId) : null), [questionBanks, bankId]);
  const bankPath = useMemo(() => (bankId ? findQuestionBankPathById(questionBanks, bankId)?.join(' / ') : null), [questionBanks, bankId]);
  const mcqs = useMemo(() => (bank ? getAllMcqsFromBank(bank) : []), [bank]);

  const handleDeleteConfirm = () => {
    if (mcqToDelete) {
      setQuestionBanks(prevBanks => deleteMcq(prevBanks, mcqToDelete.id));
      showSuccess("MCQ deleted successfully.");
      setMcqToDelete(null);
    }
  };

  const handleOpenMoveDialog = (mcq: McqData) => {
    const parentBank = findParentBankOfMcq(questionBanks, mcq.id);
    if (parentBank) {
      setSourceBankId(parentBank.id);
      setMcqToMove(mcq);
      setIsMoveDialogOpen(true);
    } else {
      showError("Could not find the source bank for this MCQ.");
    }
  };

  if (!bank) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold mb-4">Question Bank not found</h2>
        <Button asChild>
          <Link to="/question-bank"><Home className="mr-2 h-4 w-4" /> Go back to Question Banks</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-secondary/50 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-6xl">
        <Button variant="ghost" onClick={() => navigate('/question-bank')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Question Banks
        </Button>

        <Accordion type="single" collapsible className="w-full mb-6">
          <AccordionItem value="bank-settings">
            <AccordionTrigger>
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Settings className="h-5 w-5" />
                Bank Specific Settings
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <QuestionBankSettingsForm bank={bank} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="text-2xl">Manage: {bank.name}</CardTitle>
                    <CardDescription>
                        Path: {bankPath || bank.name}
                        <br />
                        {mcqs.length} MCQ(s) in this bank and its sub-banks.
                    </CardDescription>
                </div>
                <Button asChild>
                    <Link to={`/question-bank/${bank.id}/add`}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New MCQ
                    </Link>
                </Button>
            </div>
          </CardHeader>
          <CardContent>
            {mcqs.length > 0 ? (
              <div className="space-y-4">
                {mcqs.map(mcq => (
                  <McqListItem 
                    key={mcq.id} 
                    mcq={mcq} 
                    bankId={bank.id} 
                    onDelete={setMcqToDelete} 
                    onMove={handleOpenMoveDialog}
                    scheduler={settings.scheduler === 'sm2' ? 'fsrs' : settings.scheduler}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <p className="mb-2">This question bank is empty.</p>
                <p>Click "Add New MCQ" to get started!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!mcqToDelete} onOpenChange={() => setMcqToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the MCQ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MoveMcqDialog
        isOpen={isMoveDialogOpen}
        onOpenChange={setIsMoveDialogOpen}
        mcqToMove={mcqToMove}
        sourceBankId={sourceBankId}
      />
    </div>
  );
};

export default QuestionBankViewPage;