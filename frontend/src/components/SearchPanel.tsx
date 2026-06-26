import React, { useState, useContext } from 'react';
import { Search as SearchIcon, Download, Loader2, Music, Disc3, Wand2, Play } from 'lucide-react';
import { searchSpotify, downloadTrackWeb, getStreamUrl } from '../lib/api';
import type { SearchResult } from '../lib/api';
import { PlayerContext } from '../App';

export const SearchPanel: React.FC = () => {
  const { playTrack } = useContext(PlayerContext);
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

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full flex flex-col pb-12">

      {/* ── Sticky header: title + search form ─────────────── */}
      {/* Negative margin breaks out of the parent padding, then re-applies it
          so the sticky bar spans edge-to-edge while content stays padded */}
      <div
        className="sticky top-0 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8 pt-5 pb-4 mb-4"
        style={{
          background: 'rgba(18,18,18,0.94)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Page title */}
        <div className="mb-4">
          <h1 className="text-2xl font-black text-white tracking-tight leading-none mb-0.5">
            Search &amp; Download
          </h1>
          <p className="text-xs" style={{ color: 'var(--sp-subdued)' }}>
            Find any track or album and download in lossless FLAC quality
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-3xl">
          {/* Input */}
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
            {/* Type selector */}
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

            {/* Submit */}
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

      {/* ── Results column header ──────────────────────────── */}
      {results.length > 0 && !loading && (
        <div
          className="grid gap-2 sm:gap-4 px-2 sm:px-4 py-2 text-xs font-bold uppercase tracking-widest border-b mb-1 animate-fade-in grid-cols-[1fr_auto] sm:grid-cols-[2.5rem_1fr_5rem_9rem]"
          style={{
            color: 'var(--sp-subdued)',
            borderColor: 'var(--sp-border)',
          }}
        >
          <div className="text-center hidden sm:block">#</div>
          <div>Title</div>
          <div className="text-right hidden sm:block">Duration</div>
          <div className="text-center">Actions</div>
        </div>
      )}

      {/* ── Results list ──────────────────────────────────── */}
      <div className="flex flex-col gap-0.5">
        {results.map((item, index) => {
          const isDownloading = !!downloadingIds[item.id];
          const isDownloaded = downloadedIds.has(item.id);

          return (
              <div
              key={item.id}
              id={`track-${item.id}`}
              className="sp-track-row group animate-fade-in grid items-center gap-2 sm:gap-4 px-2 sm:px-4 py-2 hover:bg-white/5 rounded-md grid-cols-[1fr_auto] sm:grid-cols-[2.5rem_1fr_5rem_9rem]"
              style={{
                animationDelay: `${Math.min(index * 30, 400)}ms`,
              }}
            >
              {/* Row number / play icon */}
              <div className="sp-row-num-wrap hidden sm:flex">
                <span
                  className="sp-row-num"
                  style={{ color: isDownloaded ? 'var(--sp-green)' : 'var(--sp-subdued)' }}
                >
                  {index + 1}
                </span>
                <span 
                  className="sp-row-play" 
                  onClick={() => playTrack(item, `https://www.youtube.com/watch?v=${item.id}`)}
                >
                  <Play className="w-4 h-4" />
                </span>
              </div>

              {/* Track info */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden">
                {item.cover ? (
                  <img src={item.cover} alt="" className="w-10 h-10 sm:w-10 sm:h-10 rounded sp-cover flex-shrink-0" />
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
                    style={{ color: isDownloaded ? 'var(--sp-green)' : '#fff' }}
                  >
                    {item.name}
                  </span>
                  <span className="text-xs truncate leading-snug" style={{ color: 'var(--sp-subdued)' }}>
                    {item.artists}
                    {item.album ? <span className="hidden sm:inline" style={{ color: 'var(--sp-muted)' }}> · {item.album}</span> : null}
                  </span>
                </div>
              </div>

              {/* Duration */}
              <div className="text-right text-sm tabular-nums hidden sm:block" style={{ color: 'var(--sp-subdued)' }}>
                {formatDuration((item as any).duration_ms)}
              </div>

              {/* Download action */}
              <div className="sp-row-actions flex items-center justify-end gap-1 sm:gap-2">
                <button
                  title="Play Preview / Stream"
                  onClick={() => playTrack(item, `https://www.youtube.com/watch?v=${item.id}`)}
                  className="sp-btn-outline flex items-center justify-center rounded-full w-8 h-8 sm:w-8 sm:h-8 p-0 border-zinc-600 hover:border-white text-zinc-300 hover:text-white"
                >
                  <Play className="w-4 h-4 ml-0.5 fill-current" />
                </button>

                {isDownloaded ? (
                  <span
                    className="flex items-center gap-1.5 text-xs font-bold px-3 h-8 rounded-full"
                    style={{ color: 'var(--sp-green)', background: 'var(--sp-green-dim)' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                ) : (
                  <button
                    id={`download-${item.id}`}
                    onClick={() => handleDownload(item)}
                    disabled={isDownloading}
                    className="sp-btn-outline flex items-center gap-1.5 text-xs h-8 px-3"
                    style={{ letterSpacing: 'normal', textTransform: 'none' }}
                  >
                    {isDownloading ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" />…</>
                    ) : (
                      <><Download className="w-3.5 h-3.5" />FLAC</>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Empty / idle state ────────────────────────────── */}
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

      {/* ── Skeleton loading ──────────────────────────────── */}
      {loading && (
        <div className="flex flex-col gap-2 mt-2 animate-fade-in">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid items-center gap-4 px-4 py-3 rounded-md"
              style={{ gridTemplateColumns: '2.5rem 1fr 5rem 7rem' }}
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
              <div className="sp-skeleton h-7 w-16 mx-auto rounded-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
