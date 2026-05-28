import React from 'react';
import { ResizablePanel } from './ResizablePanel';

interface MainLayoutProps {
  centerPanel: React.ReactNode;
  rightPanel: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  centerPanel,
  rightPanel
}) => {
  return (
    <div className="h-full w-full flex overflow-hidden bg-slate-100 min-w-0">
      {/* Center Panel - Chat */}
      <ResizablePanel
        direction="horizontal"
        defaultSize={520}
        minSize={380}
        maxSize={720}
        className="flex-shrink-0 min-w-0"
      >
        <div className="h-full w-full bg-white border-r border-slate-200 min-w-0 overflow-hidden">
          {centerPanel}
        </div>
      </ResizablePanel>

      {/* Right Panel - Webview (takes remaining space) */}
      <div className="flex-1 min-w-[360px] bg-white overflow-hidden">
        {rightPanel}
      </div>
    </div>
  );
};
