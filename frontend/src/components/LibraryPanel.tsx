import React, { useEffect, useState, useContext } from 'react';
import { getDownloadedTracks, getTrackBlob, deleteDownloadedTrack, OfflineTrack } from '../lib/offline';
import { PlayerContext } from '../App';
import { Play, Pause, Trash2, Library } from 'lucide-react';

export const LibraryPanel: React.FC = () => {
  const { playTrack, currentTrack, isPlaying } = useContext(PlayerContext);
  const [tracks, setTracks] = useState<OfflineTrack[]>([]);

  useEffect(() => {
    loadTracks();
  }, []);

  const loadTracks = async () => {
    const t = await getDownloadedTracks();
    setTracks(t);
  };

  const handlePlay = async (item: OfflineTrack, index: number) => {
    // If we already created a blobUrl, use it. Otherwise, fetch from DB and create it.
    let url = item.blobUrl;
    if (!url) {
      const blob = await getTrackBlob(item.track.id);
      if (blob) {
        url = URL.createObjectURL(blob);
        // Update local state so we don't recreate blob URLs unnecessarily
        const newTracks = [...tracks];
        newTracks[index].blobUrl = url;
        setTracks(newTracks);
      } else {
        console.error("Blob not found for track", item.track.id);
        return;
      }
    }
    
    // Create a queue of just the SearchResult objects
    const queueItems = tracks.map(t => t.track);
    playTrack(item.track, url, queueItems, index);
  };

  const handleDelete = async (id: string) => {
    await deleteDownloadedTrack(id);
    await loadTracks();
  };

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
          <Library className="w-10 h-10" style={{ color: 'var(--sp-subdued)' }} />
        </div>
        <h2 className="text-white text-2xl font-bold m-0">Your Library is empty</h2>
        <p className="m-0 text-sm" style={{ color: 'var(--sp-subdued)' }}>Downloaded songs will appear here for offline playback.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col pb-12">
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mb-0.5">
          Your Library
        </h1>
        <p className="text-xs" style={{ color: 'var(--sp-subdued)' }}>
          {tracks.length} downloaded {tracks.length === 1 ? 'song' : 'songs'} available offline
        </p>
      </div>

      <div
        className="grid items-center gap-2 sm:gap-4 px-2 sm:px-4 py-2 text-xs font-bold uppercase tracking-widest border-b mb-1 grid-cols-[2.5rem_1fr_auto] sm:grid-cols-[2.5rem_1fr_4rem]"
        style={{
          color: 'var(--sp-subdued)',
          borderColor: 'var(--sp-border)',
        }}
      >
        <div className="text-center">#</div>
        <div>Title</div>
        <div className="text-right">Actions</div>
      </div>

      <div className="flex flex-col gap-0">
        {tracks.map((item, index) => {
          const isCurrentlyPlaying = currentTrack?.id === item.track.id && isPlaying;
          const isCurrentTrack = currentTrack?.id === item.track.id;

          return (
            <div
              key={item.track.id}
              className="sp-track-row group animate-fade-in grid-cols-[2.5rem_1fr_auto] sm:grid-cols-[2.5rem_1fr_4rem]"
              style={{
                display: 'grid',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.375rem 0.5rem',
                borderRadius: 6,
                background: isCurrentTrack ? 'rgba(29,185,84,0.08)' : undefined,
              }}
            >
              <div className="sp-row-num-wrap flex items-center justify-center">
                <span
                  className="sp-row-num"
                  style={{ color: isCurrentTrack ? 'var(--sp-green)' : 'var(--sp-subdued)' }}
                >
                  {isCurrentlyPlaying ? <span className="sp-eq-bars"><span /><span /><span /></span> : index + 1}
                </span>
                <span className="sp-row-play" onClick={() => handlePlay(item, index)}>
                  {isCurrentlyPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                </span>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden">
                {item.track.cover ? (
                  <img src={item.track.cover} alt="" className="w-10 h-10 rounded sp-cover" />
                ) : (
                  <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--sp-hover)' }}>
                    <Library className="w-4 h-4" style={{ color: 'var(--sp-muted)' }} />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-sm truncate leading-snug" style={{ color: isCurrentTrack ? 'var(--sp-green)' : '#fff' }}>
                    {item.track.name}
                  </span>
                  <span className="text-xs truncate leading-snug" style={{ color: 'var(--sp-subdued)' }}>
                    {item.track.artists}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => handleDelete(item.track.id)}
                  className="sp-icon-btn opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove from Library"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
