'use client';

import React, { useRef, useEffect, useState } from 'react';
import ChatMessage from './ChatMessage';
import { useChat } from './useChat';

const STARTER_PROMPTS = [
  'What was the most profitable concept in the last month?',
  'Which stores are EBITDA-negative?',
  'Which concept had the best EBITDA margin in LTM?',
  'What are the biggest negative variances this month?',
  'Summarize performance by region.',
];

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
}

export default function ChatPanel({ isOpen, onClose, onMinimize }: ChatPanelProps) {
  const { messages, isLoading, error, sendMessage, newChat, retry } = useChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStarterClick = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleNewChat = () => {
    newChat();
    setInput('');
  };

  const showStarters = messages.length === 0 && !isLoading;

  return (
    <div className={`chat-panel ${isOpen ? 'chat-panel-open' : ''}`}>
      {/* Header */}
      <div className="chat-panel-header">
        <div className="chat-panel-header-left">
          <span className="chat-panel-icon">🤖</span>
          <div>
            <div className="chat-panel-title">Shelby AI Analyst</div>
            <div className="chat-panel-subtitle">Portfolio analytics copilot</div>
          </div>
        </div>
        <div className="chat-panel-header-actions">
          <button
            className="chat-header-btn"
            onClick={handleNewChat}
            title="New chat"
            aria-label="New chat"
          >
            ✨
          </button>
          <button
            className="chat-header-btn"
            onClick={onMinimize}
            title="Minimize"
            aria-label="Minimize chat"
          >
            ─
          </button>
          <button
            className="chat-header-btn"
            onClick={onClose}
            title="Close"
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Helper text */}
      <div className="chat-helper-text">
        Ask about portfolio, concepts, stores, regions, trends, margins, EBITDA, FCFF, rankings, and variances. Answers use your current dashboard filters.
      </div>

      {/* Messages */}
      <div className="chat-messages" ref={scrollRef}>
        {showStarters && (
          <div className="chat-starters">
            <p className="chat-starters-label">Try asking:</p>
            {STARTER_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                className="chat-starter-chip"
                onClick={() => handleStarterClick(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {messages.map(msg => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}

        {isLoading && (
          <div className="chat-message chat-message-assistant">
            <div className="chat-avatar">🤖</div>
            <div className="chat-bubble chat-bubble-assistant chat-typing">
              <span className="chat-typing-dot" />
              <span className="chat-typing-dot" />
              <span className="chat-typing-dot" />
            </div>
          </div>
        )}

        {error && (
          <div className="chat-error">
            <span>{error}</span>
            <button className="chat-error-retry" onClick={retry}>
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <input
          ref={inputRef}
          className="chat-input"
          type="text"
          placeholder="Ask about your portfolio..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
