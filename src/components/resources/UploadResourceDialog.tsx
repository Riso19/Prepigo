import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useResources } from "@/contexts/ResourcesContext";
import { Upload } from "lucide-react";

export default function UploadResourceDialog() {
  const { create } = useResources();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!file) return;
    setSubmitting(true);
    try {
      await create({ file, title: title || undefined, description, tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [] });
      setOpen(false);
      setFile(null);
      setTitle("");
      setDescription("");
      setTags("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2"><Upload className="h-4 w-4" /> Upload PDF</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload PDF</DialogTitle>
          <DialogDescription>Add a PDF resource with optional title, description, and tags.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="file">PDF File</Label>
            <Input id="file" type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Optional title" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tags">Tags</Label>
            <Input id="tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="Comma separated (e.g., cardio, notes)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!file || submitting} onClick={onSubmit}>{submitting ? "Uploading..." : "Upload"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
