import React, { useEffect, useRef } from 'react';
import { useWebviewStore } from '../../stores/webview';
import { TabBar } from './TabBar';

export const WebviewPanel: React.FC = () => {
  const { tabs, addTab, updateTabTitle } = useWebviewStore();
  const webviewRefs = useRef<Map<string, Electron.WebviewTag>>(new Map());
  const hasInit = useRef(false);

  // Add initial tab on mount (prevent double execution with ref)
  useEffect(() => {
    if (!hasInit.current && tabs.length === 0) {
      hasInit.current = true;
      addTab('https://www.zhipin.com');
    }
  }, [tabs.length]);

  const handleWebviewRef = (id: string, el: HTMLWebViewElement | null) => {
    if (el) {
      const webview = el as unknown as Electron.WebviewTag;
      webviewRefs.current.set(id, webview);
      
      // Listen for page title updates
      webview.addEventListener('page-title-updated', (e) => {
        updateTabTitle(id, e.title);
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <TabBar />
      
      <div className="flex-1 relative">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`absolute inset-0 ${tab.isActive ? 'block' : 'hidden'}`}
          >
            <webview
              ref={(el) => handleWebviewRef(tab.id, el)}
              src={tab.url}
              data-tab-id={tab.id}
              className="w-full h-full"
              allowpopups={true}
              partition="persist:webview"
              webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"
            />
          </div>
        ))}
        
        {tabs.length === 0 && (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p>点击 + 按钮打开浏览器</p>
              <p className="text-sm mt-2">支持 Boss 直聘、牛客网等招聘网站</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
