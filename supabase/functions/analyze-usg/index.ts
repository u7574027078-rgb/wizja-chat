// Edge Function: analyze-usg
// Przyjmuje plik USG (image/video/DICOM) jako multipart/form-data lub JSON {imageBase64, mimeType}
// i wysyła do Grok (xAI) lub Claude (Anthropic) zwracając analizę naczyniową w Markdown.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Provider = "grok" | "claude";
type Category = "carotid" | "tcd" | "brain" | "generic";

const SYSTEM_PROMPT = `Jesteś asystentem AI dla lekarzy USG naczyniowego.
Odpowiadasz wyłącznie po polsku, w formacie Markdown.
Analizuj klatkę USG i opisz:
1. RODZAJ BADANIA (B-mode, Doppler kolorowy, spektralny, TCD/TCCD)
2. WIDOCZNE STRUKTURY / NACZYNIE
3. MORFOLOGIA (ściany, IMT, blaszki)
4. PRZEPŁYW (jeśli Doppler) — przepisz dosłownie wartości wypalone na obrazie (PSV, EDV, RI, PI, MFV)
5. SUGEROWANE INTERPRETACJE (klasyfikacja stenozy NASCET/ECST, wskaźnik Lindegaarda)
6. OGRANICZENIA i konieczność weryfikacji przez specjalistę.
NIE wymyślaj wartości liczbowych — tylko te widoczne na obrazie.`;

function userPromptFor(category: Category, regionLabel?: string): string {
  const region = regionLabel ? ` (deklarowany region: ${regionLabel})` : "";
  if (category === "carotid")
    return `Analizuj klatkę USG tętnicy szyjnej${region}. Oceń światło, ścianę, IMT, blaszki, parametry dopplerowskie.`;
  if (category === "tcd")
    return `Analizuj klatkę TCD/TCCD${region}. ⚠ Pamiętaj o ograniczonej wiarygodności AI w identyfikacji naczyń przezczaszkowych.`;
  if (category === "brain")
    return `Analizuj klatkę USG struktur mózgu${region}. Oceń komory, asymetrie, echogeniczność jąder podstawy.`;
  return `Analizuj klatkę USG naczyniowego${region}.`;
}

async function callGrok(imageDataUrl: string, userText: string) {
  const key = Deno.env.get("grokAix");
  if (!key) throw new Error("Brak sekretu grokAix");
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-2-vision-1212",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Grok ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

async function callClaude(imageBase64Raw: string, mimeType: string, userText: string) {
  const key = Deno.env.get("opusclaude");
  if (!key) throw new Error("Brak sekretu opusclaude");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: imageBase64Raw },
            },
            { type: "text", text: userText },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Claude ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  return j.content?.[0]?.text ?? "";
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    let imageBase64Raw = "";
    let mimeType = "image/jpeg";
    let provider: Provider = "grok";
    let category: Category = "generic";
    let regionLabel = "";

    const ct = req.headers.get("content-type") ?? "";

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      provider = ((form.get("provider") as string) ?? "grok") as Provider;
      category = ((form.get("category") as string) ?? "generic") as Category;
      regionLabel = (form.get("regionLabel") as string) ?? "";

      if (!file) throw new Error("Brak pliku 'file' w formData");
      mimeType = file.type || "application/octet-stream";

      // Walidacja: vision API nie przyjmie video / DICOM bezpośrednio
      if (!mimeType.startsWith("image/")) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Format ${mimeType} nie jest obsługiwany przez vision API. Wyodrębnij klatkę po stronie klienta i prześlij jako JPEG/PNG.`,
          }),
          { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Limit 10 MB
      if (file.size > 10 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ ok: false, error: "Plik > 10 MB. Zmniejsz rozdzielczość." }),
          { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const buf = new Uint8Array(await file.arrayBuffer());
      imageBase64Raw = bytesToBase64(buf);
    } else {
      // JSON path: { imageBase64 (dataURL lub raw), mimeType, provider, category, regionLabel }
      const body = await req.json();
      provider = (body.provider ?? "grok") as Provider;
      category = (body.category ?? "generic") as Category;
      regionLabel = body.regionLabel ?? "";
      mimeType = body.mimeType ?? "image/jpeg";
      const raw: string = body.imageBase64 ?? "";
      if (!raw) throw new Error("Brak imageBase64");
      const m = raw.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (m) {
        mimeType = m[1];
        imageBase64Raw = m[2];
      } else {
        imageBase64Raw = raw;
      }
    }

    const userText = userPromptFor(category, regionLabel);
    const dataUrl = `data:${mimeType};base64,${imageBase64Raw}`;

    const markdown =
      provider === "claude"
        ? await callClaude(imageBase64Raw, mimeType, userText)
        : await callGrok(dataUrl, userText);

    return new Response(
      JSON.stringify({ ok: true, provider, category, markdown }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("analyze-usg error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
