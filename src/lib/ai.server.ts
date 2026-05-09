// Pomocnicze funkcje serwerowe — wywołanie Lovable AI Gateway
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type GatewayResult =
  | { ok: true; content: string }
  | { ok: false; status: number; error: string };

export async function callLovableAI(opts: {
  model?: string;
  systemPrompt?: string;
  userText: string;
  imageBase64?: string; // dataURL np. "data:image/jpeg;base64,..."
  imagesBase64?: string[]; // wiele obrazów (multi-frame)
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<GatewayResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 500, error: "LOVABLE_API_KEY nie jest skonfigurowany" };
  }

  const messages: any[] = [];
  if (opts.systemPrompt) {
    messages.push({ role: "system", content: opts.systemPrompt });
  }

  const userContent: any[] = [{ type: "text", text: opts.userText }];
  if (opts.imageBase64) {
    userContent.push({ type: "image_url", image_url: { url: opts.imageBase64 } });
  }
  if (opts.imagesBase64?.length) {
    for (const url of opts.imagesBase64) {
      userContent.push({ type: "image_url", image_url: { url } });
    }
  }
  messages.push({ role: "user", content: userContent });

  const body: any = {
    model: opts.model ?? "google/gemini-3-flash-preview",
    messages,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);

  let res: Response;
  try {
    res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      status: aborted ? 504 : 500,
      error: aborted
        ? "Analiza trwa zbyt długo (timeout). Spróbuj z krótszym wideo."
        : `Błąd sieci: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  clearTimeout(timeout);

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
