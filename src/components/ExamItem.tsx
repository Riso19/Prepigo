import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ExamData } from '@/data/exams';
import { useDecks } from '@/contexts/DecksContext';
import { useSettings } from '@/contexts/SettingsContext';
import { getCardsForExam, calculateExamProgress, getMcqsForExam } from '@/lib/exam-utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Calendar, Tag, MoreVertical, Trash2, Pencil, FileText, HelpCircle } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { useExams } from '@/contexts/ExamsContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from 'react';
import { useQuestionBanks } from '@/contexts/QuestionBankContext';

interface ExamItemProps {
  exam: ExamData;
}

export const ExamItem = ({ exam }: ExamItemProps) => {
  const { decks } = useDecks();
  const { questionBanks } = useQuestionBanks();
  const { settings } = useSettings();
  const { deleteExam } = useExams();
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  const cardsInScope = useMemo(() => getCardsForExam(exam, decks, settings), [exam, decks, settings]);
  const mcqsInScope = useMemo(() => getMcqsForExam(exam, questionBanks, settings), [exam, questionBanks, settings]);
  const itemsInScope = useMemo(() => [...cardsInScope, ...mcqsInScope], [cardsInScope, mcqsInScope]);

  const progress = useMemo(() => calculateExamProgress(exam, itemsInScope, settings), [exam, itemsInScope, settings]);

  const examDate = new Date(exam.date);
  const daysLeft = differenceInDays(examDate, new Date());

  const getDaysLeftText = () => {
    if (isPast(examDate)) return "Exam date has passed";
    if (daysLeft === 0) return "Today is the day!";
    if (daysLeft === 1) return "1 day left";
    return `${daysLeft} days left`;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{exam.name}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4" />
                <span>{format(examDate, 'PPP')}</span>
                <span className="text-primary font-semibold">({getDaysLeftText()})</span>
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild><Link to={`/exams/${exam.id}/edit`}><Pencil className="mr-2 h-4 w-4" />Edit Exam</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsDeleteAlertOpen(true)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete Exam</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">Progress</span>
              <span className="text-muted-foreground">{progress.mastered} / {progress.total} items mastered</span>
            </div>
            <Progress value={progress.percentage} />
            <p className="text-xs text-muted-foreground">An item is "mastered" when its next review is after the exam date.</p>
          </div>
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-semibold mb-2">Scope</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-500" />
                <span>{exam.deckIds.length} deck(s)</span>
              </div>
              {exam.questionBankIds?.length > 0 && (
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-purple-500" />
                  <span>{exam.questionBankIds.length} question bank(s)</span>
                </div>
              )}
              {exam.tags.length > 0 && (
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-blue-500" />
                  <span>{exam.tags.length} tag(s)</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the exam schedule for "{exam.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteExam(exam.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, delete exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};