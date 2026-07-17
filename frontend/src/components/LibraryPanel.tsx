import React, { useEffect, useState, useContext } from 'react';
import { getDownloadedTracks, getTrackBlob, deleteDownloadedTrack } from '../lib/offline';
import type { OfflineTrack } from '../lib/offline';
import { PlayerContext } from '../App';
import { Play, Pause, Trash2, Library, Disc3, Users, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { LikeButton } from './LikeButton';

interface LibraryPanelProps {
  userId: string | null;
}

export const LibraryPanel: React.FC<LibraryPanelProps> = ({ userId }) => {
  const { playTrack, currentTrack, isPlaying } = useContext(PlayerContext);
  const [activeTab, setActiveTab] = useState<'downloads' | 'albums' | 'artists'>('downloads');
  
  const [downloadedTracks, setDownloadedTracks] = useState<OfflineTrack[]>([]);
  const [likedAlbums, setLikedAlbums] = useState<any[]>([]);
  const [likedArtists, setLikedArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'downloads') {
      loadDownloads();
    } else if (activeTab === 'albums' && userId) {
      loadLikedAlbums();
    } else if (activeTab === 'artists' && userId) {
      loadLikedArtists();
    }
  }, [activeTab, userId]);

  const loadDownloads = async () => {
    setLoading(true);
    const t = await getDownloadedTracks();
    setDownloadedTracks(t);
    setLoading(false);
  };

  const loadLikedAlbums = async () => {
    setLoading(true);
    const { data } = await supabase.from('liked_albums').select('*').eq('user_id', userId).order('liked_at', { ascending: false });
    setLikedAlbums(data || []);
    setLoading(false);
  };

  const loadLikedArtists = async () => {
    setLoading(true);
    const { data } = await supabase.from('liked_artists').select('*').eq('user_id', userId).order('liked_at', { ascending: false });
    setLikedArtists(data || []);
    setLoading(false);
  };

  const handlePlayDownloaded = async (item: OfflineTrack, index: number) => {
    let url = item.blobUrl;
    if (!url) {
      const blob = await getTrackBlob(item.track.id);
      if (blob) {
        url = URL.createObjectURL(blob);
        const newTracks = [...downloadedTracks];
        newTracks[index].blobUrl = url;
        setDownloadedTracks(newTracks);
      } else {
        return;
      }
    }
    const queueItems = downloadedTracks.map(t => t.track);
    playTrack(item.track, url, queueItems, index);
  };

  const handleDeleteDownload = async (id: string) => {
    await deleteDownloadedTrack(id);
    await loadDownloads();
  };

  return (
    <div className="w-full flex flex-col pb-12">
      <div className="mb-4 mt-4">
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mb-4">
          Your Library
        </h1>
        <div className="flex gap-2">
          <button 
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${activeTab === 'downloads' ? 'bg-white text-black' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
            onClick={() => setActiveTab('downloads')}
          >
            Downloads
          </button>
          <button 
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${activeTab === 'albums' ? 'bg-white text-black' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
            onClick={() => setActiveTab('albums')}
          >
            Albums
          </button>
          <button 
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${activeTab === 'artists' ? 'bg-white text-black' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
            onClick={() => setActiveTab('artists')}
          >
            Artists
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
      ) : activeTab === 'downloads' ? (
        downloadedTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-20 text-zinc-500">
            <Library className="w-10 h-10" />
            <p className="text-sm">No downloaded tracks for offline playback.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0 mt-4">
            {downloadedTracks.map((item, index) => {
              const isCurrentlyPlaying = currentTrack?.id === item.track.id && isPlaying;
              const isCurrentTrack = currentTrack?.id === item.track.id;
              return (
                <div key={item.track.id} className="sp-track-row group animate-fade-in flex items-center justify-between p-2 rounded-lg hover:bg-white/5" style={{ background: isCurrentTrack ? 'rgba(29,185,84,0.08)' : undefined }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <button className="w-8 h-8 flex items-center justify-center shrink-0 text-zinc-400 hover:text-white" onClick={() => handlePlayDownloaded(item, index)}>
                      {isCurrentlyPlaying ? <Pause className="w-4 h-4 fill-current text-emerald-500" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                    {item.track.cover ? <img src={item.track.cover} alt="" className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center"><Library className="w-4 h-4 text-zinc-500" /></div>}
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-sm text-white truncate">{item.track.name}</span>
                      <span className="text-xs text-zinc-400 truncate">{item.track.artists}</span>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteDownload(item.track.id)} className="p-2 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
        )
      ) : activeTab === 'albums' ? (
        !userId ? (
          <div className="py-20 text-center text-zinc-500"><p className="text-sm">Sign in to view liked albums.</p></div>
        ) : likedAlbums.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-4"><Disc3 className="w-10 h-10" /><p className="text-sm">No liked albums yet.</p></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
            {likedAlbums.map((album) => (
              <div key={album.album_id} className="flex flex-col bg-zinc-900/40 p-3 rounded-xl border border-zinc-800 hover:bg-zinc-800/60 transition-colors group">
                <div className="relative aspect-square mb-3">
                  <img src={album.album_cover} alt="" className="w-full h-full object-cover rounded-lg shadow-md" />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full p-1 backdrop-blur-md">
                    <LikeButton userId={userId} itemType="album" itemId={album.album_id} itemName={album.album_name} itemCover={album.album_cover} />
                  </div>
                </div>
                <span className="font-bold text-sm text-white truncate">{album.album_name}</span>
              </div>
            ))}
          </div>
        )
      ) : activeTab === 'artists' ? (
        !userId ? (
          <div className="py-20 text-center text-zinc-500"><p className="text-sm">Sign in to view liked artists.</p></div>
        ) : likedArtists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-4"><Users className="w-10 h-10" /><p className="text-sm">No liked artists yet.</p></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
            {likedArtists.map((artist) => (
              <div key={artist.artist_id} className="flex flex-col items-center bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 hover:bg-zinc-800/60 transition-colors group">
                <div className="relative w-24 h-24 mb-3">
                  <img src={artist.artist_cover} alt="" className="w-full h-full object-cover rounded-full shadow-md" />
                  <div className="absolute -bottom-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-1.5 backdrop-blur-md">
                    <LikeButton userId={userId} itemType="artist" itemId={artist.artist_id} itemName={artist.artist_name} itemCover={artist.artist_cover} />
                  </div>
                </div>
                <span className="font-bold text-sm text-white truncate w-full text-center">{artist.artist_name}</span>
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
};
