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
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map(message => (
        <div
          key={message.id}
          className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
        >
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
            ${message.role === 'user' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'}
          `}>
            {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
          </div>
          
          <div className={`max-w-[80%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`
              px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap
              ${message.role === 'user' 
                ? 'bg-primary text-white rounded-tr-none' 
                : 'bg-gray-100 text-gray-800 rounded-tl-none'
              }
            `}>
              {message.content}
            </div>
            <span className="text-xs text-gray-400 mt-1">{formatTime(message.timestamp)}</span>
          </div>
        </div>
      ))}
      
      {isLoading && (
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <Bot size={16} className="text-gray-600" />
          </div>
          <div className="bg-gray-100 px-4 py-2 rounded-2xl rounded-tl-none flex items-center gap-2">
            <Loader2 size={16} className="animate-spin text-gray-400" />
            <span className="text-sm text-gray-500">AI 正在分析...</span>
          </div>
        </div>
      )}
    </div>
  );
};
