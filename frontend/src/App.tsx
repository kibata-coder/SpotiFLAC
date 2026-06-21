import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DownloadQueue from './components/DownloadQueue';
import SettingsPage from './components/SettingsPage';
import HistoryPage from './components/HistoryPage';
import { SearchPanel } from './components/SearchPanel'; 

function App() {
  const [activeTab, setActiveTab] = useState<string>('search');

  const renderContent = () => {
    switch (activeTab) {
      case 'search':
        return <SearchPanel />;
      case 'queue':
        return <DownloadQueue />;
      case 'history':
        return <HistoryPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <div className="text-sm text-zinc-500">Page not found</div>;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-white font-sans selection:bg-green-500/30">
      <Sidebar currentTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* We removed the <TitleBar /> from here entirely */}
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6 container mx-auto max-w-5xl">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default App;
