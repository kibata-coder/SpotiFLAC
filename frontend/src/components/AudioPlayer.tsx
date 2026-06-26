import React, { useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import ReactPlayer from 'react-player';
import type { SearchResult } from '../lib/api';

interface AudioPlayerProps {
  currentTrack: SearchResult | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  streamUrl: string | null;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ currentTrack, isPlaying, onPlayPause, streamUrl }) => {
  const playerRef = useRef<ReactPlayer>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (playerRef.current) {
      playerRef.current.seekTo(time, 'seconds');
      setProgress(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (!newMuted && volume === 0) setVolume(1);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50" style={{ background: '#181818', borderTop: '1px solid #282828' }}>
      {/* Hidden ReactPlayer */}
      {streamUrl && (
        <ReactPlayer
          ref={playerRef}
          url={streamUrl}
          playing={isPlaying}
          volume={volume}
          muted={isMuted}
          onProgress={({ playedSeconds }) => setProgress(playedSeconds)}
          onDuration={(d) => setDuration(d)}
          onEnded={onPlayPause}
          width="0"
          height="0"
          config={{ youtube: { playerVars: { showinfo: 0, controls: 0 } } }}
          style={{ display: 'none' }}
        />
      )}

      {/* Progress bar — full width, flush to top of player */}
      <div className="relative w-full h-1 bg-zinc-700 group cursor-pointer">
        <div
          className="absolute top-0 left-0 h-full transition-all"
          style={{
            width: `${duration ? (progress / duration) * 100 : 0}%`,
            background: 'var(--sp-green)',
          }}
        />
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={progress}
          onChange={handleSeek}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      {/* Player body */}
      <div className="flex items-center justify-between px-3 sm:px-4 h-16 sm:h-20 gap-2 sm:gap-4">

        {/* Left: Track info */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-none sm:w-[30%]">
          {currentTrack.cover ? (
            <img src={currentTrack.cover} alt="Cover" className="w-10 h-10 sm:w-12 sm:h-12 rounded shadow-md object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-zinc-800 rounded flex items-center justify-center shrink-0">
              <span className="text-zinc-500 text-xs">♪</span>
            </div>
          )}
          <div className="min-w-0 flex flex-col justify-center">
            <p className="text-xs sm:text-sm font-semibold text-white truncate">{currentTrack.name}</p>
            <p className="text-[10px] sm:text-xs text-zinc-400 truncate">{currentTrack.artists}</p>
          </div>
        </div>

        {/* Center: Play controls */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="flex items-center gap-3 sm:gap-5">
            <button className="text-zinc-500 hover:text-white transition-colors hidden sm:block">
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={onPlayPause}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-white rounded-full hover:scale-105 active:scale-95 transition-transform"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 text-black fill-current" />
              ) : (
                <Play className="w-4 h-4 text-black fill-current ml-0.5" />
              )}
            </button>

            <button className="text-zinc-500 hover:text-white transition-colors hidden sm:block">
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          </div>

          {/* Time display — only on sm+ */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400">
            <span className="min-w-[36px] text-right">{formatTime(progress)}</span>
            <span>/</span>
            <span className="min-w-[36px]">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Volume (hidden on mobile) */}
        <div className="hidden sm:flex items-center justify-end gap-2 w-[30%] group">
          <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition-colors">
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="w-20 relative h-1 bg-zinc-600 rounded-full cursor-pointer">
            <div
              className="absolute top-0 left-0 h-full rounded-full"
              style={{ width: `${(isMuted ? 0 : volume) * 100}%`, background: 'var(--sp-green)' }}
            />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </div>

        {/* Mobile: volume icon only */}
        <button onClick={toggleMute} className="sm:hidden text-zinc-400 hover:text-white transition-colors shrink-0">
          {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
