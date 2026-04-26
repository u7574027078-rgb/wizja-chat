import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callLovableAI } from "./ai.server";
import { buildPrompt } from "./prompts";

const InputSchema = z.object({
  category: z.enum(["carotid", "tcd", "brain"]),
  regionLabel: z.string().min(1).max(200),
  imageBase64: z
    .string()
    .min(20)
    .max(15_000_000) // ~15MB dataURL
    .regex(/^data:image\/(png|jpeg|jpg|webp);base64,/, "Wymagany dataURL obrazu"),
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
