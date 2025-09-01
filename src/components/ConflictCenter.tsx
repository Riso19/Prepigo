import { useEffect, useMemo, useState } from 'react';
import {
  listConflicts,
  computeFieldConflicts,
  applyResolution,
  deleteConflict,
  type ConflictRecord,
} from '@/lib/conflict';
import { subscribe } from '@/lib/broadcast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle } from 'lucide-react';

export default function ConflictCenter({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const items = await listConflicts();
      setConflicts(items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const unsub = subscribe((msg) => {
      if (msg.type === 'storage-write' || msg.type === 'sync-complete') {
        // Conflicts may change after sync or writes
        void refresh();
      }
    });
    return () => {
      if (unsub) {
        unsub();
      }
    };
  }, []);

  const count = conflicts.length;

  // Minimal footprint: hide trigger entirely when no conflicts
  if (count === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className={cn('pointer-events-auto relative', className)}
              aria-label={`Open conflicts (${count})`}
            >
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="sr-only">Open conflicts</span>
              {/* Red counter dot */}
              <span
                aria-hidden
                className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-red-600 text-[10px] font-medium text-white flex items-center justify-center"
              >
                {count}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            {count} conflict{count === 1 ? '' : 's'} to resolve
          </TooltipContent>
        </Tooltip>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resolve Conflicts</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : count === 0 ? (
            <div className="text-sm text-muted-foreground">No conflicts</div>
          ) : (
            <div className="space-y-4">
              {conflicts.map((c) => (
                <ConflictItem key={c.key} conflict={c} onResolved={refresh} />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 items-start text-sm">
      <div className="col-span-1 text-muted-foreground">{label}</div>
      <div className="col-span-2 break-words">{children}</div>
    </div>
  );
}

function ConflictItem({
  conflict,
  onResolved,
}: {
  conflict: ConflictRecord;
  onResolved: () => void;
}) {
  const fields = useMemo(
    () => conflict.fields ?? computeFieldConflicts(conflict.local, conflict.server),
    [conflict],
  );

  const handleKeep = async (which: 'local' | 'server') => {
    const resolved = which === 'local' ? conflict.local : conflict.server;
    // Pass through value; generic will infer the type from the argument
    await applyResolution(conflict.resource, conflict.id, resolved);
    await deleteConflict(conflict.resource, conflict.id);
    onResolved();
  };

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-medium">
          {conflict.resource} / {conflict.id}
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date(conflict.createdAt).toLocaleString()}
        </div>
      </div>
      <Row label="Fields in conflict">
        <div className="flex flex-wrap gap-2">
          {fields.map((f) => (
            <Badge key={f} variant="outline">
              {f}
            </Badge>
          ))}
        </div>
      </Row>
      <Row label="Local value">
        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
          {JSON.stringify(conflict.local, null, 2)}
        </pre>
      </Row>
      <Row label="Server value">
        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
          {JSON.stringify(conflict.server, null, 2)}
        </pre>
      </Row>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" onClick={() => void handleKeep('server')}>
          Keep Server
        </Button>
        <Button onClick={() => void handleKeep('local')}>Keep Local</Button>
      </div>
    </div>
  );
}
