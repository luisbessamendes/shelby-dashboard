'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useFilters } from '@/contexts/FilterContext';
import { useReportScope } from '@/contexts/ReportContext';
import type { EvidenceSource } from '@/lib/chat-runtime';
import { chatHistory } from '@/lib/chat-history';

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  scope?: string;
  sources?: EvidenceSource[];
}

export function useChat() {
  const { filters } = useFilters();
  const report = useReportScope();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const busy = useRef(false);
  useEffect(() => () => { requestId.current++; abortRef.current?.abort(); }, []);
  const scope = JSON.stringify({ report, period: `${filters.periodBasis} ${filters.year ?? 'All'}/${filters.month ?? 'All'}`,
    selections: Object.fromEntries(['stores', 'concepts', 'regions', 'locations', 'legalEntities', 'storeTypes'].map(key => {
      const values = filters[key as 'stores'];
      return [key, { count: values.length, sample: values.slice(0, 2).map(v => v.slice(0, 100)) }];
    })) });

  const perform = useCallback(async (history: ChatMsg[], text: string) => {
    if (!text.trim() || busy.current) return;
    busy.current = true;
    const id = ++requestId.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const userMsg: ChatMsg = { id: `u-${id}-${Date.now()}`, role: 'user', content: text.trim(), scope };
    const next = [...history, userMsg];
    setMessages(next); setError(null); setIsLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ messages: chatHistory(next), filters, report }),
      });
      const data = await res.json();
      if (id !== requestId.current) return;
      if (!res.ok) { setError(data.error || 'The analysis could not be completed.'); return; }
      setMessages(prev => [...prev, { id: `a-${id}-${Date.now()}`, role: 'assistant', content: data.reply, sources: data.sources, scope }]);
    } catch (err) {
      if (id === requestId.current && !(err instanceof Error && err.name === 'AbortError')) setError('Could not reach the AI analyst. Please retry.');
    } finally {
      if (id === requestId.current) { busy.current = false; setIsLoading(false); abortRef.current = null; }
    }
  }, [filters, report, scope]);

  const sendMessage = useCallback((text: string) => perform(messages, text), [messages, perform]);
  const newChat = useCallback(() => {
    requestId.current++; abortRef.current?.abort(); abortRef.current = null; busy.current = false;
    setMessages([]); setError(null); setIsLoading(false);
  }, []);
  const retry = useCallback(() => {
    const index = messages.findLastIndex(m => m.role === 'user');
    if (index >= 0) void perform(messages.slice(0, index), messages[index].content);
  }, [messages, perform]);
  return { messages, isLoading, error, sendMessage, newChat, retry, report };
}
