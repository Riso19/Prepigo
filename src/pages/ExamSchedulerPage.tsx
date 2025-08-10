import { useState } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useExams } from '@/contexts/ExamsContext';
import { ExamItem } from '@/components/ExamItem';
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
import { toast } from 'sonner';

const ExamSchedulerPage = () => {
  const navigate = useNavigate();
  const { exams, setExams } = useExams();
  const [examToDelete, setExamToDelete] = useState<string | null>(null);

  const handleDelete = () => {
    if (examToDelete) {
      setExams(prev => prev.filter(exam => exam.id !== examToDelete));
      toast.success("Exam schedule deleted.");
      setExamToDelete(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Exam Scheduler</h1>
          <Button onClick={() => navigate('/exams/new')}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create Exam Plan
          </Button>
        </div>

        {exams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map(exam => (
              <ExamItem key={exam.id} exam={exam} onDelete={() => setExamToDelete(exam.id)} />
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-20 border-2 border-dashed rounded-lg">
            <h2 className="text-xl font-semibold">No Exam Schedules Found</h2>
            <p className="mt-2">Click "Create Exam Plan" to get started.</p>
          </div>
        )}
      </main>

      <AlertDialog open={!!examToDelete} onOpenChange={() => setExamToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this exam schedule. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ExamSchedulerPage;