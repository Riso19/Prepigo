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
import { useDecks } from "@/contexts/DecksContext";
import { DeckData } from "@/data/decks";
import { updateDeck } from "@/lib/deck-utils";
import { useEffect } from "react";

const formSchema = z.object({
  name: z.string().min(1, "Deck name is required."),
});

interface EditDeckDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  deck: DeckData | null;
}

export const EditDeckDialog = ({ isOpen, onOpenChange, deck }: EditDeckDialogProps) => {
  const { setDecks } = useDecks();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (deck) {
      form.reset({ name: deck.name });
    }
  }, [deck, form, isOpen]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!deck) return;

    const updatedDeck: DeckData = {
      ...deck,
      name: values.name,
    };
    setDecks((prevDecks) => updateDeck(prevDecks, updatedDeck));
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Deck Name</DialogTitle>
          <DialogDescription>
            Enter a new name for your deck.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deck Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Pharmacology" {...field} />
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