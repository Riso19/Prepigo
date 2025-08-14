import * as React from 'react';
import { QuestionBankData } from '@/data/questionBanks';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuestionBankTreeRadioSelectorProps {
  banks: QuestionBankData[];
  selectedBankId: string | null;
  onSelectionChange: (selectedId: string) => void;
  currentBankId?: string; // To disable the current bank
}

const BankNode = ({ bank, selectedBankId, onSelectionChange, currentBankId, isRoot = false }: { bank: QuestionBankData, isRoot?: boolean } & Omit<QuestionBankTreeRadioSelectorProps, 'banks'>) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const isCurrent = bank.id === currentBankId;

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
        <RadioGroupItem value={bank.id} id={`bank-radio-${bank.id}`} disabled={isCurrent} />
        <Label htmlFor={`bank-radio-${bank.id}`} className={cn("font-medium", isCurrent && "text-muted-foreground italic")}>
          {bank.name} {isCurrent && "(current)"}
        </Label>
      </div>
      {bank.subBanks && bank.subBanks.length > 0 && (
        <CollapsibleContent className="border-l-2 border-dashed ml-5">
          {bank.subBanks.map(subBank => (
            <BankNode key={subBank.id} bank={subBank} selectedBankId={selectedBankId} onSelectionChange={onSelectionChange} currentBankId={currentBankId} />
          ))}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
};

export const QuestionBankTreeRadioSelector = ({ banks, selectedBankId, onSelectionChange, currentBankId }: QuestionBankTreeRadioSelectorProps) => {
  return (
    <RadioGroup value={selectedBankId || undefined} onValueChange={onSelectionChange}>
      <div className="p-2 border rounded-md max-h-72 overflow-y-auto">
        {banks.map(bank => (
          <BankNode key={bank.id} bank={bank} selectedBankId={selectedBankId} onSelectionChange={onSelectionChange} currentBankId={currentBankId} isRoot />
        ))}
      </div>
    </RadioGroup>
  );
};