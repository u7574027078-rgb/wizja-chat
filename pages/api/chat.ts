import type { NextApiRequest, NextApiResponse } from "next";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  messages: Message[];
}

interface ResponseBody {
  text?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseBody>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Brak klucza API. Dodaj ANTHROPIC_API_KEY do zmiennych środowiskowych.",
    });
  }

  const { messages } = req.body as RequestBody;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system:
        "Jesteś przyjaznym, empatycznym asystentem AI o imieniu Wizja. Odpowiadaj po polsku w naturalny, ciepły sposób. Bądź pomocny, konkretny i zwięzły.",
      messages,
    }),
  });

  if (!response.ok) {
    return res.status(response.status).json({
      error: `Błąd API Anthropic: ${response.status} – ${response.statusText}`,
    });
  }

  const result = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  const text = result.content.find((b) => b.type === "text")?.text ?? "";
  return res.status(200).json({ text });
}
