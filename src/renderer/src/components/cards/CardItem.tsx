import React from 'react';
import { MoreVertical, Calendar } from 'lucide-react';
import type { BattleCard, CardStatus } from '../../types';

interface CardItemProps {
  card: BattleCard;
  isSelected: boolean;
  onClick: () => void;
}

const statusConfig: Record<CardStatus, { label: string; color: string; bg: string }> = {
  pending_analysis: { label: '待分析', color: 'text-gray-600', bg: 'bg-gray-100' },
  preparing: { label: '待准备', color: 'text-blue-600', bg: 'bg-blue-50' },
  scheduled: { label: '已安排', color: 'text-amber-600', bg: 'bg-amber-50' },
  interviewed: { label: '已面试', color: 'text-green-600', bg: 'bg-green-50' },
  reviewed: { label: '已复盘', color: 'text-emerald-600', bg: 'bg-emerald-50' }
};

export const CardItem: React.FC<CardItemProps> = ({ card, isSelected, onClick }) => {
  const status = statusConfig[card.status];
  
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div
      onClick={onClick}
      className={`
        p-3 rounded-lg cursor-pointer transition-all border group
        ${isSelected 
          ? 'bg-blue-50 border-blue-300 shadow-sm' 
          : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
        }
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{card.companyName}</h3>
          <p className="text-sm text-gray-500 truncate mt-0.5">{card.positionName}</p>
        </div>
        <button 
          className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            // TODO: show context menu
          }}
        >
          <MoreVertical size={16} />
        </button>
      </div>
      
      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
          {status.label}
        </span>
        
        {card.schedule.interviewTime && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar size={12} />
            <span>{formatDate(card.schedule.interviewTime)}</span>
          </div>
        )}
      </div>
    </div>
  );
};
