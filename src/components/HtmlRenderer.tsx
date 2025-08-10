import { useResolvedHtml } from '@/hooks/use-resolved-html';
import { cn } from '@/lib/utils';

interface HtmlRendererProps {
  html: string;
  className?: string;
}

export const HtmlRenderer = ({ html, className }: HtmlRendererProps) => {
  const resolvedHtml = useResolvedHtml(html);
  return <div className={cn("html-content", className)} dangerouslySetInnerHTML={{ __html: resolvedHtml }} />;
};