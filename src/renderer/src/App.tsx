import { MainLayout } from './components/layout/MainLayout';
import { CardList } from './components/cards/CardList';
import { ChatPanel } from './components/chat/ChatPanel';
import { WebviewPanel } from './components/webview/WebviewPanel';

function App() {
  return (
    <MainLayout
      leftPanel={<CardList />}
      centerPanel={<ChatPanel />}
      rightPanel={<WebviewPanel />}
    />
  );
}

export default App;
