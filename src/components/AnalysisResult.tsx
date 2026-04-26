import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Renderer wyników AI w Markdown — własne style zamiast prose
export function AnalysisResult({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-card p-5 text-sm leading-relaxed",
        "[&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:tracking-tight",
        "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold",
        "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-primary",
        "[&_p]:mb-3 [&_p]:text-foreground/90",
        "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1",
        "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1",
        "[&_li]:text-foreground/90",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_code]:rounded [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
        "[&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
        "[&_th]:border [&_th]:border-border [&_th]:bg-secondary [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
        "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-warning [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </article>
  );
}
