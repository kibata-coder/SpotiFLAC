import React, { useState, useContext } from 'react';
import {
  Search as SearchIcon, Download, Loader2, Music,
  Disc3, Wand2, Play, Pause,
} from 'lucide-react';
import { searchSpotify, downloadTrackWeb } from '../lib/api';
import type { SearchResult } from '../lib/api';
import { PlayerContext } from '../App';

export const SearchPanel: React.FC = () => {
  const { playTrack, currentTrack, isPlaying } = useContext(PlayerContext);
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('track');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState<Record<string, boolean>>({});
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await searchSpotify(query, searchType);
      setResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed. Ensure your backend is reachable.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (track: SearchResult) => {
    if (downloadingIds[track.id]) return;
    setDownloadingIds(prev => ({ ...prev, [track.id]: true }));
    try {
      await downloadTrackWeb(track.id, 'tidal', track.name);
      setDownloadedIds(prev => new Set([...prev, track.id]));
    } catch (error: any) {
      console.error('Download failed:', error);
      alert(error.message || 'Failed to process and stream file from server.');
    } finally {
      setDownloadingIds(prev => ({ ...prev, [track.id]: false }));
    }
  };

  const handlePlay = (item: SearchResult, index: number) => {
    playTrack(
      item,
      `https://www.youtube.com/watch?v=${item.id}`,
      results,
      index,
    );
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
              {searchType === 'track'
                ? <Music className="w-4 h-4 shrink-0" style={{ color: 'var(--sp-subdued)' }} />
                : <Disc3 className="w-4 h-4 shrink-0" style={{ color: 'var(--sp-subdued)' }} />}
              <select
                value={searchType}
                onChange={e => setSearchType(e.target.value)}
                className="bg-transparent text-sm font-bold text-white outline-none appearance-none cursor-pointer pr-2 py-3"
              >
                <option value="track" style={{ background: '#242424' }}>Tracks</option>
                <option value="album" style={{ background: '#242424' }}>Albums</option>
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
          className="grid items-center gap-2 sm:gap-4 px-2 sm:px-4 py-2 text-xs font-bold uppercase tracking-widest border-b mb-1 animate-fade-in"
          style={{
            gridTemplateColumns: '2.5rem 1fr 4rem 10rem',
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
              className="sp-track-row group animate-fade-in"
              style={{
                display: 'grid',
                gridTemplateColumns: '2.5rem 1fr 4rem 10rem',
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

              {/* Actions — ALWAYS VISIBLE */}
              <div className="flex items-center justify-end gap-1.5">
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

                {/* FLAC Download */}
                {isDownloaded ? (
                  <span
                    id={`downloaded-${item.id}`}
                    className="sp-action-done-badge"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
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
                    {isDownloading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Download className="w-3.5 h-3.5" />
                    }
                    <span className="hidden sm:inline">{isDownloading ? '…' : 'FLAC'}</span>
                  </button>
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
              className="grid items-center gap-4 px-4 py-2.5 rounded-md"
              style={{ gridTemplateColumns: '2.5rem 1fr 4rem 10rem' }}
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
