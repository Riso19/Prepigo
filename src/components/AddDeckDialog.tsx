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

const formSchema = z.object({
  name: z.string().min(1, "Deck name is required."),
});

interface AddDeckDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const AddDeckDialog = ({ isOpen, onOpenChange }: AddDeckDialogProps) => {
  const { setDecks } = useDecks();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const newDeck: DeckData = {
      id: `d${Date.now()}`,
      name: values.name,
      flashcards: [],
      subDecks: [],
    };
    setDecks((prevDecks) => [...prevDecks, newDeck]);
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Deck</DialogTitle>
          <DialogDescription>
            Enter a name for your new deck. You can add sub-decks and flashcards later.
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
              <Button type="submit">Create Deck</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};