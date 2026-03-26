'use client';

import { useState, useCallback, useRef } from 'react';
import { useFilters } from '@/contexts/FilterContext';

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatMeta {
  latencyMs: number;
  tokens: number;
  scope: string;
}

export function useChat() {
  const { filters } = useFilters();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<ChatMeta | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      abortRef.current = new AbortController();

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          filters,
        }),
        signal: abortRef.current.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'An unexpected error occurred. Please retry.');
        return;
      }

      const assistantMsg: ChatMsg = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
      };
      setMessages(prev => [...prev, assistantMsg]);
      setLastMeta(data.meta ?? null);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('Failed to connect to the AI analyst. Please check your connection and retry.');
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [messages, filters, isLoading]);

  const newChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setError(null);
    setLastMeta(null);
    setIsLoading(false);
  }, []);

  const retry = useCallback(() => {
    if (messages.length === 0) return;
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;
    // Remove last user message to re-send
    setMessages(prev => prev.filter(m => m.id !== lastUserMsg.id));
    // Use setTimeout to allow state to settle
    setTimeout(() => {
      sendMessage(lastUserMsg.content);
    }, 50);
  }, [messages, sendMessage]);

  return {
    messages,
    isLoading,
    error,
    lastMeta,
    sendMessage,
    newChat,
    retry,
  };
}
