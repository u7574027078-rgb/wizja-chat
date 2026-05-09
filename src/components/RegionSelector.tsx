import { REGION_GROUPS, type RegionOption } from "@/lib/regions";
import { cn } from "@/lib/utils";

interface Props {
  selectedId?: string;
  onSelect: (region: RegionOption) => void;
}

// Wybór trybu/regionu przed analizą
export function RegionSelector({ selectedId, onSelect }: Props) {
  return (
    <div className="space-y-6">
      {REGION_GROUPS.map((group) => (
        <section key={group.category}>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="text-xl">{group.icon}</span>
            {group.title}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {group.regions.map((r) => {
              const active = selectedId === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelect(r)}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left text-sm transition-all",
                    active
                      ? "border-primary bg-primary/10 text-foreground glow-primary"
                      : "border-border bg-card hover:border-primary/50 hover:bg-secondary",
                  )}
                >
                  <div className="font-medium">{r.label}</div>
                  {r.description && <div className="mt-0.5 text-xs text-muted-foreground">{r.description}</div>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
