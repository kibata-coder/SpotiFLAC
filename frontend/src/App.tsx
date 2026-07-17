import { useState, useEffect, createContext, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import { SearchPanel } from './components/SearchPanel';
import { LibraryPanel } from './components/LibraryPanel';
import { AudioPlayer } from './components/AudioPlayer';
import { AuthModal } from './components/AuthModal';
import { PlaylistsPanel } from './components/PlaylistsPanel';
import { ArtistsPanel } from './components/ArtistsPanel';
import { QueuePanel } from './components/QueuePanel';
import { DiscoverPage } from './components/DiscoverPage';
import type { SearchResult } from './lib/api';
import { getStreamUrl } from './lib/api';
import { getTrackBlob } from './lib/offline';
import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';
import { toast } from 'sonner';

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

  // Supabase Auth and User States
  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Array<{ id: string; name: string }>>([]);
  const [followedArtists, setFollowedArtists] = useState<Set<string>>(new Set());

  // Audio Player State
  const [currentTrack, setCurrentTrack] = useState<SearchResult | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [queue, setQueue] = useState<SearchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isShuffle, setIsShuffle] = useState(false);
  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const [initialSeek, setInitialSeek] = useState<number | undefined>(undefined);

  // Shuffle: track which indices have been played to avoid repeats
  const shuffleHistoryRef = useRef<Set<number>>(new Set());

  // Listening history tracking (Phase 2)
  const trackStartTimeRef = useRef<number>(Date.now());
  const prevTrackRef      = useRef<SearchResult | null>(null);

  // Check auth state on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Listening history (Phase 2) ──────────────────────────────────
  // Log a track when the user switches tracks (if played >= 30s)
  useEffect(() => {
    const prev    = prevTrackRef.current;
    const elapsed = (Date.now() - trackStartTimeRef.current) / 1000;

    if (prev && user && elapsed >= 30) {
      supabase.from('listening_history').insert({
        user_id:       user.id,
        track_id:      prev.id,
        track_name:    prev.name,
        track_artists: prev.artists,
        played_at:     new Date().toISOString(),
        duration_seconds: Math.floor(elapsed),
      }).then(() => {}).catch(() => {});
    }

    prevTrackRef.current     = currentTrack;
    trackStartTimeRef.current = Date.now();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id]);


  // Fetch userdata whenever user changes
  useEffect(() => {
    if (user) {
      fetchUserPlaylists();
      fetchUserFollowedArtists();
      restorePlaybackState(user.id);
    } else {
      setPlaylists([]);
      setFollowedArtists(new Set());
    }
  }, [user]);

  // ── Handle Collaborative Playlist Invites ──────────────────────────
  useEffect(() => {
    const handleInvite = async () => {
      const params = new URLSearchParams(window.location.search);
      const inviteCode = params.get('join_playlist');
      if (inviteCode && user) {
        // Clear param from URL
        window.history.replaceState({}, document.title, window.location.pathname);
        try {
          const { data, error } = await supabase.from('playlists').select('id, name').eq('invite_code', inviteCode).maybeSingle();
          if (error || !data) {
            toast.error('Invalid or expired invite link');
            return;
          }
          // Join playlist
          const { error: joinError } = await supabase.from('playlist_collaborators').insert({ playlist_id: data.id, user_id: user.id });
          if (joinError && joinError.code !== '23505') { // Ignore unique violation if already joined
            throw joinError;
          }
          toast.success(`Joined collaborative playlist: ${data.name}`);
          fetchUserPlaylists();
          setCurrentTab('playlists');
        } catch (err) {
          toast.error('Failed to join playlist');
        }
      } else if (inviteCode && !user) {
        toast.error('Please sign in to join this playlist', { duration: 5000 });
        setAuthModalOpen(true);
      }
    };
    handleInvite();
  }, [user]);

  // ── Cross-device sync: restore ───────────────────────────────────
  const restorePlaybackState = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('playback_state')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) return;

      const track: SearchResult = {
        id: data.track_id,
        name: data.track_name,
        artists: data.track_artists,
        cover: data.track_cover,
        album: data.track_album,
      };

      // Restore queue if available
      let restoredQueue: SearchResult[] = [];
      let restoredIndex = 0;
      if (data.queue_data) {
        try {
          restoredQueue = JSON.parse(data.queue_data);
          restoredIndex = data.queue_index ?? 0;
        } catch {}
      }

      if (restoredQueue.length === 0) {
        restoredQueue = [track];
        restoredIndex = 0;
      }

      const blob = await getTrackBlob(track.id);
      const url = blob ? URL.createObjectURL(blob) : getStreamUrl(track.id);

      setCurrentTrack(track);
      setStreamUrl(url);
      setQueue(restoredQueue);
      setCurrentIndex(restoredIndex);
      setInitialSeek(data.position_seconds || 0);
      setIsPlaying(false); // don't autoplay on restore

      toast.success(`▶ Resume: ${track.name}`, { duration: 4000 });
    } catch (err) {
      console.error('Failed to restore playback state:', err);
    }
  };

  const fetchUserPlaylists = async () => {
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select('id, name');
      if (error) throw error;
      setPlaylists(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUserFollowedArtists = async () => {
    try {
      const { data, error } = await supabase
        .from('followed_artists')
        .select('artist_name');
      if (error) throw error;
      setFollowedArtists(new Set((data || []).map(a => a.artist_name)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Logged out successfully');
      setCurrentTab('search');
    } catch (err: any) {
      toast.error(err.message || 'Logout failed');
    }
  };

  const playTrack = useCallback((
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
    setInitialSeek(undefined);
    if (trackQueue) {
      setQueue(trackQueue);
      setCurrentIndex(index ?? 0);
      shuffleHistoryRef.current = new Set([index ?? 0]);
    }
  }, [currentTrack]);

  // ── Shuffle: pick random unplayed index ──────────────────────────
  const pickShuffleIndex = useCallback((currentIdx: number, total: number): number => {
    const history = shuffleHistoryRef.current;
    // If all played, reset
    if (history.size >= total) {
      shuffleHistoryRef.current = new Set([currentIdx]);
    }
    const candidates = Array.from({ length: total }, (_, i) => i).filter(
      i => i !== currentIdx && !history.has(i)
    );
    if (candidates.length === 0) return (currentIdx + 1) % total;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    shuffleHistoryRef.current.add(picked);
    return picked;
  }, []);

  const handlePrev = useCallback(async (forceWrap?: boolean) => {
    let idx = currentIndex - 1;
    if (isShuffle) {
      idx = Math.max(0, currentIndex - 1); // shuffle goes back linearly
    }
    if (idx < 0) {
      if (forceWrap && queue.length > 0) {
        idx = queue.length - 1;
      } else {
        // Seek to start of current track instead
        return;
      }
    }
    const t = queue[idx];
    if (!t) return;
    const blob = await getTrackBlob(t.id);
    const url = blob ? URL.createObjectURL(blob) : getStreamUrl(t.id);
    setCurrentTrack(t);
    setStreamUrl(url);
    setIsPlaying(true);
    setCurrentIndex(idx);
    setInitialSeek(undefined);
  }, [currentIndex, queue, isShuffle]);

  const handleNext = useCallback(async (forceWrap?: boolean) => {
    let idx: number;
    if (isShuffle) {
      idx = pickShuffleIndex(currentIndex, queue.length);
    } else {
      idx = currentIndex + 1;
    }
    if (idx >= queue.length) {
      if (forceWrap && queue.length > 0) {
        idx = 0;
      } else {
        return;
      }
    }
    const t = queue[idx];
    if (!t) return;
    const blob = await getTrackBlob(t.id);
    const url = blob ? URL.createObjectURL(blob) : getStreamUrl(t.id);
    setCurrentTrack(t);
    setStreamUrl(url);
    setIsPlaying(true);
    setCurrentIndex(idx);
    setInitialSeek(undefined);
  }, [currentIndex, queue, isShuffle, pickShuffleIndex]);

  // ── Queue management ─────────────────────────────────────────────
  const handleJumpToQueue = useCallback(async (index: number) => {
    const t = queue[index];
    if (!t) return;
    const blob = await getTrackBlob(t.id);
    const url = blob ? URL.createObjectURL(blob) : getStreamUrl(t.id);
    setCurrentTrack(t);
    setStreamUrl(url);
    setIsPlaying(true);
    setCurrentIndex(index);
    setInitialSeek(undefined);
  }, [queue]);

  const handleRemoveFromQueue = useCallback((index: number) => {
    setQueue(prev => {
      const next = [...prev];
      next.splice(index, 1);
      // Adjust currentIndex
      if (index < currentIndex) {
        setCurrentIndex(c => c - 1);
      } else if (index === currentIndex && next.length > 0) {
        const newIdx = Math.min(index, next.length - 1);
        setCurrentIndex(newIdx);
        const t = next[newIdx];
        if (t) {
          getTrackBlob(t.id).then(blob => {
            setStreamUrl(blob ? URL.createObjectURL(blob) : getStreamUrl(t.id));
            setCurrentTrack(t);
          });
        }
      }
      return next;
    });
  }, [currentIndex]);

  const handleReorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      // Update currentIndex to follow the current track
      if (fromIndex === currentIndex) {
        setCurrentIndex(toIndex);
      } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
        setCurrentIndex(c => c - 1);
      } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
        setCurrentIndex(c => c + 1);
      }
      return next;
    });
  }, [currentIndex]);

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    setSidebarOpen(false);
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'search':
        return (
          <SearchPanel
            userId={user ? user.id : null}
            playlists={playlists}
            followedArtists={followedArtists}
            onRefreshFollowedArtists={fetchUserFollowedArtists}
            onRefreshPlaylists={fetchUserPlaylists}
          />
        );
      case 'discover':
        return <DiscoverPage userId={user ? user.id : null} />;

      case 'playlists':
        return (
          <PlaylistsPanel
            userId={user ? user.id : null}
            onPlayTrack={playTrack}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        );

      case 'artists':
        return (
          <ArtistsPanel
            userId={user ? user.id : null}
            onPlayTrack={playTrack}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        );
      case 'queue':
        return <LibraryPanel userId={user ? user.id : null} />;
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
        return (
          <SearchPanel
            userId={user ? user.id : null}
            playlists={playlists}
            followedArtists={followedArtists}
            onRefreshFollowedArtists={fetchUserFollowedArtists}
            onRefreshPlaylists={fetchUserPlaylists}
          />
        );
    }
  };

  const gradients: Record<string, string> = {
    search:    'linear-gradient(180deg, rgba(28,65,46,0.9) 0%, rgba(18,18,18,0) 100%)',
    discover:  'linear-gradient(180deg, rgba(20,40,80,0.9) 0%, rgba(18,18,18,0) 100%)',
    playlists: 'linear-gradient(180deg, rgba(74,40,80,0.8) 0%, rgba(18,18,18,0) 100%)',
    artists:   'linear-gradient(180deg, rgba(30,70,80,0.8) 0%, rgba(18,18,18,0) 100%)',
    queue:     'linear-gradient(180deg, rgba(30,50,90,0.8) 0%, rgba(18,18,18,0) 100%)',
    history:   'linear-gradient(180deg, rgba(70,40,80,0.8) 0%, rgba(18,18,18,0) 100%)',
    settings:  'linear-gradient(180deg, rgba(40,40,40,0.8) 0%, rgba(18,18,18,0) 100%)',
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
          <Sidebar
            currentTab={currentTab}
            onTabChange={handleTabChange}
            user={user}
            onOpenAuth={() => setAuthModalOpen(true)}
            onLogout={handleLogout}
          />
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
          <Sidebar
            currentTab={currentTab}
            onTabChange={handleTabChange}
            user={user}
            onOpenAuth={() => setAuthModalOpen(true)}
            onLogout={handleLogout}
          />
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
          <div className="flex lg:hidden items-center gap-3 px-4 pt-4 pb-2 relative z-10">
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

        {/* ── Queue Panel (slide in from right) ── */}
        {showQueuePanel && currentTrack && (
          <div className="hidden lg:block w-[320px] shrink-0 h-full">
            <QueuePanel
              queue={queue}
              currentIndex={currentIndex}
              onClose={() => setShowQueuePanel(false)}
              onJumpTo={handleJumpToQueue}
              onRemove={handleRemoveFromQueue}
              onReorder={handleReorderQueue}
            />
          </div>
        )}
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
        isShuffle={isShuffle}
        onShuffleChange={setIsShuffle}
        onQueuePanelToggle={() => setShowQueuePanel(p => !p)}
        showQueuePanel={showQueuePanel}
        userId={user?.id}
        initialSeek={initialSeek}
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

      {/* Auth Modal Overlay */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={() => {
          fetchUserPlaylists();
          fetchUserFollowedArtists();
        }}
      />
    </PlayerContext.Provider>
  );
}

export default App;
