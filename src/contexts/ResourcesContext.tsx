import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  ResourceItem,
  getResourcesPage,
  getLastDbError,
  saveResourceWithMedia,
  deleteResourceAndMedia,
  getResourceBlob,
} from '@/lib/dexie-db';
import { subscribe } from '@/lib/broadcast';
import { toast } from '@/hooks/use-toast';

export type CreateResourceInput = {
  file: File; // must be PDF
  title?: string;
  description?: string;
  tags?: string[];
};

export type ResourcesContextType = {
  items: ResourceItem[];
  total: number;
  page: number;
  pageSize: number;
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
  create: (input: CreateResourceInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  getBlobUrl: (res: ResourceItem) => Promise<string | null>;
  refresh: () => Promise<void>;
  isLoading: boolean;
};

const ResourcesContext = createContext<ResourcesContextType | undefined>(undefined);

export const ResourcesProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [blobUrlCache] = useState<Map<string, string>>(new Map());

  const refresh = async () => {
    setIsLoading(true);
    try {
      const { items: list, total } = await getResourcesPage(page, pageSize);
      setItems(list);
      setTotal(total);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // Multi-tab updates: refresh when other tabs write to resources/highlights
    const unsub = subscribe((msg) => {
      if (msg.type === 'storage-write' && (msg.resource === 'resources' || msg.resource === 'resource_highlights' || msg.resource === 'resource_highlights_v2')) {
        refresh();
      }
      if (msg.type === 'sync-error') {
        // Fetch and show the last DB error details
        getLastDbError().then((err) => {
          if (!err) return;
          toast({
            title: 'Sync error',
            description: `${err.context}: ${err.message}`,
            variant: 'destructive',
          });
        });
      }
    });
    return unsub;
  }, [page, pageSize]);

  const create = async (input: CreateResourceInput) => {
    try {
      // Validate file
      if (!input.file) {
        throw new Error('No file provided');
      }

      // Check file type
      const fileName = input.file.name.toLowerCase();
      const isPDF =
        input.file.type === 'application/pdf' ||
        fileName.endsWith('.pdf') ||
        (input.file.type === '' && input.file instanceof Blob);

      if (!isPDF) {
        throw new Error('Only PDF files are supported');
      }

      // Generate unique IDs
      const id = crypto.randomUUID();
      const mediaId = `res-${id}`;

      // Create resource metadata
      const now = Date.now();
      const resource: ResourceItem = {
        id,
        mediaId,
        title: input.title?.trim() || input.file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '),
        description: input.description?.trim(),
        tags: input.tags?.map((tag) => tag.trim()).filter(Boolean) || [],
        size: input.file.size,
        type: 'application/pdf',
        createdAt: now,
        updatedAt: now,
      };

      // Transactional save (media + resource)
      await saveResourceWithMedia(resource, input.file);

      // Refresh the resources list
      await refresh();
    } catch (error) {
      console.error('Error in create resource:', error);
      throw error; // Re-throw to be handled by the UI
    }
  };

  const remove = async (id: string) => {
    await deleteResourceAndMedia(id);
    await refresh();
  };

  const getBlobUrl = async (res: ResourceItem) => {
    const cached = blobUrlCache.get(res.id);
    if (cached) return cached;
    const blob = await getResourceBlob(res);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    blobUrlCache.set(res.id, url);
    return url;
  };

  const value: ResourcesContextType = useMemo(
    () => ({ items, total, page, pageSize, setPage, setPageSize, create, remove, getBlobUrl, refresh, isLoading }),
    [items, total, page, pageSize, isLoading],
  );

  return <ResourcesContext.Provider value={value}>{children}</ResourcesContext.Provider>;
};

export const useResources = () => {
  const ctx = useContext(ResourcesContext);
  if (!ctx) throw new Error('useResources must be used within ResourcesProvider');
  return ctx;
};
