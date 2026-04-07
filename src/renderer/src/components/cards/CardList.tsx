import React from 'react';

export const CardList: React.FC = () => {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">作战卡</h2>
        <p className="text-sm text-gray-500 mt-1">跟进中的面试机会</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="text-center text-gray-400 py-8">
          暂无作战卡
        </div>
      </div>
    </div>
  );
};
