import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useResources } from "@/contexts/ResourcesContext";
import { Eye, Trash2, FileText } from "lucide-react";
import { ResourceItem } from "@/lib/dexie-db";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PdfCover from "./PdfCover";

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

  const sizeText = item.size ? `${(item.size / 1024 / 1024).toFixed(2)} MB` : undefined;
  const dateText = new Date(item.createdAt).toLocaleDateString();

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
              <Badge key={t} variant="secondary">{t}</Badge>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
          {sizeText && <span>{sizeText}</span>}
          {(sizeText) && <span>•</span>}
          <span>{dateText}</span>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 pt-0">
        <Button size="sm" variant="secondary" onClick={openPreview} className="gap-2">
          <Eye className="h-4 w-4"/> Preview
        </Button>
        <Button size="sm" variant="ghost" onClick={() => remove(item.id)} className="ml-auto text-red-600 hover:text-red-700 hover:bg-red-50 gap-2">
          <Trash2 className="h-4 w-4"/> Delete
        </Button>
      </CardFooter>
    </Card>
  );
}