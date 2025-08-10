import { useState, useEffect } from 'react';
import { getMediaFromDB } from '@/lib/idb';

const resolvedUrlCache = new Map<string, string>();
const proxyUrl = 'https://images.weserv.nl/?url=';

export const unresolveMediaHtml = (html: string): string => {
    let unprocessedHtml = html;

    // Un-resolve media:// URLs from blob URLs
    for (const [fileName, objectUrl] of resolvedUrlCache.entries()) {
        const urlToReplace = new URL(objectUrl).toString();
        unprocessedHtml = unprocessedHtml.split(urlToReplace).join(`media://${fileName}`);
    }

    // Un-proxy http/s URLs
    const proxyRegex = new RegExp(`src="${proxyUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^"]+)"`, 'g');
    unprocessedHtml = unprocessedHtml.replace(proxyRegex, (_match, encodedUrl) => {
        try {
            const originalUrl = decodeURIComponent(encodedUrl);
            return `src="${originalUrl}"`;
        } catch (e) {
            return _match;
        }
    });

    return unprocessedHtml;
};

export const useResolvedHtml = (html: string | undefined) => {
  const [resolvedHtml, setResolvedHtml] = useState(html || '');

  useEffect(() => {
    if (!html) {
      setResolvedHtml('');
      return;
    }

    let isMounted = true;

    const resolveHtmlContent = async () => {
      let tempHtml = html;

      // 1. Proxy HTTP/HTTPS images
      const httpRegex = /src="(https?:\/\/[^"]+)"/g;
      tempHtml = tempHtml.replace(httpRegex, (_match, url) => {
        return `src="${proxyUrl}${encodeURIComponent(url)}"`;
      });

      // 2. Resolve media:// images
      const mediaRegex = /src="(media:\/\/([^"]+))"/g;
      const mediaMatches = [...tempHtml.matchAll(mediaRegex)];
      const mediaFileNamesToResolve = mediaMatches
        .map(match => match[2])
        .filter(name => !resolvedUrlCache.has(name));

      if (mediaFileNamesToResolve.length > 0) {
        const resolutions = await Promise.all(
          [...new Set(mediaFileNamesToResolve)].map(async (fileName) => {
            try {
              const blob = await getMediaFromDB(fileName);
              if (blob) {
                const objectUrl = URL.createObjectURL(blob);
                return { fileName, url: objectUrl };
              }
            } catch (error) {
              console.error(`Failed to load media ${fileName}`, error);
            }
            return { fileName, url: null };
          })
        );

        if (!isMounted) {
          resolutions.forEach(res => res.url && URL.revokeObjectURL(res.url));
          return;
        }

        resolutions.forEach(({ fileName, url }) => {
          if (url) resolvedUrlCache.set(fileName, url);
        });
      }

      // Replace all media URLs with cached versions
      tempHtml = tempHtml.replace(mediaRegex, (_match, _fullSrc, fileName) => {
        const resolvedUrl = resolvedUrlCache.get(fileName);
        return resolvedUrl ? `src="${resolvedUrl}"` : 'src=""';
      });

      if (isMounted) {
        setResolvedHtml(tempHtml);
      }
    };

    resolveHtmlContent();

    return () => {
      isMounted = false;
    };
  }, [html]);

  return resolvedHtml;
};