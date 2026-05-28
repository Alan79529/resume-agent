import React, { useRef, useEffect } from 'react';
import { User, Bot, Loader2 } from 'lucide-react';
import { useChatStore } from '../../stores/chat';

export const MessageList: React.FC = () => {
  const { messages, isLoading } = useChatStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/70 px-5 py-4 space-y-4">
      {messages.map(message => (
        <div
          key={message.id}
          className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
        >
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm
            ${message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}
          `}>
            {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
          </div>
          
          <div className={`flex min-w-0 max-w-[82%] flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`
              max-w-full px-4 py-2.5 rounded-lg text-sm leading-6 whitespace-pre-wrap break-words [overflow-wrap:anywhere] shadow-sm
              ${message.role === 'user' 
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-800 border border-slate-200'
              }
            `}>
              {message.content}
            </div>
            <span className="text-xs text-slate-400 mt-1">{formatTime(message.timestamp)}</span>
          </div>
        </div>
      ))}
      
      {isLoading && (
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <Bot size={16} className="text-slate-600" />
          </div>
          <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm">
            <Loader2 size={16} className="animate-spin text-blue-500" />
            <span className="text-sm text-slate-500">AI 正在分析...</span>
          </div>
        </div>
      )}
    </div>
  );
};
