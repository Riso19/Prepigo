import { Link } from 'react-router-dom';
import { useExams } from '@/contexts/ExamsContext';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { ExamItem } from '@/components/ExamItem';

const ExamSchedulerPage = () => {
  const { exams } = useExams();
  const sortedExams = [...exams].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Upcoming Exams</h1>
          <Button asChild>
            <Link to="/exams/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Schedule New Exam
            </Link>
          </Button>
        </div>
        {sortedExams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedExams.map(exam => (
              <ExamItem key={exam.id} exam={exam} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border-2 border-dashed rounded-lg">
            <h2 className="text-xl font-semibold">No Exams Scheduled</h2>
            <p className="text-muted-foreground mt-2">Click "Schedule New Exam" to get started.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ExamSchedulerPage;