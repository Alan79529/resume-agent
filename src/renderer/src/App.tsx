import { MainLayout } from './components/layout/MainLayout';
import { CardList } from './components/cards/CardList';
import { ChatPanel } from './components/chat/ChatPanel';
import { CardDetail } from './components/cards/CardDetail';
import { WebviewPanel } from './components/webview/WebviewPanel';
import { useCardsStore } from './stores/cards';

function App() {
  const { selectedCardId } = useCardsStore();

  return (
    <MainLayout
      leftPanel={<CardList />}
      centerPanel={selectedCardId ? <CardDetail /> : <ChatPanel />}
      rightPanel={<WebviewPanel />}
    />
  );
}

export default App;
