import { useRef, useState, useEffect, useCallback, KeyboardEvent, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Subscript, Superscript, Image as ImageIcon, Link as LinkIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useResolvedHtml, unresolveMediaHtml } from '@/hooks/use-resolved-html';
import { saveSingleMediaToDB } from '@/lib/idb';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

interface HtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const HtmlEditor = ({ value, onChange, placeholder }: HtmlEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isSubscript, setIsSubscript] = useState(false);
  const [isSuperscript, setIsSuperscript] = useState(false);
  const resolvedValue = useResolvedHtml(value);

  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

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

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading('Uploading image...');
    try {
      const fileName = `media-${Date.now()}-${file.name}`;
      await saveSingleMediaToDB(fileName, file);

      const imgTag = `<img src="media://${fileName}" alt="${file.name}">`;
      
      editorRef.current?.focus();
      document.execCommand('insertHTML', false, imgTag);
      
      handleInput();

      toast.success('Image added successfully!', { id: toastId });
    } catch (error) {
      console.error('Failed to upload image', error);
      toast.error('Failed to add image.', { id: toastId });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleAddImageFromUrl = async () => {
    if (!imageUrlInput) return;
    setIsUrlLoading(true);
    const toastId = toast.loading('Loading image from URL...');
    try {
      const proxyUrl = 'https://images.weserv.nl/?url=';
      const response = await fetch(proxyUrl + encodeURIComponent(imageUrlInput));
      if (!response.ok) {
        throw new Error(`Failed to fetch image. Status: ${response.status}`);
      }
      const blob = await response.blob();
      const fileName = `media-${Date.now()}-${imageUrlInput.split('/').pop()?.split('?')[0] || 'image'}`;
      await saveSingleMediaToDB(fileName, blob);

      const imgTag = `<img src="media://${fileName}" alt="Image from URL">`;
      
      editorRef.current?.focus();
      document.execCommand('insertHTML', false, imgTag);
      
      handleInput();

      toast.success('Image added successfully!', { id: toastId });
      setIsPopoverOpen(false);
      setImageUrlInput('');
    } catch (error) {
      console.error('Failed to load image from URL', error);
      toast.error('Could not load image. Check URL.', { id: toastId });
    } finally {
      setIsUrlLoading(false);
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
        <Button
          variant="ghost"
          size="icon"
          onMouseDown={(e) => { e.preventDefault(); handleImageButtonClick(); }}
          title="Add Image from Computer"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onMouseDown={(e) => e.preventDefault()}
              title="Add Image from URL"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Add Image from URL</h4>
                <p className="text-sm text-muted-foreground">
                  Paste an image URL to add it to your card.
                </p>
              </div>
              <div className="grid gap-2">
                <div className="relative">
                  <Input
                    id="imageUrl"
                    placeholder="https://example.com/image.png"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    disabled={isUrlLoading}
                  />
                  {isUrlLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                </div>
                <Button onClick={handleAddImageFromUrl} disabled={isUrlLoading || !imageUrlInput}>
                  Add Image
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
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
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        className="hidden"
        accept="image/*"
      />
    </div>
  );
};

export default HtmlEditor;