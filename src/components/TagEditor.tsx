import * as React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Command as CommandPrimitive } from 'cmdk';
import { cn } from '@/lib/utils';

interface TagEditorProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  allTags: string[];
  className?: string;
}

export const TagEditor = ({ tags = [], onTagsChange, allTags, className }: TagEditorProps) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = React.useState('');
  const [open, setOpen] = React.useState(false);

  const handleSelect = (tag: string) => {
    setInputValue('');
    const newTags = [...tags, tag];
    onTagsChange(newTags);
  };

  const handleUnselect = (tag: string) => {
    onTagsChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ' ' || e.key === ',') && inputValue) {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (newTag && !tags.includes(newTag)) {
        handleSelect(newTag);
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      handleUnselect(tags[tags.length - 1]);
    }
  };

  const filteredSelectables = allTags.filter(
    (tag) => !tags.includes(tag) && tag.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className={cn('w-full', className)}>
      <Command
        onKeyDown={handleKeyDown}
        className="overflow-visible bg-transparent"
      >
        <div className="group rounded-md border border-input px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
                <button
                  className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onClick={() => handleUnselect(tag)}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </Badge>
            ))}
            <CommandPrimitive.Input
              ref={inputRef}
              value={inputValue}
              onValueChange={setInputValue}
              onBlur={() => setOpen(false)}
              onFocus={() => setOpen(true)}
              placeholder="Add tags..."
              className="ml-2 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="relative mt-2">
          {open && filteredSelectables.length > 0 && (
            <div className="absolute w-full z-10 top-0 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
              <CommandList>
                <CommandGroup heading="Suggestions">
                  {filteredSelectables.map((tag) => (
                    <CommandItem
                      key={tag}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onSelect={() => handleSelect(tag)}
                      className="cursor-pointer"
                    >
                      {tag}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </div>
          )}
        </div>
      </Command>
    </div>
  );
};