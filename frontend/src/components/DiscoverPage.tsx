import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  Compass, TrendingUp, TrendingDown, Minus,
  Play, Pause, Loader2, ChevronRight, ChevronLeft,
  Sparkles, Radio, Disc3, Globe, RotateCw, Music,
} from 'lucide-react';
import {
  getCharts, getMoods, getMoodPlaylists, getPlaylistTracks, getRecommendations,
  type ChartTrack, type MoodCategory, type MoodPlaylist, type SearchResult,
} from '../lib/api';
import { getStreamUrl } from '../lib/api';
import { PlayerContext } from '../App';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface DiscoverPageProps {
  userId: string | null;
}

// ─── Country options ────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: 'ZZ', name: '🌍 Global' },
  { code: 'US', name: '🇺🇸 US' },
  { code: 'GB', name: '🇬🇧 UK' },
  { code: 'DE', name: '🇩🇪 Germany' },
  { code: 'FR', name: '🇫🇷 France' },
  { code: 'JP', name: '🇯🇵 Japan' },
  { code: 'KR', name: '🇰🇷 Korea' },
  { code: 'BR', name: '🇧🇷 Brazil' },
  { code: 'IN', name: '🇮🇳 India' },
  { code: 'NG', name: '🇳🇬 Nigeria' },
  { code: 'ZA', name: '🇿🇦 South Africa' },
];

// ─── Mood gradient palette (deterministic via hash) ─────────────────────────
const MOOD_GRADIENTS = [
  { from: '#0d2137', to: '#1a3d6b', accent: '#60a5fa', text: '#93c5fd' },
  { from: '#2d1000', to: '#5a2800', accent: '#f97316', text: '#fdba74' },
  { from: '#1a0d2e', to: '#3d1b69', accent: '#a855f7', text: '#c4b5fd' },
  { from: '#0d2414', to: '#1a5a2a', accent: '#22c55e', text: '#86efac' },
  { from: '#2e0d1a', to: '#5a1a35', accent: '#ec4899', text: '#f9a8d4' },
  { from: '#1a1400', to: '#3d3200', accent: '#eab308', text: '#fde047' },
  { from: '#0d1f2e', to: '#1a3d5a', accent: '#38bdf8', text: '#7dd3fc' },
  { from: '#1a0d0d', to: '#3d1a1a', accent: '#f87171', text: '#fca5a5' },
  { from: '#0d1a1a', to: '#1a3d3d', accent: '#2dd4bf', text: '#5eead4' },
  { from: '#1a1a0d', to: '#3d3d1a', accent: '#a3e635', text: '#bef264' },
];

const getMoodGradient = (name: string) => {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return MOOD_GRADIENTS[hash % MOOD_GRADIENTS.length];
};

// ─── Trend icon ──────────────────────────────────────────────────────────────
const TrendIcon: React.FC<{ trend?: string }> = ({ trend }) => {
  if (trend === 'UP')   return <TrendingUp   className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />;
  if (trend === 'DOWN') return <TrendingDown className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />;
  return <Minus className="w-3.5 h-3.5" style={{ color: '#6b7280' }} />;
};

// ─── Skeleton row ────────────────────────────────────────────────────────────
const SkeletonRow: React.FC<{ n?: number }> = ({ n = 6 }) => (
  <div className="flex flex-col gap-1">
    {Array.from({ length: n }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-2 py-2.5 rounded-lg animate-pulse">
        <div className="sp-skeleton w-6 h-4 rounded shrink-0" />
        <div className="sp-skeleton w-10 h-10 rounded-md shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="sp-skeleton h-3.5 rounded" style={{ width: `${130 + (i % 3) * 50}px` }} />
          <div className="sp-skeleton h-3 rounded" style={{ width: `${80 + (i % 2) * 30}px` }} />
        </div>
      </div>
    ))}
  </div>
);

// ─── Section header ─────────────────────────────────────────────────────────
const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ icon, title, subtitle, action }) => (
  <div className="flex items-end justify-between mb-4">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(29,185,84,0.15)' }}>
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-black text-white leading-none mb-0.5">{title}</h2>
        {subtitle && <p className="text-xs" style={{ color: 'var(--sp-subdued)' }}>{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// Main DiscoverPage component
// ═══════════════════════════════════════════════════════════════════════════
export const DiscoverPage: React.FC<DiscoverPageProps> = ({ userId }) => {
  const { playTrack, currentTrack, isPlaying } = useContext(PlayerContext);

  // ── Charts ──────────────────────────────────────────────────────
  const [chartsCountry, setChartsCountry] = useState('ZZ');
  const [chartTracks,   setChartTracks]   = useState<ChartTrack[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  // ── Moods ───────────────────────────────────────────────────────
  const [moodCategories, setMoodCategories] = useState<MoodCategory[]>([]);
  const [moodsLoading,   setMoodsLoading]   = useState(true);
  const [selectedMood,   setSelectedMood]   = useState<MoodCategory | null>(null);
  const [moodPlaylists,  setMoodPlaylists]  = useState<MoodPlaylist[]>([]);
  const [moodPlaylistsLoading, setMoodPlaylistsLoading] = useState(false);
  const [selectedPlaylist,     setSelectedPlaylist]     = useState<MoodPlaylist | null>(null);
  const [playlistTracks,       setPlaylistTracks]       = useState<SearchResult[]>([]);
  const [playlistLoading,      setPlaylistLoading]      = useState(false);
  const [playlistMeta,         setPlaylistMeta]         = useState<{ title: string; cover: string } | null>(null);
  const moodScrollRef = React.useRef<HTMLDivElement>(null);

  // ── Recommendations ─────────────────────────────────────────────
  const [recTracks, setRecTracks] = useState<SearchResult[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recRefreshing, setRecRefreshing] = useState(false);

  // ─────────────────────────────────────────────────────────────────
  // Fetch Charts
  // ─────────────────────────────────────────────────────────────────
  const fetchCharts = useCallback(async () => {
    setChartsLoading(true);
    try {
      const data = await getCharts(chartsCountry);
      setChartTracks(data.songs || []);
    } catch {
      toast.error('Charts unavailable right now');
    } finally {
      setChartsLoading(false);
    }
  }, [chartsCountry]);

  useEffect(() => { fetchCharts(); }, [fetchCharts]);

  // ─────────────────────────────────────────────────────────────────
  // Fetch Moods
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMoodsLoading(true);
    getMoods()
      .then(d => setMoodCategories(d.categories || []))
      .catch(() => {})
      .finally(() => setMoodsLoading(false));
  }, []);

  const handleMoodClick = async (mood: MoodCategory) => {
    if (selectedMood?.params === mood.params) {
      setSelectedMood(null);
      setMoodPlaylists([]);
      setSelectedPlaylist(null);
      setPlaylistTracks([]);
      return;
    }
    setSelectedMood(mood);
    setSelectedPlaylist(null);
    setPlaylistTracks([]);
    setMoodPlaylistsLoading(true);
    try {
      const data = await getMoodPlaylists(mood.params);
      setMoodPlaylists(data.playlists || []);
    } catch {
      toast.error('Could not load mood playlists');
    } finally {
      setMoodPlaylistsLoading(false);
    }
  };

  const handlePlaylistClick = async (pl: MoodPlaylist) => {
    if (selectedPlaylist?.id === pl.id) return;
    setSelectedPlaylist(pl);
    setPlaylistLoading(true);
    setPlaylistTracks([]);
    try {
      const data = await getPlaylistTracks(pl.id);
      setPlaylistTracks(data.tracks || []);
      setPlaylistMeta({ title: data.meta.title || pl.name, cover: data.meta.cover || pl.cover });
    } catch {
      toast.error('Could not load playlist tracks');
    } finally {
      setPlaylistLoading(false);
    }
  };

  const scrollMoodPlaylists = (dir: 'left' | 'right') => {
    if (!moodScrollRef.current) return;
    moodScrollRef.current.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' });
  };

  // ─────────────────────────────────────────────────────────────────
  // Fetch Recommendations from listening history
  // ─────────────────────────────────────────────────────────────────
  const fetchRecommendations = useCallback(async (refresh = false) => {
    if (!userId) return;
    if (refresh) setRecRefreshing(true);
    else setRecLoading(true);
    try {
      const { data } = await supabase
        .from('listening_history')
        .select('track_id')
        .eq('user_id', userId)
        .order('played_at', { ascending: false })
        .limit(20);
      const seedIds = [...new Set((data || []).map(r => r.track_id))].slice(0, 5);
      if (seedIds.length === 0) {
        setRecTracks([]);
        return;
      }
      const res = await getRecommendations(seedIds);
      setRecTracks(res.tracks || []);
    } catch {
      // Silent fail — recommendations are optional
    } finally {
      setRecLoading(false);
      setRecRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { fetchRecommendations(); }, [fetchRecommendations]);

  // ─────────────────────────────────────────────────────────────────
  // Play helpers
  // ─────────────────────────────────────────────────────────────────
  const playFromList = (tracks: SearchResult[], index: number) => {
    const t = tracks[index];
    if (!t) return;
    playTrack(t, getStreamUrl(t.id), tracks, index);
  };

  const playAllCharts = () => {
    if (chartTracks.length === 0) return;
    playFromList(chartTracks, 0);
    toast.success(`Playing top ${chartTracks.length} tracks`);
  };

  const playAllPlaylist = () => {
    if (playlistTracks.length === 0) return;
    playFromList(playlistTracks, 0);
    toast.success(`Playing ${playlistMeta?.title || 'playlist'}`);
  };

  // ─────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────
  const renderTrackRow = (
    track: ChartTrack,
    index: number,
    list: SearchResult[],
    showRank = false,
  ) => {
    const isActive  = currentTrack?.id === track.id;
    const isNowPlaying = isActive && isPlaying;
    return (
      <div
        key={`${track.id}-${index}`}
        className="discover-track-row group"
        style={{ background: isActive ? 'rgba(29,185,84,0.07)' : undefined }}
        onClick={() => playFromList(list, index)}
      >
        {/* Rank / index */}
        <div className="w-8 flex items-center justify-center shrink-0">
          {showRank && track.rank ? (
            <span className="text-base font-black tabular-nums" style={{ color: isActive ? 'var(--sp-green)' : 'var(--sp-muted)' }}>
              {isNowPlaying
                ? <span className="sp-eq-bars"><span /><span /><span /></span>
                : track.rank
              }
            </span>
          ) : (
            <span className="text-sm tabular-nums" style={{ color: isActive ? 'var(--sp-green)' : 'var(--sp-muted)' }}>
              {isNowPlaying ? <span className="sp-eq-bars"><span /><span /><span /></span> : index + 1}
            </span>
          )}
        </div>

        {/* Cover */}
        {track.cover
          ? <img src={track.cover} alt="" className="w-10 h-10 rounded-md object-cover shrink-0" />
          : <div className="w-10 h-10 rounded-md shrink-0 flex items-center justify-center" style={{ background: 'var(--sp-hover)' }}><Music className="w-4 h-4" style={{ color: 'var(--sp-muted)' }} /></div>
        }

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate leading-snug" style={{ color: isActive ? 'var(--sp-green)' : '#fff' }}>
            {track.name}
          </p>
          <p className="text-xs truncate leading-snug" style={{ color: 'var(--sp-subdued)' }}>{track.artists}</p>
        </div>

        {/* Trend + play */}
        {showRank && (
          <div className="shrink-0 opacity-60">
            <TrendIcon trend={track.trend} />
          </div>
        )}
        <button
          className="shrink-0 sp-icon-btn opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => { e.stopPropagation(); playFromList(list, index); }}
        >
          {isNowPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-px" />}
        </button>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="w-full flex flex-col gap-10 pb-16">

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-center gap-4 pt-2">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, rgba(29,185,84,0.25), rgba(29,185,84,0.08))', border: '1px solid rgba(29,185,84,0.3)' }}>
          <Compass className="w-7 h-7" style={{ color: 'var(--sp-green)' }} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-1">Discover</h1>
          <p className="text-sm" style={{ color: 'var(--sp-subdued)' }}>Charts, moods, and music made for you</p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          SECTION 1: Charts
      ════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          icon={<TrendingUp className="w-5 h-5" style={{ color: 'var(--sp-green)' }} />}
          title="Trending Now"
          subtitle="Top tracks on the charts"
          action={
            <div className="flex items-center gap-2">
              <select
                value={chartsCountry}
                onChange={e => setChartsCountry(e.target.value)}
                className="text-xs font-bold text-white bg-transparent outline-none cursor-pointer border border-white/10 rounded-lg px-3 py-1.5 hover:border-white/30 transition-colors"
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code} style={{ background: '#282828' }}>{c.name}</option>
                ))}
              </select>
              {chartTracks.length > 0 && (
                <button
                  className="sp-btn-primary text-xs px-4 py-2"
                  onClick={playAllCharts}
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Play All
                </button>
              )}
            </div>
          }
        />

        {chartsLoading ? <SkeletonRow n={8} /> : (
          <div className="flex flex-col gap-0">
            {chartTracks.length === 0 ? (
              <div className="py-10 text-center" style={{ color: 'var(--sp-subdued)' }}>
                <Globe className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Charts unavailable for this region</p>
              </div>
            ) : (
              chartTracks.map((t, i) => renderTrackRow(t, i, chartTracks, true))
            )}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════
          SECTION 2: Browse by Mood
      ════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          icon={<Sparkles className="w-5 h-5" style={{ color: 'var(--sp-green)' }} />}
          title="Browse by Mood"
          subtitle="Find music that matches how you feel"
        />

        {moodsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="sp-skeleton rounded-xl h-20 animate-pulse" />
            ))}
          </div>
        ) : moodCategories.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: 'var(--sp-subdued)' }}>Mood categories unavailable</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {moodCategories.map(mood => {
              const g = getMoodGradient(mood.title);
              const isSelected = selectedMood?.params === mood.params;
              return (
                <button
                  key={mood.params}
                  className="discover-mood-card group"
                  style={{
                    background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
                    border: isSelected ? `2px solid ${g.accent}` : '1px solid rgba(255,255,255,0.07)',
                    boxShadow: isSelected ? `0 0 20px ${g.accent}40` : 'none',
                  }}
                  onClick={() => handleMoodClick(mood)}
                >
                  {mood.cover && (
                    <img
                      src={mood.cover} alt=""
                      className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-20 group-hover:opacity-30 transition-opacity"
                    />
                  )}
                  <span className="relative z-10 text-sm font-bold leading-tight text-left" style={{ color: g.text }}>
                    {mood.title}
                  </span>
                  <span className="relative z-10 text-[10px] mt-1" style={{ color: `${g.text}80` }}>
                    {mood.section}
                  </span>
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: g.accent }}>
                      <svg width="8" height="8" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="black" strokeWidth="2" strokeLinecap="round" /></svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Mood Playlists carousel */}
        {selectedMood && (
          <div className="mt-5 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold" style={{ color: 'var(--sp-subdued)' }}>
                Playlists for <span className="text-white">{selectedMood.title}</span>
              </p>
              <div className="flex gap-1">
                <button onClick={() => scrollMoodPlaylists('left')} className="sp-icon-btn w-7 h-7"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => scrollMoodPlaylists('right')} className="sp-icon-btn w-7 h-7"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>

            {moodPlaylistsLoading ? (
              <div className="flex gap-3">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="sp-skeleton rounded-xl shrink-0 w-36 h-36 animate-pulse" />)}
              </div>
            ) : (
              <div ref={moodScrollRef} className="flex gap-3 overflow-x-auto pb-2 discover-h-scroll">
                {moodPlaylists.map(pl => {
                  const isSelected = selectedPlaylist?.id === pl.id;
                  return (
                    <button
                      key={pl.id}
                      className="discover-playlist-card shrink-0 group"
                      style={{ border: isSelected ? '2px solid var(--sp-green)' : '1px solid rgba(255,255,255,0.07)' }}
                      onClick={() => handlePlaylistClick(pl)}
                    >
                      {pl.cover
                        ? <img src={pl.cover} alt="" className="w-full aspect-square object-cover rounded-lg mb-2" />
                        : <div className="w-full aspect-square rounded-lg mb-2 flex items-center justify-center" style={{ background: 'var(--sp-hover)' }}><Disc3 className="w-8 h-8 opacity-30" /></div>
                      }
                      <p className="text-xs font-semibold text-white truncate w-full text-left leading-tight">{pl.name}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Playlist tracks */}
        {selectedPlaylist && (
          <div className="mt-5 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {playlistMeta?.cover && (
                  <img src={playlistMeta.cover} alt="" className="w-12 h-12 rounded-lg object-cover" />
                )}
                <p className="text-sm font-bold text-white">{playlistMeta?.title || selectedPlaylist.name}</p>
              </div>
              {playlistTracks.length > 0 && (
                <button className="sp-btn-primary text-xs px-4 py-2" onClick={playAllPlaylist}>
                  <Play className="w-3.5 h-3.5 fill-current" /> Play All
                </button>
              )}
            </div>
            {playlistLoading ? <SkeletonRow n={6} /> : (
              <div className="flex flex-col gap-0">
                {playlistTracks.map((t, i) => renderTrackRow(t, i, playlistTracks))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════
          SECTION 3: Made For You (Recommendations)
      ════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          icon={<Radio className="w-5 h-5" style={{ color: 'var(--sp-green)' }} />}
          title="Made For You"
          subtitle={userId ? "Based on your listening history" : "Sign in to get personal recommendations"}
          action={
            userId && recTracks.length > 0 ? (
              <button
                className="sp-icon-btn gap-1.5 text-xs font-bold"
                onClick={() => fetchRecommendations(true)}
                disabled={recRefreshing}
                style={{ color: 'var(--sp-subdued)' }}
                title="Refresh recommendations"
              >
                <RotateCw className={`w-4 h-4 ${recRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            ) : null
          }
        />

        {!userId ? (
          <div className="py-10 text-center rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Radio className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-semibold text-white mb-1">Sign in for Recommendations</p>
            <p className="text-xs" style={{ color: 'var(--sp-subdued)' }}>We'll build a mix based on your taste</p>
          </div>
        ) : recLoading ? (
          <SkeletonRow n={6} />
        ) : recTracks.length === 0 ? (
          <div className="py-10 text-center rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Music className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-semibold text-white mb-1">Play some music first</p>
            <p className="text-xs" style={{ color: 'var(--sp-subdued)' }}>
              Listen to a few songs and we'll generate your personal mix
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0">
            {recTracks.map((t, i) => renderTrackRow(t, i, recTracks))}
          </div>
        )}
      </section>

    </div>
  );
};
