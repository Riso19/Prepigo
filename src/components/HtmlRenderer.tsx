import { useResolvedHtml } from '@/hooks/use-resolved-html';
import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

interface HtmlRendererProps {
  html: string;
  className?: string;
}

export const HtmlRenderer = ({ html, className }: HtmlRendererProps) => {
  const resolvedHtml = useResolvedHtml(html);
  const textRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textRef.current && imageRef.current) {
      // Clear previous content
      textRef.current.innerHTML = '';
      imageRef.current.innerHTML = '';

      if (resolvedHtml) {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = resolvedHtml;

        const images = Array.from(tempContainer.querySelectorAll('img'));
        images.forEach(img => {
          imageRef.current!.appendChild(img);
        });

        textRef.current.innerHTML = tempContainer.innerHTML;
      }
    }
  }, [resolvedHtml]);

  return (
    <div className={cn("html-content-wrapper", className)}>
      <div ref={textRef} className="html-content-text" />
      <div ref={imageRef} className="html-content-images mt-4 flex flex-col items-center gap-4" />
    </div>
  );
};