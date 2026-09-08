export type FairyMessage = {
  role: "user" | "assistant";
  content: string;
};

export const FAIRY_MESSAGE_MAX_LENGTH = 2_000;
export const FAIRY_ANSWER_MAX_LENGTH = 6_000;
export const FAIRY_HISTORY_MAX_MESSAGES = 8;
export const FAIRY_HISTORY_MAX_LENGTH = 16_000;

/** Keep complete recent turns; an unanswered/failed question is never context. */
export function boundFairyConversation(
  messages: readonly FairyMessage[],
): FairyMessage[] {
  const turns: FairyMessage[][] = [];
  for (let index = 0; index < messages.length - 1; index += 1) {
    const question = messages[index];
    const answer = messages[index + 1];
    if (question.role !== "user" || answer.role !== "assistant") continue;

    const userContent = question.content.trim().slice(0, FAIRY_MESSAGE_MAX_LENGTH);
    const assistantContent = answer.content.trim().slice(0, FAIRY_ANSWER_MAX_LENGTH);
    if (userContent && assistantContent) {
      turns.push([
        { role: "user", content: userContent },
        { role: "assistant", content: assistantContent },
      ]);
    }
    index += 1;
  }

  const recent: FairyMessage[] = [];
  let length = 0;
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    const turnLength = turn[0].content.length + turn[1].content.length;
    if (recent.length + 2 > FAIRY_HISTORY_MAX_MESSAGES || length + turnLength > FAIRY_HISTORY_MAX_LENGTH) break;
    recent.unshift(...turn);
    length += turnLength;
  }
  return recent;
}
