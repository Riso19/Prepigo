import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useDecks } from "@/contexts/DecksContext";
import { DeckData } from "@/data/decks";
import { addSubDeckToDeck } from "@/lib/deck-utils";

const formSchema = z.object({
  name: z.string().min(1, "Sub-deck name is required."),
});

interface AddSubDeckDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  parentDeckId: string;
}

export const AddSubDeckDialog = ({ isOpen, onOpenChange, parentDeckId }: AddSubDeckDialogProps) => {
  const { decks, setDecks } = useDecks();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const newSubDeck: DeckData = {
      id: `sd${Date.now()}`,
      name: values.name,
      flashcards: [],
      subDecks: [],
    };
    setDecks(addSubDeckToDeck(decks, parentDeckId, newSubDeck));
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Sub-Deck</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sub-Deck Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Antibiotics" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Create Sub-Deck</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};