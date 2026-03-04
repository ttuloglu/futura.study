import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, Plus, Send, Share2, User } from 'lucide-react';
import { ChatMessage } from '../types';
import { chatWithAI } from '../ai';

interface AIChatViewProps {
  onBack: () => void;
  context?: string;
}

type DownloadFormat = 'txt' | 'md';

const THINKING_LABEL = 'Düşünüyor';

function AssistantAvatar() {
  return (
    <div className="chat-avatar">
      <span className="chat-avatar-aura" />
      <span className="chat-avatar-ring" />
      <img src="/favicon-red.svg" alt="Asistan" className="chat-avatar-icon" />
    </div>
  );
}

function formatMessageTime(value: Date): string {
  return value.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function buildDownloadName(content: string, format: DownloadFormat): string {
  const base = content
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşü\s-]/gi, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join('-')
    .replace(/-+/g, '-')
    .slice(0, 42);

  const prefix = base || `chat-${Date.now()}`;
  return `${prefix}.${format}`;
}

export default function AIChatView({ onBack: _onBack, context: _context }: AIChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Merhaba. İstediğin konuda konuşabiliriz.',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [openDownloadMenuFor, setOpenDownloadMenuFor] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = '0px';
    const nextHeight = Math.min(120, Math.max(36, textarea.scrollHeight));
    textarea.style.height = `${nextHeight}px`;
  }, [inputText]);

  useEffect(() => {
    if (!openDownloadMenuFor) return;

    const handleOutside = (event: MouseEvent) => {
      if (!downloadMenuRef.current) return;
      if (!downloadMenuRef.current.contains(event.target as Node)) {
        setOpenDownloadMenuFor(null);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [openDownloadMenuFor]);

  const getChatErrorMessage = (error: unknown): string => {
    const rawMessage = (error as { message?: string } | null)?.message;
    if (!rawMessage || typeof rawMessage !== 'string') {
      return 'Bağlantı hatası.';
    }

    const sanitized = rawMessage
      .replace(/^Firebase:\s*/i, '')
      .replace(/\s*\(functions\/[a-z-]+\)\.?$/i, '')
      .trim();

    return sanitized || 'Bağlantı hatası.';
  };

  const handleCopyMessage = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => {
        setCopiedMessageId((prev) => (prev === message.id ? null : prev));
      }, 1600);
    } catch (error) {
      console.error('Chat copy failed:', error);
    }
  };

  const handleDownloadMessage = (message: ChatMessage, format: DownloadFormat) => {
    const fileName = buildDownloadName(message.content, format);
    const blob = new Blob([message.content], {
      type: format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setOpenDownloadMenuFor(null);
  };

  const handleShareMessage = async (message: ChatMessage) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Fortale Chat', text: message.content });
        return;
      }

      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => {
        setCopiedMessageId((prev) => (prev === message.id ? null : prev));
      }, 1600);
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'AbortError') return;
      console.error('Chat share failed:', error);
    }
  };

  const handleSend = async () => {
    const normalizedInput = inputText.trim();
    if (!normalizedInput || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: normalizedInput,
      timestamp: new Date()
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInputText('');
    setIsTyping(true);

    try {
      const responseText = await chatWithAI(nextHistory, userMsg.content);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getChatErrorMessage(error),
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="chat-shell flex flex-col h-full bg-transparent">
      <div className="flex-1 overflow-y-auto px-3 pt-[99px] pb-48 hide-scrollbar">
        <div className="mx-auto w-full max-w-[560px] space-y-6 chat-messages-wrapper">
          {messages.map((msg) => {
            const isAssistant = msg.role === 'assistant';
            const isCopied = copiedMessageId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[95%] ${isAssistant ? '' : 'ml-auto flex-row-reverse'}`}
              >
                {isAssistant ? (
                  <AssistantAvatar />
                ) : (
                  <div className="w-8 h-8 flex items-center justify-center shrink-0 rounded-xl glass-panel bg-white/5 text-zinc-300">
                    <User size={14} />
                  </div>
                )}

                <div className={`space-y-1.5 ${isAssistant ? '' : 'items-end flex flex-col'}`}>
                  <span className="text-[10px] font-medium text-zinc-500 px-1 inline-flex items-center gap-1">
                    <span>{isAssistant ? 'Asistan' : 'Sen'}</span>
                    <span>•</span>
                    <span>{formatMessageTime(msg.timestamp)}</span>
                  </span>

                  <div
                    className={`chat-bubble px-3 py-2 rounded-2xl text-[13px] leading-relaxed tracking-tight ${
                      isAssistant
                        ? 'bg-[#10141d]/88 border border-white/10 text-zinc-100'
                        : 'bg-white/[0.08] border border-white/15 text-white'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {isAssistant ? (
                    <div className="flex items-center gap-1 px-1 text-zinc-400">
                      <button
                        type="button"
                        onClick={() => void handleCopyMessage(msg)}
                        className={`h-6 w-6 rounded-md flex items-center justify-center transition-colors ${
                          isCopied ? 'text-accent-green' : 'hover:text-white'
                        }`}
                        title="Kopyala"
                      >
                        {isCopied ? <Check size={12} /> : <Copy size={12} />}
                      </button>

                      <div ref={openDownloadMenuFor === msg.id ? downloadMenuRef : null} className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenDownloadMenuFor((prev) => (prev === msg.id ? null : msg.id))
                          }
                          className="h-6 w-6 rounded-md flex items-center justify-center transition-colors hover:text-white"
                          title="İndir"
                        >
                          <Download size={12} />
                        </button>

                        {openDownloadMenuFor === msg.id && (
                          <div className="absolute top-7 left-0 z-20 min-w-[132px] rounded-lg border border-white/10 bg-[#0f141d] p-1.5 shadow-lg">
                            <button
                              type="button"
                              onClick={() => handleDownloadMessage(msg, 'txt')}
                              className="w-full rounded-md px-2 py-1.5 text-left text-[11px] text-zinc-300 hover:bg-white/5 hover:text-white"
                            >
                              Metin indir
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadMessage(msg, 'md')}
                              className="w-full rounded-md px-2 py-1.5 text-left text-[11px] text-zinc-300 hover:bg-white/5 hover:text-white"
                            >
                              Markdown indir
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleShareMessage(msg)}
                        className="h-6 w-6 rounded-md flex items-center justify-center transition-colors hover:text-white"
                        title="Paylaş"
                      >
                        <Share2 size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-1 text-zinc-400">
                      <button
                        type="button"
                        onClick={() => void handleCopyMessage(msg)}
                        className={`h-6 w-6 rounded-md flex items-center justify-center transition-colors ${
                          isCopied ? 'text-accent-green' : 'hover:text-white'
                        }`}
                        title="Kopyala"
                      >
                        {isCopied ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex gap-3 max-w-[95%]">
              <AssistantAvatar />
              <div className="chat-thinking-surface rounded-2xl border border-white/10 bg-[#0f141d]/92 px-3 py-2 min-w-[200px]">
                <div className="flex items-center gap-2 h-6">
                  <span className="text-[12px] text-zinc-100">{THINKING_LABEL}</span>
                  <span className="flex items-center gap-1 ml-1">
                    <span className="w-1 h-1 bg-zinc-300 rounded-full animate-bounce" />
                    <span
                      className="w-1 h-1 bg-zinc-300 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    />
                    <span
                      className="w-1 h-1 bg-zinc-300 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    />
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="absolute bottom-[90px] left-0 w-full px-3 z-20">
        <div className="mx-auto w-full max-w-[560px] float-lusion p-2 rounded-2xl shadow-2xl space-y-2 border border-white/10">
          <div className="flex items-end gap-2 px-1">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Mesajını yaz..."
              rows={1}
              className="chat-input flex-1 bg-transparent border-none text-white text-sm py-2 px-1 focus:outline-none placeholder:text-text-secondary/50 font-medium resize-none max-h-[120px]"
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => textareaRef.current?.focus()}
              className="w-9 h-9 glass-icon shrink-0"
            >
              <Plus size={16} className="text-text-secondary" />
            </button>
            <button
              onClick={() => void handleSend()}
              disabled={!inputText.trim() || isTyping}
              className={`h-9 w-9 shrink-0 flex items-center justify-center transition-all duration-500 rounded-xl ${
                inputText.trim() && !isTyping
                  ? 'btn-glass-primary shadow-lg scale-105 active:scale-95'
                  : 'btn-glass opacity-20 border-none shadow-none'
              }`}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
