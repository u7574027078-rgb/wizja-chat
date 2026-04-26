import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Renderer wyników AI w Markdown
export function AnalysisResult({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <article
      className={cn(
        "prose prose-invert max-w-none rounded-xl border border-border bg-card p-5",
        "prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-h1:text-xl prose-h2:text-lg prose-h3:text-base",
        "prose-p:text-sm prose-li:text-sm prose-strong:text-foreground",
        "prose-code:rounded prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </article>
  );
}
