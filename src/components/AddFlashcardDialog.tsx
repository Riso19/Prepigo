import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDecks } from "@/contexts/DecksContext";
import { FlashcardData } from "@/data/decks";
import { addFlashcardToDeck } from "@/lib/deck-utils";

const formSchema = z.object({
  question: z.string().min(1, "Question is required."),
  answer: z.string().min(1, "Answer is required."),
});

interface AddFlashcardDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  parentDeckId: string;
}

export const AddFlashcardDialog = ({ isOpen, onOpenChange, parentDeckId }: AddFlashcardDialogProps) => {
  const { decks, setDecks } = useDecks();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { question: "", answer: "" },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const newFlashcard: FlashcardData = {
      id: Date.now(),
      question: values.question,
      answer: values.answer,
    };
    setDecks(addFlashcardToDeck(decks, parentDeckId, newFlashcard));
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Flashcard</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question</FormLabel>
                  <FormControl>
                    <Textarea placeholder="What is the capital of France?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="answer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Answer</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Paris" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Create Flashcard</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};