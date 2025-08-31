import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  ResourceItem,
  getAllResourcesFromDB,
  saveResource,
  deleteResource as deleteResourceFromDB,
  saveSingleMediaToDB,
  getResourceBlob,
} from "@/lib/dexie-db";

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
    if (input.file.type !== "application/pdf") {
      throw new Error("Only PDF files are supported");
    }
    const id = crypto.randomUUID();
    const mediaId = `res-${id}`;
    await saveSingleMediaToDB(mediaId, input.file);
    const now = Date.now();
    const resource: ResourceItem = {
      id,
      mediaId,
      title: input.title || input.file.name.replace(/\.pdf$/i, ""),
      description: input.description,
      tags: input.tags || [],
      size: input.file.size,
      type: "application/pdf",
      createdAt: now,
      updatedAt: now,
    };
    await saveResource(resource);
    await refresh();
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
    [items, isLoading]
  );

  return <ResourcesContext.Provider value={value}>{children}</ResourcesContext.Provider>;
};

export const useResources = () => {
  const ctx = useContext(ResourcesContext);
  if (!ctx) throw new Error("useResources must be used within ResourcesProvider");
  return ctx;
};
