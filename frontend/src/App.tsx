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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--sp-subdued)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Download Queue</h2>
            <p style={{ color: 'var(--sp-subdued)', fontSize: '0.875rem', margin: 0 }}>Your active downloads will appear here</p>
          </div>
        );
      case 'history':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--sp-subdued)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>History</h2>
            <p style={{ color: 'var(--sp-subdued)', fontSize: '0.875rem', margin: 0 }}>Your previously downloaded tracks will appear here</p>
          </div>
        );
      case 'settings':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--sp-subdued)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Configuration</h2>
            <p style={{ color: 'var(--sp-subdued)', fontSize: '0.875rem', margin: 0 }}>App settings and preferences</p>
          </div>
        );
      default:
        return <SearchPanel />;
    }
  };

  // Gradient per tab
  const gradients: Record<string, string> = {
    search:   'linear-gradient(180deg, rgba(28,65,46,0.9) 0%, rgba(18,18,18,0) 100%)',
    queue:    'linear-gradient(180deg, rgba(30,50,90,0.8) 0%, rgba(18,18,18,0) 100%)',
    history:  'linear-gradient(180deg, rgba(70,40,80,0.8) 0%, rgba(18,18,18,0) 100%)',
    settings: 'linear-gradient(180deg, rgba(40,40,40,0.8) 0%, rgba(18,18,18,0) 100%)',
  };

  return (
    // Outermost shell — 100vh, row flex, no overflow
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--sp-bg)',
        padding: '8px',
        gap: '8px',
        boxSizing: 'border-box',
      }}
    >
      {/* ── Sidebar (fixed width, never shrinks) ── */}
      <div style={{ width: 280, flexShrink: 0, height: '100%' }}>
        <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />
      </div>

      {/* ── Main panel (fills remaining width) ── */}
      <main
        style={{
          flex: '1 1 0',
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          background: 'var(--sp-surface)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {/* Gradient wash */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 280,
            background: gradients[currentTab] ?? gradients.settings,
            pointerEvents: 'none',
            transition: 'background 0.6s ease',
            zIndex: 0,
          }}
        />

        {/* ── Scrollable content ── the key is: flex:1, minHeight:0, overflowY:auto */}
        <div
          className="custom-scrollbar"
          style={{
            position: 'relative',
            zIndex: 1,
            flex: '1 1 0',
            minHeight: 0,          // ← prevents flex child from expanding beyond parent
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <div style={{ maxWidth: 1800, margin: '0 auto', padding: '24px 32px' }}>
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
