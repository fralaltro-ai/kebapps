import React from "react";

interface LegalContentProps {
  content: string;
}

/**
 * Component to render pre-compiled HTML legal content.
 * Markdown is parsed to HTML at build time to prevent Cloudflare Worker CPU limit errors.
 * Uses Tailwind Typography (prose) for styling.
 */
export default function LegalContent({ content }: LegalContentProps) {
  // Ensure content is a clean string
  const cleanContent = typeof content === 'string' ? content.trim() : "";

  return (
    <div 
      className="prose dark:prose-invert prose-sm sm:prose-base max-w-none prose-headings:font-quicksand prose-headings:font-black prose-headings:tracking-tight prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-foreground prose-h2:text-xl prose-h2:border-b prose-h2:border-border prose-h2:pb-2 prose-h3:text-lg prose-th:px-4 prose-th:py-3 prose-th:bg-muted/50 prose-th:uppercase prose-th:text-[13px] sm:prose-th:text-sm prose-td:px-4 prose-td:py-3 prose-td:text-[13px] sm:prose-td:text-sm prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-primary/10 prose-blockquote:rounded-r-xl"
      dangerouslySetInnerHTML={{ __html: cleanContent }}
    />
  );
}

