import { useResolvedHtml } from '@/hooks/use-resolved-html';

interface HtmlRendererProps {
  html: string;
  className?: string;
}

export const HtmlRenderer = ({ html, className }: HtmlRendererProps) => {
  const resolvedHtml = useResolvedHtml(html);
  return <div className={className} dangerouslySetInnerHTML={{ __html: resolvedHtml }} />;
};