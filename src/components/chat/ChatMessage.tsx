'use client';

import React from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

/** Simple markdown-like rendering for AI messages */
function renderContent(text: string): React.ReactNode {
  // Split into lines and process
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="chat-msg-list">
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      flushList();
      return;
    }

    // Bullet list item
    if (/^[-•]\s/.test(trimmed)) {
      listItems.push(
        <li key={idx}>{renderInline(trimmed.replace(/^[-•]\s/, ''))}</li>
      );
      return;
    }

    // Numbered list item
    if (/^\d+\.\s/.test(trimmed)) {
      listItems.push(
        <li key={idx}>{renderInline(trimmed.replace(/^\d+\.\s/, ''))}</li>
      );
      return;
    }

    flushList();

    // Heading (## or **Title**)
    if (/^#{1,3}\s/.test(trimmed)) {
      elements.push(
        <p key={idx} className="chat-msg-heading">
          {renderInline(trimmed.replace(/^#{1,3}\s/, ''))}
        </p>
      );
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={idx} className="chat-msg-paragraph">
        {renderInline(trimmed)}
      </p>
    );
  });

  flushList();
  return elements;
}

/** Inline formatting: **bold** */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
  return (
    <div className={`chat-message chat-message-${role}`}>
      {role === 'assistant' && <div className="chat-avatar">🤖</div>}
      <div className={`chat-bubble chat-bubble-${role}`}>
        {role === 'assistant' ? renderContent(content) : <p>{content}</p>}
      </div>
      {role === 'user' && <div className="chat-avatar chat-avatar-user">👤</div>}
    </div>
  );
}
