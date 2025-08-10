import { Link } from 'react-router-dom';
import { McqData } from '@/data/questionBanks';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HtmlRenderer } from './HtmlRenderer';
import { CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { McqStatus } from './McqStatus';
import { State } from 'ts-fsrs';
import { DynamicDueDate } from './DynamicDueDate';

interface McqListItemProps {
  mcq: McqData;
  bankId: string;
  onDelete: (mcq: McqData) => void;
  scheduler: 'fsrs' | 'fsrs6';
}

export const McqListItem = ({ mcq, bankId, onDelete, scheduler }: McqListItemProps) => {
  return (
    <Card className="w-full overflow-hidden">
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-4">
          {/* Main Question Content */}
          <div className="md:col-span-7 lg:col-span-8 space-y-4">
            <HtmlRenderer html={mcq.question} className="prose dark:prose-invert max-w-none" />
          </div>

          {/* Sidebar with Details */}
          <div className="md:col-span-5 lg:col-span-4 space-y-4 md:border-l md:pl-6">
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Options</h4>
              <ul className="space-y-2">
                {mcq.options.map(opt => (
                  <li key={opt.id} className="flex items-start gap-2 text-sm">
                    <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center mt-0.5">
                      {opt.isCorrect && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    </div>
                    <HtmlRenderer html={opt.text} className={cn("prose dark:prose-invert prose-sm max-w-none", !opt.isCorrect && "text-muted-foreground")} />
                  </li>
                ))}
              </ul>
            </div>

            {mcq.tags && mcq.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {mcq.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Status</h4>
              <McqStatus mcq={mcq} scheduler={scheduler} />
            </div>

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Due Date</h4>
              <div>
                {(() => {
                  const srsData = scheduler === 'fsrs6' ? mcq.srs?.fsrs6 : mcq.srs?.fsrs;
                  const dueDate = srsData?.due;
                  const isNew = !srsData || srsData.state === State.New;

                  return (
                    <DynamicDueDate
                      dueDate={dueDate}
                      isNew={isNew}
                      isSuspended={mcq.srs?.isSuspended}
                    />
                  );
                })()}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" asChild>
                    <Link to={`/question-bank/${bankId}/edit/${mcq.id}`}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(mcq)} className="text-destructive hover:text-destructive focus:text-destructive focus:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};