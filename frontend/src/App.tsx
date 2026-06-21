import { useState } from 'react';
import Sidebar from './components/Sidebar';
import { SearchPanel } from './components/SearchPanel';

function App() {
  const [currentTab, setCurrentTab] = useState('search');

  const renderContent = () => {
    switch (currentTab) {
      case 'search':
        return <SearchPanel />;
      case 'queue':
        return <div className="text-[#b3b3b3] font-bold text-2xl">Download Queue</div>;
      case 'history':
        return <div className="text-[#b3b3b3] font-bold text-2xl">History Log</div>;
      case 'settings':
        return <div className="text-[#b3b3b3] font-bold text-2xl">Configuration</div>;
      default:
        return <SearchPanel />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black p-2 gap-2 text-white font-sans selection:bg-[#1DB954]/30">
      
      <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />
      
      {/* Main Content Island */}
      <main className="flex-1 relative rounded-lg bg-[#121212] overflow-hidden flex flex-col">
        
        {/* Spotify Top Gradient Wash */}
        <div className="absolute top-0 left-0 right-0 h-80 bg-gradient-to-b from-[#1e4431] to-[#121212] pointer-events-none transition-colors duration-500" />
        
        {/* Sticky Header / Top Bar */}
        <header className="sticky top-0 z-10 h-16 flex items-center px-6">
          {/* Optional top bar content goes here */}
        </header>

        {/* Scrollable Content Container */}
        <div className="relative z-0 flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-[1955px] mx-auto">
            {renderContent()}
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;
