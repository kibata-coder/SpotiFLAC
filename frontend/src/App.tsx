// frontend/src/App.tsx
import { useState } from 'react';
import Sidebar from './components/Sidebar';
import { SearchPanel } from './components/SearchPanel';

// IMPORT YOUR OTHER COMPONENTS HERE:
// (Adjust these imports based on whether you used default or named exports in those files)
// import { DownloadQueue } from './components/DownloadQueue';
// import { HistoryPage } from './components/HistoryPage';
// import { SettingsPage } from './components/SettingsPage';

function App() {
  // State to track which tab is currently active in the Sidebar
  // We initialize it to 'search' to match the first item in your Sidebar navItems
  const [currentTab, setCurrentTab] = useState('search');

  // A helper function to determine which component to render based on the current tab
  const renderContent = () => {
    switch (currentTab) {
      case 'search':
        return <SearchPanel />;
      case 'queue':
        // return <DownloadQueue />; 
        return <div className="text-zinc-400">Download Queue UI goes here</div>;
      case 'history':
        // return <HistoryPage />;
        return <div className="text-zinc-400">History UI goes here</div>;
      case 'settings':
        // return <SettingsPage />;
        return <div className="text-zinc-400">Settings UI goes here</div>;
      default:
        return <SearchPanel />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-white font-sans selection:bg-green-500/30">
      
      {/* 1. Insert the Sidebar and pass the state and state-updater function */}
      <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />
      
      {/* 2. Main Content Area */}
      <main className="flex-1 relative overflow-y-auto bg-zinc-950 custom-scrollbar">
        
        {/* Subtle radial gradient background for depth and improved aesthetics */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/40 via-zinc-950 to-zinc-950 pointer-events-none" />
        
        {/* 3. Content Container with responsive padding */}
        <div className="relative h-full flex flex-col p-6 lg:p-10 max-w-7xl mx-auto">
          {/* Animated transition wrapper could go here in the future! */}
          {renderContent()}
        </div>

      </main>
    </div>
  );
}

export default App;
