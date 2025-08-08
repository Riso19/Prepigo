import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Subscript, Superscript, Baseline } from 'lucide-react';

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

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const updateToolbar = useCallback(() => {
    setTimeout(() => {
      setIsBold(document.queryCommandState('bold'));
      setIsItalic(document.queryCommandState('italic'));
      setIsSubscript(document.queryCommandState('subscript'));
      setIsSuperscript(document.queryCommandState('superscript'));
    }, 0);
  }, []);

  const handleFormat = (command: 'bold' | 'italic' | 'subscript' | 'superscript') => {
    // Make subscript and superscript mutually exclusive
    if (command === 'subscript' || command === 'superscript') {
      const otherCommand = command === 'subscript' ? 'superscript' : 'subscript';
      if (document.queryCommandState(otherCommand)) {
        document.execCommand(otherCommand, false);
      }
    }
    
    document.execCommand(command, false);

    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
      editorRef.current.focus();
      updateToolbar();
    }
  };

  const handleNormalFormat = () => {
    if (document.queryCommandState('subscript')) {
      document.execCommand('subscript', false);
    }
    if (document.queryCommandState('superscript')) {
      document.execCommand('superscript', false);
    }

    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
      editorRef.current.focus();
      updateToolbar();
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div className="border rounded-md bg-background">
      <div className="flex items-center gap-1 p-1 border-b">
        <Button
          variant={isBold ? 'secondary' : 'ghost'}
          size="icon"
          onMouseDown={(e) => { e.preventDefault(); handleFormat('bold'); }}
          aria-pressed={isBold}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={isItalic ? 'secondary' : 'ghost'}
          size="icon"
          onMouseDown={(e) => { e.preventDefault(); handleFormat('italic'); }}
          aria-pressed={isItalic}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant={isSubscript ? 'secondary' : 'ghost'}
          size="icon"
          onMouseDown={(e) => { e.preventDefault(); handleFormat('subscript'); }}
          aria-pressed={isSubscript}
          title="Subscript"
        >
          <Subscript className="h-4 w-4" />
        </Button>
        <Button
          variant={isSuperscript ? 'secondary' : 'ghost'}
          size="icon"
          onMouseDown={(e) => { e.preventDefault(); handleFormat('superscript'); }}
          aria-pressed={isSuperscript}
          title="Superscript"
        >
          <Superscript className="h-4 w-4" />
        </Button>
        <Button
          variant={'ghost'}
          size="icon"
          onMouseDown={(e) => { e.preventDefault(); handleNormalFormat(); }}
          title="Normal text"
        >
          <Baseline className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
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