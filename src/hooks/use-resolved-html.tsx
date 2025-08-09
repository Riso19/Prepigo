import { useState, useEffect, useMemo } from 'react';
import { getMediaFromDB } from '@/lib/idb';

const resolvedUrlCache = new Map<string, string>();

export const useResolvedHtml = (html: string | undefined) => {
  const [resolvedHtml, setResolvedHtml] = useState(html || '');

  const mediaFileNames = useMemo(() => {
    if (!html) return [];
    const mediaUrlRegex = /src="media:\/\/([^"]+)"/g;
    return [...html.matchAll(mediaUrlRegex)].map(match => match[1]);
  }, [html]);

  useEffect(() => {
    if (!html) {
      setResolvedHtml('');
      return;
    }
    if (mediaFileNames.length === 0) {
      setResolvedHtml(html);
      return;
    }

    let isMounted = true;

    const resolveUrls = async () => {
      let tempHtml = html;
      const urlsToResolve = mediaFileNames.filter(name => !resolvedUrlCache.has(name));
      
      if (urlsToResolve.length > 0) {
        const resolutions = await Promise.all(urlsToResolve.map(async (fileName) => {
          const blob = await getMediaFromDB(fileName);
          if (blob) {
            const objectUrl = URL.createObjectURL(blob);
            return { fileName, url: objectUrl };
          }
          return { fileName, url: null };
        }));

        if (!isMounted) {
          resolutions.forEach(res => res.url && URL.revokeObjectURL(res.url));
          return;
        }
        
        resolutions.forEach(({ fileName, url }) => {
          if (url) resolvedUrlCache.set(fileName, url);
        });
      }

      for (const [fileName, url] of resolvedUrlCache.entries()) {
        tempHtml = tempHtml.replace(new RegExp(`src="media://${fileName}"`, 'g'), `src="${url}"`);
      }
      
      if (isMounted) {
        setResolvedHtml(tempHtml);
      }
    };

    resolveUrls();

    return () => {
      isMounted = false;
    };
  }, [html, mediaFileNames]);

  return resolvedHtml;
};