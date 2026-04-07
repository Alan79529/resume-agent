import React from 'react';
import { ResizablePanel } from './ResizablePanel';

interface MainLayoutProps {
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  leftPanel,
  centerPanel,
  rightPanel
}) => {
  return (
    <div className="h-screen w-screen flex overflow-hidden bg-gray-50">
      {/* Left Panel - Card List */}
      <ResizablePanel
        direction="horizontal"
        defaultSize={280}
        minSize={200}
        maxSize={400}
        className="flex-shrink-0"
      >
        <div className="h-full bg-white border-r border-gray-200">
          {leftPanel}
        </div>
      </ResizablePanel>

      {/* Center Panel - Chat */}
      <ResizablePanel
        direction="horizontal"
        defaultSize={500}
        minSize={400}
        maxSize={800}
        className="flex-shrink-0"
      >
        <div className="h-full bg-white border-r border-gray-200">
          {centerPanel}
        </div>
      </ResizablePanel>

      {/* Right Panel - Webview (takes remaining space) */}
      <div className="flex-1 bg-white">
        {rightPanel}
      </div>
    </div>
  );
};
