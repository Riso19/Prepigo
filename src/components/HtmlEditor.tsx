import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Subscript, Superscript } from 'lucide-react';

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

  // This effect syncs the editor's content with the `value` prop from outside.
  // This is important for cases like clearing the form.
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  // This function checks the current selection and updates the toolbar buttons' state.
  const updateToolbar = () => {
    // We use a small timeout to allow the browser's selection to update
    // before we query its state.
    setTimeout(() => {
      setIsBold(document.queryCommandState('bold'));
      setIsItalic(document.queryCommandState('italic'));
      setIsSubscript(document.queryCommandState('subscript'));
      setIsSuperscript(document.queryCommandState('superscript'));
    }, 0);
  };

  const handleFormat = (command: string) => {
    document.execCommand(command, false);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
      editorRef.current.focus();
      updateToolbar(); // Update toolbar immediately after a format change.
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
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={isItalic ? 'secondary' : 'ghost'}
          size="icon"
          onMouseDown={(e) => { e.preventDefault(); handleFormat('italic'); }}
          aria-pressed={isItalic}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant={isSubscript ? 'secondary' : 'ghost'}
          size="icon"
          onMouseDown={(e) => { e.preventDefault(); handleFormat('subscript'); }}
          aria-pressed={isSubscript}
        >
          <Subscript className="h-4 w-4" />
        </Button>
        <Button
          variant={isSuperscript ? 'secondary' : 'ghost'}
          size="icon"
          onMouseDown={(e) => { e.preventDefault(); handleFormat('superscript'); }}
          aria-pressed={isSuperscript}
        >
          <Superscript className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        dangerouslySetInnerHTML={{ __html: value }}
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