import React from 'react';

export const ChatPanel: React.FC = () => {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">AI 助手</h2>
        <p className="text-sm text-gray-500 mt-1">输入公司+岗位开始分析</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            你好！我是你的面试助手。在右侧浏览器中打开 Boss 直聘或牛客网，
            找到感兴趣的岗位后，点击"提取并分析"按钮，我就能为你生成面试策略。
          </p>
        </div>
      </div>
    </div>
  );
};
