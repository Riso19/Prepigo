import { useState, useRef, ChangeEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useResources } from '@/contexts/ResourcesContext';
import { Upload, X, FileCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function UploadResourceDialog() {
  const { create } = useResources();
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): boolean => {
    // Check file type more leniently
    const isPDF =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf') ||
      (file.type === '' && file instanceof Blob && file.size > 0);

    if (!isPDF) {
      setError('Only PDF files are allowed');
      return false;
    }
    setError(null);
    return true;
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
        // Set title from filename if not already set
        if (!title) {
          setTitle(selectedFile.name.replace(/\.pdf$/i, ''));
        }
      } else {
        // Clear the invalid file selection
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setFile(null);
      }
    }
  };

  const removeFile = () => {
    setFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onSubmit = async () => {
    try {
      // Reset previous errors
      setError(null);

      // Validate file
      if (!file) {
        setError('Please select a PDF file to upload');
        return;
      }

      if (!validateFile(file)) {
        return;
      }

      setSubmitting(true);

      // Show upload progress
      const toastId = toast.loading('Uploading PDF...');

      try {
        // Prepare tags
        const tagList = tags
          ? tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 10) // Limit number of tags
          : [];

        // Create the resource
        await create({
          file,
          title: title || undefined,
          description: description || undefined,
          tags: tagList,
        });

        // Success
        toast.success('PDF uploaded successfully!', { id: toastId });

        // Reset form
        setOpen(false);
        setFile(null);
        setTitle('');
        setDescription('');
        setTags('');
      } catch (err) {
        console.error('Error uploading PDF:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to upload PDF';
        toast.error(errorMessage, { id: toastId });
        setError(errorMessage);
      } finally {
        setSubmitting(false);
      }
    } catch (err) {
      console.error('Unexpected error in upload handler:', err);
      toast.error('An unexpected error occurred');
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Upload className="h-4 w-4" /> Upload PDF
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload PDF</DialogTitle>
          <DialogDescription>
            Add a PDF resource with optional title, description, and tags.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="file">PDF File</Label>
            {!file ? (
              <div className="flex items-center justify-center w-full">
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/70 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">PDF files only</p>
                  </div>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="hidden"
                    accept=".pdf,application/pdf,application/octet-stream"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                  />
                </label>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={removeFile}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove file</span>
                </Button>
              </div>
            )}
            {error && <p className="text-sm text-destructive mt-1">{error}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Comma separated (e.g., cardio, notes)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!file || submitting} onClick={onSubmit} className="min-w-[100px]">
            {submitting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Uploading...
              </>
            ) : (
              'Upload'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
