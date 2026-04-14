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

  return (
    <MainLayout
      leftPanel={<CardList />}
      centerPanel={selectedCardId && mode !== 'mock' ? <CardDetail /> : <ChatPanel />}
      rightPanel={<WebviewPanel />}
    />
  );
}

export default App;
