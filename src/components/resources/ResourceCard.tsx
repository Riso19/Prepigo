import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useResources } from '@/contexts/ResourcesContext';
import { Eye, Trash2, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { ResourceItem } from '@/lib/dexie-db';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PdfCover from './PdfCover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function ResourceCard({ item }: { item: ResourceItem }) {
  const { remove, getBlobUrl } = useResources();
  const navigate = useNavigate();
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const url = await getBlobUrl(item);
      if (!mounted) return;
      setCoverUrl(url);
    })();
    return () => {
      mounted = false;
    };
  }, [getBlobUrl, item]);

  const openPreview = async () => {
    // Navigate to inline viewer route
    navigate(`/resources/${item.id}/view`);
  };

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const sizeText = item.size ? `${(item.size / 1024 / 1024).toFixed(2)} MB` : undefined;
  const dateText = new Date(item.createdAt).toLocaleDateString();

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    try {
      setIsDeleting(true);
      await remove(item.id);
      setShowDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="group overflow-hidden border-muted/50 hover:border-primary/30 transition-colors">
      {coverUrl ? (
        <PdfCover url={coverUrl} />
      ) : (
        <div className="w-full aspect-[4/3] bg-gradient-to-br from-primary/15 to-secondary/40 flex items-center justify-center">
          <FileText className="h-8 w-8 text-primary" />
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="line-clamp-2 text-base md:text-lg">{item.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {item.description && <p className="line-clamp-3">{item.description}</p>}
        {(item.tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {(item.tags || []).map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
          {sizeText && <span>{sizeText}</span>}
          {sizeText && <span>•</span>}
          <span>{dateText}</span>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 pt-0">
        <Button size="sm" variant="secondary" onClick={openPreview} className="gap-2">
          <Eye className="h-4 w-4" /> Preview
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          className="ml-auto text-red-600 hover:text-red-700 hover:bg-red-50 gap-2"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <DialogTitle>Delete Resource</DialogTitle>
              </div>
              <DialogDescription className="pt-2">
                Are you sure you want to delete "{item.title}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
}
