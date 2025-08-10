import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuestionBanks } from '@/contexts/QuestionBankContext';
import { findQuestionBankById, getAllMcqsFromBank, deleteMcq, findQuestionBankPathById } from '@/lib/question-bank-utils';
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
import { ArrowLeft, Home, PlusCircle } from 'lucide-react';
import { McqData } from '@/data/questionBanks';
import { showSuccess } from '@/utils/toast';
import { McqListItem } from '@/components/McqListItem';

const QuestionBankViewPage = () => {
  const { bankId } = useParams<{ bankId: string }>();
  const { questionBanks, setQuestionBanks } = useQuestionBanks();
  const navigate = useNavigate();
  const [mcqToDelete, setMcqToDelete] = useState<McqData | null>(null);

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
    </div>
  );
};

export default QuestionBankViewPage;