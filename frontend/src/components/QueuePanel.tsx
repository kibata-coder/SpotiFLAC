import React, { useContext } from 'react';
import { X, Play, Pause, GripVertical, Radio } from 'lucide-react';
import type { SearchResult } from '../lib/api';
import { PlayerContext } from '../App';
import { getStreamUrl } from '../lib/api';
import { getTrackBlob } from '../lib/offline';

interface QueuePanelProps {
  queue: SearchResult[];
  currentIndex: number;
  onClose: () => void;
  onJumpTo: (index: number) => void;
  onRemove: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
  queue,
  currentIndex,
  onClose,
  onJumpTo,
  onRemove,
  onReorder,
}) => {
  const { currentTrack, isPlaying } = useContext(PlayerContext);

  const nowPlaying = currentIndex >= 0 ? queue[currentIndex] : null;
  const upNext = queue.slice(currentIndex + 1);
  const upNextStart = currentIndex + 1;

  // ── Drag state ───────────────────────────────────────────────────
  const dragIndexRef = React.useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, absoluteIndex: number) => {
    dragIndexRef.current = absoluteIndex;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, absoluteIndex: number) => {
    e.preventDefault();
    if (dragIndexRef.current === null || dragIndexRef.current === absoluteIndex) return;
    onReorder(dragIndexRef.current, absoluteIndex);
    dragIndexRef.current = null;
  };

  return (
    <div className="sp-queue-panel animate-fade-in-scale">
      {/* Header */}
      <div className="sp-queue-header">
        <span className="sp-queue-title">Queue</span>
        <button className="sp-queue-close" onClick={onClose} title="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="sp-queue-body custom-scrollbar">
        {/* Now Playing */}
        {nowPlaying && (
          <div className="sp-queue-section">
            <p className="sp-queue-section-label">Now Playing</p>
            <QueueTrackRow
              track={nowPlaying}
              index={currentIndex}
              isActive={true}
              isCurrentlyPlaying={isPlaying}
              onPlay={() => onJumpTo(currentIndex)}
              onRemove={() => onRemove(currentIndex)}
              onDragStart={e => handleDragStart(e, currentIndex)}
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, currentIndex)}
            />
          </div>
        )}

        {/* Up Next */}
        {upNext.length > 0 && (
          <div className="sp-queue-section">
            <p className="sp-queue-section-label">Next Up</p>
            {upNext.map((track, i) => {
              const absoluteIndex = upNextStart + i;
              return (
                <QueueTrackRow
                  key={`${track.id}-${absoluteIndex}`}
                  track={track}
                  index={absoluteIndex}
                  isActive={false}
                  isCurrentlyPlaying={false}
                  onPlay={() => onJumpTo(absoluteIndex)}
                  onRemove={() => onRemove(absoluteIndex)}
                  onDragStart={e => handleDragStart(e, absoluteIndex)}
                  onDragOver={handleDragOver}
                  onDrop={e => handleDrop(e, absoluteIndex)}
                />
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {queue.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Radio className="w-10 h-10 opacity-20" />
            <p className="text-sm" style={{ color: 'var(--sp-subdued)' }}>Your queue is empty</p>
            <p className="text-xs text-center px-6" style={{ color: 'var(--sp-muted)' }}>
              Search for a song and press play to start a queue
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Individual Queue Track Row ───────────────────────────────────
interface QueueTrackRowProps {
  track: SearchResult;
  index: number;
  isActive: boolean;
  isCurrentlyPlaying: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

const QueueTrackRow: React.FC<QueueTrackRowProps> = ({
  track, index, isActive, isCurrentlyPlaying, onPlay, onRemove,
  onDragStart, onDragOver, onDrop,
}) => (
  <div
    className={`sp-queue-row group ${isActive ? 'sp-queue-row--active' : ''}`}
    draggable
    onDragStart={onDragStart}
    onDragOver={onDragOver}
    onDrop={onDrop}
  >
    {/* Drag handle */}
    <GripVertical
      className="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab"
      style={{ color: 'var(--sp-subdued)' }}
    />

    {/* Cover + info */}
    <div className="flex items-center gap-3 flex-1 min-w-0" onClick={onPlay} style={{ cursor: 'pointer' }}>
      {track.cover
        ? <img src={track.cover} alt="" className="w-10 h-10 rounded-md object-cover shrink-0" />
        : <div className="w-10 h-10 rounded-md shrink-0 flex items-center justify-center text-sm" style={{ background: 'var(--sp-hover)' }}>♪</div>
      }
      <div className="flex flex-col min-w-0">
        <span
          className="text-sm font-semibold truncate"
          style={{ color: isActive ? 'var(--sp-green)' : '#fff' }}
        >
          {isActive && isCurrentlyPlaying
            ? <span className="sp-eq-bars mr-1.5"><span /><span /><span /></span>
            : null
          }
          {track.name}
        </span>
        <span className="text-xs truncate" style={{ color: 'var(--sp-subdued)' }}>
          {track.artists}
        </span>
      </div>
    </div>

    {/* Play button (hover) */}
    <button
      className="sp-icon-btn opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      onClick={onPlay}
      title="Play this track"
    >
      {isActive && isCurrentlyPlaying
        ? <Pause className="w-4 h-4 fill-current" />
        : <Play className="w-4 h-4 fill-current" />
      }
    </button>

    {/* Remove button */}
    <button
      className="sp-icon-btn opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      onClick={e => { e.stopPropagation(); onRemove(); }}
      title="Remove from queue"
      style={{ color: 'var(--sp-muted)' }}
    >
      <X className="w-3.5 h-3.5" />
    </button>
  </div>
);
