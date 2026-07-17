import React, { useState, useContext, useEffect } from 'react';
import {
  Search as SearchIcon, Download, Loader2, Music,
  Disc3, Wand2, Play, Pause, FolderHeart, Plus,
  Users, ListMusic, Radio,
} from 'lucide-react';
import { searchSpotify, downloadTrackWeb, getStreamUrl, getArtistTopTracks, getRadio } from '../lib/api';
import type { SearchResult } from '../lib/api';
import { PlayerContext } from '../App';
import { saveDownloadedTrack } from '../lib/offline';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { LikeButton } from './LikeButton';

interface SearchPanelProps {
  userId: string | null;
  playlists: Array<{ id: string; name: string }>;
  followedArtists: Set<string>;
  onRefreshFollowedArtists: () => void;
  onRefreshPlaylists: () => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  userId,
  playlists,
  followedArtists,
  onRefreshFollowedArtists,
  onRefreshPlaylists
}) => {
  const { playTrack, currentTrack, isPlaying } = useContext(PlayerContext);
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('track');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState<Record<string, boolean>>({});
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [openPlaylistMenuId, setOpenPlaylistMenuId] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await searchSpotify(query.trim(), searchType);
      setResults(data || []);
    } catch (error: any) {
      console.error('Search error:', error);
      toast.error(error.message || 'Search failed. Please check your connection.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFollowArtist = async (artistName: string) => {
    if (!userId) return;

    try {
      if (followedArtists.has(artistName)) {
        const { error } = await supabase
          .from('followed_artists')
          .delete()
          .eq('artist_name', artistName);

        if (error) throw error;
        toast.success(`Unfollowed ${artistName}`);
      } else {
        const { error } = await supabase
          .from('followed_artists')
          .insert([{ artist_name: artistName, user_id: userId }]);

        if (error) throw error;
        toast.success(`Following ${artistName}`);
      }
      onRefreshFollowedArtists();
    } catch (err: any) {
      toast.error('Operation failed. Please try again.');
    }
  };

  const handleAddToPlaylist = async (playlistId: string, track: SearchResult) => {
    setOpenPlaylistMenuId(null);
    try {
      const { error } = await supabase
        .from('playlist_tracks')
        .insert([{
          playlist_id: playlistId,
          track_id: track.id,
          track_name: track.name,
          track_artists: track.artists,
          track_cover: track.cover || '',
          track_album: track.album || ''
        }]);

      if (error) {
        if (error.code === '23505') {
          toast.info('Song is already in this playlist!');
          return;
        }
        throw error;
      }
      toast.success(`Added "${track.name}" to playlist!`);
    } catch (err: any) {
      toast.error('Failed to add track to playlist');
    }
  };

  const handleDownload = async (track: SearchResult) => {
    if (downloadingIds[track.id]) return;
    setDownloadingIds(prev => ({ ...prev, [track.id]: true }));
    try {
      const blob = await downloadTrackWeb(track.id);
      await saveDownloadedTrack(track, blob);
      setDownloadedIds(prev => new Set([...prev, track.id]));
      toast.success("Saved to Library for offline playback!");
    } catch (error: any) {
      console.error('Download failed:', error);
      toast.error(error.message || "Download failed");
    } finally {
      setDownloadingIds(prev => ({ ...prev, [track.id]: false }));
    }
  };

  const handlePlay = (item: SearchResult, index: number) => {
    // Only track-type results are directly playable
    if (item.type && item.type !== 'track') return;
    const url = getStreamUrl(item.id);
    // Filter queue to only playable tracks
    const playableQueue = results.filter(r => !r.type || r.type === 'track');
    const playableIndex = playableQueue.findIndex(r => r.id === item.id);
    playTrack(item, url, playableQueue, playableIndex >= 0 ? playableIndex : 0);
  };

  const handleLoadArtistTracks = async (artist: SearchResult) => {
    try {
      toast.loading(`Loading top tracks for ${artist.name}...`, { id: 'artist-load' });
      const { tracks, artist_name } = await getArtistTopTracks(artist.id);
      if (tracks.length === 0) { toast.error('No tracks found', { id: 'artist-load' }); return; }
      toast.success(`Loaded ${tracks.length} tracks from ${artist_name}`, { id: 'artist-load' });
      setResults(tracks);
      setSearchType('track');
    } catch {
      toast.error('Failed to load artist tracks', { id: 'artist-load' });
    }
  };

  const handleStartRadio = async (track: SearchResult) => {
    try {
      toast.loading('Starting radio...', { id: 'radio-load' });
      const radioTracks = await getRadio(track.id);
      if (radioTracks.length === 0) { toast.error('No radio tracks found', { id: 'radio-load' }); return; }
      toast.success(`Radio: ${radioTracks.length} tracks`, { id: 'radio-load' });
      const url = getStreamUrl(radioTracks[0].id);
      playTrack(radioTracks[0], url, radioTracks, 0);
    } catch {
      toast.error('Could not start radio', { id: 'radio-load' });
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full flex flex-col pb-12">

      {/* ── Sticky header ─────────────────────────────── */}
      <div
        className="sticky top-0 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8 pt-5 pb-4 mb-4"
        style={{
          background: 'rgba(18,18,18,0.94)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="mb-4">
          <h1 className="text-2xl font-black text-white tracking-tight leading-none mb-0.5">
            Search & Download
          </h1>
          <p className="text-xs" style={{ color: 'var(--sp-subdued)' }}>
            Find any track and download in lossless FLAC quality
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-3xl">
          <div className="relative flex-1">
            <SearchIcon
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
              style={{ color: 'var(--sp-muted)' }}
            />
            <input
              id="search-input"
              type="text"
              placeholder="What do you want to download?"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="sp-search-input"
              autoComplete="off"
            />
          </div>

          <div className="flex gap-2 shrink-0">
            <div
              className="relative flex items-center gap-2 px-4 rounded-full"
              style={{ background: '#242424' }}
            >
              {searchType === 'track' && <Music className="w-4 h-4 shrink-0" style={{ color: 'var(--sp-subdued)' }} />}
              {searchType === 'album' && <Disc3 className="w-4 h-4 shrink-0" style={{ color: 'var(--sp-subdued)' }} />}
              {searchType === 'artist' && <Users className="w-4 h-4 shrink-0" style={{ color: 'var(--sp-subdued)' }} />}
              {searchType === 'playlist' && <ListMusic className="w-4 h-4 shrink-0" style={{ color: 'var(--sp-subdued)' }} />}
              <select
                value={searchType}
                onChange={e => { setSearchType(e.target.value); setResults([]); setHasSearched(false); }}
                className="bg-transparent text-sm font-bold text-white outline-none appearance-none cursor-pointer pr-2 py-3"
              >
                <option value="track" style={{ background: '#242424' }}>Tracks</option>
                <option value="album" style={{ background: '#242424' }}>Albums</option>
                <option value="artist" style={{ background: '#242424' }}>Artists</option>
                <option value="playlist" style={{ background: '#242424' }}>Playlists</option>
              </select>
            </div>

            <button
              type="submit"
              id="search-submit"
              disabled={loading || !query.trim()}
              className="sp-btn-primary"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <><Wand2 className="w-4 h-4" />Search</>
              }
            </button>
          </div>
        </form>
      </div>

      {/* ── Column headers ─────────────────────────────── */}
      {results.length > 0 && !loading && (
        <div
          className="grid items-center gap-2 sm:gap-4 px-2 sm:px-4 py-2 text-xs font-bold uppercase tracking-widest border-b mb-1 animate-fade-in grid-cols-[2.5rem_1fr_auto] sm:grid-cols-[2.5rem_1fr_4rem_10rem]"
          style={{
            color: 'var(--sp-subdued)',
            borderColor: 'var(--sp-border)',
          }}
        >
          <div className="text-center">#</div>
          <div>Title</div>
          <div className="text-right hidden sm:block">Duration</div>
          <div className="text-right">Actions</div>
        </div>
      )}

      {/* ── Results list ─────────────────────────────── */}
      <div className="flex flex-col gap-0">
        {results.map((item, index) => {
          const isCurrentlyPlaying = currentTrack?.id === item.id && isPlaying;
          const isCurrentTrack = currentTrack?.id === item.id;
          const isDownloading = !!downloadingIds[item.id];
          const isDownloaded = downloadedIds.has(item.id);

          return (
            <div
              key={item.id}
              id={`track-${item.id}`}
              className="sp-track-row group animate-fade-in grid-cols-[2.5rem_1fr_auto] sm:grid-cols-[2.5rem_1fr_4rem_10rem]"
              style={{
                display: 'grid',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.375rem 0.5rem',
                borderRadius: 6,
                animationDelay: `${Math.min(index * 25, 400)}ms`,
                background: isCurrentTrack ? 'rgba(29,185,84,0.08)' : undefined,
              }}
            >
              {/* Row num / play icon */}
              <div className="sp-row-num-wrap flex items-center justify-center">
                <span
                  className="sp-row-num"
                  style={{ color: isCurrentTrack ? 'var(--sp-green)' : 'var(--sp-subdued)' }}
                >
                  {isCurrentlyPlaying
                    ? <span className="sp-eq-bars"><span /><span /><span /></span>
                    : index + 1
                  }
                </span>
                <span
                  className="sp-row-play"
                  onClick={() => handlePlay(item, index)}
                >
                  {isCurrentlyPlaying
                    ? <Pause className="w-4 h-4 fill-current" />
                    : <Play className="w-4 h-4 fill-current" />
                  }
                </span>
              </div>

              {/* Track info */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden">
                {item.cover ? (
                  <div className="relative flex-shrink-0 group/cover">
                    <img src={item.cover} alt="" className="w-10 h-10 rounded sp-cover" />
                    {/* Mobile play overlay on cover */}
                    <button
                      className="sm:hidden absolute inset-0 flex items-center justify-center bg-black/50 rounded opacity-0 group-hover/cover:opacity-100 transition-opacity"
                      onClick={() => handlePlay(item, index)}
                    >
                      {isCurrentlyPlaying
                        ? <Pause className="w-4 h-4 fill-white text-white" />
                        : <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                      }
                    </button>
                  </div>
                ) : (
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--sp-hover)' }}
                  >
                    <Music className="w-4 h-4" style={{ color: 'var(--sp-muted)' }} />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span
                    className="font-semibold text-sm truncate leading-snug"
                    style={{ color: isCurrentTrack ? 'var(--sp-green)' : '#fff' }}
                  >
                    {item.name}
                  </span>
                  <span className="text-xs truncate leading-snug" style={{ color: 'var(--sp-subdued)' }}>
                    {item.artists}
                    {item.album
                      ? <span className="hidden sm:inline" style={{ color: 'var(--sp-muted)' }}> · {item.album}</span>
                      : null}
                  </span>
                </div>
              </div>

              {/* Duration */}
              <div className="text-right text-sm tabular-nums hidden sm:block" style={{ color: 'var(--sp-subdued)' }}>
                {formatDuration((item as any).duration_ms)}
              </div>

              {/* Actions — context-sensitive by result type */}
              <div className="flex items-center justify-end gap-1.5">

                {/* Artist: load top tracks */}
                {item.type === 'artist' && (
                  <button
                    onClick={() => handleLoadArtistTracks(item)}
                    className="sp-action-flac-btn"
                    title="Load top tracks"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Top Tracks</span>
                  </button>
                )}

                {/* Playlist: load tracks (future feature — shows label for now) */}
                {item.type === 'playlist' && (
                  <span className="sp-action-done-badge" style={{ color: 'var(--sp-subdued)', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}>
                    <ListMusic className="w-3 h-3" />
                    <span className="hidden sm:inline">{item.album}</span>
                  </span>
                )}

                {/* Album: label + like */}
                {item.type === 'album' && (
                  <>
                    {item.year && <span className="text-xs mr-2" style={{ color: 'var(--sp-muted)' }}>{item.year}</span>}
                    <LikeButton 
                      userId={userId} 
                      itemType="album" 
                      itemId={item.id} 
                      itemName={item.name} 
                      itemCover={item.cover || ''} 
                    />
                  </>
                )}
                
                {/* Artist: like button */}
                {item.type === 'artist' && (
                  <LikeButton 
                    userId={userId} 
                    itemType="artist" 
                    itemId={item.id} 
                    itemName={item.name} 
                    itemCover={item.cover || ''} 
                  />
                )}

                {/* Track-only actions */}
                {(!item.type || item.type === 'track') && (
                  <>
                    {/* Follow Artist */}
                    {userId && (
                      <button
                        onClick={() => handleToggleFollowArtist(item.artists)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/60 transition-all shrink-0"
                        title={followedArtists.has(item.artists) ? 'Unfollow Artist' : 'Follow Artist'}
                      >
                        <FolderHeart className={`w-3.5 h-3.5 ${followedArtists.has(item.artists) ? 'fill-emerald-500 text-emerald-500' : ''}`} />
                      </button>
                    )}

                    {/* Add to Playlist */}
                    {userId && playlists.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => setOpenPlaylistMenuId(openPlaylistMenuId === item.id ? null : item.id)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/60 transition-all shrink-0"
                          title="Add to Playlist"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        {openPlaylistMenuId === item.id && (
                          <div className="absolute right-0 bottom-full mb-1 z-30 w-48 rounded-lg bg-zinc-900 border border-zinc-800 p-1 flex flex-col shadow-2xl animate-in fade-in duration-100">
                            <p className="text-[10px] uppercase font-bold text-zinc-500 px-2 py-1.5 tracking-wider border-b border-zinc-800">Add to Playlist</p>
                            {playlists.map(p => (
                              <button
                                key={p.id}
                                onClick={() => handleAddToPlaylist(p.id, item)}
                                className="text-left text-xs font-semibold text-white hover:text-black hover:bg-emerald-500 px-2 py-2 rounded transition-colors truncate"
                              >
                                {p.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Radio */}
                    <button
                      onClick={() => handleStartRadio(item)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/60 transition-all shrink-0"
                      title="Start radio"
                    >
                      <Radio className="w-3.5 h-3.5" />
                    </button>

                    {/* Play/Pause */}
                    <button
                      id={`play-${item.id}`}
                      title={isCurrentlyPlaying ? 'Pause' : 'Play'}
                      onClick={() => handlePlay(item, index)}
                      className="sp-action-play-btn"
                    >
                      {isCurrentlyPlaying
                        ? <Pause className="w-3.5 h-3.5 fill-current" />
                        : <Play className="w-3.5 h-3.5 fill-current ml-px" />
                      }
                    </button>

                    {/* Download */}
                    {isDownloaded ? (
                      <span id={`downloaded-${item.id}`} className="sp-action-done-badge">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        <span className="hidden sm:inline">Saved</span>
                      </span>
                    ) : (
                      <button
                        id={`download-${item.id}`}
                        onClick={() => handleDownload(item)}
                        disabled={isDownloading}
                        className="sp-action-flac-btn"
                        title="Download FLAC"
                      >
                        {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{isDownloading ? '…' : 'FLAC'}</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Empty / idle state ─────────────────────── */}
      {!loading && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in-scale">
          <div className="relative mb-8">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'rgba(29,185,84,0.12)' }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(29,185,84,0.2)' }}>
                <SearchIcon className="w-7 h-7" style={{ color: 'var(--sp-green)' }} />
              </div>
            </div>
            <div className="absolute inset-[-8px] rounded-full border opacity-30 animate-pulse" style={{ borderColor: 'var(--sp-green)' }} />
            <div className="absolute inset-[-18px] rounded-full border opacity-15 animate-pulse" style={{ borderColor: 'var(--sp-green)', animationDelay: '0.3s' }} />
          </div>

          <h3 className="text-white text-2xl font-bold mb-3 tracking-tight">
            {hasSearched ? 'No results found' : 'Find your favorite music'}
          </h3>
          <p className="max-w-sm text-sm leading-relaxed" style={{ color: 'var(--sp-subdued)' }}>
            {hasSearched
              ? `No results for "${query}". Try a different search term.`
              : 'Search for tracks or albums and download them in pure, lossless FLAC quality — no account required.'}
          </p>

          {!hasSearched && (
            <div className="flex flex-wrap gap-2 justify-center mt-6">
              {['Joji', 'The Weeknd', 'Taylor Swift', 'Starboy', 'Die For You'].map(s => (
                <button key={s} onClick={() => setQuery(s)} className="sp-chip text-sm">{s}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Skeleton loading ────────────────────────── */}
      {loading && (
        <div className="flex flex-col gap-1 mt-2 animate-fade-in">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid items-center gap-4 px-4 py-2.5 rounded-md grid-cols-[2.5rem_1fr_auto] sm:grid-cols-[2.5rem_1fr_4rem_10rem]"
            >
              <div className="sp-skeleton w-5 h-4 mx-auto rounded" />
              <div className="flex items-center gap-3">
                <div className="sp-skeleton w-10 h-10 rounded shrink-0" />
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="sp-skeleton h-3.5 rounded" style={{ width: `${120 + (i % 3) * 40}px` }} />
                  <div className="sp-skeleton h-3 rounded" style={{ width: `${80 + (i % 4) * 20}px` }} />
                </div>
              </div>
              <div className="sp-skeleton h-3 w-8 ml-auto rounded" />
              <div className="flex gap-2 justify-end">
                <div className="sp-skeleton h-7 w-7 rounded-full" />
                <div className="sp-skeleton h-7 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
