import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Subscript, Superscript } from 'lucide-react';

interface HtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const HtmlEditor = ({ value, onChange, placeholder }: HtmlEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);

  const handleFormat = (command: string) => {
    document.execCommand(command, false);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
      editorRef.current.focus();
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
        <Button variant="ghost" size="icon" onMouseDown={(e) => { e.preventDefault(); handleFormat('bold'); }}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onMouseDown={(e) => { e.preventDefault(); handleFormat('italic'); }}>
          <Italic className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onMouseDown={(e) => { e.preventDefault(); handleFormat('subscript'); }}>
          <Subscript className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onMouseDown={(e) => { e.preventDefault(); handleFormat('superscript'); }}>
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
      />
    </div>
  );
};

export default HtmlEditor;