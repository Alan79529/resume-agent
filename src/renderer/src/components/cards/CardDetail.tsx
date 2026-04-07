import React from 'react';
import { Building2, FileText, MessageSquare, AlertTriangle, CheckSquare, Mic, FileEdit, BookOpen, Bell, ClipboardList } from 'lucide-react';
import { useCardsStore } from '../../stores/cards';
import type { CardStatus } from '../../types';

const statusOptions: { value: CardStatus; label: string }[] = [
  { value: 'pending_analysis', label: '待分析' },
  { value: 'preparing', label: '待准备' },
  { value: 'scheduled', label: '已安排面试' },
  { value: 'interviewed', label: '已面试' },
  { value: 'reviewed', label: '已复盘' }
];

export const CardDetail: React.FC = () => {
  const { selectedCardId, cards, updateCard } = useCardsStore();
  
  const card = cards.find(c => c.id === selectedCardId);
  
  if (!card) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p>选择左侧作战卡查看详情</p>
        </div>
      </div>
    );
  }

  const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2 text-gray-700">
        {icon}
        <h3 className="font-medium">{title}</h3>
      </div>
      <div className="pl-6">{children}</div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">{card.companyName}</h1>
        <p className="text-gray-600 mt-1">{card.positionName}</p>
        
        <div className="flex items-center gap-4 mt-4">
          <select
            value={card.status}
            onChange={(e) => updateCard(card.id, { status: e.target.value as CardStatus })}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          
          {card.schedule.interviewTime && (
            <span className="text-sm text-gray-500">
              面试: {new Date(card.schedule.interviewTime).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Analysis Sections */}
      {card.analysis.companySummary && (
        <Section title="公司业务" icon={<Building2 size={18} />}>
          <p className="text-sm text-gray-600">{card.analysis.companySummary}</p>
        </Section>
      )}

      {card.analysis.jdSummary && (
        <Section title="JD 摘要" icon={<FileText size={18} />}>
          <p className="text-sm text-gray-600">{card.analysis.jdSummary}</p>
        </Section>
      )}

      {card.analysis.commonQuestions.length > 0 && (
        <Section title="高频问题" icon={<MessageSquare size={18} />}>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
            {card.analysis.commonQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </Section>
      )}

      {card.analysis.warnings.length > 0 && (
        <Section title="注意事项" icon={<AlertTriangle size={18} />}>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            {card.analysis.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Section>
      )}

      {card.analysis.checklist.length > 0 && (
        <Section title="准备清单" icon={<CheckSquare size={18} />}>
          <ul className="space-y-2">
            {card.analysis.checklist.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <input type="checkbox" className="mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {card.analysis.selfIntroduction && (
        <Section title="自我介绍" icon={<Mic size={18} />}>
          <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
            {card.analysis.selfIntroduction}
          </div>
        </Section>
      )}

      {card.analysis.resumeSuggestions.length > 0 && (
        <Section title="简历建议" icon={<FileEdit size={18} />}>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            {card.analysis.resumeSuggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Section>
      )}

      {card.analysis.keyPoints.length > 0 && (
        <Section title="八股重点" icon={<BookOpen size={18} />}>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            {card.analysis.keyPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Review Section */}
      {card.status === 'interviewed' || card.status === 'reviewed' ? (
        <Section title="复盘笔记" icon={<ClipboardList size={18} />}>
          <textarea
            value={card.review.notes}
            onChange={(e) => updateCard(card.id, { review: { ...card.review, notes: e.target.value } })}
            placeholder="记录面试感受..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </Section>
      ) : null}
    </div>
  );
};
