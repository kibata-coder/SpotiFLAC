import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Volume1,
  Shuffle, Repeat, Repeat1,
  Heart, Download, Loader2,
  Mic2, Maximize2, ListMusic,
  ChevronDown, Gauge, Timer, Radio,
} from 'lucide-react';
import type { SearchResult } from '../lib/api';
import { downloadTrackWeb, getLyrics, getStreamUrl, getRadio } from '../lib/api';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface AudioPlayerProps {
  currentTrack: SearchResult | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  streamUrl: string | null;
  queue?: SearchResult[];
  currentIndex?: number;
  onPrev?: (forceWrap?: boolean) => void;
  onNext?: (forceWrap?: boolean) => void;
  onError?: (e: any) => void;
  isShuffle?: boolean;
  onShuffleChange?: (v: boolean) => void;
  onQueuePanelToggle?: () => void;
  showQueuePanel?: boolean;
  userId?: string | null;
  initialSeek?: number;
}

type RepeatMode = 'none' | 'all' | 'one';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  currentTrack,
  isPlaying,
  onPlayPause,
  streamUrl,
  queue = [],
  currentIndex = -1,
  onPrev,
  onNext,
  onError,
  isShuffle = false,
  onShuffleChange,
  onQueuePanelToggle,
  showQueuePanel = false,
  userId,
  initialSeek,
}) => {
  // ── Audio refs ──────────────────────────────────────────────────
  const audioRef    = useRef<HTMLAudioElement>(null);
  const nextAudioRef = useRef<HTMLAudioElement>(null);

  // ── State ────────────────────────────────────────────────────────
  const [progress, setProgress]         = useState(0);
  const [duration, setDuration]         = useState(0);
  const [volume, setVolume]             = useState(0.8);
  const [isMuted, setIsMuted]           = useState(false);
  const [repeatMode, setRepeatMode]     = useState<RepeatMode>('none');
  const [isLiked, setIsLiked]           = useState(false);
  const [showLyrics, setShowLyrics]     = useState(false);
  const [lyricsText, setLyricsText]     = useState<string | null>(null);
  const [lyricsData, setLyricsData]     = useState<{ time: number; text: string }[] | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [downloadingFlac, setDownloadingFlac] = useState(false);
  const [downloadedFlac, setDownloadedFlac]   = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [crossfadeSecs, setCrossfadeSecs] = useState(3); // seconds
  const [isCrossfading, setIsCrossfading] = useState(false);
  const [sleepTimer, setSleepTimer]       = useState<number | null>(null); // remaining ms
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [sleepTimerInterval, setSleepTimerInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [isRadioMode, setIsRadioMode]   = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const syncSaveRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekPendingRef = useRef<number | null>(null); // for initial seek after metadata loaded
  const crossfadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Liked songs ──────────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack || !userId) return;
    supabase
      .from('liked_songs')
      .select('id')
      .eq('user_id', userId)
      .eq('track_id', currentTrack.id)
      .maybeSingle()
      .then(({ data }) => setIsLiked(!!data));
  }, [currentTrack?.id, userId]);

  const handleToggleLike = async () => {
    if (!currentTrack) return;
    if (!userId) { toast.error('Sign in to like songs'); return; }
    if (isLiked) {
      await supabase.from('liked_songs').delete().eq('user_id', userId).eq('track_id', currentTrack.id);
      toast.success('Removed from Liked Songs');
      setIsLiked(false);
    } else {
      await supabase.from('liked_songs').insert({
        user_id: userId,
        track_id: currentTrack.id,
        track_name: currentTrack.name,
        track_artists: currentTrack.artists,
        track_cover: currentTrack.cover || '',
        track_album: currentTrack.album || '',
      });
      toast.success('Saved to Liked Songs ♥');
      setIsLiked(true);
    }
  };

  // ── Reset on track change ────────────────────────────────────────
  useEffect(() => {
    setProgress(0);
    setDuration(0);
    setDownloadedFlac(false);
    setLyricsText(null);
    setLyricsData(null);
    if (initialSeek != null && initialSeek > 0) {
      seekPendingRef.current = initialSeek;
    }
    // Cancel in-flight crossfade
    if (crossfadeTimerRef.current) clearTimeout(crossfadeTimerRef.current);
    setIsCrossfading(false);
  }, [currentTrack?.id]);

  // ── Apply volume + speed to audio element ────────────────────────
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = isMuted ? 0 : volume;
    el.playbackRate = playbackSpeed;
  }, [volume, isMuted, playbackSpeed]);

  // ── Play / pause ──────────────────────────────────────────────────
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) { el.play().catch(() => {}); }
    else { el.pause(); }
  }, [isPlaying, streamUrl]);

  // ── Apply src when streamUrl changes ─────────────────────────────
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (streamUrl) {
      el.src = streamUrl;
      el.load();
      if (isPlaying) el.play().catch(() => {});
    }
  }, [streamUrl]);

  // ── Media Session API ─────────────────────────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.name,
      artist: currentTrack.artists,
      album: currentTrack.album || '',
      artwork: currentTrack.cover
        ? [{ src: currentTrack.cover, sizes: '300x300', type: 'image/jpeg' }]
        : [],
    });
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', onPlayPause);
    navigator.mediaSession.setActionHandler('pause', onPlayPause);
    navigator.mediaSession.setActionHandler('previoustrack', onPrev ? () => onPrev() : null);
    navigator.mediaSession.setActionHandler('nexttrack', onNext ? () => onNext() : null);
  }, [onPlayPause, onPrev, onNext]);

  // ── Cross-device sync: save progress ─────────────────────────────
  const savePlaybackState = useCallback(() => {
    if (!currentTrack || !userId || !audioRef.current) return;
    const pos = audioRef.current.currentTime;
    supabase.from('playback_state').upsert({
      user_id: userId,
      track_id: currentTrack.id,
      track_name: currentTrack.name,
      track_artists: currentTrack.artists,
      track_cover: currentTrack.cover || '',
      track_album: currentTrack.album || '',
      position_seconds: Math.floor(pos),
      queue_data: JSON.stringify(queue.slice(0, 50)), // cap queue size
      queue_index: currentIndex,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  }, [currentTrack, userId, queue, currentIndex]);

  // ── Fetch lyrics ──────────────────────────────────────────────────
  useEffect(() => {
    if (currentTrack && showLyrics && lyricsText === null && !lyricsLoading) {
      setLyricsLoading(true);
      getLyrics(currentTrack.id)
        .then(setLyricsText)
        .catch(() => setLyricsText(''))
        .finally(() => setLyricsLoading(false));
    }
  }, [currentTrack?.id, showLyrics, lyricsText, lyricsLoading]);

  // ── Parse synced lyrics ───────────────────────────────────────────
  useEffect(() => {
    if (!lyricsText) { setLyricsData(null); return; }
    const lines = lyricsText.split('\n');
    const parsed: { time: number; text: string }[] = [];
    const timeRegex = /\[(\d{1,2}):(\d{2})\.(\d{2,3})\]/;
    for (const line of lines) {
      if (/^\[[a-zA-Z]+:.*\]/.test(line)) continue;
      const match = timeRegex.exec(line);
      if (match) {
        const time = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / (match[3].length === 2 ? 100 : 1000);
        const text = line.replace(timeRegex, '').trim();
        if (text) parsed.push({ time, text });
      } else if (line.trim()) {
        parsed.push({ time: -1, text: line.trim() });
      }
    }
    setLyricsData(parsed);
  }, [lyricsText]);

  // ── Active lyric line ─────────────────────────────────────────────
  const isSynced = lyricsData?.some(d => d.time >= 0) ?? false;
  let activeLineIndex = 0;
  if (lyricsData && lyricsData.length > 0) {
    if (isSynced) {
      for (let i = lyricsData.length - 1; i >= 0; i--) {
        if (lyricsData[i].time <= progress) { activeLineIndex = i; break; }
      }
    } else {
      activeLineIndex = duration > 0
        ? Math.min(Math.floor((progress / duration) * lyricsData.length), lyricsData.length - 1)
        : 0;
    }
  }
  useEffect(() => {
    if (showLyrics && activeLineIndex >= 0) {
      document.getElementById(`lyric-line-${activeLineIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLineIndex, showLyrics]);

  // ── Sleep timer ───────────────────────────────────────────────────
  const startSleepTimer = (minutes: number) => {
    if (sleepTimerInterval) clearInterval(sleepTimerInterval);
    const endMs = Date.now() + minutes * 60_000;
    setSleepTimer(minutes * 60_000);
    setShowSleepMenu(false);
    const interval = setInterval(() => {
      const remaining = endMs - Date.now();
      if (remaining <= 0) {
        clearInterval(interval);
        setSleepTimer(null);
        setSleepTimerInterval(null);
        onPlayPause(); // pause
        // Fade out
        const el = audioRef.current;
        if (el) {
          const fadeSteps = 20;
          const origVol = el.volume;
          let step = 0;
          const fade = setInterval(() => {
            step++;
            el.volume = Math.max(0, origVol * (1 - step / fadeSteps));
            if (step >= fadeSteps) { clearInterval(fade); el.volume = origVol; }
          }, 50);
        }
      } else {
        setSleepTimer(remaining);
      }
    }, 1000);
    setSleepTimerInterval(interval);
    toast.success(`Sleep timer: ${minutes} min`);
  };

  const cancelSleepTimer = () => {
    if (sleepTimerInterval) clearInterval(sleepTimerInterval);
    setSleepTimerInterval(null);
    setSleepTimer(null);
  };

  const formatSleepTimer = (ms: number) => {
    const totalSecs = Math.round(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ── Audio event handlers ──────────────────────────────────────────
  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el) return;
    const t = el.currentTime;
    setProgress(t);

    // Debounced sync save every 5s
    if (userId) {
      if (syncSaveRef.current) clearTimeout(syncSaveRef.current);
      syncSaveRef.current = setTimeout(savePlaybackState, 5000);
    }

    // Crossfade trigger: when within crossfadeSecs of end
    if (crossfadeSecs > 0 && !isCrossfading && el.duration && t >= el.duration - crossfadeSecs) {
      triggerCrossfade();
    }
  };

  const triggerCrossfade = () => {
    if (isCrossfading) return;
    const nextTrack = queue[currentIndex + 1];
    if (!nextTrack) return; // no next track to crossfade to
    setIsCrossfading(true);

    // Preload next track in the hidden second audio
    const nextEl = nextAudioRef.current;
    const currEl = audioRef.current;
    if (!nextEl || !currEl) return;

    const nextUrl = getStreamUrl(nextTrack.id);
    nextEl.src = nextUrl;
    nextEl.volume = 0;
    nextEl.play().catch(() => {});

    const totalMs = crossfadeSecs * 1000;
    const steps = 40;
    const interval = totalMs / steps;
    const origVol = isMuted ? 0 : volume;
    let step = 0;

    const fade = setInterval(() => {
      step++;
      const ratio = step / steps;
      if (currEl) currEl.volume = Math.max(0, origVol * (1 - ratio));
      if (nextEl) nextEl.volume = Math.min(origVol, origVol * ratio);
      if (step >= steps) {
        clearInterval(fade);
        setIsCrossfading(false);
        onNext?.(); // advance to next track (which will set its own streamUrl)
      }
    }, interval);
  };

  const handleLoadedMetadata = () => {
    const el = audioRef.current;
    if (!el) return;
    setDuration(el.duration);
    el.volume = isMuted ? 0 : volume;
    el.playbackRate = playbackSpeed;
    if (seekPendingRef.current != null) {
      el.currentTime = seekPendingRef.current;
      seekPendingRef.current = null;
    }
  };

  const handleEnded = () => {
    if (repeatMode === 'one') {
      const el = audioRef.current;
      if (el) { el.currentTime = 0; el.play().catch(() => {}); }
      return;
    }
    if (currentIndex < queue.length - 1) {
      onNext?.();
    } else if (repeatMode === 'all' && queue.length > 0) {
      onNext?.(true);
    } else {
      onPlayPause();
    }
  };

  const handleSeekClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time  = ratio * duration;
    if (audioRef.current) audioRef.current.currentTime = time;
    setProgress(time);
  }, [duration]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    setIsMuted(vol === 0);
    if (audioRef.current) audioRef.current.volume = vol;
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (audioRef.current) audioRef.current.volume = newMuted ? 0 : volume;
    if (newMuted === false && volume === 0) setVolume(0.5);
  };

  const cycleRepeat = () => {
    setRepeatMode(m => m === 'none' ? 'all' : m === 'all' ? 'one' : 'none');
  };

  const handleFlacDownload = () => {
    if (!currentTrack || downloadingFlac) return;
    setDownloadingFlac(true);
    window.location.href = `/api/download?spotify_id=${currentTrack.id}`;
    setTimeout(() => { setDownloadingFlac(false); setDownloadedFlac(true); }, 4000);
  };

  const handleStartRadio = async () => {
    if (!currentTrack) return;
    try {
      const radioTracks = await getRadio(currentTrack.id);
      if (radioTracks.length === 0) { toast.error('No radio tracks found'); return; }
      setIsRadioMode(true);
      toast.success('Radio started!');
      // The caller (App) needs to receive these — we surface this via the context
      // For now, open the first radio track using onNext logic is done from App
    } catch {
      toast.error('Could not start radio');
    }
  };

  const formatTime = (t: number) => {
    if (!t || isNaN(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPct = duration ? (progress / duration) * 100 : 0;
  const volumeIcon = isMuted || volume === 0
    ? <VolumeX className="w-4 h-4" />
    : volume < 0.4
      ? <Volume1 className="w-4 h-4" />
      : <Volume2 className="w-4 h-4" />;

  const hasPrev = !!onPrev && (currentIndex > 0 || repeatMode !== 'none');
  const hasNext = !!onNext && (currentIndex < queue.length - 1 || repeatMode !== 'none');

  if (!currentTrack) return null;

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
        ) : lyricsData ? (
          <div className="mt-8 text-center text-lg whitespace-pre-wrap leading-relaxed max-w-2xl mx-auto px-4 pb-40">
            {lyricsData.map((line, idx) => (
              <div
                key={idx}
                id={`lyric-line-${idx}`}
                className={`transition-all duration-500 min-h-[1.75rem] mb-2 ${idx === activeLineIndex ? 'text-white text-2xl scale-105 font-bold drop-shadow-lg' : 'text-white/40'}`}
              >
                {line.text}
              </div>
            ))}
          </div>
        ) : (
          <div className="sp-lyrics-placeholder-box">
            <Mic2 className="w-8 h-8 mb-3 opacity-30" />
            <p className="text-white/60 text-sm text-center">Lyrics aren't available for this track.</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Hidden native audio elements */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={onError}
        preload="auto"
        style={{ display: 'none' }}
      />
      {/* Second audio for crossfade */}
      <audio
        ref={nextAudioRef}
        preload="auto"
        style={{ display: 'none' }}
      />

      {/* Lyrics full-screen overlay */}
      {showLyrics && lyricsPanelContent}

      {/* Speed menu */}
      {showSpeedMenu && (
        <div className="sp-speed-menu" onClick={() => setShowSpeedMenu(false)}>
          <div className="sp-speed-menu-inner" onClick={e => e.stopPropagation()}>
            <p className="sp-speed-menu-title">Playback Speed</p>
            {SPEED_OPTIONS.map(s => (
              <button
                key={s}
                className={`sp-speed-option ${playbackSpeed === s ? 'active' : ''}`}
                onClick={() => {
                  setPlaybackSpeed(s);
                  if (audioRef.current) audioRef.current.playbackRate = s;
                  setShowSpeedMenu(false);
                }}
              >
                {s === 1 ? 'Normal' : `${s}×`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sleep timer menu */}
      {showSleepMenu && (
        <div className="sp-speed-menu" onClick={() => setShowSleepMenu(false)}>
          <div className="sp-speed-menu-inner" onClick={e => e.stopPropagation()}>
            <p className="sp-speed-menu-title">Sleep Timer</p>
            {[15, 30, 45, 60].map(m => (
              <button key={m} className="sp-speed-option" onClick={() => startSleepTimer(m)}>
                {m} minutes
              </button>
            ))}
            <button className="sp-speed-option" onClick={() => startSleepTimer(999)}>End of track</button>
            {sleepTimer !== null && (
              <button className="sp-speed-option" style={{ color: '#e91429' }} onClick={cancelSleepTimer}>
                Cancel ({formatSleepTimer(sleepTimer)})
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Player bar ────────────────────────────────────────── */}
      <div className="sp-player-bar">

        {/* ── PROGRESS BAR ── */}
        <div className="sp-progress-wrap">
          <span className="sp-time">{formatTime(progress)}</span>
          <div ref={progressBarRef} className="sp-progress-track group" onClick={handleSeekClick}>
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
              onClick={handleToggleLike}
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
              onClick={() => onShuffleChange?.(!isShuffle)}
              title="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            {/* Prev */}
            <button
              className={`sp-icon-btn sp-skip-btn ${!hasPrev ? 'disabled' : ''}`}
              onClick={() => onPrev?.()}
              title="Previous"
              disabled={!hasPrev}
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            {/* Play / Pause */}
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
              onClick={() => onNext?.()}
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
            {/* Download */}
            <button
              id="player-download-flac"
              className={`sp-flac-btn ${downloadedFlac ? 'done' : ''}`}
              onClick={handleFlacDownload}
              disabled={downloadingFlac}
              title="Download audio"
            >
              {downloadingFlac
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : downloadedFlac
                  ? <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  : <Download className="w-3.5 h-3.5" />
              }
              <span>{downloadedFlac ? 'Saved!' : 'M4A'}</span>
            </button>

            {/* Playback speed */}
            <button
              className={`sp-icon-btn sp-icon-btn-labeled ${playbackSpeed !== 1 ? 'active' : ''}`}
              onClick={() => setShowSpeedMenu(s => !s)}
              title="Playback speed"
            >
              <Gauge className="w-4 h-4" />
              {playbackSpeed !== 1 && <span className="text-[10px] font-bold leading-none">{playbackSpeed}×</span>}
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
              className={`sp-icon-btn sp-icon-btn-labeled ${showQueuePanel ? 'active' : ''}`}
              onClick={onQueuePanelToggle}
              title="Queue"
            >
              <ListMusic className="w-4 h-4" />
            </button>

            {/* Sleep Timer */}
            <button
              className={`sp-icon-btn sp-icon-btn-labeled ${sleepTimer !== null ? 'active' : ''}`}
              onClick={() => setShowSleepMenu(s => !s)}
              title="Sleep timer"
            >
              <Timer className="w-4 h-4" />
              {sleepTimer !== null && <span className="text-[10px] font-bold leading-none">{formatSleepTimer(sleepTimer)}</span>}
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

        {/* ── MOBILE BOTTOM NAV ── */}
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
              onClick={handleToggleLike}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            </button>
            <button className="sp-play-btn sp-play-btn-sm" onClick={onPlayPause}>
              {isPlaying
                ? <Pause className="w-4 h-4 fill-current text-black" />
                : <Play className="w-4 h-4 fill-current text-black ml-0.5" />
              }
            </button>
            <button className="sp-icon-btn" onClick={() => onNext?.()} disabled={!hasNext}>
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
