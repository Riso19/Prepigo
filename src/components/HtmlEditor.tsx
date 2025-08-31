import { scheduleSyncNow } from '@/lib/sync';
import { postMessage } from '@/lib/broadcast';
import { useRef, useState, useEffect, useCallback, KeyboardEvent, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Subscript, Superscript, Image as ImageIcon, Link as LinkIcon, Loader2, Underline, List, ListOrdered, Palette, Table, ArrowUpFromLine, ArrowDownFromLine, ArrowLeftFromLine, ArrowRightFromLine, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useResolvedHtml, unresolveMediaHtml } from '@/hooks/use-resolved-html';
import { saveSingleMediaToDB, enqueueSyncOp } from '@/lib/idb';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

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
  const [isUnderline, setIsUnderline] = useState(false);
  const [isSubscript, setIsSubscript] = useState(false);
  const [isSuperscript, setIsSuperscript] = useState(false);
  const [isUl, setIsUl] = useState(false);
  const [isOl, setIsOl] = useState(false);
  const [isInsideTable, setIsInsideTable] = useState(false);
  const resolvedValue = useResolvedHtml(value);

  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== resolvedValue) {
      editorRef.current.innerHTML = resolvedValue;
    }
  }, [resolvedValue]);

  const handleInput = () => {
    if (editorRef.current) {
      const rawHtml = editorRef.current.innerHTML;
      const originalUrlHtml = unresolveMediaHtml(rawHtml);
      onChange(originalUrlHtml);
    }
  };

  const updateToolbar = useCallback(() => {
    setTimeout(() => {
      setIsBold(document.queryCommandState('bold'));
      setIsItalic(document.queryCommandState('italic'));
      setIsUnderline(document.queryCommandState('underline'));
      setIsSubscript(document.queryCommandState('subscript'));
      setIsSuperscript(document.queryCommandState('superscript'));
      setIsUl(document.queryCommandState('insertUnorderedList'));
      setIsOl(document.queryCommandState('insertOrderedList'));

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const node = selection.getRangeAt(0).startContainer;
        const parent = node.nodeType === 3 ? node.parentNode : node;
        let inTable = false;
        while (parent) {
          if (parent.nodeName === 'TABLE') {
            inTable = true;
            break;
          }
          parent = parent.parentNode;
        }
        setIsInsideTable(inTable);
      } else {
        setIsInsideTable(false);
      }
    }, 0);
  }, []);

  const handleFormat = (command: 'bold' | 'italic' | 'underline' | 'subscript' | 'superscript' | 'insertUnorderedList' | 'insertOrderedList') => {
    if (command === 'subscript' || command === 'superscript') {
      const otherCommand = command === 'subscript' ? 'superscript' : 'subscript';
      if (document.queryCommandState(otherCommand)) {
        document.execCommand(otherCommand, false);
      }
    }
    
    document.execCommand(command, false);

    if (editorRef.current) {
      handleInput();
      editorRef.current.focus();
      updateToolbar();
    }
  };

  const handleColorChange = (color: string) => {
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('foreColor', false, color);
    if (editorRef.current) {
      handleInput();
      editorRef.current.focus();
      updateToolbar();
    }
  };

  const handleInsertTable = () => {
    const tableHtml = `
      <table style="width:100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="border: 1px solid; padding: 8px;">Header 1</th>
            <th style="border: 1px solid; padding: 8px;">Header 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid; padding: 8px;">Cell 1</td>
            <td style="border: 1px solid; padding: 8px;">Cell 2</td>
          </tr>
          <tr>
            <td style="border: 1px solid; padding: 8px;">Cell 3</td>
            <td style="border: 1px solid; padding: 8px;">Cell 4</td>
          </tr>
        </tbody>
      </table>
      <p><br></p>
    `;
    document.execCommand('insertHTML', false, tableHtml);
    handleInput();
  };

  const getCurrentTableElements = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const node = selection.getRangeAt(0).startContainer;
    let cell: HTMLElement | null = null, row: HTMLElement | null = null, table: HTMLElement | null = null;

    const parent = node.nodeType === 3 ? node.parentNode as HTMLElement : node as HTMLElement;
    while (parent) {
        const nodeName = parent.nodeName;
        if (nodeName === 'TD' || nodeName === 'TH') cell = parent;
        if (nodeName === 'TR') row = parent;
        if (nodeName === 'TABLE') {
            table = parent;
            break;
        }
        parent = parent.parentNode as HTMLElement;
    }

    if (!table || !row || !cell) return null;

    const cellIndex = Array.from(row.children).indexOf(cell);
    return { table, row, cell, cellIndex };
  };

  const handleAddRow = (where: 'before' | 'after') => {
    const elements = getCurrentTableElements();
    if (!elements) return;
    const { row } = elements;

    const newRow = document.createElement('tr');
    const colCount = (row as HTMLTableRowElement).cells.length;
    for (let i = 0; i < colCount; i++) {
        const newCell = document.createElement('td');
        newCell.style.border = '1px solid';
        newCell.style.padding = '8px';
        newCell.innerHTML = '<br>';
        newRow.appendChild(newCell);
    }

    if (where === 'before') {
        row.parentNode?.insertBefore(newRow, row);
    } else {
        row.parentNode?.insertBefore(newRow, row.nextSibling);
    }
    handleInput();
  };

  const handleAddColumn = (where: 'before' | 'after') => {
    const elements = getCurrentTableElements();
    if (!elements) return;
    const { table, cellIndex } = elements;

    const insertIndex = where === 'before' ? cellIndex : cellIndex + 1;

    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
        const newCell = document.createElement(row.parentElement?.tagName === 'THEAD' ? 'th' : 'td');
        newCell.style.border = '1px solid';
        newCell.style.padding = '8px';
        newCell.innerHTML = '<br>';
        
        const refCell = row.cells[insertIndex];
        row.insertBefore(newCell, refCell || null);
    });
    handleInput();
  };

  const handleDeleteRow = () => {
    const elements = getCurrentTableElements();
    if (!elements) return;
    const { row } = elements;
    if (row.parentNode?.childNodes.length === 1) {
        elements.table.remove();
    } else {
        row.remove();
    }
    handleInput();
    updateToolbar();
  };

  const handleDeleteColumn = () => {
    const elements = getCurrentTableElements();
    if (!elements) return;
    const { table, cellIndex } = elements;

    if ((elements.row as HTMLTableRowElement).cells.length === 1) {
        table.remove();
    } else {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            if (row.cells[cellIndex]) {
                row.cells[cellIndex].remove();
            }
        });
    }
    handleInput();
    updateToolbar();
  };

  const handleDeleteTable = () => {
    const elements = getCurrentTableElements();
    if (!elements) return;
    elements.table.remove();
    handleInput();
    updateToolbar();
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
      void enqueueSyncOp({ resource: 'media', opType: 'upsert', payload: { id: fileName } })
        .then(() => scheduleSyncNow())
        .then(() => postMessage({ type: 'storage-write', resource: 'media', id: fileName }))
        .catch(() => { /* noop */ });

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
      void enqueueSyncOp({ resource: 'media', opType: 'upsert', payload: { id: fileName } })
        .then(() => scheduleSyncNow())
        .then(() => postMessage({ type: 'storage-write', resource: 'media', id: fileName }))
        .catch(() => { /* noop */ });

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
  const colorPalette = ['#000000', '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899'];

  return (
    <div className="border rounded-md bg-background">
      <div className="flex items-center gap-1 p-1 border-b flex-wrap">
        <Button variant="ghost" size="icon" className={cn(isBold && activeClass)} onMouseDown={(e) => { e.preventDefault(); handleFormat('bold'); }} aria-pressed={isBold} title="Bold"><Bold className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className={cn(isItalic && activeClass)} onMouseDown={(e) => { e.preventDefault(); handleFormat('italic'); }} aria-pressed={isItalic} title="Italic"><Italic className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className={cn(isUnderline && activeClass)} onMouseDown={(e) => { e.preventDefault(); handleFormat('underline'); }} aria-pressed={isUnderline} title="Underline"><Underline className="h-4 w-4" /></Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button variant="ghost" size="icon" className={cn(isSubscript && activeClass)} onMouseDown={(e) => { e.preventDefault(); handleFormat('subscript'); }} aria-pressed={isSubscript} title="Subscript"><Subscript className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className={cn(isSuperscript && activeClass)} onMouseDown={(e) => { e.preventDefault(); handleFormat('superscript'); }} aria-pressed={isSuperscript} title="Superscript"><Superscript className="h-4 w-4" /></Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button variant="ghost" size="icon" className={cn(isUl && activeClass)} onMouseDown={(e) => { e.preventDefault(); handleFormat('insertUnorderedList'); }} aria-pressed={isUl} title="Bulleted List"><List className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className={cn(isOl && activeClass)} onMouseDown={(e) => { e.preventDefault(); handleFormat('insertOrderedList'); }} aria-pressed={isOl} title="Numbered List"><ListOrdered className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onMouseDown={(e) => { e.preventDefault(); handleInsertTable(); }} title="Insert Table"><Table className="h-4 w-4" /></Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" onMouseDown={(e) => e.preventDefault()} title="Text Color"><Palette className="h-4 w-4" /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-6 gap-1">
              {colorPalette.map((color) => (
                <Button key={color} variant="outline" size="icon" className="h-6 w-6 rounded-full p-0 border" style={{ backgroundColor: color }} onMouseDown={(e) => { e.preventDefault(); handleColorChange(color); }} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button variant="ghost" size="icon" onMouseDown={(e) => { e.preventDefault(); handleImageButtonClick(); }} title="Add Image from Computer"><ImageIcon className="h-4 w-4" /></Button>
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" onMouseDown={(e) => e.preventDefault()} title="Add Image from URL"><LinkIcon className="h-4 w-4" /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              <div className="space-y-2"><h4 className="font-medium leading-none">Add Image from URL</h4><p className="text-sm text-muted-foreground">Paste an image URL to add it to your card.</p></div>
              <div className="grid gap-2">
                <div className="relative">
                  <Input id="imageUrl" placeholder="https://example.com/image.png" value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)} disabled={isUrlLoading} />
                  {isUrlLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                </div>
                <Button onClick={handleAddImageFromUrl} disabled={isUrlLoading || !imageUrlInput}>Add Image</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        {isInsideTable && (
          <>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onMouseDown={(e) => { e.preventDefault(); handleAddRow('before'); }}><ArrowUpFromLine className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Add Row Above</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onMouseDown={(e) => { e.preventDefault(); handleAddRow('after'); }}><ArrowDownFromLine className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Add Row Below</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onMouseDown={(e) => { e.preventDefault(); handleAddColumn('before'); }}><ArrowLeftFromLine className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Add Column Left</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onMouseDown={(e) => { e.preventDefault(); handleAddColumn('after'); }}><ArrowRightFromLine className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Add Column Right</TooltipContent></Tooltip>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onMouseDown={(e) => { e.preventDefault(); handleDeleteRow(); }}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Delete Row</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onMouseDown={(e) => { e.preventDefault(); handleDeleteColumn(); }}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Delete Column</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onMouseDown={(e) => { e.preventDefault(); handleDeleteTable(); }}><Table className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Delete Table</TooltipContent></Tooltip>
          </>
        )}
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className="min-h-[100px] p-2 focus:outline-none prose dark:prose-invert max-w-none prose-ul:list-disc prose-ol:list-decimal"
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