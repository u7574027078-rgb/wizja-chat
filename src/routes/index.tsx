import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { UploadDropzone } from "@/components/UploadDropzone";
import { RegionSelector } from "@/components/RegionSelector";
import { Viewport } from "@/components/Viewport";
import { AnalysisResult } from "@/components/AnalysisResult";
import { Disclaimer } from "@/components/Disclaimer";
import { FILTER_PRESETS, type FilterPreset } from "@/lib/presets";
import type { RegionOption } from "@/lib/regions";
import { captureFrameAsDataURL, sampleFramesFromVideo, type SampledFrame } from "@/lib/capture";
import { analyzeFrame, analyzeSequence } from "@/lib/analyze.functions";

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

type SequenceState =
  | { status: "idle" }
  | { status: "sampling"; current: number; total: number }
  | { status: "uploading" }
  | { status: "analyzing"; elapsed: number }
  | { status: "ok"; markdown: string; frames: SampledFrame[]; duration: number }
  | { status: "error"; message: string };

const SAMPLE_COUNT = 8;
const SEQUENCE_CONSENT_KEY = "vi.sequenceConsent";

function HomePage() {
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [region, setRegion] = useState<RegionOption | null>(null);
  const [filter, setFilter] = useState<FilterPreset>(FILTER_PRESETS[0]);
  const [analysis, setAnalysis] = useState<AnalysisState>({ status: "idle" });
  const [sequence, setSequence] = useState<SequenceState>({ status: "idle" });
  const [showConsent, setShowConsent] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const sourceRef = useRef<HTMLVideoElement | HTMLImageElement | null>(null);

  function reset() {
    if (uploaded) URL.revokeObjectURL(uploaded.url);
    setUploaded(null);
    setRegion(null);
    setFilter(FILTER_PRESETS[0]);
    setAnalysis({ status: "idle" });
    setSequence({ status: "idle" });
    setVideoDuration(null);
  }

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
        data: { category: region.category, regionLabel: region.label, imageBase64: dataUrl },
      });
      if (result.ok) setAnalysis({ status: "ok", markdown: result.markdown });
      else setAnalysis({ status: "error", message: result.error });
    } catch (e) {
      setAnalysis({ status: "error", message: e instanceof Error ? e.message : "Nieznany błąd" });
    }
  }

  // Główna funkcja analizy sekwencji
  async function runSequenceAnalysis() {
    if (!uploaded || !region) return;
    const video = sourceRef.current;
    if (!(video instanceof HTMLVideoElement)) {
      setSequence({ status: "error", message: "Analiza sekwencji działa tylko dla wideo." });
      return;
    }
    if (!video.duration || video.duration < 2) {
      setSequence({ status: "error", message: "Wideo musi mieć min. 2 sekundy." });
      return;
    }

    const duration = video.duration;
    setSequence({ status: "sampling", current: 0, total: SAMPLE_COUNT });

    let frames: SampledFrame[];
    try {
      frames = await sampleFramesFromVideo(
        video,
        SAMPLE_COUNT,
        filter.filter,
        (current, total) => setSequence({ status: "sampling", current, total }),
        512,
        0.7,
      );
    } catch (e) {
      setSequence({ status: "error", message: `Błąd próbkowania: ${e instanceof Error ? e.message : String(e)}` });
      return;
    }

    setSequence({ status: "uploading" });

    // Licznik czasu analizy
    const startedAt = Date.now();
    const tick = setInterval(() => {
      setSequence((prev) =>
        prev.status === "analyzing" || prev.status === "uploading"
          ? { status: "analyzing", elapsed: Math.floor((Date.now() - startedAt) / 1000) }
          : prev,
      );
    }, 1000);

    try {
      setSequence({ status: "analyzing", elapsed: 0 });
      const result = await analyzeSequence({
        data: {
          category: region.category,
          regionLabel: region.label,
          videoDuration: duration,
          frames: frames.map((f) => ({ dataUrl: f.dataUrl, timestamp: f.timestamp })),
        },
      });
      clearInterval(tick);
      if (result.ok) {
        setSequence({ status: "ok", markdown: result.markdown, frames, duration });
      } else {
        setSequence({ status: "error", message: result.error });
      }
    } catch (e) {
      clearInterval(tick);
      setSequence({ status: "error", message: e instanceof Error ? e.message : "Nieznany błąd" });
    }
  }

  function handleSequenceClick() {
    if (typeof window !== "undefined" && localStorage.getItem(SEQUENCE_CONSENT_KEY) === "1") {
      void runSequenceAnalysis();
    } else {
      setShowConsent(true);
    }
  }

  function seekVideoTo(t: number) {
    const v = sourceRef.current;
    if (v instanceof HTMLVideoElement) {
      try {
        v.currentTime = t;
      } catch { /* noop */ }
    }
  }

  // Czy przycisk sekwencji jest dostępny
  const seqDisabled =
    !region ||
    uploaded?.kind !== "video" ||
    !videoDuration ||
    videoDuration < 2 ||
    sequence.status === "sampling" ||
    sequence.status === "uploading" ||
    sequence.status === "analyzing";

  const seqTooltip = (() => {
    if (uploaded?.kind !== "video") return "Analiza sekwencji wymaga wideo.";
    if (!videoDuration) return "Poczekaj na załadowanie metadanych wideo.";
    if (videoDuration < 2) return "Wideo musi mieć min. 2 sekundy.";
    if (!region) return "Wybierz najpierw region.";
    return "Analiza 8 klatek z całego nagrania. Ocenia dynamikę przepływu Dopplera, zmiany w cyklu serca, charakter krzywej. Trwa 30-60 sek. Idealne dla badań Dopplerowskich.";
  })();

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
            uruchom analizę AI — pojedynczą klatkę lub całą sekwencję.
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

      {!uploaded && (
        <div className="space-y-4">
          <UploadDropzone onUpload={setUploaded} />
          <Disclaimer variant="strong" />
        </div>
      )}

      {uploaded && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Viewport
              fileUrl={uploaded.url}
              fileKind={uploaded.kind}
              fileName={uploaded.file.name}
              filter={filter}
              onFilterChange={setFilter}
              sourceRef={sourceRef}
              onVideoMeta={(d) => setVideoDuration(d)}
            />

            {/* Akcje analizy */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Wybrany region</div>
                <div className="truncate font-medium">{region ? region.label : "— wybierz po prawej —"}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!region || analysis.status === "loading" || uploaded.kind === "dicom"}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {analysis.status === "loading" ? "Analizuję…" : "🤖 Analizuj obecną klatkę"}
                </button>
                <button
                  type="button"
                  onClick={handleSequenceClick}
                  disabled={seqDisabled}
                  title={seqTooltip}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sequence.status === "sampling"
                    ? `Pobieranie klatki ${sequence.current}/${sequence.total}…`
                    : sequence.status === "uploading"
                      ? "Wysyłanie do AI…"
                      : sequence.status === "analyzing"
                        ? `AI analizuje sekwencję… ${sequence.elapsed}s`
                        : "🎬 Analizuj sekwencję wideo (AI)"}
                </button>
              </div>
              {sequence.status === "sampling" && (
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${(sequence.current / sequence.total) * 100}%` }}
                  />
                </div>
              )}
            </div>

            {/* Wynik pojedynczej klatki */}
            {analysis.status === "loading" && (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Analiza AI w toku — interpretacja klatki…</p>
              </div>
            )}
            {analysis.status === "error" && (
              <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive-foreground">
                <strong className="text-destructive">Błąd:</strong> {analysis.message}
              </div>
            )}
            {analysis.status === "ok" && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  🤖 Analiza pojedynczej klatki
                </h3>
                <AnalysisResult markdown={analysis.markdown} />
              </div>
            )}

            {/* Wynik sekwencji */}
            {sequence.status === "error" && (
              <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive-foreground">
                <strong className="text-destructive">Błąd sekwencji:</strong> {sequence.message}
              </div>
            )}
            {(sequence.status === "uploading" || sequence.status === "analyzing") && (
              <div className="rounded-xl border border-accent/50 bg-accent/10 p-6 text-center">
                <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <p className="text-sm text-foreground/90">
                  {sequence.status === "uploading"
                    ? "Wysyłanie 8 klatek do modelu…"
                    : `AI analizuje sekwencję — multi-image vision (gemini-2.5-pro)… ${sequence.elapsed}s`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Może zająć 30–90 sekund.</p>
              </div>
            )}
            {sequence.status === "ok" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    🎬 Analiza sekwencji ({sequence.frames.length} klatek z {sequence.duration.toFixed(1)}s)
                  </h3>
                </div>
                <AnalysisResult markdown={sequence.markdown} />

                {/* Miniaturki kluczowych klatek */}
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                    Kluczowe klatki (kliknij aby przewinąć wideo)
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {pickKeyFrames(sequence.frames).map((f, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => seekVideoTo(f.timestamp)}
                        className="group overflow-hidden rounded-md border border-border bg-black transition-all hover:border-accent"
                      >
                        <img src={f.dataUrl} alt={`klatka @ ${f.timestamp}s`} className="aspect-video w-full object-contain" />
                        <div className="bg-secondary/80 px-2 py-1 text-left text-[10px] font-mono text-muted-foreground group-hover:text-accent">
                          t = {f.timestamp.toFixed(2)}s
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <Disclaimer variant="strong">
                  ⚠ Analiza oparta na próbce {sequence.frames.length} klatek z całego nagrania ({sequence.duration.toFixed(1)}s).
                  Może przegapić szybkie zdarzenia (np. pojedyncze HITS w TCD). Nie zastępuje pełnej oceny ekspertem.
                </Disclaimer>
              </div>
            )}

            {analysis.status === "ok" && sequence.status !== "ok" && <Disclaimer variant="strong" />}
          </div>

          <aside className="lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-2">
            <RegionSelector selectedId={region?.id} onSelect={setRegion} />
          </aside>
        </div>
      )}

      {/* Modal pierwszej zgody */}
      {showConsent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
          <div className="max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold">Analiza sekwencji wideo</h3>
            <p className="text-sm text-muted-foreground">
              Analiza wysyła <strong className="text-foreground">8 klatek</strong> do modelu AI (gemini-2.5-pro). Zużywa
              ok. <strong className="text-foreground">8× więcej kredytów</strong> niż analiza pojedynczej klatki i może
              trwać 30–90 sekund. Kontynuować?
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConsent(false)}
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm hover:bg-secondary/80"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConsent(false);
                  void runSequenceAnalysis();
                }}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Tak
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") localStorage.setItem(SEQUENCE_CONSENT_KEY, "1");
                  setShowConsent(false);
                  void runSequenceAnalysis();
                }}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
              >
                Tak, nie pytaj więcej
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// 4 reprezentatywne klatki: ~0%, ~33%, ~66%, ~100%
function pickKeyFrames(frames: SampledFrame[]): SampledFrame[] {
  if (frames.length <= 4) return frames;
  const last = frames.length - 1;
  const indices = [0, Math.round(last * 0.33), Math.round(last * 0.66), last];
  return Array.from(new Set(indices)).map((i) => frames[i]);
}
