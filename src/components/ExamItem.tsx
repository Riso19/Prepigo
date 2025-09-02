import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExamData } from '@/data/exams';
import { useDecks } from '@/contexts/DecksContext';
import { useSettings } from '@/contexts/SettingsContext';
import { getCardsForExam, calculateExamProgress, getMcqsForExam, calculateProjectedRetention } from '@/lib/exam-utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Calendar, Tag, MoreVertical, Trash2, Pencil, FileText, HelpCircle } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { useExams } from '@/contexts/ExamsContext';
import { showError, showSuccess } from '@/utils/toast';
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
import { useQuestionBanks } from '@/contexts/QuestionBankContext';
import { findDeckById } from '@/lib/deck-utils';
import { findQuestionBankById } from '@/lib/question-bank-utils';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

interface ExamItemProps {
  exam: ExamData;
}

export const ExamItem = ({ exam }: ExamItemProps) => {
  const { decks } = useDecks();
  const { questionBanks } = useQuestionBanks();
  const { settings } = useSettings();
  const { deleteExam } = useExams();
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const cardsInScope = useMemo(() => getCardsForExam(exam, decks, settings), [exam, decks, settings]);
  const mcqsInScope = useMemo(() => getMcqsForExam(exam, questionBanks, settings), [exam, questionBanks, settings]);
  const itemsInScope = useMemo(() => [...cardsInScope, ...mcqsInScope], [cardsInScope, mcqsInScope]);

  const progress = useMemo(() => calculateExamProgress(exam, itemsInScope, settings), [exam, itemsInScope, settings]);
  const projectedRetention = useMemo(() => calculateProjectedRetention(exam, itemsInScope, settings), [exam, itemsInScope, settings]);

  const deckNames = useMemo(() => {
    return exam.deckIds
      .map(id => findDeckById(decks, id)?.name)
      .filter(Boolean) as string[];
  }, [exam.deckIds, decks]);

  const questionBankNames = useMemo(() => {
    return (exam.questionBankIds || [])
      .map(id => findQuestionBankById(questionBanks, id)?.name)
      .filter(Boolean) as string[];
  }, [exam.questionBankIds, questionBanks]);

  const examDate = new Date(exam.date);
  const daysLeft = differenceInDays(examDate, new Date());

  const getDaysLeftText = () => {
    if (isPast(examDate) && daysLeft < 0) return "Exam date has passed";
    if (daysLeft === 0) return "Today is the day!";
    if (daysLeft === 1) return "1 day left";
    return `${daysLeft} days left`;
  };

  const getReadinessColor = (percentage: number) => {
    if (percentage < 50) return "text-destructive";
    if (percentage < 75) return "text-yellow-500";
    return "text-green-500";
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
                <Button variant="ghost" size="icon" disabled={isDeleting}><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild><Link to={`/exams/${exam.id}/edit`}><Pencil className="mr-2 h-4 w-4" />Edit Exam</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsDeleteAlertOpen(true)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete Exam</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Readiness Score</p>
              <p className={cn("text-3xl font-bold", getReadinessColor(progress.percentage))}>
                {progress.percentage}%
              </p>
              <p className="text-xs text-muted-foreground">
                {progress.mastered} mastered, {progress.newItems} new
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Projected Retention</p>
              <p className={cn("text-3xl font-bold", getReadinessColor(projectedRetention ?? 0))}>
                {projectedRetention !== null ? `${projectedRetention.toFixed(1)}%` : 'N/A'}
              </p>
              <p className="text-xs text-muted-foreground">
                Est. recall on exam day
              </p>
            </div>
          </div>
          <Progress value={progress.percentage} className="mt-2" />
          <div className="flex flex-wrap gap-2 mt-3">
            <Button asChild variant="secondary" size="sm">
              <Link to={`/exams/${exam.id}/progress`}>View Progress</Link>
            </Button>
          </div>
          
          <div className="pt-4 border-t">
            <h4 className="text-sm font-semibold mb-2">Scope ({itemsInScope.length} items)</h4>
            <div className="space-y-3">
              {deckNames.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-sm text-foreground/90">Decks</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pl-6">
                    {deckNames.map(name => <Badge key={name} variant="outline" className="font-normal">{name}</Badge>)}
                  </div>
                </div>
              )}
              {questionBankNames.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <HelpCircle className="h-4 w-4 text-purple-500 flex-shrink-0" />
                    <span className="font-medium text-sm text-foreground/90">Question Banks</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pl-6">
                    {questionBankNames.map(name => <Badge key={name} variant="outline" className="font-normal">{name}</Badge>)}
                  </div>
                </div>
              )}
              {exam.tags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Tag className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <span className="font-medium text-sm text-foreground/90">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pl-6">
                    {exam.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={(open) => { if (!isDeleting) setIsDeleteAlertOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the exam schedule for "{exam.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (isDeleting) return;
                setIsDeleting(true);
                try {
                  await deleteExam(exam.id);
                  showSuccess(`Exam "${exam.name}" deleted.`);
                  setIsDeleteAlertOpen(false);
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  showError(`Failed to delete exam: ${msg}`);
                } finally {
                  setIsDeleting(false);
                }
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting…' : 'Yes, delete exam'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};