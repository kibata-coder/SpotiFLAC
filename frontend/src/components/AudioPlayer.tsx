import React, { useRef, useState, useEffect, useCallback } from 'react';
import ReactPlayer from 'react-player';
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Volume1,
  Shuffle, Repeat, Repeat1,
  Heart, Download, Loader2,
  Mic2, Maximize2, ListMusic,
  ChevronDown, X,
} from 'lucide-react';
import type { SearchResult } from '../lib/api';
import { downloadTrackWeb, getLyrics } from '../lib/api';

interface AudioPlayerProps {
  currentTrack: SearchResult | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  streamUrl: string | null;
  queue?: SearchResult[];
  currentIndex?: number;
  onPrev?: () => void;
  onNext?: () => void;
}

type RepeatMode = 'none' | 'all' | 'one';

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  currentTrack,
  isPlaying,
  onPlayPause,
  streamUrl,
  queue = [],
  currentIndex = -1,
  onPrev,
  onNext,
}) => {
  const playerRef = useRef<ReactPlayer>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [isLiked, setIsLiked] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const [downloadingFlac, setDownloadingFlac] = useState(false);
  const [downloadedFlac, setDownloadedFlac] = useState(false);
  const [lyricsText, setLyricsText] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Reset state on track change
  useEffect(() => {
    setProgress(0);
    setDuration(0);
    setIsLiked(false);
    setDownloadedFlac(false);
    setLyricsText(null);
  }, [currentTrack?.id]);

  // Fetch lyrics when the panel is opened
  useEffect(() => {
    if (currentTrack && showLyrics && lyricsText === null && !lyricsLoading) {
      setLyricsLoading(true);
      getLyrics(currentTrack.id)
        .then(setLyricsText)
        .catch(() => setLyricsText('')) // empty string means unavailable
        .finally(() => setLyricsLoading(false));
    }
  }, [currentTrack?.id, showLyrics, lyricsText, lyricsLoading]);

  const handleSeekClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = ratio * duration;
    playerRef.current?.seekTo(time, 'seconds');
    setProgress(time);
  }, [duration]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    setIsMuted(m => !m);
    if (isMuted && volume === 0) setVolume(0.5);
  };

  const cycleRepeat = () => {
    setRepeatMode(m => m === 'none' ? 'all' : m === 'all' ? 'one' : 'none');
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPct = duration ? (progress / duration) * 100 : 0;
  const volumeIcon = isMuted || volume === 0
    ? <VolumeX className="w-4 h-4" />
    : volume < 0.4
      ? <Volume1 className="w-4 h-4" />
      : <Volume2 className="w-4 h-4" />;

  const hasPrev = onPrev && (currentIndex > 0 || repeatMode !== 'none');
  const hasNext = onNext && (currentIndex < queue.length - 1 || repeatMode !== 'none');

  const handleFlacDownload = async () => {
    if (!currentTrack || downloadingFlac) return;
    setDownloadingFlac(true);
    try {
      await downloadTrackWeb(currentTrack.id, currentTrack.name);
      setDownloadedFlac(true);
    } catch (err: any) {
      console.error('FLAC download failed:', err.message || err);
    } finally {
      setDownloadingFlac(false);
    }
  };

  const handleEnded = () => {
    if (repeatMode === 'one') {
      playerRef.current?.seekTo(0);
      return;
    }
    if (hasNext) onNext?.();
    else if (repeatMode === 'all' && queue.length > 0) onPrev?.(); // wrap
    else onPlayPause();
  };

  if (!currentTrack) return null;

  const lyricsLines = lyricsText ? lyricsText.split('\n') : [];
  const activeLineIndex = duration > 0 ? Math.min(Math.floor((progress / duration) * lyricsLines.length), lyricsLines.length - 1) : 0;

  useEffect(() => {
    if (showLyrics && activeLineIndex >= 0) {
      const activeEl = document.getElementById(`lyric-line-${activeLineIndex}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIndex, showLyrics]);

  /* ──────────────── LYRICS OVERLAY ──────────────── */
  const lyricsPanelContent = (
    <div className="sp-lyrics-overlay">
      <div className="sp-lyrics-header">
        <button className="sp-lyrics-close" onClick={() => setShowLyrics(false)}>
          <ChevronDown className="w-6 h-6" />
        </button>
        <span className="sp-lyrics-title">Lyrics</span>
        <span />
      </div>
      <div className="sp-lyrics-body">
        <div className="sp-lyrics-cover-wrap">
          {currentTrack.cover
            ? <img src={currentTrack.cover} alt="" className="sp-lyrics-cover" />
            : <div className="sp-lyrics-cover-placeholder"><span>♪</span></div>
          }
        </div>
        <p className="sp-lyrics-track-name">{currentTrack.name}</p>
        <p className="sp-lyrics-artist">{currentTrack.artists}</p>
        {lyricsLoading ? (
          <div className="sp-lyrics-placeholder-box">
             <Loader2 className="w-8 h-8 mb-3 opacity-50 animate-spin" />
             <p className="text-white/60 text-sm">Fetching lyrics...</p>
          </div>
        ) : lyricsText ? (
          <div className="mt-8 text-center text-lg whitespace-pre-wrap leading-relaxed max-w-2xl mx-auto px-4 pb-40">
             {lyricsLines.map((line, idx) => (
                <div
                  key={idx}
                  id={`lyric-line-${idx}`}
                  className={`transition-all duration-500 min-h-[1.75rem] mb-2 ${idx === activeLineIndex ? 'text-white text-2xl scale-105 font-bold drop-shadow-lg' : 'text-white/40'}`}
                >
                  {line}
                </div>
             ))}
          </div>
        ) : (
          <div className="sp-lyrics-placeholder-box">
            <Mic2 className="w-8 h-8 mb-3 opacity-30" />
            <p className="text-white/60 text-sm text-center">
              Lyrics aren't available for this track.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Lyrics full-screen overlay */}
      {showLyrics && lyricsPanelContent}

      {/* ── Player bar ────────────────────────────────────────── */}
      <div className="sp-player-bar">
        {/* Hidden ReactPlayer */}
        {streamUrl && (
          <ReactPlayer
            ref={playerRef}
            url={streamUrl}
            playing={isPlaying}
            volume={isMuted ? 0 : volume}
            muted={false}
            onProgress={({ playedSeconds }) => {
              if (!isDragging) setProgress(playedSeconds);
            }}
            onDuration={d => setDuration(d)}
            onEnded={handleEnded}
            width="0" height="0"
            config={{ youtube: { playerVars: { showinfo: 0, controls: 0 } } }}
            style={{ display: 'none' }}
          />
        )}

        {/* ── PROGRESS BAR ── */}
        <div className="sp-progress-wrap">
          <span className="sp-time">{formatTime(progress)}</span>
          <div
            ref={progressBarRef}
            className="sp-progress-track group"
            onClick={handleSeekClick}
          >
            <div className="sp-progress-bg" />
            <div className="sp-progress-fill" style={{ width: `${progressPct}%` }} />
            <div className="sp-progress-thumb" style={{ left: `${progressPct}%` }} />
          </div>
          <span className="sp-time">{formatTime(duration)}</span>
        </div>

        {/* ── MAIN CONTROLS ROW ── */}
        <div className="sp-player-body">

          {/* LEFT: Track info */}
          <div className="sp-player-left">
            <div className="sp-player-cover-wrap">
              {currentTrack.cover
                ? <img src={currentTrack.cover} alt="Cover" className="sp-player-cover" />
                : <div className="sp-player-cover-empty"><span>♪</span></div>
              }
            </div>
            <div className="sp-player-track-info">
              <p className="sp-player-track-name">{currentTrack.name}</p>
              <p className="sp-player-artist">{currentTrack.artists}</p>
            </div>
            {/* Like */}
            <button
              className={`sp-icon-btn sp-like-btn ${isLiked ? 'active' : ''}`}
              onClick={() => setIsLiked(l => !l)}
              title="Save to Your Library"
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* CENTER: Playback controls */}
          <div className="sp-player-center">
            {/* Shuffle */}
            <button
              className={`sp-icon-btn ${isShuffle ? 'active' : ''}`}
              onClick={() => setIsShuffle(s => !s)}
              title="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            {/* Prev */}
            <button
              className={`sp-icon-btn sp-skip-btn ${!hasPrev ? 'disabled' : ''}`}
              onClick={onPrev}
              title="Previous"
              disabled={!hasPrev}
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            {/* Play / Pause — big green circle */}
            <button
              id="player-play-pause"
              className="sp-play-btn"
              onClick={onPlayPause}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying
                ? <Pause className="w-5 h-5 fill-current text-black" />
                : <Play className="w-5 h-5 fill-current text-black ml-0.5" />
              }
            </button>

            {/* Next */}
            <button
              className={`sp-icon-btn sp-skip-btn ${!hasNext ? 'disabled' : ''}`}
              onClick={onNext}
              title="Next"
              disabled={!hasNext}
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            {/* Repeat */}
            <button
              className={`sp-icon-btn ${repeatMode !== 'none' ? 'active' : ''}`}
              onClick={cycleRepeat}
              title="Repeat"
            >
              {repeatMode === 'one'
                ? <Repeat1 className="w-4 h-4" />
                : <Repeat className="w-4 h-4" />
              }
            </button>
          </div>

          {/* RIGHT: Side controls */}
          <div className="sp-player-right">
            {/* FLAC Download */}
            <button
              id="player-download-flac"
              className={`sp-flac-btn ${downloadedFlac ? 'done' : ''}`}
              onClick={handleFlacDownload}
              disabled={downloadingFlac}
              title="Download FLAC"
            >
              {downloadingFlac
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : downloadedFlac
                  ? <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  : <Download className="w-3.5 h-3.5" />
              }
              <span>{downloadedFlac ? 'Saved' : 'FLAC'}</span>
            </button>

            {/* Lyrics */}
            <button
              className={`sp-icon-btn sp-icon-btn-labeled ${showLyrics ? 'active' : ''}`}
              onClick={() => setShowLyrics(l => !l)}
              title="Lyrics"
            >
              <Mic2 className="w-4 h-4" />
            </button>

            {/* Queue */}
            <button
              className={`sp-icon-btn sp-icon-btn-labeled ${showQueue ? 'active' : ''}`}
              onClick={() => setShowQueue(q => !q)}
              title="Queue"
            >
              <ListMusic className="w-4 h-4" />
            </button>

            {/* Volume */}
            <div className="sp-volume-wrap">
              <button className="sp-icon-btn" onClick={toggleMute} title="Mute">
                {volumeIcon}
              </button>
              <div className="sp-volume-slider-wrap group">
                <div className="sp-volume-track">
                  <div className="sp-volume-fill" style={{ width: `${(isMuted ? 0 : volume) * 100}%` }} />
                  <div className="sp-volume-thumb" style={{ left: `${(isMuted ? 0 : volume) * 100}%` }} />
                </div>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="sp-volume-input"
                />
              </div>
            </div>
          </div>

        </div>

        {/* ── MOBILE BOTTOM NAV (visible only on small screens) ── */}
        <div className="sp-mobile-player">
          <div className="sp-mobile-cover">
            {currentTrack.cover
              ? <img src={currentTrack.cover} alt="" />
              : <div className="sp-mobile-cover-empty">♪</div>
            }
          </div>
          <div className="sp-mobile-info">
            <p className="sp-mobile-name">{currentTrack.name}</p>
            <p className="sp-mobile-artist">{currentTrack.artists}</p>
          </div>
          <div className="sp-mobile-controls">
            <button
              className={`sp-icon-btn sp-like-btn ${isLiked ? 'active' : ''}`}
              onClick={() => setIsLiked(l => !l)}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            </button>
            <button
              className="sp-play-btn sp-play-btn-sm"
              onClick={onPlayPause}
            >
              {isPlaying
                ? <Pause className="w-4 h-4 fill-current text-black" />
                : <Play className="w-4 h-4 fill-current text-black ml-0.5" />
              }
            </button>
            <button className="sp-icon-btn" onClick={onNext} disabled={!hasNext}>
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
