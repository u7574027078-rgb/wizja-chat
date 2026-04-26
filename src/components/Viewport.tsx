import { useEffect, useRef, useState } from "react";
import { FILTER_PRESETS, type FilterPreset } from "@/lib/presets";
import { cn } from "@/lib/utils";

interface Props {
  fileUrl: string;
  fileKind: "video" | "image" | "dicom";
  fileName: string;
  filter: FilterPreset;
  onFilterChange: (f: FilterPreset) => void;
  // Ref do bieżącego źródła — używany do capture klatki
  sourceRef: React.MutableRefObject<HTMLVideoElement | HTMLImageElement | null>;
  onVideoMeta?: (durationSec: number) => void;
}

// Viewport — wideo lub obraz, z presetami CSS filter
export function Viewport({ fileUrl, fileKind, fileName, filter, onFilterChange, sourceRef, onVideoMeta }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fileKind === "video") sourceRef.current = videoRef.current;
    else if (fileKind === "image") sourceRef.current = imgRef.current;
    else sourceRef.current = null;
  }, [fileKind, fileUrl, sourceRef]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          <span className="mr-1 font-mono">{fileName}</span>
          <span className="rounded bg-secondary px-1.5 py-0.5 uppercase tracking-wider">{fileKind}</span>
        </div>
      </div>

      <div className="medical-grid relative overflow-hidden rounded-xl border border-border bg-black">
        {fileKind === "dicom" ? (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="text-5xl opacity-60">💾</div>
            <h3 className="text-lg font-semibold">Plik DICOM wykryty</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Pełna obsługa DICOM (Cornerstone3D, kalibracja mm/piksel, multi-frame) zostanie dołączona w kolejnej
              iteracji. Aby skorzystać z analizy AI w tym MVP, wgraj klatkę jako PNG/JPG lub wideo MP4.
            </p>
          </div>
        ) : fileKind === "video" ? (
          <video
            ref={videoRef}
            src={fileUrl}
            controls
            crossOrigin="anonymous"
            className="mx-auto block max-h-[60vh] w-full"
            style={{ filter: filter.filter }}
            onLoadedMetadata={(e) => {
              const d = (e.currentTarget as HTMLVideoElement).duration;
              if (isFinite(d) && d > 0) onVideoMeta?.(d);
            }}
            onError={() => setError("Nie udało się załadować wideo.")}
          />
        ) : (
          <img
            ref={imgRef}
            src={fileUrl}
            alt={fileName}
            crossOrigin="anonymous"
            className="mx-auto block max-h-[60vh] w-full object-contain"
            style={{ filter: filter.filter }}
            onError={() => setError("Nie udało się załadować obrazu.")}
          />
        )}
        {error && (
          <div className="absolute inset-x-0 bottom-0 bg-destructive/90 px-3 py-2 text-center text-xs text-destructive-foreground">
            {error}
          </div>
        )}
      </div>

      {/* Presety filtrów */}
      <div className="flex flex-wrap gap-2">
        {FILTER_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onFilterChange(p)}
            title={p.description}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs transition-colors",
              p.id === filter.id
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
