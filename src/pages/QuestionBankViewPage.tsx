import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuestionBanks } from '@/contexts/QuestionBankContext';
import { findQuestionBankById, getAllMcqsFromBank, deleteMcq, findQuestionBankPathById } from '@/lib/question-bank-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { ArrowLeft, Home, Pencil, Trash2, PlusCircle, CheckCircle2 } from 'lucide-react';
import { McqData } from '@/data/questionBanks';
import { showSuccess } from '@/utils/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { HtmlRenderer } from '@/components/HtmlRenderer';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const QuestionBankViewPage = () => {
  const { bankId } = useParams<{ bankId: string }>();
  const { questionBanks, setQuestionBanks } = useQuestionBanks();
  const navigate = useNavigate();
  const [mcqToDelete, setMcqToDelete] = useState<McqData | null>(null);
  const isMobile = useIsMobile();

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

  const renderDesktopView = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Question</TableHead>
          <TableHead>Options</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead className="text-right w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {mcqs.map(mcq => (
          <TableRow key={mcq.id}>
            <TableCell>
              <HtmlRenderer html={mcq.question} className="prose dark:prose-invert max-w-md" />
            </TableCell>
            <TableCell>
              <ul className="list-disc pl-5 space-y-1 max-w-md">
                {mcq.options.map(opt => (
                  <li key={opt.id} className={cn(opt.isCorrect && "font-semibold text-primary")}>
                    <HtmlRenderer html={opt.text} className="inline prose dark:prose-invert max-w-none" />
                    {opt.isCorrect && <CheckCircle2 className="inline ml-2 h-4 w-4 text-green-600" />}
                  </li>
                ))}
              </ul>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1 max-w-[200px]">
                {mcq.tags?.map(tag => <Badge key={tag} variant="outline" className="font-normal">{tag}</Badge>)}
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/question-bank/${bank.id}/edit/${mcq.id}`}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setMcqToDelete(mcq)} className="text-destructive hover:text-destructive focus:text-destructive focus:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const renderMobileView = () => (
    <div className="space-y-4">
      {mcqs.map(mcq => (
        <Card key={mcq.id}>
          <CardContent className="p-4 space-y-4">
            <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Question</p>
                    <HtmlRenderer html={mcq.question} className="prose dark:prose-invert max-w-none" />
                </div>
                <div className="flex items-center justify-end gap-2 flex-shrink-0">
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" asChild><Link to={`/question-bank/${bank.id}/edit/${mcq.id}`}><Pencil className="h-4 w-4" /><span className="sr-only">Edit</span></Link></Button></TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setMcqToDelete(mcq)} className="text-destructive hover:text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span></Button></TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Options</p>
              <ul className="list-disc pl-5 space-y-1">
                {mcq.options.map(opt => (
                  <li key={opt.id} className={cn(opt.isCorrect && "font-semibold text-primary")}>
                    <HtmlRenderer html={opt.text} className="inline prose dark:prose-invert max-w-none" />
                    {opt.isCorrect && <CheckCircle2 className="inline ml-2 h-4 w-4 text-green-600" />}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Tags</p>
              <div className="flex flex-wrap gap-1">
                {mcq.tags?.map(tag => <Badge key={tag} variant="outline" className="font-normal">{tag}</Badge>)}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

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
              isMobile ? renderMobileView() : renderDesktopView()
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