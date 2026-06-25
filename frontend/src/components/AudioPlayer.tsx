import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import type { SearchResult } from '../lib/api';

interface AudioPlayerProps {
  currentTrack: SearchResult | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  streamUrl: string | null;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ currentTrack, isPlaying, onPlayPause, streamUrl }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, streamUrl]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const newMuted = !isMuted;
      audioRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (!newMuted && volume === 0) {
        setVolume(1);
        audioRef.current.volume = 1;
      }
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-[#181818] border-t border-[#282828] px-4 flex items-center justify-between z-50">
      {streamUrl && (
        <audio
          ref={audioRef}
          src={streamUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => onPlayPause()}
          onLoadedMetadata={handleTimeUpdate}
        />
      )}

      {/* Left: Track Info */}
      <div className="flex items-center w-[30%] min-w-[180px]">
        {currentTrack.cover ? (
          <img src={currentTrack.cover} alt="Cover" className="w-14 h-14 rounded shadow-md object-cover" />
        ) : (
          <div className="w-14 h-14 bg-zinc-800 rounded flex items-center justify-center">
            <span className="text-zinc-500 text-xs">No art</span>
          </div>
        )}
        <div className="ml-4 overflow-hidden flex flex-col justify-center">
          <p className="text-sm font-semibold text-white truncate hover:underline cursor-pointer">{currentTrack.name}</p>
          <p className="text-xs text-zinc-400 truncate hover:underline cursor-pointer">{currentTrack.artists}</p>
        </div>
      </div>

      {/* Center: Controls */}
      <div className="flex flex-col items-center w-[40%] max-w-[722px]">
        <div className="flex items-center gap-6 mb-2">
          <button className="text-zinc-400 hover:text-white transition-colors">
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          
          <button 
            onClick={onPlayPause}
            className="w-8 h-8 flex items-center justify-center bg-white rounded-full hover:scale-105 transition-transform"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-black fill-current" />
            ) : (
              <Play className="w-4 h-4 text-black fill-current ml-1" />
            )}
          </button>

          <button className="text-zinc-400 hover:text-white transition-colors">
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>

        <div className="flex items-center w-full gap-2 group">
          <span className="text-xs text-zinc-400 min-w-[40px] text-right">
            {formatTime(progress)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={progress}
            onChange={handleSeek}
            className="w-full h-1 bg-zinc-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:hidden group-hover:[&::-webkit-slider-thumb]:block hover:bg-green-500 transition-colors"
          />
          <span className="text-xs text-zinc-400 min-w-[40px]">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Right: Volume */}
      <div className="flex items-center justify-end w-[30%] min-w-[180px] gap-2 group">
        <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition-colors">
          {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
        <div className="w-24 flex items-center">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-full h-1 bg-zinc-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:hidden group-hover:[&::-webkit-slider-thumb]:block hover:bg-green-500 transition-colors"
          />
        </div>
      </div>
    </div>
  );
};
