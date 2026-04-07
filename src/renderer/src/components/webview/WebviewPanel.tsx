import React from 'react';

export const WebviewPanel: React.FC = () => {
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">浏览器</span>
        </div>
      </div>
      <div className="flex-1 bg-gray-100 flex items-center justify-center">
        <p className="text-gray-400">Webview 浏览器将显示在这里</p>
      </div>
    </div>
  );
};
