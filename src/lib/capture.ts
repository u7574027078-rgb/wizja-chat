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

  // Aplikuj filtr CSS (kontrast/saturacja itp.)
  ctx.filter = filterCss;
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.9);
}
