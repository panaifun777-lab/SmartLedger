'use client'

import React, { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from 'next-themes'
import { Check, Copy, FileCode } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  content: string
  className?: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-all',
        'opacity-0 group-hover:opacity-100 focus:opacity-100',
        copied
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white/80'
      )}
      aria-label={copied ? 'Copied' : 'Copy code'}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  )
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div className={cn('markdown-content', className)}>
      <ReactMarkdown
        components={{
          // Headers
          h1: ({ children }) => (
            <h1 className="mt-5 mb-3 text-xl font-bold tracking-tight first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-4 mb-2 text-lg font-bold tracking-tight first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 mb-2 text-base font-semibold first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 className="mt-2 mb-1 text-sm font-semibold first:mt-0">{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 className="mt-2 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground first:mt-0">
              {children}
            </h6>
          ),

          // Paragraph
          p: ({ children }) => <p className="mb-3 last:mb-0 leading-7">{children}</p>,

          // Bold
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),

          // Italic
          em: ({ children }) => <em className="italic">{children}</em>,

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 underline underline-offset-2 transition-colors"
            >
              {children}
            </a>
          ),

          // Unordered list
          ul: ({ children }) => (
            <ul className="mb-3 ml-4 list-disc space-y-1 marker:text-emerald-500">{children}</ul>
          ),

          // Ordered list
          ol: ({ children }) => (
            <ol className="mb-3 ml-4 list-decimal space-y-1 marker:text-emerald-600 marker:font-medium">
              {children}
            </ol>
          ),

          // List item
          li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,

          // Code blocks
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '')
            const language = match ? match[1] : ''
            const isInline = !match && !className

            const codeString = String(children).replace(/\n$/, '')

            if (isInline) {
              return (
                <code
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[0.85em] font-mono',
                    isDark
                      ? 'bg-slate-700/60 text-emerald-300'
                      : 'bg-emerald-50 text-emerald-800'
                  )}
                  {...props}
                >
                  {children}
                </code>
              )
            }

            return (
              <div className="group relative my-3 overflow-x-auto overflow-y-hidden max-h-[400px] rounded-lg border border-border">
                {/* Header bar with language label */}
                <div
                  className={cn(
                    'flex items-center gap-2 px-4 py-1.5 text-xs font-medium sticky top-0 z-10',
                    isDark
                      ? 'bg-[#282c34] text-slate-400 border-b border-slate-700'
                      : 'bg-[#fafafa] text-slate-500 border-b border-slate-200'
                  )}
                >
                  <FileCode className="h-3.5 w-3.5" />
                  <span>{language || 'code'}</span>
                </div>
                {/* Syntax highlighter */}
                <SyntaxHighlighter
                  style={isDark ? oneDark : oneLight}
                  language={language || 'text'}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    fontSize: '0.8125rem',
                    lineHeight: '1.6',
                    padding: '1rem',
                  }}
                  codeTagProps={{
                    style: {
                      fontSize: '0.8125rem',
                      fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                    },
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
                <CopyButton text={codeString} />
              </div>
            )
          },

          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-3 border-emerald-500 pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          ),

          // Table
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead
              className={cn(
                'border-b border-border',
                isDark ? 'bg-slate-800/50' : 'bg-slate-50'
              )}
            >
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-t border-border">{children}</td>
          ),

          // Horizontal rule
          hr: () => (
            <hr className="my-4 border-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
          ),

          // Pre tag (handled by code component above)
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
