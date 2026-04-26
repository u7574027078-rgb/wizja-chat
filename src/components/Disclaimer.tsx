import { cn } from "@/lib/utils";

// Wspólny komponent disclaimera medycznego
export function Disclaimer({
  variant = "default",
  className,
  children,
}: {
  variant?: "default" | "strong";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-4 py-3 text-sm leading-relaxed",
        variant === "strong"
          ? "border-warning/50 bg-warning/10 text-warning-foreground"
          : "border-border bg-muted/40 text-muted-foreground",
        className,
      )}
      role="note"
    >
      <span className="mr-2 font-semibold text-warning">⚠</span>
      {children ?? (
        <>
          Vascular Insights to narzędzie wspomagające/edukacyjne. <strong>NIE jest wyrobem medycznym.</strong>{" "}
          Szczególnie TCD/TCCD wymaga interpretacji neurosonologa — AI ma ograniczoną wiarygodność w identyfikacji
          naczyń i interpretacji prędkości. Decyzja kliniczna należy do lekarza.
        </>
      )}
    </div>
  );
}
