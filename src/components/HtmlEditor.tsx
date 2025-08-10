import { useRef, useState, useEffect, useCallback, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Subscript, Superscript } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useResolvedHtml, unresolveMediaHtml } from '@/hooks/use-resolved-html';

interface HtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const HtmlEditor = ({ value, onChange, placeholder }: HtmlEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isSubscript, setIsSubscript] = useState(false);
  const [isSuperscript, setIsSuperscript] = useState(false);
  const resolvedValue = useResolvedHtml(value);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== resolvedValue) {
      editorRef.current.innerHTML = resolvedValue;
    }
  }, [resolvedValue]);

  const updateToolbar = useCallback(() => {
    setTimeout(() => {
      setIsBold(document.queryCommandState('bold'));
      setIsItalic(document.queryCommandState('italic'));
      setIsSubscript(document.queryCommandState('subscript'));
      setIsSuperscript(document.queryCommandState('superscript'));
    }, 0);
  }, []);

  const handleFormat = (command: 'bold' | 'italic' | 'subscript' | 'superscript') => {
    if (command === 'subscript' || command === 'superscript') {
      const otherCommand = command === 'subscript' ? 'superscript' : 'subscript';
      if (document.queryCommandState(otherCommand)) {
        document.execCommand(otherCommand, false);
      }
    }
    
    document.execCommand(command, false);

    if (editorRef.current) {
      const rawHtml = editorRef.current.innerHTML;
      const originalUrlHtml = unresolveMediaHtml(rawHtml);
      onChange(originalUrlHtml);
      editorRef.current.focus();
      updateToolbar();
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      const rawHtml = editorRef.current.innerHTML;
      const originalUrlHtml = unresolveMediaHtml(rawHtml);
      onChange(originalUrlHtml);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ') {
      if (document.queryCommandState('subscript')) {
        document.execCommand('subscript', false);
      }
      if (document.queryCommandState('superscript')) {
        document.execCommand('superscript', false);
      }
    }
  };

  const activeClass = "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";

  return (
    <div className="border rounded-md bg-background">
      <div className="flex items-center gap-1 p-1 border-b">
        <Button
          variant="ghost"
          size="icon"
          className={cn(isBold && activeClass)}
          onMouseDown={(e) => { e.preventDefault(); handleFormat('bold'); }}
          aria-pressed={isBold}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(isItalic && activeClass)}
          onMouseDown={(e) => { e.preventDefault(); handleFormat('italic'); }}
          aria-pressed={isItalic}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(isSubscript && activeClass)}
          onMouseDown={(e) => { e.preventDefault(); handleFormat('subscript'); }}
          aria-pressed={isSubscript}
          title="Subscript"
        >
          <Subscript className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(isSuperscript && activeClass)}
          onMouseDown={(e) => { e.preventDefault(); handleFormat('superscript'); }}
          aria-pressed={isSuperscript}
          title="Superscript"
        >
          <Superscript className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className="min-h-[100px] p-2 focus:outline-none prose dark:prose-invert max-w-none"
        data-placeholder={placeholder}
        onMouseUp={updateToolbar}
        onKeyUp={updateToolbar}
        onFocus={updateToolbar}
      />
    </div>
  );
};

export default HtmlEditor;