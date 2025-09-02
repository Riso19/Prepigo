import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { QuestionBankData } from "@/data/questionBanks";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "./ui/button";
import { ChevronRight, Folder, MoreVertical, Plus, Settings, GripVertical, Trash2, HelpCircle, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { AddSubQuestionBankDialog } from "./AddSubQuestionBankDialog";
import { getMcqDueCounts, getAllMcqsFromBank } from "@/lib/question-bank-utils";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useQuestionBanks } from "@/contexts/QuestionBankContext";
import { showSuccess, showError } from "@/utils/toast";
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
import { useSettings } from "@/contexts/SettingsContext";
import { McqReviewLog } from "@/lib/idb";
import { calculateAccuracy } from "@/lib/analytics-utils";
import { EditQuestionBankDialog } from "./EditQuestionBankDialog";

const QuestionBankItem = ({ bank, allLogs }: { bank: QuestionBankData; allLogs: McqReviewLog[] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddSubBankOpen, setIsAddSubBankOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isEditBankOpen, setIsEditBankOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { questionBanks, deleteQuestionBankById } = useQuestionBanks();
  const { settings } = useSettings();

  const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
    id: bank.id,
  });
  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: bank.id,
  });

  const hasSubBanks = bank.subBanks && bank.subBanks.length > 0;

  const dueCounts = useMemo(() => {
    return getMcqDueCounts(bank, questionBanks, settings);
  }, [bank, questionBanks, settings]);

  const accuracy = useMemo(() => {
    const allMcqIds = new Set(getAllMcqsFromBank(bank).map(m => m.id));
    if (allMcqIds.size === 0) return null;
    return calculateAccuracy(allMcqIds, allLogs);
  }, [bank, allLogs]);

  const getStrengthColor = (acc: number | null) => {
    if (acc === null) return "text-primary";
    if (acc < 60) return "text-red-500";
    if (acc < 85) return "text-yellow-500";
    return "text-green-500";
  };

  const totalDue = dueCounts.newCount + dueCounts.learnCount + dueCounts.dueCount;

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteQuestionBankById(bank.id);
      showSuccess(`Question Bank "${bank.name}" and all its contents deleted.`);
      setIsDeleteAlertOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showError(`Failed to delete question bank: ${msg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const containerStyle = {
    opacity: isDragging ? 0.5 : 1,
    outline: isOver ? '2px solid hsl(var(--primary))' : 'none',
    outlineOffset: '2px',
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
        <div ref={setDroppableRef} style={containerStyle} className="flex items-center justify-between space-x-2 pl-1 pr-1 py-1 rounded-lg hover:bg-accent group transition-all">
          <div className="flex items-center gap-1 flex-grow">
            <div {...listeners} {...attributes} ref={setDraggableRef} className="cursor-grab p-2 touch-none">
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-3 flex-grow text-left p-1 rounded-md">
                <ChevronRight className={cn("h-5 w-5 transition-transform duration-200", isOpen && "rotate-90", !hasSubBanks && "invisible")} />
                <Folder className={cn("h-5 w-5", getStrengthColor(accuracy))} />
                <span className="font-semibold">{bank.name}</span>
              </button>
            </CollapsibleTrigger>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-2 text-sm font-semibold px-2">
              <span className="text-blue-600 dark:text-blue-400">{dueCounts.newCount}</span>
              <span className="text-green-600 dark:text-green-400">{dueCounts.learnCount}</span>
              <span className="text-red-600 dark:text-red-400">{dueCounts.dueCount}</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isDeleting}>
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Bank options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {totalDue > 0 && (
                  <DropdownMenuItem asChild>
                    <Link to={`/mcq-review/${bank.id}`}>
                      <HelpCircle className="mr-2 h-4 w-4" />
                      Review Due
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to={`/question-bank/${bank.id}/practice`}>
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Practice MCQs
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsEditBankOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={`/question-bank/${bank.id}/view`}>
                    <Settings className="mr-2 h-4 w-4" />
                    Manage MCQs
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={`/question-bank/${bank.id}/add`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add MCQ
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsAddSubBankOpen(true)} disabled={isDeleting}>
                  <Folder className="mr-2 h-4 w-4" />
                  Add Sub-Bank
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsDeleteAlertOpen(true)}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Bank
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <CollapsibleContent className="space-y-2 pl-8 border-l-2 border-dashed ml-4">
          {hasSubBanks && (
            <div className="space-y-2 pt-2">
              {bank.subBanks!.map((subBank) => (
                <QuestionBankItem key={subBank.id} bank={subBank} allLogs={allLogs} />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
      <AddSubQuestionBankDialog isOpen={isAddSubBankOpen} onOpenChange={setIsAddSubBankOpen} parentBankId={bank.id} />
      <EditQuestionBankDialog isOpen={isEditBankOpen} onOpenChange={setIsEditBankOpen} bank={bank} />
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={(open) => { if (!isDeleting) setIsDeleteAlertOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the question bank "{bank.name}" and all of its sub-banks and MCQs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await handleDelete(); }} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? 'Deleting…' : 'Yes, delete bank'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default QuestionBankItem;