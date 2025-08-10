import { useState, useEffect } from 'react';
import { getMediaFromDB } from '@/lib/idb';

export const useResolvedMediaUrl = (url: string | undefined) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let objectUrl: string | null = null;
    const resolveUrl = async () => {
      if (url?.startsWith('media://')) {
        const fileName = url.substring('media://'.length);
        try {
          const blob = await getMediaFromDB(fileName);
          if (blob) {
            objectUrl = URL.createObjectURL(blob);
            setResolvedUrl(objectUrl);
          } else {
            setResolvedUrl(undefined); // Media not found
          }
        } catch (error) {
          console.error(`Failed to load media ${fileName}`, error);
          setResolvedUrl(undefined);
        }
      } else {
        setResolvedUrl(url);
      }
    };

    resolveUrl();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  return resolvedUrl;
};