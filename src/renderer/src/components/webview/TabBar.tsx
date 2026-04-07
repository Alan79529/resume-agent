import React from 'react';
import { Plus, X } from 'lucide-react';
import { useWebviewStore } from '../../stores/webview';

export const TabBar: React.FC = () => {
  const { tabs, addTab, closeTab, setActiveTab } = useWebviewStore();

  return (
    <div className="flex items-center bg-gray-100 border-b border-gray-200">
      <div className="flex-1 flex overflow-x-auto">
        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              group flex items-center gap-2 px-3 py-2 min-w-[120px] max-w-[200px] 
              cursor-pointer border-r border-gray-200 text-sm
              ${tab.isActive 
                ? 'bg-white text-gray-900' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-50'
              }
            `}
          >
            <span className="flex-1 truncate">{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-200 rounded"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      
      <button
        onClick={() => addTab()}
        className="p-2 text-gray-600 hover:bg-gray-200 transition-colors"
        title="新建标签页"
      >
        <Plus size={18} />
      </button>
    </div>
  );
};
