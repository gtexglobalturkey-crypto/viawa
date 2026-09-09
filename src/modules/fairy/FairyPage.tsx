import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { useAuth } from "../../features/auth/AuthContext";
import { askFairy, FairyServiceError } from "../../services/supabase/fairyService";
import { FAIRY_HISTORY_MAX_MESSAGES, FAIRY_MESSAGE_MAX_LENGTH, type FairyMessage } from "./fairyConversation";
import { FairyMessageContent } from "./FairyMessageContent";
import "./fairy.css";

function FairyConversation({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<FairyMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const conversationArea = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => { request.current?.abort(); }, []);

  useEffect(() => {
    const area = conversationArea.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [messages, pendingMessage]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (request.current || !message) return;

    const controller = new AbortController();
    request.current = controller;
    setError(null);
    setPendingMessage(message);

    try {
      const answer = await askFairy({ message, conversation: messages }, { userId, signal: controller.signal });
      if (controller.signal.aborted) return;
      setMessages((current) => [
        ...current,
        { role: "user" as const, content: message },
        { role: "assistant" as const, content: answer },
      ].slice(-FAIRY_HISTORY_MAX_MESSAGES));
      setDraft("");
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason instanceof FairyServiceError ? reason.message : "Fairy yanıtı alınamadı. Lütfen tekrar deneyin.");
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setPendingMessage(null);
      }
    }
  }

  const pending = pendingMessage !== null;

  return (
    <main className="page fairy-page">
      <header className="page-header fairy-heading">
        <h1>Fairy</h1>
        <p>VIAWA Çalışma Asistanı</p>
      </header>

      <div className="fairy-conversation" ref={conversationArea} role="log" aria-label="Fairy ile sohbet" aria-live="polite" aria-relevant="additions text">
        <p className="fairy-intro">
          Güncel VIAWA kayıtlarındaki firma, fuar, fırsat ve iletişim bilgilerini birlikte değerlendirerek sorularınızı yanıtlayabilirim.
          Bilgilerin yetersiz olduğu noktaları belirtirim. Bu sürümde yalnızca okurum; kayıt değiştirmem veya e-posta göndermem.
        </p>
        {messages.map((message, index) => (
          <article className={`fairy-message fairy-message-${message.role}`} key={`${index}-${message.role}`}>
            <p className="fairy-message-label">{message.role === "user" ? "Siz" : "Fairy"}</p>
            {message.role === "assistant"
              ? <FairyMessageContent content={message.content} />
              : <p className="fairy-message-content">{message.content}</p>}
          </article>
        ))}
        {pendingMessage !== null && (
          <article className="fairy-message fairy-message-user">
            <p className="fairy-message-label">Siz</p>
            <p className="fairy-message-content">{pendingMessage}</p>
          </article>
        )}
        {pending && <p className="fairy-pending" role="status">VIAWA kayıtları değerlendiriliyor…</p>}
      </div>

      <form className="fairy-composer" onSubmit={(event) => void handleSend(event)} aria-busy={pending}>
        <label htmlFor="fairy-message">Sorunuz</label>
        <textarea
          id="fairy-message"
          name="message"
          rows={3}
          maxLength={FAIRY_MESSAGE_MAX_LENGTH}
          placeholder="Bugün neye odaklanmalıyım?"
          value={draft}
          disabled={pending}
          aria-describedby={error ? "fairy-message-help fairy-error" : "fairy-message-help"}
          onChange={(event) => { setDraft(event.target.value); setError(null); }}
        />
        {error && <p className="fairy-error" id="fairy-error" role="alert">{error}</p>}
        <div className="fairy-composer-actions">
          <p className="muted" id="fairy-message-help">{draft.length} / {FAIRY_MESSAGE_MAX_LENGTH} karakter</p>
          <Button type="submit" variant="primary" disabled={pending || !draft.trim()}>
            <Send size={14} aria-hidden="true" />
            {pending ? "Yanıt hazırlanıyor…" : "Gönder"}
          </Button>
        </div>
      </form>
    </main>
  );
}

export function FairyPage() {
  const { session } = useAuth();
  // A new account gets a fresh conversation; unmount aborts any previous request.
  return session ? <FairyConversation key={session.user.id} userId={session.user.id} /> : null;
}
