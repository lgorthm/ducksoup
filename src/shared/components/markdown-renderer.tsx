/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, memo, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy, Download } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useTheme } from '@/shared/providers/theme-provider';

/** 语言名 → 文件扩展名映射 */
const langToExt: Record<string, string> = {
  javascript: '.js',
  js: '.js',
  typescript: '.ts',
  ts: '.ts',
  tsx: '.tsx',
  jsx: '.jsx',
  python: '.py',
  py: '.py',
  java: '.java',
  go: '.go',
  rust: '.rs',
  c: '.c',
  cpp: '.cpp',
  csharp: '.cs',
  cs: '.cs',
  html: '.html',
  css: '.css',
  scss: '.scss',
  sass: '.sass',
  less: '.less',
  json: '.json',
  xml: '.xml',
  yaml: '.yml',
  yml: '.yml',
  toml: '.toml',
  markdown: '.md',
  md: '.md',
  sql: '.sql',
  shell: '.sh',
  sh: '.sh',
  bash: '.sh',
  zsh: '.sh',
  powershell: '.ps1',
  dockerfile: '',
  docker: '',
  graphql: '.graphql',
  gql: '.graphql',
  kotlin: '.kt',
  swift: '.swift',
  ruby: '.rb',
  php: '.php',
  lua: '.lua',
  r: '.r',
  dart: '.dart',
  scala: '.scala',
  perl: '.pl',
  haskell: '.hs',
  elixir: '.ex',
  clojure: '.clj',
  erlang: '.erl',
  diff: '.diff',
  makefile: '',
  nginx: '.conf',
  properties: '.properties',
  ini: '.ini',
  env: '.env',
  vue: '.vue',
  svelte: '.svelte',
};

function getExt(lang: string): string {
  return langToExt[lang.toLowerCase()] ?? `.${lang}`;
}

/** 代码块语言检测正则，提升到模块级别避免重复创建 */
const LANGUAGE_RE = /language-(\w+)/;

// ---- 代码块（含工具栏） ----

const CodeBlock = memo(function CodeBlock({
  language,
  code,
  isStreaming = false,
}: {
  language: string;
  code: string;
  isStreaming?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const { theme } = useTheme();

  const isDark = useMemo(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, [theme]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = getExt(language);
    const filename = `code${ext}`;
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 流式传输期间跳过语法高亮，只显示纯文本
  if (isStreaming) {
    return (
      <div className="my-4 overflow-hidden rounded-md border">
        <div className="flex items-center justify-between bg-muted px-4 py-2 text-xs text-muted-foreground">
          <span>{language || 'text'}</span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label="复制代码"
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center justify-center rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label="下载代码"
            >
              <Download className="size-3.5" />
            </button>
          </div>
        </div>
        <pre className="overflow-x-auto bg-muted/50 p-4 text-[0.8125rem] leading-relaxed">
          <code className="font-mono">{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="my-4 overflow-hidden rounded-md border">
      {/* 工具栏 */}
      <div className="flex items-center justify-between bg-muted px-4 py-2 text-xs text-muted-foreground">
        <span>{language || 'text'}</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="复制代码"
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center justify-center rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="下载代码"
          >
            <Download className="size-3.5" />
          </button>
        </div>
      </div>
      {/* 代码 */}
      <SyntaxHighlighter
        style={isDark ? oneDark : oneLight}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.8125rem',
          lineHeight: '1.6',
        }}
        codeTagProps={{
          style: {
            fontFamily:
              '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, Monaco, monospace',
          },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
});

// ---- 内联代码 ----

function InlineCode({ children, ...props }: ComponentPropsWithoutRef<'code'>) {
  return (
    <code
      {...props}
      className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem] text-accent-foreground"
    >
      {children}
    </code>
  );
}

// ---- 静态 Markdown 组件（不依赖 isStreaming，模块级别避免重复创建） ----

const STATIC_MARKDOWN_COMPONENTS = {
  // 标题
  h1: ({ children, ...props }: any) => (
    <h1 className="mt-6 mb-2 text-xl font-semibold" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="mt-5 mb-2 text-lg font-semibold" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: any) => (
    <h3 className="mt-4 mb-1.5 text-base font-semibold" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }: any) => (
    <h4 className="mt-3 mb-1 text-sm font-semibold" {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, ...props }: any) => (
    <h5 className="mt-3 mb-1 text-sm font-medium" {...props}>
      {children}
    </h5>
  ),
  h6: ({ children, ...props }: any) => (
    <h6
      className="mt-3 mb-1 text-sm font-medium text-muted-foreground"
      {...props}
    >
      {children}
    </h6>
  ),

  // 段落
  p: ({ children, ...props }: any) => (
    <p className="mb-2 last:mb-0" {...props}>
      {children}
    </p>
  ),

  // 列表
  ul: ({ children, ...props }: any) => (
    <ul className="mb-2 list-disc space-y-1 pl-6" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="mb-2 list-decimal space-y-1 pl-6" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: any) => (
    <li className="pl-0.5" {...props}>
      {children}
    </li>
  ),

  // 引用
  blockquote: ({ children, ...props }: any) => (
    <blockquote
      className="my-2 border-l-2 border-muted-foreground/30 pl-4 text-muted-foreground italic"
      {...props}
    >
      {children}
    </blockquote>
  ),

  // 表格
  table: ({ children, ...props }: any) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: any) => (
    <thead className="border-b-2" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }: any) => (
    <tbody {...props}>{children}</tbody>
  ),
  tr: ({ children, ...props }: any) => (
    <tr className="border-b" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }: any) => (
    <th className="px-3 py-2 text-left font-semibold" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }: any) => (
    <td className="px-3 py-2" {...props}>
      {children}
    </td>
  ),

  // 链接
  a: ({ children, href, ...props }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80"
      {...props}
    >
      {children}
    </a>
  ),

  // 分割线
  hr: (props: any) => <hr className="my-4" {...props} />,

  // 强调
  strong: ({ children, ...props }: any) => (
    <strong className="font-semibold" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }: any) => <em {...props}>{children}</em>,

  // 删除线
  del: ({ children, ...props }: any) => (
    <del className="text-muted-foreground line-through" {...props}>
      {children}
    </del>
  ),

  // 图片
  img: ({ alt, src, ...props }: any) => (
    <img
      alt={alt}
      src={src}
      className="my-3 max-w-full rounded-md"
      loading="lazy"
      {...props}
    />
  ),
} as const;

// ---- react-markdown 语言组件映射 ----

interface MarkdownRendererProps {
  children: string;
  className?: string;
  /** 是否流式传输中（跳过语法高亮以提升性能） */
  isStreaming?: boolean;
}

export function MarkdownRenderer({
  children,
  className,
  isStreaming = false,
}: MarkdownRendererProps) {
  // 只有 code 组件依赖 isStreaming，其余组件由模块级静态对象复用
  const components = useMemo(
    () => ({
      ...STATIC_MARKDOWN_COMPONENTS,
      code({
        className: codeClassName,
        children: codeChildren,
        ...props
      }: any) {
        const match = LANGUAGE_RE.exec(codeClassName || '');
        const raw = String(codeChildren).replace(/\n$/, '');

        // 内联代码（无 language- 前缀且无换行）
        if (!match && !String(codeChildren).includes('\n')) {
          return (
            <InlineCode className={codeClassName} {...props}>
              {codeChildren}
            </InlineCode>
          );
        }

        return (
          <CodeBlock
            language={match ? match[1] : ''}
            code={raw}
            isStreaming={isStreaming}
          />
        );
      },
    }),
    [isStreaming],
  );

  return (
    <div className={cn('prose-custom text-sm leading-relaxed', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
