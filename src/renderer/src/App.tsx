import { useState } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { CardList } from './components/cards/CardList';
import { ChatPanel } from './components/chat/ChatPanel';
import { CardDetail } from './components/cards/CardDetail';
import { WebviewPanel } from './components/webview/WebviewPanel';
import { useCardsStore } from './stores/cards';
import { useChatStore } from './stores/chat';

function App() {
  const { selectedCardId } = useCardsStore();
  const { mode } = useChatStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100">
      <CardList isDrawerOpen={drawerOpen} onToggleDrawer={() => setDrawerOpen(!drawerOpen)} />
      <div className={`h-full transition-[padding] duration-300 ease-in-out ${drawerOpen ? 'sm:pl-[320px]' : 'sm:pl-0'}`}>
        <MainLayout
          centerPanel={selectedCardId && mode !== 'mock' ? <CardDetail /> : <ChatPanel />}
          rightPanel={<WebviewPanel />}
        />
      </div>
    </div>
  );
}

export default App;
