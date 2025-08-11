import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllExamLogsFromDB } from '@/lib/idb';
import { ExamLog } from '@/data/examLogs';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { History } from 'lucide-react';

const ExamHistoryPage = () => {
  const [examLogs, setExamLogs] = useState<ExamLog[]>([]);
  const [hasMistakes, setHasMistakes] = useState(false);

  useEffect(() => {
    getAllExamLogsFromDB().then(logs => {
      const sortedLogs = logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExamLogs(sortedLogs);
      setHasMistakes(sortedLogs.some(log => log.results.incorrectCount > 0));
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl">Exam History</CardTitle>
                <CardDescription>Review your past exam attempts and performance.</CardDescription>
              </div>
              {hasMistakes && (
                <Button asChild>
                  <Link to="/exam/mistakes/all/setup">
                    <History className="mr-2 h-4 w-4" />
                    Review All Mistakes
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {examLogs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {examLogs.map(log => {
                    const totalMarks = log.settings.totalQuestions * log.settings.marksPerCorrect;
                    const percentage = totalMarks > 0 ? (log.results.score / totalMarks) * 100 : 0;
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.name}</TableCell>
                        <TableCell>{format(new Date(log.date), 'PPP p')}</TableCell>
                        <TableCell>{log.results.score.toFixed(2)} / {totalMarks} ({percentage.toFixed(1)}%)</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link to={`/exam/results/${log.id}`}>
                              View Results
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>You haven't completed any exams yet.</p>
                <Button asChild className="mt-4">
                  <Link to="/mcq-practice/setup">Take a Practice Exam</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ExamHistoryPage;