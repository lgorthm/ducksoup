import { lazy, Suspense, type ComponentProps } from 'react';

import { cn } from '@/shared/lib/utils';
import type { MarkdownRenderer } from './markdown-renderer';

const MarkdownRendererImpl = lazy(() =>
  import('./markdown-renderer').then((m) => ({ default: m.MarkdownRenderer })),
);

type MarkdownRendererProps = ComponentProps<typeof MarkdownRenderer>;

/**
 * Plain-text fallback shown while the markdown chunk is loading.
 * Keeps message content visible (and eligible as the LCP element) instead
 * of rendering a blank bubble.
 */
function MarkdownFallback({ children, className }: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        'prose-custom text-sm leading-relaxed whitespace-pre-wrap',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Lazily loaded MarkdownRenderer. The markdown pipeline (react-markdown,
 * micromark, remark-gfm) and the prism grammars live in an async chunk that
 * main.tsx prefetches at startup, so first paint never waits on ~150 kB
 * (gzip) of parsing/highlighting code.
 */
export function LazyMarkdownRenderer(props: MarkdownRendererProps) {
  return (
    <Suspense fallback={<MarkdownFallback {...props} />}>
      <MarkdownRendererImpl {...props} />
    </Suspense>
  );
}
