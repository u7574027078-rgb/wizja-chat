import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/start";
import { useState, useRef, useEffect } from "react";

// ─── Server function: calls Claude API securely ───────────────────────────────
const askClaude = createServerFn({ method: "POST" })
  .validator(
    (data: { messages: Array<{ role: string; content: string }> }) => data
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        error:
          "Brak klucza API. Dodaj zmienną środowiskową ANTHROPIC_API_KEY w ustawieniach Vercel.",
      };
    }
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
        messages: data.messages,
      }),
    });
    if (!response.ok) {
      return { error: `Błąd API: ${response.status} – ${response.statusText}` };
    }
    const result = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const text = result.content.find((b) => b.type === "text")?.text ?? "";
    return { text };
  });

// ─── Route ────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/")(
  { component: ChatPage }
);

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  "Jak mogę poprawić swoje samopoczucie?",
  "Wyjaśnij mi coś trudnego prostymi słowami",
  "Pomóż mi zaplanować dzień",
  "Co wiesz o zdrowym stylu życia?",
];

function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setError(null);
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    try {
      const history = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const result = await askClaude({ data: { messages: history } });
      if ("error" in result) {
        setError(result.error);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: result.text,
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setError("Wystąpił nieoczekiwany błąd. Spróbuj ponownie.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  return (
    <>
      <Styles />
      <div className="chat-root">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />

        <header className="chat-header">
          <div className="header-inner">
            <div className="logo-group">
              <div className="logo-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M8 12h.01M12 12h.01M16 12h.01" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h1 className="logo-title">Wizja AI</h1>
                <p className="logo-subtitle">Twój osobisty asystent</p>
              </div>
            </div>
            {messages.length > 0 && (
              <button className="clear-btn" onClick={() => setMessages([])}>
                + Nowa rozmowa
              </button>
            )}
          </div>
        </header>

        <main className="chat-main">
          {messages.length === 0 ? (
            <Welcome onSuggestion={sendMessage} />
          ) : (
            <div className="messages-list">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {loading && <TypingIndicator />}
              {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
              <div ref={bottomRef} />
            </div>
          )}
        </main>

        <footer className="input-bar">
          <div className="input-inner">
            <div className="input-wrapper">
              <textarea
                ref={inputRef}
                className="chat-input"
                placeholder="Napisz wiadomość… (Enter aby wysłać)"
                value={input}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={loading}
              />
              <button
                className={`send-btn ${loading || !input.trim() ? "send-btn-disabled" : "send-btn-active"}`}
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
              >
                {loading ? (
                  <span className="send-spinner" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>
            <p className="input-hint">Shift+Enter dla nowej linii · Enter aby wysłać</p>
          </div>
        </footer>
      </div>
    </>
  );
}

function Welcome({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  return (
    <div className="welcome">
      <div className="welcome-avatar">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <path d="M8 12h.01M12 12h.01M16 12h.01" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
      <h2 className="welcome-title">Cześć! Jestem Wizja 👋</h2>
      <p className="welcome-desc">
        Twój asystent AI gotowy do pomocy. Możesz zapytać mnie o wszystko —
        wyjaśnienia, pomysły, planowanie, a nawet zwykłą rozmowę.
      </p>
      <div className="suggestions-grid">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="suggestion-chip" onClick={() => onSuggestion(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`msg-row ${isUser ? "msg-row-user" : "msg-row-ai"}`}>
      {!isUser && (
        <div className="ai-avatar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M8 12h.01M12 12h.01M16 12h.01" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
      )}
      <div className={`msg-bubble ${isUser ? "msg-user" : "msg-ai"}`}>
        <p className="msg-text">{message.content}</p>
        <span className="msg-time">
          {message.timestamp.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="msg-row msg-row-ai">
      <div className="ai-avatar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M8 12h.01M12 12h.01M16 12h.01" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="msg-bubble msg-ai typing-bubble">
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="error-banner">
      <span>⚠ {message}</span>
      <button onClick={onDismiss} className="error-dismiss">✕</button>
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      .chat-root{font-family:'DM Sans',sans-serif;min-height:100dvh;display:flex;flex-direction:column;background:#f0f4ff;position:relative;overflow:hidden}
      .bg-orb{position:fixed;border-radius:50%;filter:blur(90px);opacity:.3;pointer-events:none;z-index:0}
      .bg-orb-1{width:520px;height:520px;background:radial-gradient(circle,#a5b4fc,#818cf8);top:-150px;right:-120px}
      .bg-orb-2{width:420px;height:420px;background:radial-gradient(circle,#6ee7b7,#34d399);bottom:40px;left:-100px}
      .chat-header{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.82);backdrop-filter:blur(20px);border-bottom:1px solid rgba(148,163,184,.15)}
      .header-inner{max-width:720px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;justify-content:space-between}
      .logo-group{display:flex;align-items:center;gap:12px}
      .logo-icon{width:44px;height:44px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(99,102,241,.4)}
      .logo-title{font-family:'Sora',sans-serif;font-size:17px;font-weight:600;color:#1e1b4b;letter-spacing:-.3px}
      .logo-subtitle{font-size:12px;color:#64748b}
      .clear-btn{padding:7px 16px;border-radius:20px;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);color:#6366f1;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;font-family:inherit}
      .clear-btn:hover{background:rgba(99,102,241,.16)}
      .chat-main{flex:1;overflow-y:auto;position:relative;z-index:1;padding:24px 20px 8px}
      .messages-list{max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
      .welcome{max-width:520px;margin:44px auto 0;text-align:center;animation:fadeUp .5s ease both}
      .welcome-avatar{width:76px;height:76px;margin:0 auto 22px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 28px rgba(99,102,241,.45)}
      .welcome-title{font-family:'Sora',sans-serif;font-size:27px;font-weight:600;color:#1e1b4b;margin-bottom:12px}
      .welcome-desc{font-size:15px;color:#64748b;line-height:1.65;margin-bottom:32px}
      .suggestions-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .suggestion-chip{padding:13px 16px;border-radius:14px;background:white;border:1px solid rgba(148,163,184,.22);font-size:13.5px;font-weight:500;color:#374151;cursor:pointer;text-align:left;transition:all .2s;line-height:1.4;font-family:inherit;box-shadow:0 2px 8px rgba(0,0,0,.06)}
      .suggestion-chip:hover{border-color:#6366f1;color:#6366f1;transform:translateY(-2px);box-shadow:0 6px 18px rgba(99,102,241,.18)}
      .msg-row{display:flex;align-items:flex-end;gap:10px;animation:fadeUp .3s ease both}
      .msg-row-user{flex-direction:row-reverse}
      .ai-avatar{width:32px;height:32px;flex-shrink:0;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(99,102,241,.3)}
      .msg-bubble{max-width:75%;padding:12px 16px;border-radius:18px}
      .msg-user{background:linear-gradient(135deg,#6366f1,#7c3aed);border-radius:18px 18px 4px 18px;box-shadow:0 4px 14px rgba(99,102,241,.3)}
      .msg-ai{background:white;border-radius:18px 18px 18px 4px;box-shadow:0 2px 10px rgba(0,0,0,.07);border:1px solid rgba(148,163,184,.12)}
      .msg-text{font-size:14.5px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
      .msg-user .msg-text{color:white}
      .msg-ai .msg-text{color:#1e293b}
      .msg-time{display:block;font-size:10.5px;margin-top:6px;opacity:.5}
      .msg-user .msg-time{color:white;text-align:right}
      .msg-ai .msg-time{color:#94a3b8}
      .typing-bubble{display:flex;align-items:center;gap:5px;padding:16px 18px}
      .dot{width:7px;height:7px;border-radius:50%;background:#a5b4fc;animation:bounce 1.2s infinite ease-in-out}
      .dot:nth-child(2){animation-delay:.2s}
      .dot:nth-child(3){animation-delay:.4s}
      .error-banner{display:flex;align-items:center;gap:10px;max-width:720px;margin:0 auto;padding:12px 16px;border-radius:12px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:13.5px}
      .error-dismiss{margin-left:auto;background:none;border:none;color:#b91c1c;cursor:pointer;font-size:14px;opacity:.7}
      .error-dismiss:hover{opacity:1}
      .input-bar{position:sticky;bottom:0;z-index:10;background:rgba(240,244,255,.88);backdrop-filter:blur(20px);border-top:1px solid rgba(148,163,184,.12);padding:14px 20px 20px}
      .input-inner{max-width:720px;margin:0 auto}
      .input-wrapper{display:flex;align-items:flex-end;gap:10px;background:white;border-radius:20px;padding:8px 8px 8px 18px;border:1.5px solid rgba(148,163,184,.2);box-shadow:0 4px 20px rgba(0,0,0,.08);transition:border-color .2s,box-shadow .2s}
      .input-wrapper:focus-within{border-color:#6366f1;box-shadow:0 4px 20px rgba(99,102,241,.15)}
      .chat-input{flex:1;border:none;outline:none;resize:none;font-size:14.5px;font-family:inherit;background:transparent;color:#1e293b;line-height:1.55;min-height:24px;max-height:160px;padding:4px 0}
      .chat-input::placeholder{color:#94a3b8}
      .chat-input:disabled{opacity:.6}
      .send-btn{width:42px;height:42px;border-radius:14px;border:none;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .2s}
      .send-btn-active{background:linear-gradient(135deg,#6366f1,#7c3aed);color:white;box-shadow:0 4px 12px rgba(99,102,241,.4)}
      .send-btn-active:hover{transform:scale(1.07)}
      .send-btn-disabled{background:#f1f5f9;color:#cbd5e1;cursor:not-allowed}
      .send-spinner{width:18px;height:18px;border:2px solid rgba(255,255,255,.3);border-top-color:white;border-radius:50%;animation:spin .7s linear infinite;display:block}
      .input-hint{font-size:11px;color:#94a3b8;text-align:center;margin-top:8px}
      @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-7px)}}
      @keyframes spin{to{transform:rotate(360deg)}}
      @media(max-width:500px){.suggestions-grid{grid-template-columns:1fr}.msg-bubble{max-width:90%}.welcome-title{font-size:22px}}
    `}</style>
  );
}
