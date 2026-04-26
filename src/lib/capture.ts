// Hook do wyciągania pojedynczej klatki z elementu wideo lub obrazu
export async function captureFrameAsDataURL(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  filterCss: string = "none",
  maxWidth: number = 1280,
): Promise<string> {
  const naturalW =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source instanceof HTMLImageElement
        ? source.naturalWidth
        : source.width;
  const naturalH =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source instanceof HTMLImageElement
        ? source.naturalHeight
        : source.height;

  if (!naturalW || !naturalH) {
    throw new Error("Źródło nie ma jeszcze wymiarów — poczekaj na załadowanie.");
  }

  const scale = Math.min(1, maxWidth / naturalW);
  const w = Math.round(naturalW * scale);
  const h = Math.round(naturalH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Brak kontekstu canvas");

  ctx.filter = filterCss;
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export interface SampledFrame {
  dataUrl: string; // pełny dataURL — przesyłamy do AI
  timestamp: number; // sekundy
}

// Próbkowanie N klatek równomiernie z wideo, z aktualnym filtrem CSS
export async function sampleFramesFromVideo(
  video: HTMLVideoElement,
  sampleCount: number,
  filterCss: string,
  onProgress?: (current: number, total: number) => void,
  size: number = 512,
  jpegQuality: number = 0.7,
): Promise<SampledFrame[]> {
  if (!video.duration || !isFinite(video.duration)) {
    throw new Error("Wideo nie ma znanej długości — poczekaj na załadowanie metadanych.");
  }
  const total = video.duration;

  // Zachowaj stan aby przywrócić po próbkowaniu
  const wasPaused = video.paused;
  const originalTime = video.currentTime;
  try {
    video.pause();
  } catch { /* ignore */ }

  const w = video.videoWidth || size;
  const h = video.videoHeight || size;
  const scale = Math.min(1, size / Math.max(w, h));
  const cw = Math.max(64, Math.round(w * scale));
  const ch = Math.max(64, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Brak kontekstu canvas");

  const frames: SampledFrame[] = [];

  const seekTo = (t: number) =>
    new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onErr);
        // Mała pauza — niektóre przeglądarki potrzebują tick na render
        requestAnimationFrame(() => resolve());
      };
      const onErr = () => {
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onErr);
        reject(new Error("Błąd seek wideo"));
      };
      video.addEventListener("seeked", onSeeked, { once: true });
      video.addEventListener("error", onErr, { once: true });
      try {
        video.currentTime = t;
      } catch (e) {
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onErr);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });

  for (let i = 0; i < sampleCount; i++) {
    const targetTime =
      sampleCount === 1
        ? total / 2
        : Math.min(total - 0.01, Math.max(0, (i / (sampleCount - 1)) * total));
    onProgress?.(i + 1, sampleCount);
    await seekTo(targetTime);
    ctx.filter = filterCss || "none";
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(video, 0, 0, cw, ch);
    const dataUrl = canvas.toDataURL("image/jpeg", jpegQuality);
    frames.push({ dataUrl, timestamp: Number(targetTime.toFixed(2)) });
  }

  // Przywróć poprzedni stan
  try {
    video.currentTime = originalTime;
    if (!wasPaused) await video.play().catch(() => undefined);
  } catch { /* ignore */ }

  return frames;
}
