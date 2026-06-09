import { useState, useMemo, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy, Download } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useTheme } from '@/shared/components/theme-provider';

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

// ---- 代码块（含工具栏） ----

function CodeBlock({ language, code }: { language: string; code: string }) {
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
}

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

// ---- react-markdown 语言组件映射 ----

interface MarkdownRendererProps {
  children: string;
  className?: string;
}

export function MarkdownRenderer({
  children,
  className,
}: MarkdownRendererProps) {
  return (
    <div className={cn('prose-custom text-sm leading-relaxed', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 代码块 + 内联代码
          code({ className: codeClassName, children: codeChildren, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || '');
            const raw = String(codeChildren).replace(/\n$/, '');

            // 内联代码（无 language- 前缀且无换行）
            if (!match && !String(codeChildren).includes('\n')) {
              return (
                <InlineCode className={codeClassName} {...props}>
                  {codeChildren}
                </InlineCode>
              );
            }

            return <CodeBlock language={match ? match[1] : ''} code={raw} />;
          },

          // 标题
          h1: ({ children: hChildren, ...props }) => (
            <h1 className="mt-6 mb-2 text-xl font-semibold" {...props}>
              {hChildren}
            </h1>
          ),
          h2: ({ children: hChildren, ...props }) => (
            <h2 className="mt-5 mb-2 text-lg font-semibold" {...props}>
              {hChildren}
            </h2>
          ),
          h3: ({ children: hChildren, ...props }) => (
            <h3 className="mt-4 mb-1.5 text-base font-semibold" {...props}>
              {hChildren}
            </h3>
          ),
          h4: ({ children: hChildren, ...props }) => (
            <h4 className="mt-3 mb-1 text-sm font-semibold" {...props}>
              {hChildren}
            </h4>
          ),
          h5: ({ children: hChildren, ...props }) => (
            <h5 className="mt-3 mb-1 text-sm font-medium" {...props}>
              {hChildren}
            </h5>
          ),
          h6: ({ children: hChildren, ...props }) => (
            <h6
              className="mt-3 mb-1 text-sm font-medium text-muted-foreground"
              {...props}
            >
              {hChildren}
            </h6>
          ),

          // 段落
          p: ({ children: pChildren, ...props }) => (
            <p className="mb-2 last:mb-0" {...props}>
              {pChildren}
            </p>
          ),

          // 列表
          ul: ({ children: ulChildren, ...props }) => (
            <ul className="mb-2 list-disc space-y-1 pl-6" {...props}>
              {ulChildren}
            </ul>
          ),
          ol: ({ children: olChildren, ...props }) => (
            <ol className="mb-2 list-decimal space-y-1 pl-6" {...props}>
              {olChildren}
            </ol>
          ),
          li: ({ children: liChildren, ...props }) => (
            <li className="pl-0.5" {...props}>
              {liChildren}
            </li>
          ),

          // 引用
          blockquote: ({ children: bqChildren, ...props }) => (
            <blockquote
              className="my-2 border-l-2 border-muted-foreground/30 pl-4 text-muted-foreground italic"
              {...props}
            >
              {bqChildren}
            </blockquote>
          ),

          // 表格
          table: ({ children: tChildren, ...props }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm" {...props}>
                {tChildren}
              </table>
            </div>
          ),
          thead: ({ children: thChildren, ...props }) => (
            <thead className="border-b-2" {...props}>
              {thChildren}
            </thead>
          ),
          tbody: ({ children: tbChildren, ...props }) => (
            <tbody {...props}>{tbChildren}</tbody>
          ),
          tr: ({ children: trChildren, ...props }) => (
            <tr className="border-b" {...props}>
              {trChildren}
            </tr>
          ),
          th: ({ children: thCellChildren, ...props }) => (
            <th className="px-3 py-2 text-left font-semibold" {...props}>
              {thCellChildren}
            </th>
          ),
          td: ({ children: tdChildren, ...props }) => (
            <td className="px-3 py-2" {...props}>
              {tdChildren}
            </td>
          ),

          // 链接
          a: ({ children: aChildren, href, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:opacity-80"
              {...props}
            >
              {aChildren}
            </a>
          ),

          // 分割线
          hr: (props) => <hr className="my-4" {...props} />,

          // 强调
          strong: ({ children: sChildren, ...props }) => (
            <strong className="font-semibold" {...props}>
              {sChildren}
            </strong>
          ),
          em: ({ children: emChildren, ...props }) => (
            <em {...props}>{emChildren}</em>
          ),

          // 删除线
          del: ({ children: delChildren, ...props }) => (
            <del className="text-muted-foreground line-through" {...props}>
              {delChildren}
            </del>
          ),

          // 图片（基本样式，会由 Tailwind 处理响应式）
          img: ({ alt, src, ...props }) => (
            <img
              alt={alt}
              src={src}
              className="my-3 max-w-full rounded-md"
              loading="lazy"
              {...props}
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
