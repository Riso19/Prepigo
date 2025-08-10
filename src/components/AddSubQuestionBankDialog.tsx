import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useQuestionBanks } from "@/contexts/QuestionBankContext";
import { QuestionBankData } from "@/data/questionBanks";
import { addSubBankToBank } from "@/lib/question-bank-utils";

const formSchema = z.object({
  name: z.string().min(1, "Sub-bank name is required."),
});

interface AddSubQuestionBankDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  parentBankId: string;
}

export const AddSubQuestionBankDialog = ({ isOpen, onOpenChange, parentBankId }: AddSubQuestionBankDialogProps) => {
  const { questionBanks, setQuestionBanks } = useQuestionBanks();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const newSubBank: QuestionBankData = {
      id: `sqb${Date.now()}`,
      name: values.name,
      mcqs: [],
      subBanks: [],
    };
    setQuestionBanks(addSubBankToBank(questionBanks, parentBankId, newSubBank));
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Sub-Bank</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sub-Bank Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Pharmacology MCQs" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Create Sub-Bank</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};