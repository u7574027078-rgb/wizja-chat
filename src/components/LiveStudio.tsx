import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveStream } from "@/lib/useLiveStream";
import { FILTER_PRESETS, type FilterPreset } from "@/lib/presets";
import { RegionSelector } from "@/components/RegionSelector";
import type { RegionOption } from "@/lib/regions";
import { captureFrameAsDataURL, sampleFramesFromLive, type SampledFrame } from "@/lib/capture";
import { analyzeFrame, analyzeSequence } from "@/lib/analyze.functions";
import { AnalysisResult } from "@/components/AnalysisResult";
import { Disclaimer } from "@/components/Disclaimer";
import { cn } from "@/lib/utils";

interface Props {
  onExit: () => void;
}

// Wpis w galerii sesji live
interface SessionEntry {
  id: string;
  type: "single" | "sequence" | "continuous";
  regionLabel: string;
  category: "carotid" | "tcd" | "brain";
  thumbnail: string; // dataURL JPEG
  markdown: string;
  createdAt: number; // epoch ms
}

const INTERVALS_S = [5, 10, 30] as const;

// Główny ekran trybu live
export function LiveStudio({ onExit }: Props) {
  const live = useLiveStream();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [filter, setFilter] = useState<FilterPreset>(FILTER_PRESETS[0]);
  const [region, setRegion] = useState<RegionOption | null>(null);
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("vi.liveIntroSeen") !== "1";
  });

  const [aiBusy, setAiBusy] = useState<null | "single" | "sequence">(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [seqProgress, setSeqProgress] = useState<{ current: number; total: number } | null>(null);

  const [continuous, setContinuous] = useState(false);
  const [intervalSec, setIntervalSec] = useState<(typeof INTERVALS_S)[number]>(30);
  const [continuousCount, setContinuousCount] = useState(0);

  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);

  // Pierwsze załadowanie listy urządzeń
  useEffect(() => {
    void live.refreshDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Podpięcie streamu do <video>
  useEffect(() => {
    if (videoRef.current && live.stream) {
      videoRef.current.srcObject = live.stream;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [live.stream]);

  // Pomocnicza — bezpieczne capture
  async function grabAnalysisFrame(maxWidth = 1280): Promise<string | null> {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      setAiError("Live stream nie jest jeszcze gotowy.");
      return null;
    }
    return captureFrameAsDataURL(v, filter.filter, maxWidth);
  }

  function addEntry(entry: Omit<SessionEntry, "id" | "createdAt"> & Partial<Pick<SessionEntry, "createdAt">>) {
    const e: SessionEntry = {
      id: crypto.randomUUID(),
      createdAt: entry.createdAt ?? Date.now(),
      ...entry,
    };
    setEntries((prev) => [e, ...prev]);
    setActiveEntryId(e.id);
  }

  // Pojedyncza klatka z live → AI
  async function analyzeLiveFrame(opts?: { silent?: boolean }) {
    if (!region) {
      setAiError("Wybierz region badania.");
      return;
    }
    if (!opts?.silent) setAiBusy("single");
    setAiError(null);
    try {
      const dataUrl = await grabAnalysisFrame();
      if (!dataUrl) return;
      const thumb = await captureFrameAsDataURL(videoRef.current!, filter.filter, 320);
      const res = await analyzeFrame({
        data: { category: region.category, regionLabel: region.label, imageBase64: dataUrl },
      });
      if (res.ok) {
        addEntry({
          type: opts?.silent ? "continuous" : "single",
          regionLabel: region.label,
          category: region.category,
          thumbnail: thumb,
          markdown: res.markdown,
        });
      } else {
        setAiError(res.error);
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Nieznany błąd");
    } finally {
      if (!opts?.silent) setAiBusy(null);
    }
  }

  // Sekwencja live: 8 klatek z 5 sek
  async function analyzeLiveSequence() {
    if (!region) {
      setAiError("Wybierz region badania.");
      return;
    }
    setAiBusy("sequence");
    setAiError(null);
    setSeqProgress({ current: 0, total: 8 });
    try {
      const v = videoRef.current!;
      const frames = await sampleFramesFromLive(
        v,
        8,
        5,
        filter.filter,
        (current, total) => setSeqProgress({ current, total }),
        512,
        0.7,
      );
      const thumb = frames[Math.floor(frames.length / 2)].dataUrl;
      const res = await analyzeSequence({
        data: {
          category: region.category,
          regionLabel: region.label,
          videoDuration: 5,
          frames,
        },
      });
      if (res.ok) {
        addEntry({
          type: "sequence",
          regionLabel: region.label,
          category: region.category,
          thumbnail: thumb,
          markdown: res.markdown,
        });
      } else {
        setAiError(res.error);
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Nieznany błąd");
    } finally {
      setAiBusy(null);
      setSeqProgress(null);
    }
  }

  // Tryb ciągły — co intervalSec wysyła klatkę
  useEffect(() => {
    if (!continuous || !region || live.status !== "streaming") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loop = async () => {
      if (cancelled) return;
      await analyzeLiveFrame({ silent: true });
      setContinuousCount((c) => c + 1);
      if (cancelled) return;
      timer = setTimeout(loop, intervalSec * 1000);
    };
    timer = setTimeout(loop, 500); // pierwszy strzał po 0.5 s
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continuous, intervalSec, region, live.status]);

  // Snapshot bez analizy (lokalna miniaturka w galerii)
  async function snapshotOnly() {
    if (!videoRef.current?.videoWidth) return;
    const thumb = await captureFrameAsDataURL(videoRef.current, filter.filter, 320);
    addEntry({
      type: "single",
      regionLabel: region?.label ?? "(snapshot)",
      category: region?.category ?? "carotid",
      thumbnail: thumb,
      markdown: "_Snapshot bez analizy AI._",
    });
  }

  function dismissIntro(persist: boolean) {
    if (persist && typeof window !== "undefined") localStorage.setItem("vi.liveIntroSeen", "1");
    setShowIntro(false);
  }

  function exitLive() {
    setContinuous(false);
    live.stopStream();
    onExit();
  }

  function exportSessionJSON() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vascular-insights-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportSessionPDF() {
    // Otwieramy nowe okno z czystym HTML i wywołujemy print() — bez dodatkowej zależności
    const w = window.open("", "_blank");
    if (!w) return;
    const escape = (s: string) =>
      s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
    const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8" />
      <title>Vascular Insights — sesja live</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 24px; color: #111; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .sub { color: #666; font-size: 12px; margin-bottom: 24px; }
        .entry { display: grid; grid-template-columns: 220px 1fr; gap: 16px; padding: 16px 0; border-top: 1px solid #ddd; page-break-inside: avoid; }
        .entry img { width: 220px; border: 1px solid #ddd; }
        .meta { font-size: 12px; color: #555; margin-bottom: 6px; }
        pre { white-space: pre-wrap; font-family: inherit; font-size: 12px; line-height: 1.45; margin: 0; }
        .disc { margin-top: 20px; padding: 10px; background: #fff8dc; border: 1px solid #e0c97a; font-size: 11px; }
        @media print { .noprint { display: none; } }
      </style></head><body>
      <h1>Vascular Insights — raport sesji live</h1>
      <div class="sub">Wygenerowano: ${new Date().toLocaleString("pl-PL")} · Wpisów: ${entries.length}</div>
      ${entries
        .map(
          (e) => `<section class="entry">
            <img src="${e.thumbnail}" alt="snapshot" />
            <div>
              <div class="meta"><strong>${escape(e.regionLabel)}</strong> · ${e.type} · ${new Date(e.createdAt).toLocaleString("pl-PL")}</div>
              <pre>${escape(e.markdown)}</pre>
            </div>
          </section>`,
        )
        .join("")}
      <div class="disc">⚠ Vascular Insights to narzędzie wspomagające/edukacyjne. NIE jest wyrobem medycznym. Decyzja kliniczna należy do lekarza.</div>
      <div class="noprint" style="margin-top:24px"><button onclick="window.print()">Drukuj / Zapisz jako PDF</button></div>
      <script>setTimeout(() => window.print(), 400);</script>
      </body></html>`;
    w.document.write(html);
    w.document.close();
  }

  const activeEntry = useMemo(() => entries.find((e) => e.id === activeEntryId) ?? null, [entries, activeEntryId]);
  const liveReady = live.status === "streaming";

  return (
    <div className="space-y-4">
      {/* Header + safety banner */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📡</span>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-primary">Live streaming</div>
            <h2 className="text-xl font-semibold">Kamera / capture card / OBS Virtual Camera</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={exitLive}
          className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm hover:border-destructive hover:text-destructive"
        >
          ⏹ Zatrzymaj live
        </button>
      </div>

      <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-2 text-xs leading-relaxed text-warning-foreground">
        🔒 <strong>Obraz NIE jest nagrywany.</strong> Tylko klatki, które wybierzesz do analizy AI, są wysyłane do
        Lovable AI Gateway. Zamknięcie strony = koniec sesji.
      </div>

      {/* Wybór kamery / start */}
      {!liveReady && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 text-sm font-semibold">Wybór źródła obrazu</div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[240px]">
              <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Kamera</label>
              <select
                value={live.selectedDeviceId ?? ""}
                onChange={(e) => live.setSelectedDeviceId(e.target.value)}
                className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm"
              >
                {live.devices.length === 0 && <option value="">Brak urządzeń</option>}
                {live.devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void live.refreshDevices()}
              className="rounded-md border border-border bg-secondary px-3 py-2 text-sm hover:bg-secondary/80"
            >
              🔄 Odśwież
            </button>
            <button
              type="button"
              onClick={() => void live.startStream()}
              disabled={!live.selectedDeviceId}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              ▶ Start stream
            </button>
          </div>
          {live.error && <div className="mt-3 text-xs text-destructive">⚠ {live.error}</div>}
          <details className="mt-4 text-xs text-muted-foreground">
            <summary className="cursor-pointer text-foreground">Pomoc — setup capture card / OBS</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Podłącz capture card HDMI→USB (np. Elgato HD60 X, AverMedia, generic).</li>
              <li>Wyjście HDMI aparatu USG → wejście capture card.</li>
              <li>OBS Studio → Tools → Start Virtual Camera (lub używaj capture device wprost).</li>
              <li>W przeglądarce zezwól na dostęp do kamery i wybierz „OBS Virtual Camera”.</li>
              <li>Alternatywnie: kamera komputera skierowana na ekran aparatu USG.</li>
            </ol>
          </details>
        </div>
      )}

      {/* Streaming UI */}
      {liveReady && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            <div className="medical-grid relative overflow-hidden rounded-xl border border-border bg-black">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="mx-auto block max-h-[60vh] w-full"
                style={{ filter: filter.filter }}
              />
              <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs font-semibold text-white">
                <span
                  className={cn(
                    "inline-block h-2 w-2 rounded-full",
                    live.status === "paused" ? "bg-yellow-400" : "animate-pulse bg-red-500",
                  )}
                />
                {live.status === "paused" ? "PAUZA" : "LIVE"}
              </div>
            </div>

            {/* Kontrolki streamu */}
            <div className="flex flex-wrap gap-2">
              {live.status === "streaming" ? (
                <button
                  type="button"
                  onClick={live.pauseStream}
                  className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs hover:bg-secondary/80"
                >
                  ⏸ Pauza
                </button>
              ) : (
                <button
                  type="button"
                  onClick={live.resumeStream}
                  className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs hover:bg-secondary/80"
                >
                  ▶ Wznów
                </button>
              )}
              <button
                type="button"
                onClick={() => void snapshotOnly()}
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs hover:bg-secondary/80"
              >
                📸 Snapshot (bez AI)
              </button>
              <button
                type="button"
                onClick={() => {
                  live.stopStream();
                }}
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs hover:bg-secondary/80"
              >
                🎥 Zmień kamerę
              </button>
            </div>

            {/* Presety filtrów */}
            <div className="flex flex-wrap gap-2">
              {FILTER_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setFilter(p)}
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

            {/* Akcje AI */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Wybrany region</div>
                <div className="truncate font-medium">{region ? region.label : "— wybierz po prawej —"}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void analyzeLiveFrame()}
                  disabled={!region || aiBusy !== null}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
                >
                  {aiBusy === "single" ? "Analizuję…" : "🤖 Analizuj obecną klatkę"}
                </button>
                <button
                  type="button"
                  onClick={() => void analyzeLiveSequence()}
                  disabled={!region || aiBusy !== null}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-40"
                  title="Nagrywa 5 sekund (8 klatek) z live i wysyła do AI."
                >
                  {aiBusy === "sequence"
                    ? seqProgress
                      ? `Nagrywam ${seqProgress.current}/${seqProgress.total}…`
                      : "Wysyłam…"
                    : "🎬 Analizuj sekwencję live (5s)"}
                </button>
              </div>

              {/* Tryb ciągły */}
              <div className="mt-4 rounded-lg border border-border/60 bg-secondary/30 p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={continuous}
                    onChange={(e) => {
                      setContinuous(e.target.checked);
                      if (e.target.checked) setContinuousCount(0);
                    }}
                    disabled={!region}
                  />
                  🔴 Tryb ciągły AI
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Interwał:</span>
                  {INTERVALS_S.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setIntervalSec(s)}
                      className={cn(
                        "rounded border px-2 py-0.5 text-xs",
                        intervalSec === s
                          ? "border-primary bg-primary/15 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      {s}s
                    </button>
                  ))}
                  {continuous && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      Wywołań: <strong className="text-foreground">{continuousCount}</strong> · ~{Math.round(3600 / intervalSec)}/h
                    </span>
                  )}
                </div>
                {continuous && (
                  <div className="mt-2 text-[11px] text-warning-foreground">
                    ⚠ Tryb ciągły zużywa kredyty AI Gateway. Sugerowany interwał: 30 s.
                  </div>
                )}
              </div>

              {aiError && (
                <div className="mt-3 rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
                  <strong className="text-destructive">Błąd:</strong> {aiError}
                </div>
              )}
            </div>

            {/* Aktywny wynik */}
            {activeEntry && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {activeEntry.type === "sequence" ? "🎬" : "🤖"} {activeEntry.regionLabel} ·{" "}
                  {new Date(activeEntry.createdAt).toLocaleTimeString("pl-PL")}
                </h3>
                <AnalysisResult markdown={activeEntry.markdown} />
              </div>
            )}

            <Disclaimer variant="strong" />
          </div>

          {/* Sidebar: galeria + region */}
          <aside className="space-y-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-2">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Galeria sesji ({entries.length})
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={exportSessionJSON}
                    disabled={entries.length === 0}
                    title="Eksport do JSON"
                    className="rounded border border-border bg-secondary px-2 py-0.5 text-[10px] hover:bg-secondary/80 disabled:opacity-40"
                  >
                    JSON
                  </button>
                  <button
                    type="button"
                    onClick={exportSessionPDF}
                    disabled={entries.length === 0}
                    title="Eksport do PDF (drukowanie)"
                    className="rounded border border-border bg-secondary px-2 py-0.5 text-[10px] hover:bg-secondary/80 disabled:opacity-40"
                  >
                    PDF
                  </button>
                </div>
              </div>
              {entries.length === 0 && (
                <div className="py-4 text-center text-xs text-muted-foreground">Brak analiz w tej sesji.</div>
              )}
              <ul className="space-y-2">
                {entries.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setActiveEntryId(e.id)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded border p-2 text-left transition-colors",
                        activeEntryId === e.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary/30 hover:border-primary/50",
                      )}
                    >
                      <img src={e.thumbnail} alt="" className="h-12 w-16 flex-shrink-0 rounded object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium">{e.regionLabel}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(e.createdAt).toLocaleTimeString("pl-PL")} · {e.type}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <RegionSelector selectedId={region?.id} onSelect={setRegion} />
          </aside>
        </div>
      )}

      {/* Modal intro */}
      {showIntro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
          <div className="max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">📡 Live streaming — wymagania</h3>
            <div className="space-y-2 text-sm text-foreground/90">
              <p><strong>Wariant A — z aparatem USG:</strong></p>
              <ol className="list-decimal space-y-1 pl-5 text-xs">
                <li>Capture card HDMI→USB podłączony do komputera</li>
                <li>Aparat USG z wyjściem HDMI podłączony do capture card</li>
                <li>OBS Studio z włączoną <em>Start Virtual Camera</em></li>
              </ol>
              <p className="mt-3"><strong>Wariant B — bez aparatu (test):</strong></p>
              <ol className="list-decimal space-y-1 pl-5 text-xs">
                <li>Webcam komputera skierowany na ekran aparatu USG</li>
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                Przeglądarka zapyta o dostęp do kamery. Wybierz odpowiednią z listy.
              </p>
              <div className="mt-3 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                ⚠ Obraz <strong>NIE jest nagrywany ani wysyłany</strong>. Tylko klatki wybrane do analizy AI idą do
                Lovable AI Gateway.
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => dismissIntro(false)}
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm hover:bg-secondary/80"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={() => dismissIntro(true)}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Rozumiem, kontynuuj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
