import React from 'react';
import {
  ArrowLeft,
  Building2,
  FileText,
  MessageSquare,
  AlertTriangle,
  CheckSquare,
  Mic,
  FileEdit,
  BookOpen,
  ClipboardList,
  Target
} from 'lucide-react';
import { useCardsStore } from '../../stores/cards';
import { useChatStore } from '../../stores/chat';
import type { CardStatus } from '../../types';

const statusOptions: { value: CardStatus; label: string }[] = [
  { value: 'pending_analysis', label: '待分析' },
  { value: 'preparing', label: '准备中' },
  { value: 'scheduled', label: '已安排面试' },
  { value: 'interviewed', label: '已面试' },
  { value: 'reviewed', label: '已复盘' }
];

function getScoreColor(score: number): string {
  if (score < 40) return 'bg-red-100 text-red-700';
  if (score <= 70) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
}

export const CardDetail: React.FC = () => {
  const { selectedCardId, cards, updateCard, selectCard } = useCardsStore();
  const { enterMockMode } = useChatStore();

  const card = cards.find((item) => item.id === selectedCardId);
  if (!card) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p>请选择左侧作战卡查看详情</p>
        </div>
      </div>
    );
  }

  const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({
    title,
    icon,
    children
  }) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2 text-gray-700">
        {icon}
        <h3 className="font-medium">{title}</h3>
      </div>
      <div className="pl-6">{children}</div>
    </div>
  );

  const score = card.analysis.matchScore ?? null;
  const hasScore = typeof score === 'number' && score > 0;
  const missingSkills = card.analysis.missingSkills ?? [];
  const matchSuggestions = card.analysis.matchSuggestions ?? [];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 pb-4 border-b border-gray-200">
        <button
          onClick={() => selectCard(null)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <ArrowLeft size={16} />
          返回对话
        </button>
        <h1 className="text-xl font-bold text-gray-900">{card.companyName}</h1>
        {card.companyLocation ? <p className="text-sm text-gray-400 mt-1">{card.companyLocation}</p> : null}
        <p className="text-gray-600 mt-1">{card.positionName}</p>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <select
            value={card.status}
            onChange={(event) => updateCard(card.id, { status: event.target.value as CardStatus })}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => enterMockMode(card.id)}
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
          >
            开始模拟面试
          </button>

          {card.schedule.interviewTime ? (
            <span className="text-sm text-gray-500">面试: {new Date(card.schedule.interviewTime).toLocaleString()}</span>
          ) : null}
        </div>
      </div>

      {card.analysis.companySummary ? (
        <Section title="公司业务" icon={<Building2 size={18} />}>
          <p className="text-sm text-gray-600">{card.analysis.companySummary}</p>
        </Section>
      ) : null}

      {card.analysis.jdSummary ? (
        <Section title="JD 摘要" icon={<FileText size={18} />}>
          <p className="text-sm text-gray-600">{card.analysis.jdSummary}</p>
        </Section>
      ) : null}

      <Section title="匹配度分析" icon={<Target size={18} />}>
        {hasScore ? (
          <div className="space-y-3">
            <div>
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(score)}`}>
                匹配分: {score}
              </span>
            </div>

            {missingSkills.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">缺失技能</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                  {missingSkills.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {matchSuggestions.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">简历优化建议</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                  {matchSuggestions.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-gray-500">完善资源库中的简历后，可获得岗位匹配度分析。</p>
        )}
      </Section>

      {card.analysis.commonQuestions.length > 0 ? (
        <Section title="高频问题" icon={<MessageSquare size={18} />}>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
            {card.analysis.commonQuestions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ol>
        </Section>
      ) : null}

      {card.analysis.warnings.length > 0 ? (
        <Section title="注意事项" icon={<AlertTriangle size={18} />}>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            {card.analysis.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {card.analysis.checklist.length > 0 ? (
        <Section title="准备清单" icon={<CheckSquare size={18} />}>
          <ul className="space-y-2">
            {card.analysis.checklist.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                <input type="checkbox" className="mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {card.analysis.selfIntroduction ? (
        <Section title="自我介绍" icon={<Mic size={18} />}>
          <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">{card.analysis.selfIntroduction}</div>
        </Section>
      ) : null}

      {card.analysis.resumeSuggestions.length > 0 ? (
        <Section title="简历建议" icon={<FileEdit size={18} />}>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            {card.analysis.resumeSuggestions.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {card.analysis.keyPoints.length > 0 ? (
        <Section title="八股重点" icon={<BookOpen size={18} />}>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            {card.analysis.keyPoints.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {card.status === 'interviewed' || card.status === 'reviewed' ? (
        <Section title="复盘笔记" icon={<ClipboardList size={18} />}>
          <textarea
            value={card.review.notes}
            onChange={(event) => updateCard(card.id, { review: { ...card.review, notes: event.target.value } })}
            placeholder="记录面试感受..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </Section>
      ) : null}
    </div>
  );
};
