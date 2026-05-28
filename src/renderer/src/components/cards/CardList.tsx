import React, { useEffect, useState } from 'react';
import { Plus, Settings, FileText, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useCardsStore } from '../../stores/cards';
import { CardItem } from './CardItem';
import { SettingsPanel } from '../settings/SettingsPanel';
import { ResourceLibraryModal } from '../resources/ResourceLibraryModal';

interface CardListProps {
  isDrawerOpen: boolean;
  onToggleDrawer: () => void;
}

export const CardList: React.FC<CardListProps> = ({ isDrawerOpen, onToggleDrawer }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showResourceLibrary, setShowResourceLibrary] = useState(false);
  const { cards, selectedCardId, loadCards, selectCard, createCard } = useCardsStore();

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleCreateCard = async () => {
    await createCard({
      companyName: '示例公司',
      companyLocation: '北京',
      positionName: '前端开发实习生',
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
        keyPoints: [],
        matchScore: null,
        missingSkills: [],
        matchSuggestions: []
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
    <>
      {/* Toggle button — always visible */}
      <button
        onClick={onToggleDrawer}
        className="fixed top-3 left-3 z-40 p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
        title={isDrawerOpen ? '收起作战卡' : '展开作战卡'}
      >
        {isDrawerOpen ? <PanelLeftClose size={18} className="text-gray-600" /> : <PanelLeft size={18} className="text-gray-600" />}
      </button>

      {/* Backdrop */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 transition-opacity sm:hidden"
          onClick={onToggleDrawer}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 z-30 h-full w-[320px] bg-white border-r border-gray-200 shadow-2xl shadow-gray-900/10 flex flex-col transition-transform duration-300 ease-in-out ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 pt-14 border-b border-gray-200">
          <div className="flex flex-wrap items-start justify-between gap-3 min-w-0">
            <div className="min-w-0 flex-1 basis-[180px]">
              <h2 className="text-lg font-semibold text-gray-900 break-words">作战卡</h2>
              <p className="text-sm text-gray-500 mt-0.5 break-words">{cards.length} 个面试机会</p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-1 shrink-0 max-w-full">
              <button
                onClick={() => setShowResourceLibrary(true)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="资源库"
              >
                <FileText size={18} />
              </button>
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

        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden p-3 space-y-2">
          {cards.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">暂无作战卡</p>
              <p className="text-gray-300 text-xs mt-1">点击 + 创建或从浏览器提取</p>
            </div>
          ) : (
            cards.map((card) => (
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
        <ResourceLibraryModal
          isOpen={showResourceLibrary}
          onClose={() => setShowResourceLibrary(false)}
        />
      </div>
    </>
  );
};
