import * as React from 'react';
import { DeckData } from '@/data/decks';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeckTreeSelectorProps {
  decks: DeckData[];
  selectedDeckIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
}

const getAllChildDeckIds = (deck: DeckData): string[] => {
  let ids = [deck.id];
  if (deck.subDecks) {
    for (const subDeck of deck.subDecks) {
      ids = [...ids, ...getAllChildDeckIds(subDeck)];
    }
  }
  return ids;
};

const DeckNode = ({ deck, selectedDeckIds, onSelectionChange, isRoot = false }: { deck: DeckData, isRoot?: boolean } & Omit<DeckTreeSelectorProps, 'decks'>) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const allChildrenIds = React.useMemo(() => getAllChildDeckIds(deck), [deck]);
  
  const isChecked = allChildrenIds.every(id => selectedDeckIds.has(id));

  const handleCheckedChange = (checked: boolean | 'indeterminate') => {
    const newSelectedIds = new Set(selectedDeckIds);
    if (checked) {
      allChildrenIds.forEach(id => newSelectedIds.add(id));
    } else {
      allChildrenIds.forEach(id => newSelectedIds.delete(id));
    }
    onSelectionChange(newSelectedIds);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn(!isRoot && "ml-4")}>
      <div className="flex items-center space-x-2 py-1">
        {deck.subDecks && deck.subDecks.length > 0 ? (
          <CollapsibleTrigger asChild>
            <button className="p-1">
              <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
            </button>
          </CollapsibleTrigger>
        ) : (
          <div className="w-8 h-4" /> // Placeholder for alignment
        )}
        <Checkbox
          id={`deck-select-${deck.id}`}
          checked={isChecked}
          onCheckedChange={handleCheckedChange}
          aria-label={`Select deck ${deck.name}`}
        />
        <label htmlFor={`deck-select-${deck.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {deck.name}
        </label>
      </div>
      {deck.subDecks && deck.subDecks.length > 0 && (
        <CollapsibleContent className="border-l-2 border-dashed ml-5">
          {deck.subDecks.map(subDeck => (
            <DeckNode key={subDeck.id} deck={subDeck} selectedDeckIds={selectedDeckIds} onSelectionChange={onSelectionChange} />
          ))}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
};

export const DeckTreeSelector = ({ decks, selectedDeckIds, onSelectionChange }: DeckTreeSelectorProps) => {
  return (
    <div className="p-2 border rounded-md max-h-72 overflow-y-auto">
      {decks.map(deck => (
        <DeckNode key={deck.id} deck={deck} selectedDeckIds={selectedDeckIds} onSelectionChange={onSelectionChange} isRoot />
      ))}
    </div>
  );
};