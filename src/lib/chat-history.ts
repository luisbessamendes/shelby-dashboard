import type { ChatInputMessage } from './bi-contract';

// Preserve recent complete turns within the route's byte budget; old answers are context, not evidence.
export function chatHistory(messages: ChatInputMessage[]): ChatInputMessage[] {
  const history: ChatInputMessage[] = [];
  let bytes = 0;
  for (const message of messages.slice(-21).reverse()) {
    const item = { role: message.role, content: message.content.length > 8000
      ? `${message.content.slice(0, 7900)}\n[Earlier answer shortened; retrieve fresh evidence.]` : message.content,
    scope: message.scope };
    const size = new TextEncoder().encode(JSON.stringify(item)).length;
    if (history.length && bytes + size > 45000) break;
    bytes += size;
    history.unshift(item);
  }
  if (history[0]?.role === 'assistant') history.shift();
  return history;
}
