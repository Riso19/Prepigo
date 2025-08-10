import { useResolvedMediaUrl } from '@/hooks/use-resolved-media-url';
import { Skeleton } from './ui/skeleton';

interface MediaAwareImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string;
}

export const MediaAwareImage = ({ src, className, ...props }: MediaAwareImageProps) => {
  const resolvedSrc = useResolvedMediaUrl(src);

  if (resolvedSrc === undefined && src !== undefined) {
    // URL is being resolved
    return <Skeleton className={className} />;
  }

  if (!resolvedSrc) {
    // URL is resolved but is null/undefined (e.g., media not found or src is undefined)
    return <div className={`${className} flex items-center justify-center bg-muted text-muted-foreground text-xs`}>No Image</div>;
  }

  return <img src={resolvedSrc} className={className} {...props} />;
};