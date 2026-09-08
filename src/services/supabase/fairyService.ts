import {
  boundFairyConversation,
  FAIRY_ANSWER_MAX_LENGTH,
  FAIRY_MESSAGE_MAX_LENGTH,
  type FairyMessage,
} from "../../modules/fairy/fairyConversation";
import { supabase } from "./client";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_REQUEST: "Sorunuzu kontrol edip tekrar deneyin.",
  REQUEST_TOO_LARGE: "Mesajınız çok uzun. Lütfen kısaltıp tekrar deneyin.",
  UNAUTHENTICATED: "Oturumunuz doğrulanamadı. Lütfen yeniden giriş yapın.",
  ACCESS_DENIED: "Bu hesap Fairy için VIAWA erişimine sahip değil.",
  AUTH_UNAVAILABLE: "Erişim kontrolü şu anda tamamlanamıyor. Lütfen tekrar deneyin.",
  FAIRY_NOT_CONFIGURED: "Fairy henüz kullanıma hazır değil.",
  CONTEXT_UNAVAILABLE: "VIAWA kayıtları şu anda okunamıyor. Lütfen tekrar deneyin.",
  AI_RATE_LIMITED: "Fairy şu anda yoğun. Lütfen biraz sonra tekrar deneyin.",
  AI_UNAVAILABLE: "Fairy şu anda yanıt veremiyor. Lütfen tekrar deneyin.",
  AI_TIMEOUT: "Yanıt hazırlanması beklenenden uzun sürdü. Lütfen tekrar deneyin.",
  AI_INCOMPLETE: "Fairy yanıtı tamamlayamadı. Lütfen tekrar deneyin.",
  INTERNAL_ERROR: "Fairy yanıtı alınamadı. Lütfen tekrar deneyin.",
};

export class FairyServiceError extends Error {
  constructor(code: string) {
    super(Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, code) ? ERROR_MESSAGES[code] : ERROR_MESSAGES.INTERNAL_ERROR);
    this.name = "FairyServiceError";
  }
}

function readErrorCode(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("code" in value)) return null;
  return typeof value.code === "string" ? value.code : null;
}

async function describeInvocationError(error: unknown): Promise<FairyServiceError> {
  // Only fixed local messages reach the UI, including for gateway/non-JSON errors.
  if (error && typeof error === "object" && "context" in error && error.context instanceof Response) {
    const response = error.context;
    try {
      const code = readErrorCode(await response.clone().json());
      if (code) return new FairyServiceError(code);
    } catch { /* The Supabase gateway may return a non-JSON error. */ }

    if (response.status === 401) return new FairyServiceError("UNAUTHENTICATED");
    if (response.status === 403) return new FairyServiceError("ACCESS_DENIED");
    if (response.status === 429) return new FairyServiceError("AI_RATE_LIMITED");
    if (response.status === 504) return new FairyServiceError("AI_TIMEOUT");
  }
  return new FairyServiceError("INTERNAL_ERROR");
}

export async function askFairy(
  input: { message: string; conversation?: readonly FairyMessage[] },
  options: { userId: string; signal?: AbortSignal },
): Promise<string> {
  const message = input.message.trim();
  if (!message || input.message.length > FAIRY_MESSAGE_MAX_LENGTH) {
    throw new FairyServiceError("INVALID_REQUEST");
  }

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (sessionError || !session?.access_token || session.user.id !== options.userId) {
      throw new FairyServiceError("UNAUTHENTICATED");
    }
    options.signal?.throwIfAborted();

    const { data, error } = await supabase.functions.invoke<unknown>("fairy", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { message, conversation: boundFairyConversation(input.conversation ?? []) },
      signal: options.signal,
      timeout: 65_000,
    });

    if (error) throw await describeInvocationError(error);
    const errorCode = readErrorCode(data);
    if (errorCode) throw new FairyServiceError(errorCode);
    if (!data || typeof data !== "object" || !("answer" in data) ||
      typeof data.answer !== "string" || !data.answer.trim() || data.answer.length > FAIRY_ANSWER_MAX_LENGTH) {
      throw new FairyServiceError("AI_INCOMPLETE");
    }
    return data.answer.trim();
  } catch (error) {
    if (error instanceof FairyServiceError) throw error;
    throw new FairyServiceError("INTERNAL_ERROR");
  }
}
