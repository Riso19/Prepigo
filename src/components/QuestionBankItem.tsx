import { useState } from "react";
import { Link } from "react-router-dom";
import { QuestionBankData } from "@/data/questionBanks";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "./ui/button";
import { ChevronRight, Folder, MoreVertical, Plus, Settings, GripVertical, Trash2, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { AddSubQuestionBankDialog } from "./AddSubQuestionBankDialog";
import { deleteQuestionBank } from "@/lib/question-bank-utils";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useQuestionBanks } from "@/contexts/QuestionBankContext";
import { showSuccess } from "@/utils/toast";
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

const QuestionBankItem = ({ bank }: { bank: QuestionBankData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddSubBankOpen, setIsAddSubBankOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const { setQuestionBanks } = useQuestionBanks();

  const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
    id: bank.id,
  });
  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: bank.id,
  });

  const hasSubBanks = bank.subBanks && bank.subBanks.length > 0;

  const handleDelete = () => {
    setQuestionBanks(prevBanks => deleteQuestionBank(prevBanks, bank.id));
    showSuccess(`Question Bank "${bank.name}" and all its contents deleted.`);
    setIsDeleteAlertOpen(false);
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
                <Folder className="h-5 w-5 text-primary" />
                <span className="font-semibold">{bank.name}</span>
              </button>
            </CollapsibleTrigger>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Bank options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/question-bank/${bank.id}/practice`}>
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Practice MCQs
                  </Link>
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
                <DropdownMenuItem onClick={() => setIsAddSubBankOpen(true)}>
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
                <QuestionBankItem key={subBank.id} bank={subBank} />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
      <AddSubQuestionBankDialog isOpen={isAddSubBankOpen} onOpenChange={setIsAddSubBankOpen} parentBankId={bank.id} />
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the question bank "{bank.name}" and all of its sub-banks and MCQs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, delete bank
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default QuestionBankItem;