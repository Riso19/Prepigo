import * as React from 'react';
import { QuestionBankData } from '@/data/questionBanks';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuestionBankTreeSelectorProps {
  banks: QuestionBankData[];
  selectedBankIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
}

const getAllChildBankIds = (bank: QuestionBankData): string[] => {
  let ids = [bank.id];
  if (bank.subBanks) {
    for (const subBank of bank.subBanks) {
      ids = [...ids, ...getAllChildBankIds(subBank)];
    }
  }
  return ids;
};

const BankNode = ({ bank, selectedBankIds, onSelectionChange, isRoot = false }: { bank: QuestionBankData, isRoot?: boolean } & Omit<QuestionBankTreeSelectorProps, 'banks'>) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const allChildrenIds = React.useMemo(() => getAllChildBankIds(bank), [bank]);
  
  const isChecked = allChildrenIds.every(id => selectedBankIds.has(id));

  const handleCheckedChange = (checked: boolean | 'indeterminate') => {
    const newSelectedIds = new Set(selectedBankIds);
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
        {bank.subBanks && bank.subBanks.length > 0 ? (
          <CollapsibleTrigger asChild>
            <button className="p-1">
              <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
            </button>
          </CollapsibleTrigger>
        ) : (
          <div className="w-8 h-4" /> // Placeholder for alignment
        )}
        <Checkbox
          id={`bank-select-${bank.id}`}
          checked={isChecked}
          onCheckedChange={handleCheckedChange}
          aria-label={`Select bank ${bank.name}`}
        />
        <label htmlFor={`bank-select-${bank.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {bank.name}
        </label>
      </div>
      {bank.subBanks && bank.subBanks.length > 0 && (
        <CollapsibleContent className="border-l-2 border-dashed ml-5">
          {bank.subBanks.map(subBank => (
            <BankNode key={subBank.id} bank={subBank} selectedBankIds={selectedBankIds} onSelectionChange={onSelectionChange} />
          ))}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
};

export const QuestionBankTreeSelector = ({ banks, selectedBankIds, onSelectionChange }: QuestionBankTreeSelectorProps) => {
  return (
    <div className="p-2 border rounded-md max-h-72 overflow-y-auto">
      {banks.map(bank => (
        <BankNode key={bank.id} bank={bank} selectedBankIds={selectedBankIds} onSelectionChange={onSelectionChange} isRoot />
      ))}
    </div>
  );
};