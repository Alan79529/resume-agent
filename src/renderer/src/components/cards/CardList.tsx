import React, { useEffect, useState } from 'react';
import { Plus, Settings } from 'lucide-react';
import { useCardsStore } from '../../stores/cards';
import { CardItem } from './CardItem';
import { SettingsPanel } from '../settings/SettingsPanel';

export const CardList: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const { cards, selectedCardId, loadCards, selectCard, createCard } = useCardsStore();

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleCreateCard = async () => {
    // Create a demo card for testing
    await createCard({
      companyName: '示例公司',
      companyLocation: '北京',
      positionName: '前端开发实习',
      status: 'pending_analysis',
      analysis: {
        companySummary: '',
        jdSummary: '',
        experienceSummary: '',
        commonQuestions: [],
        warnings: [],
        checklist: [],
        selfIntroduction: '',
        resumeSuggestions: [],
        keyPoints: []
      },
      schedule: {
        interviewTime: null,
        reminderMinutes: 60,
        location: ''
      },
      review: {
        actualQuestions: '',
        selfRating: 3,
        answerFeedback: '',
        interviewerFeedback: '',
        salaryRange: '',
        result: 'pending',
        recommend: false,
        notes: ''
      },
      sourceUrl: ''
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">作战卡</h2>
            <p className="text-sm text-gray-500 mt-0.5">{cards.length} 个面试机会</p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              title="设置"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={handleCreateCard}
              className="p-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
              title="新建作战卡"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cards.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">暂无作战卡</p>
            <p className="text-gray-300 text-xs mt-1">点击 + 创建或从浏览器提取</p>
          </div>
        ) : (
          cards.map(card => (
            <CardItem
              key={card.id}
              card={card}
              isSelected={selectedCardId === card.id}
              onClick={() => selectCard(card.id)}
            />
          ))
        )}
      </div>
      
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};
