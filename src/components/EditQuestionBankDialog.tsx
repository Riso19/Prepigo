import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useQuestionBanks } from "@/contexts/QuestionBankContext";
import { QuestionBankData } from "@/data/questionBanks";
import { updateQuestionBank } from "@/lib/question-bank-utils";
import { useEffect } from "react";

const formSchema = z.object({
  name: z.string().min(1, "Bank name is required."),
});

interface EditQuestionBankDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bank: QuestionBankData | null;
}

export const EditQuestionBankDialog = ({ isOpen, onOpenChange, bank }: EditQuestionBankDialogProps) => {
  const { setQuestionBanks } = useQuestionBanks();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (bank) {
      form.reset({ name: bank.name });
    }
  }, [bank, form, isOpen]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!bank) return;

    const updatedBank: QuestionBankData = {
      ...bank,
      name: values.name,
    };
    setQuestionBanks((prevBanks) => updateQuestionBank(prevBanks, updatedBank));
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Bank Name</DialogTitle>
          <DialogDescription>
            Enter a new name for your question bank.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Cardiology MCQs" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};