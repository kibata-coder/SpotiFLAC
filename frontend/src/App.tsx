import { useState, createContext } from 'react';
import Sidebar from './components/Sidebar';
import { SearchPanel } from './components/SearchPanel';
import { LibraryPanel } from './components/LibraryPanel';
import { AudioPlayer } from './components/AudioPlayer';
import type { SearchResult } from './lib/api';
import { getStreamUrl } from './lib/api';
import { getTrackBlob } from './lib/offline';

export interface PlayerContextType {
  playTrack: (track: SearchResult, streamUrl: string, queue?: SearchResult[], index?: number) => void;
  currentTrack: SearchResult | null;
  isPlaying: boolean;
}

export const PlayerContext = createContext<PlayerContextType>({
  playTrack: () => {},
  currentTrack: null,
  isPlaying: false,
});

function App() {
  const [currentTab, setCurrentTab] = useState('search');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Audio Player State
  const [currentTrack, setCurrentTrack] = useState<SearchResult | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [queue, setQueue] = useState<SearchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const playTrack = (
    track: SearchResult,
    url: string,
    trackQueue?: SearchResult[],
    index?: number,
  ) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(p => !p);
      return;
    }
    setCurrentTrack(track);
    setStreamUrl(url);
    setIsPlaying(true);
    if (trackQueue) {
      setQueue(trackQueue);
      setCurrentIndex(index ?? 0);
    }
  };

  const handlePrev = async (forceWrap?: boolean) => {
    let idx = currentIndex - 1;
    if (idx < 0) {
      if (forceWrap && queue.length > 0) {
        idx = queue.length - 1;
      } else {
        return;
      }
    }
    const t = queue[idx];
    if (!t) return;
    // Check offline blob first
    const blob = await getTrackBlob(t.id);
    const url = blob ? URL.createObjectURL(blob) : getStreamUrl(t.id);
    setCurrentTrack(t);
    setStreamUrl(url);
    setIsPlaying(true);
    setCurrentIndex(idx);
  };

  const handleNext = async (forceWrap?: boolean) => {
    let idx = currentIndex + 1;
    if (idx >= queue.length) {
      if (forceWrap && queue.length > 0) {
        idx = 0;
      } else {
        return;
      }
    }
    const t = queue[idx];
    if (!t) return;
    // Check offline blob first
    const blob = await getTrackBlob(t.id);
    const url = blob ? URL.createObjectURL(blob) : getStreamUrl(t.id);
    setCurrentTrack(t);
    setStreamUrl(url);
    setIsPlaying(true);
    setCurrentIndex(idx);
  };

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    setSidebarOpen(false);
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'search':
        return <SearchPanel />;
      case 'queue':
        return <LibraryPanel />;
      case 'history':
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
              <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--sp-subdued)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-white text-2xl font-bold m-0">History</h2>
            <p className="m-0 text-sm" style={{ color: 'var(--sp-subdued)' }}>Your previously downloaded tracks will appear here</p>
          </div>
        );
      case 'settings':
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
              <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--sp-subdued)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-white text-2xl font-bold m-0">Configuration</h2>
            <p className="m-0 text-sm" style={{ color: 'var(--sp-subdued)' }}>App settings and preferences</p>
          </div>
        );
      default:
        return <SearchPanel />;
    }
  };

  const gradients: Record<string, string> = {
    search:   'linear-gradient(180deg, rgba(28,65,46,0.9) 0%, rgba(18,18,18,0) 100%)',
    queue:    'linear-gradient(180deg, rgba(30,50,90,0.8) 0%, rgba(18,18,18,0) 100%)',
    history:  'linear-gradient(180deg, rgba(70,40,80,0.8) 0%, rgba(18,18,18,0) 100%)',
    settings: 'linear-gradient(180deg, rgba(40,40,40,0.8) 0%, rgba(18,18,18,0) 100%)',
  };

  return (
    <PlayerContext.Provider value={{ playTrack, currentTrack, isPlaying }}>
      {/* ── Mobile sidebar backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Root layout ─────────────────────────────── */}
      <div
        className="flex flex-row w-screen overflow-hidden"
        style={{
          height: currentTrack ? 'calc(100dvh - 90px)' : '100dvh',
          background: 'var(--sp-bg)',
          padding: '8px',
          gap: '8px',
          boxSizing: 'border-box',
          transition: 'height 0.3s ease',
        }}
      >
        {/* ── Desktop sidebar (hidden on mobile) ── */}
        <div className="hidden lg:flex w-[280px] shrink-0 h-full">
          <Sidebar currentTab={currentTab} onTabChange={handleTabChange} />
        </div>

        {/* ── Mobile sidebar (slide-in drawer) ── */}
        <div
          className={`fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-in-out lg:hidden flex flex-col`}
          style={{
            width: 260,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            padding: '8px',
            boxSizing: 'border-box',
          }}
        >
          <Sidebar currentTab={currentTab} onTabChange={handleTabChange} />
        </div>

        {/* ── Main content ── */}
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

          {/* ── Mobile top bar ── */}
          <div
            className="flex lg:hidden items-center gap-3 px-4 pt-4 pb-2 relative z-10"
          >
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.1)' }}
              aria-label="Open menu"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--sp-green)' }}>
                <svg width="14" height="14" fill="none" stroke="black" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <span className="font-black text-base text-white">SoudMusic</span>
            </div>
          </div>

          {/* Scrollable content */}
          <div
            className="custom-scrollbar"
            style={{
              position: 'relative',
              zIndex: 1,
              flex: '1 1 0',
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            <div style={{ maxWidth: 1800, margin: '0 auto', padding: '16px 20px 24px' }} className="lg:!px-8 lg:!pt-6">
              {renderContent()}
            </div>
          </div>
        </main>
      </div>

      <AudioPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        streamUrl={streamUrl}
        onPlayPause={() => setIsPlaying(p => !p)}
        queue={queue}
        currentIndex={currentIndex}
        onPrev={handlePrev}
        onNext={handleNext}
        onError={async () => {
          console.warn("Playback failed. Checking offline storage...");
          if (currentTrack) {
            const blob = await getTrackBlob(currentTrack.id);
            if (blob) {
              setStreamUrl(URL.createObjectURL(blob));
            } else {
              setStreamUrl(getStreamUrl(currentTrack.id));
            }
          }
        }}
      />
    </PlayerContext.Provider>
  );
}

export default App;
