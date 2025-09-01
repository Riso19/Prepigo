import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  ResourceItem,
  getAllResourcesFromDB,
  saveResource,
  deleteResource as deleteResourceFromDB,
  saveSingleMediaToDB,
  getResourceBlob,
  MEDIA_STORE,
  table,
} from '@/lib/dexie-db';

export type CreateResourceInput = {
  file: File; // must be PDF
  title?: string;
  description?: string;
  tags?: string[];
};

export type ResourcesContextType = {
  items: ResourceItem[];
  create: (input: CreateResourceInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  getBlobUrl: (res: ResourceItem) => Promise<string | null>;
  refresh: () => Promise<void>;
  isLoading: boolean;
};

const ResourcesContext = createContext<ResourcesContextType | undefined>(undefined);

export const ResourcesProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [blobUrlCache] = useState<Map<string, string>>(new Map());

  const refresh = async () => {
    setIsLoading(true);
    try {
      const list = await getAllResourcesFromDB();
      setItems(list);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

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

      // Save the file content to media store
      try {
        await saveSingleMediaToDB(mediaId, input.file);
      } catch (mediaError) {
        console.error('Error saving media:', mediaError);
        throw new Error('Failed to save PDF content. The file might be corrupted or too large.');
      }

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

      // Save resource metadata
      try {
        await saveResource(resource);
      } catch (saveError) {
        console.error('Error saving resource:', saveError);
        // Clean up the media if metadata save fails
        try {
          const t = await table(MEDIA_STORE);
          await t.delete(mediaId);
        } catch (cleanupError) {
          console.error('Error cleaning up after failed save:', cleanupError);
        }
        throw new Error('Failed to save resource metadata. Please try again.');
      }

      // Refresh the resources list
      await refresh();
    } catch (error) {
      console.error('Error in create resource:', error);
      throw error; // Re-throw to be handled by the UI
    }
  };

  const remove = async (id: string) => {
    await deleteResourceFromDB(id);
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
    () => ({ items, create, remove, getBlobUrl, refresh, isLoading }),
    [items, isLoading],
  );

  return <ResourcesContext.Provider value={value}>{children}</ResourcesContext.Provider>;
};

export const useResources = () => {
  const ctx = useContext(ResourcesContext);
  if (!ctx) throw new Error('useResources must be used within ResourcesProvider');
  return ctx;
};
