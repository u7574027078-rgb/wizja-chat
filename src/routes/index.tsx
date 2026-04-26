import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { UploadDropzone } from "@/components/UploadDropzone";
import { RegionSelector } from "@/components/RegionSelector";
import { Viewport } from "@/components/Viewport";
import { AnalysisResult } from "@/components/AnalysisResult";
import { Disclaimer } from "@/components/Disclaimer";
import { FILTER_PRESETS, type FilterPreset } from "@/lib/presets";
import type { RegionOption } from "@/lib/regions";
import { captureFrameAsDataURL } from "@/lib/capture";
import { analyzeFrame } from "@/lib/analyze.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vascular Insights — viewer i AI dla USG naczyniowych" },
      {
        name: "description",
        content:
          "Analizator AI dla USG tętnic szyjnych, TCD/TCCD i struktur mózgu. Narzędzie wspomagające — nie wyrób medyczny.",
      },
      { property: "og:title", content: "Vascular Insights" },
      {
        property: "og:description",
        content: "Viewer i analizator AI dla USG naczyniowych: carotid, TCD/TCCD, struktury mózgu.",
      },
    ],
  }),
  component: HomePage,
});

interface UploadedFile {
  file: File;
  url: string;
  kind: "video" | "image" | "dicom";
}

type AnalysisState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; markdown: string }
  | { status: "error"; message: string };

function HomePage() {
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [region, setRegion] = useState<RegionOption | null>(null);
  const [filter, setFilter] = useState<FilterPreset>(FILTER_PRESETS[0]);
  const [analysis, setAnalysis] = useState<AnalysisState>({ status: "idle" });
  const sourceRef = useRef<HTMLVideoElement | HTMLImageElement | null>(null);

  function reset() {
    if (uploaded) URL.revokeObjectURL(uploaded.url);
    setUploaded(null);
    setRegion(null);
    setFilter(FILTER_PRESETS[0]);
    setAnalysis({ status: "idle" });
  }

  // Główna funkcja analizy klatki
  async function handleAnalyze() {
    if (!uploaded || !region) return;
    if (uploaded.kind === "dicom") {
      setAnalysis({
        status: "error",
        message: "Analiza DICOM-only wymaga pełnego viewera Cornerstone (kolejna iteracja). Wgraj wideo lub obraz.",
      });
      return;
    }
    const source = sourceRef.current;
    if (!source) {
      setAnalysis({ status: "error", message: "Źródło obrazu nie jest gotowe." });
      return;
    }

    setAnalysis({ status: "loading" });
    try {
      const dataUrl = await captureFrameAsDataURL(source, filter.filter, 1280);
      const result = await analyzeFrame({
        data: {
          category: region.category,
          regionLabel: region.label,
          imageBase64: dataUrl,
        },
      });
      if (result.ok) {
        setAnalysis({ status: "ok", markdown: result.markdown });
      } else {
        setAnalysis({ status: "error", message: result.error });
      }
    } catch (e) {
      setAnalysis({
        status: "error",
        message: e instanceof Error ? e.message : "Nieznany błąd",
      });
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      {/* Header */}
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            Vascular Insights
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Viewer i analizator AI <span className="text-primary">USG naczyniowych</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Tętnice szyjne (carotid Doppler), TCD / TCCD, struktury mózgu. Wgraj klatkę lub wideo, wybierz region,
            uruchom analizę AI.
          </p>
        </div>
        {uploaded && (
          <button
            type="button"
            onClick={reset}
            className="shrink-0 rounded-md border border-border bg-secondary px-3 py-1.5 text-sm hover:border-destructive hover:text-destructive"
          >
            Resetuj
          </button>
        )}
      </header>

      {/* Krok 1: Upload */}
      {!uploaded && (
        <div className="space-y-4">
          <UploadDropzone onUpload={setUploaded} />
          <Disclaimer variant="strong" />
        </div>
      )}

      {/* Krok 2: viewer + wybór regionu + analiza */}
      {uploaded && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          {/* Lewa kolumna — viewer + wynik */}
          <div className="space-y-4">
            <Viewport
              fileUrl={uploaded.url}
              fileKind={uploaded.kind}
              fileName={uploaded.file.name}
              filter={filter}
              onFilterChange={setFilter}
              sourceRef={sourceRef}
            />

            {/* Akcje analizy */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Wybrany region</div>
                <div className="truncate font-medium">{region ? region.label : "— wybierz po prawej —"}</div>
              </div>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!region || analysis.status === "loading" || uploaded.kind === "dicom"}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {analysis.status === "loading" ? "Analizuję…" : "🤖 Analizuj obecną klatkę"}
              </button>
            </div>

            {/* Wynik analizy */}
            {analysis.status === "loading" && (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">
                  Analiza AI w toku — model wieloskośny (vision) interpretuje klatkę…
                </p>
              </div>
            )}
            {analysis.status === "error" && (
              <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive-foreground">
                <strong className="text-destructive">Błąd:</strong> {analysis.message}
              </div>
            )}
            {analysis.status === "ok" && (
              <div className="space-y-3">
                <AnalysisResult markdown={analysis.markdown} />
                <Disclaimer variant="strong" />
              </div>
            )}
          </div>

          {/* Prawa kolumna — wybór regionu */}
          <aside className="lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-2">
            <RegionSelector selectedId={region?.id} onSelect={setRegion} />
          </aside>
        </div>
      )}
    </main>
  );
}
