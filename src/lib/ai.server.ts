// Pomocnicze funkcje serwerowe — wywołanie Lovable AI Gateway
// Wydzielone do .server.ts żeby uniknąć referencji w split serverFn

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export async function callLovableAI(opts: {
  model?: string;
  systemPrompt?: string;
  userText: string;
  imageBase64?: string; // dataURL np. "data:image/png;base64,..."
}): Promise<{ ok: true; content: string } | { ok: false; status: number; error: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 500, error: "LOVABLE_API_KEY nie jest skonfigurowany" };
  }

  const messages: any[] = [];
  if (opts.systemPrompt) {
    messages.push({ role: "system", content: opts.systemPrompt });
  }

  // Wiadomość użytkownika z opcjonalnym obrazem
  const userContent: any[] = [{ type: "text", text: opts.userText }];
  if (opts.imageBase64) {
    userContent.push({
      type: "image_url",
      image_url: { url: opts.imageBase64 },
    });
  }
  messages.push({ role: "user", content: userContent });

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? "google/gemini-3-flash-preview",
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) {
      return { ok: false, status: 429, error: "Przekroczony limit zapytań. Spróbuj za chwilę." };
    }
    if (res.status === 402) {
      return { ok: false, status: 402, error: "Brak kredytów Lovable AI. Doładuj w Settings → Workspace → Usage." };
    }
    return { ok: false, status: res.status, error: `Błąd AI Gateway: ${res.status} ${text.slice(0, 200)}` };
  }

  const json = (await res.json()) as any;
  const content: string = json?.choices?.[0]?.message?.content ?? "";
  return { ok: true, content };
}
