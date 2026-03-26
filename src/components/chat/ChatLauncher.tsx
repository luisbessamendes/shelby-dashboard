'use client';

import React, { useState, useCallback } from 'react';
import ChatPanel from './ChatPanel';
import '../../app/chat.css';

type ChatState = 'closed' | 'open' | 'minimized';

export default function ChatLauncher() {
  const [state, setState] = useState<ChatState>('closed');

  const handleOpen = useCallback(() => setState('open'), []);
  const handleClose = useCallback(() => setState('closed'), []);
  const handleMinimize = useCallback(() => setState('minimized'), []);
  const handleRestore = useCallback(() => setState('open'), []);

  const showPanel = state === 'open';
  const showLauncher = state !== 'open';
  const isMinimized = state === 'minimized';

  return (
    <>
      {/* Floating launcher button — visible when closed or minimized */}
      <button
        className={`chat-launcher ${showLauncher ? '' : 'chat-launcher-hidden'}`}
        onClick={isMinimized ? handleRestore : handleOpen}
        aria-label={isMinimized ? 'Restore AI Analyst Chat' : 'Open AI Analyst Chat'}
        title="Shelby AI Analyst"
      >
        <span className="chat-launcher-icon">🤖</span>
        {isMinimized && <span className="chat-launcher-badge">Chat</span>}
        {state === 'closed' && <span className="chat-launcher-pulse" />}
      </button>

      {/* Chat panel — only rendered when open */}
      {showPanel && (
        <ChatPanel
          isOpen={true}
          onClose={handleClose}
          onMinimize={handleMinimize}
        />
      )}
    </>
  );
}
