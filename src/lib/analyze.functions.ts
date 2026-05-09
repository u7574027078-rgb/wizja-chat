import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callLovableAI } from "./ai.server";
import { buildPrompt } from "./prompts";
import { buildSequencePrompt } from "./sequencePrompts";

const ImageDataUrl = z
  .string()
  .min(20)
  .max(15_000_000)
  .regex(/^data:image\/(png|jpeg|jpg|webp);base64,/, "Wymagany dataURL obrazu");

const InputSchema = z.object({
  category: z.enum(["carotid", "tcd", "brain"]),
  regionLabel: z.string().min(1).max(200),
  imageBase64: ImageDataUrl,
});

// Analiza pojedynczej klatki — zwraca markdown z opisem
export const analyzeFrame = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const prompt = buildPrompt(data.category, data.regionLabel);

    const result = await callLovableAI({
      systemPrompt:
        "Jesteś asystentem AI dla lekarzy. Odpowiadasz wyłącznie po polsku, w formacie Markdown. Zawsze podkreślasz ograniczenia analizy i konieczność weryfikacji przez specjalistę.",
      userText: prompt,
      imageBase64: data.imageBase64,
    });

    if (!result.ok) {
      return { ok: false as const, error: result.error, status: result.status };
    }
    return { ok: true as const, markdown: result.content };
  });

// Analiza sekwencji wieloklatkowej (do 8 klatek)
const SequenceSchema = z.object({
  category: z.enum(["carotid", "tcd", "brain"]),
  regionLabel: z.string().min(1).max(200),
  videoDuration: z.number().positive().max(3600),
  frames: z
    .array(
      z.object({
        dataUrl: ImageDataUrl,
        timestamp: z.number().nonnegative(),
      }),
    )
    .min(2)
    .max(8),
});

export const analyzeSequence = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SequenceSchema.parse(input))
  .handler(async ({ data }) => {
    // Pilnujemy łącznego rozmiaru ≤ ~5 MB
    const totalBytes = data.frames.reduce((s, f) => s + f.dataUrl.length, 0);
    if (totalBytes > 5_500_000) {
      return {
        ok: false as const,
        status: 413,
        error: "Łączny rozmiar klatek przekracza limit. Zmniejsz liczbę klatek lub jakość.",
      };
    }

    const sampleCount = data.frames.length;
    const prompt = buildSequencePrompt({
      category: data.category,
      regionLabel: data.regionLabel,
      sampleCount,
      videoDuration: data.videoDuration,
    });

    const tsList = data.frames
      .map((f, i) => `Klatka ${i + 1}: t=${f.timestamp.toFixed(2)}s`)
      .join("\n");
    const userText = `${prompt}\n\nKolejność i znaczniki czasowe klatek:\n${tsList}`;

    const result = await callLovableAI({
      model: "google/gemini-2.5-pro",
      maxTokens: 3000,
      timeoutMs: 90_000,
      systemPrompt:
        "Jesteś asystentem AI dla lekarzy. Odpowiadasz wyłącznie po polsku, w formacie Markdown. Analizujesz sekwencję klatek USG naczyniowego i opisujesz DYNAMIKĘ przepływu (zmiany w cyklu serca, rytmiczność), nie tylko statyczną morfologię. Zawsze podkreślasz ograniczenia i konieczność weryfikacji przez specjalistę.",
      userText,
      imagesBase64: data.frames.map((f) => f.dataUrl),
    });

    if (!result.ok) {
      return { ok: false as const, error: result.error, status: result.status };
    }
    return { ok: true as const, markdown: result.content, sampleCount, videoDuration: data.videoDuration };
  });
