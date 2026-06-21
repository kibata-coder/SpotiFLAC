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
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-2"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--sp-subdued)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">Download Queue</h2>
            <p className="text-sm" style={{ color: 'var(--sp-subdued)' }}>Your active downloads will appear here</p>
          </div>
        );
      case 'history':
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-2"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--sp-subdued)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">History</h2>
            <p className="text-sm" style={{ color: 'var(--sp-subdued)' }}>Your previously downloaded tracks will appear here</p>
          </div>
        );
      case 'settings':
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-2"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--sp-subdued)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white">Configuration</h2>
            <p className="text-sm" style={{ color: 'var(--sp-subdued)' }}>App settings and preferences</p>
          </div>
        );
      default:
        return <SearchPanel />;
    }
  };

  return (
    <div
      className="flex h-screen w-screen overflow-hidden p-2 gap-2"
      style={{ background: 'var(--sp-bg)' }}
    >
      <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Main Content Panel */}
      <main
        className="flex-1 relative rounded-xl overflow-hidden flex flex-col"
        style={{ background: 'var(--sp-surface)' }}
      >
        {/* Spotify-style top gradient wash — shifts with tab */}
        <div
          className="absolute top-0 left-0 right-0 h-72 pointer-events-none transition-all duration-700"
          style={{
            background: currentTab === 'search'
              ? 'linear-gradient(180deg, rgba(28,65,46,0.9) 0%, rgba(18,18,18,0) 100%)'
              : currentTab === 'queue'
              ? 'linear-gradient(180deg, rgba(30,50,90,0.8) 0%, rgba(18,18,18,0) 100%)'
              : currentTab === 'history'
              ? 'linear-gradient(180deg, rgba(70,40,80,0.8) 0%, rgba(18,18,18,0) 100%)'
              : 'linear-gradient(180deg, rgba(40,40,40,0.8) 0%, rgba(18,18,18,0) 100%)',
          }}
        />

        {/* Scrollable Content */}
        <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-[1800px] mx-auto px-6 lg:px-8 py-6">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
