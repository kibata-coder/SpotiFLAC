import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Music, Play, FolderHeart, FolderClosed, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { SearchResult } from '../lib/api';

interface Playlist {
  id: string;
  name: string;
  created_at: string;
}

interface PlaylistTrack {
  id: string;
  track_id: string;
  track_name: string;
  track_artists: string;
  track_cover: string;
  track_album: string;
}

interface PlaylistsPanelProps {
  userId: string | null;
  onPlayTrack: (track: SearchResult, streamUrl: string, queue: SearchResult[], index: number) => void;
  onOpenAuth: () => void;
}

export const PlaylistsPanel: React.FC<PlaylistsPanelProps> = ({ userId, onPlayTrack, onOpenAuth }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [activePlaylistTracks, setActivePlaylistTracks] = useState<PlaylistTrack[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [loading, setLoading] = useState(false);
  const [tracksLoading, setTracksLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchPlaylists();
    } else {
      setPlaylists([]);
      setActivePlaylistId(null);
    }
  }, [userId]);

  useEffect(() => {
    if (activePlaylistId) {
      fetchPlaylistTracks(activePlaylistId);
    } else {
      setActivePlaylistTracks([]);
    }
  }, [activePlaylistId]);

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlaylists(data || []);
    } catch (err: any) {
      toast.error('Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaylistTracks = async (playlistId: string) => {
    setTracksLoading(true);
    try {
      const { data, error } = await supabase
        .from('playlist_tracks')
        .select('*')
        .eq('playlist_id', playlistId)
        .order('added_at', { ascending: true });

      if (error) throw error;
      setActivePlaylistTracks(data || []);
    } catch (err: any) {
      toast.error('Failed to load playlist tracks');
    } finally {
      setTracksLoading(false);
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('playlists')
        .insert([{ name: newPlaylistName.trim(), user_id: userId }])
        .select();

      if (error) throw error;
      toast.success('Playlist created!');
      setNewPlaylistName('');
      fetchPlaylists();
      if (data && data[0]) {
        setActivePlaylistId(data[0].id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create playlist');
    }
  };

  const handleDeletePlaylist = async (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this playlist?')) return;

    try {
      const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlistId);

      if (error) throw error;
      toast.success('Playlist deleted');
      if (activePlaylistId === playlistId) {
        setActivePlaylistId(null);
      }
      fetchPlaylists();
    } catch (err: any) {
      toast.error('Failed to delete playlist');
    }
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (!activePlaylistId) return;

    try {
      const { error } = await supabase
        .from('playlist_tracks')
        .delete()
        .eq('playlist_id', activePlaylistId)
        .eq('track_id', trackId);

      if (error) throw error;
      toast.success('Song removed from playlist');
      fetchPlaylistTracks(activePlaylistId);
    } catch (err: any) {
      toast.error('Failed to remove track');
    }
  };

  const handlePlayTrack = (track: PlaylistTrack, index: number) => {
    // Map custom playlist track metadata scheme to general SearchResult
    const mappedTrack: SearchResult = {
      id: track.track_id,
      name: track.track_name,
      artists: track.track_artists,
      album: track.track_album,
      cover: track.track_cover
    };

    const queue: SearchResult[] = activePlaylistTracks.map(t => ({
      id: t.track_id,
      name: t.track_name,
      artists: t.track_artists,
      album: t.track_album,
      cover: t.track_cover
    }));

    onPlayTrack(mappedTrack, `https://www.youtube.com/watch?v=${track.track_id}`, queue, index);
  };

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
          <FolderClosed className="w-10 h-10 text-zinc-400" />
        </div>
        <h2 className="text-white text-2xl font-bold m-0">Log in to view Playlists</h2>
        <p className="m-0 text-sm text-zinc-400 text-center max-w-xs">
          Synchronize and manage custom music collections from any of your devices.
        </p>
        <button
          onClick={onOpenAuth}
          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-full transition-colors mt-2"
        >
          Sign In / Register
        </button>
      </div>
    );
  }

  const activePlaylist = playlists.find(p => p.id === activePlaylistId);

  return (
    <div className="w-full flex flex-col pb-12">
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mb-0.5">
          Your Playlists
        </h1>
        <p className="text-xs text-zinc-400">
          Create lists and keep your music collections synced in the cloud.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Playlists List */}
        <div className="md:col-span-1 flex flex-col gap-4">
          <form onSubmit={handleCreatePlaylist} className="flex gap-2">
            <input
              type="text"
              placeholder="New playlist name..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              type="submit"
              className="p-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg transition-colors"
              title="Create Playlist"
            >
              <Plus className="w-5 h-5" />
            </button>
          </form>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-zinc-500 text-sm py-4 text-center">No playlists created yet.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => setActivePlaylistId(playlist.id)}
                  className={`flex items-center justify-between p-3 rounded-lg text-left text-sm font-semibold transition-all group ${
                    activePlaylistId === playlist.id
                      ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/10'
                      : 'bg-zinc-800/40 text-white hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FolderHeart className="w-4 h-4 shrink-0" />
                    <span className="truncate">{playlist.name}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                    className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 ${
                      activePlaylistId === playlist.id ? 'text-zinc-950 hover:bg-black/10' : 'text-red-400'
                    }`}
                    title="Delete Playlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column - Playlist Details */}
        <div className="md:col-span-2 bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-4 sm:p-6 min-h-[300px]">
          {activePlaylistId ? (
            <div>
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800">
                <div>
                  <h2 className="text-xl font-bold text-white leading-tight">
                    {activePlaylist?.name}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    {activePlaylistTracks.length} {activePlaylistTracks.length === 1 ? 'song' : 'songs'} in this playlist
                  </p>
                </div>
              </div>

              {tracksLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
              ) : activePlaylistTracks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-sm gap-2">
                  <Music className="w-8 h-8 text-zinc-600 animate-pulse" />
                  <span>No songs added to this playlist yet.</span>
                  <span className="text-xs text-zinc-600">Search for tracks and add them!</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {activePlaylistTracks.map((track, idx) => (
                    <div
                      key={track.id}
                      className="flex items-center gap-3 p-2 hover:bg-zinc-800/50 rounded-lg group transition-colors"
                    >
                      <button
                        onClick={() => handlePlayTrack(track, idx)}
                        className="w-8 h-8 rounded-full bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-black flex items-center justify-center transition-colors shrink-0"
                      >
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </button>

                      {track.track_cover ? (
                        <img src={track.track_cover} alt="" className="w-10 h-10 rounded shrink-0 object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center shrink-0">
                          <Music className="w-4 h-4 text-zinc-500" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate leading-snug">{track.track_name}</p>
                        <p className="text-xs text-zinc-400 truncate leading-snug">{track.track_artists}</p>
                      </div>

                      <button
                        onClick={() => handleRemoveTrack(track.track_id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove from Playlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-sm gap-2 py-20 text-center">
              <FolderHeart className="w-12 h-12 text-zinc-700" />
              <span className="font-semibold">Select a playlist</span>
              <span className="text-xs text-zinc-600 max-w-xs">Choose or create a playlist from the left column to view and play songs.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
