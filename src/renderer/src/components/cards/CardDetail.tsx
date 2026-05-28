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

function sanitizeCardLabel(value: string, fallback = ''): string {
  const stripPrivateUse = (text: string) =>
    Array.from(text)
      .filter((char) => {
        const code = char.codePointAt(0) ?? 0;
        const inBmpPrivate = code >= 0xe000 && code <= 0xf8ff;
        const inSupPrivateA = code >= 0xf0000 && code <= 0xffffd;
        const inSupPrivateB = code >= 0x100000 && code <= 0x10fffd;
        return !inBmpPrivate && !inSupPrivateA && !inSupPrivateB;
      })
      .join('');

  const clean = stripPrivateUse(String(value || ''))
    .replace(/\uFFFD/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\ufeff/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return clean || fallback;
}

export const CardDetail: React.FC = () => {
  const { selectedCardId, cards, updateCard, selectCard } = useCardsStore();
  const { enterMockMode } = useChatStore();

  const card = cards.find((item) => item.id === selectedCardId);
  if (!card) {
    return (
      <div className="h-full min-w-0 flex items-center justify-center text-gray-400">
        <div className="text-center px-6">
          <p>请先在左侧选择作战卡查看详情。</p>
        </div>
      </div>
    );
  }

  const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({
    title,
    icon,
    children
  }) => (
    <div className="mb-6 min-w-0">
      <div className="mb-2 flex min-w-0 items-center gap-2 text-gray-700">
        {icon}
        <h3 className="font-medium break-words">{title}</h3>
      </div>
      <div className="pl-6 min-w-0">{children}</div>
    </div>
  );

  const score = card.analysis.matchScore ?? null;
  const hasScore = typeof score === 'number' && score > 0;
  const missingSkills = card.analysis.missingSkills ?? [];
  const matchSuggestions = card.analysis.matchSuggestions ?? [];
  const companyName = sanitizeCardLabel(card.companyName, '未知公司');
  const companyLocation = sanitizeCardLabel(card.companyLocation);
  const positionName = sanitizeCardLabel(card.positionName, '未知岗位');

  return (
    <div className="h-full min-w-0 overflow-y-auto p-6">
      <div className="mb-6 border-b border-gray-200 pb-4 min-w-0">
        <button
          onClick={() => selectCard(null)}
          className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={16} />
          返回对话
        </button>

        <h1 className="text-xl font-bold text-gray-900 break-words">{companyName}</h1>
        {companyLocation ? <p className="mt-1 text-sm text-gray-400 break-all">{companyLocation}</p> : null}
        <p className="mt-1 text-gray-600 break-words">{positionName}</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            value={card.status}
            onChange={(event) => updateCard(card.id, { status: event.target.value as CardStatus })}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => enterMockMode(card.id)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-indigo-700"
          >
            开始模拟面试
          </button>

          {card.schedule.interviewTime ? (
            <span className="text-sm text-gray-500 break-words">
              面试时间: {new Date(card.schedule.interviewTime).toLocaleString()}
            </span>
          ) : null}
        </div>
      </div>

      {card.analysis.companySummary ? (
        <Section title="公司业务" icon={<Building2 size={18} />}>
          <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{card.analysis.companySummary}</p>
        </Section>
      ) : null}

      {card.analysis.jdSummary ? (
        <Section title="JD 摘要" icon={<FileText size={18} />}>
          <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{card.analysis.jdSummary}</p>
        </Section>
      ) : null}

      <Section title="岗位匹配分析" icon={<Target size={18} />}>
        {hasScore ? (
          <div className="space-y-3 min-w-0">
            <div>
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${getScoreColor(score)}`}>
                匹配分: {score}
              </span>
            </div>

            {missingSkills.length > 0 ? (
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700">缺失技能</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                  {missingSkills.map((item, index) => (
                    <li key={index} className="break-words">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {matchSuggestions.length > 0 ? (
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700">简历优化建议</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                  {matchSuggestions.map((item, index) => (
                    <li key={index} className="break-words">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-gray-500 break-words">完善资源库中的简历后，可获得岗位匹配分析。</p>
        )}
      </Section>

      {card.analysis.commonQuestions.length > 0 ? (
        <Section title="高频问题" icon={<MessageSquare size={18} />}>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
            {card.analysis.commonQuestions.map((question, index) => (
              <li key={index} className="break-words">
                {question}
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {card.analysis.warnings.length > 0 ? (
        <Section title="注意事项" icon={<AlertTriangle size={18} />}>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            {card.analysis.warnings.map((warning, index) => (
              <li key={index} className="break-words">
                {warning}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {card.analysis.checklist.length > 0 ? (
        <Section title="准备清单" icon={<CheckSquare size={18} />}>
          <ul className="space-y-2">
            {card.analysis.checklist.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                <input type="checkbox" className="mt-0.5 shrink-0" />
                <span className="break-words">{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {card.analysis.selfIntroduction ? (
        <Section title="自我介绍" icon={<Mic size={18} />}>
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 whitespace-pre-wrap break-words">
            {card.analysis.selfIntroduction}
          </div>
        </Section>
      ) : null}

      {card.analysis.resumeSuggestions.length > 0 ? (
        <Section title="简历建议" icon={<FileEdit size={18} />}>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            {card.analysis.resumeSuggestions.map((item, index) => (
              <li key={index} className="break-words">
                {item}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {card.analysis.keyPoints.length > 0 ? (
        <Section title="关键重点" icon={<BookOpen size={18} />}>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            {card.analysis.keyPoints.map((item, index) => (
              <li key={index} className="break-words">
                {item}
              </li>
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
            className="h-32 w-full resize-none rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </Section>
      ) : null}
    </div>
  );
};
