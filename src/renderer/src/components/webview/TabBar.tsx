import React from 'react';
import { Plus, X } from 'lucide-react';
import { useWebviewStore } from '../../stores/webview';

export const TabBar: React.FC = () => {
  const { tabs, addTab, closeTab, setActiveTab } = useWebviewStore();

  return (
    <div className="flex min-w-0 items-center border-b border-gray-200 bg-gray-100">
      <div className="flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              group flex min-w-[140px] max-w-[260px] flex-1 items-center gap-2 border-r border-gray-200 px-3 py-2 text-sm
              cursor-pointer
              ${tab.isActive ? 'bg-white text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-50'}
            `}
          >
            <span className="min-w-0 flex-1 truncate" title={tab.title}>
              {tab.title}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="shrink-0 rounded p-0.5 opacity-70 hover:bg-gray-200 hover:opacity-100"
              title="关闭标签页"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => addTab()}
        className="shrink-0 p-2 text-gray-600 transition-colors hover:bg-gray-200"
        title="新建标签页"
      >
        <Plus size={18} />
      </button>
    </div>
  );
};
