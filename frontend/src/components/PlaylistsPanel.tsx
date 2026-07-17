import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Music, Play, FolderHeart, FolderClosed, Loader2, Edit2, Share2, FolderPlus, Settings2, Link } from 'lucide-react';
import { toast } from 'sonner';
import type { SearchResult } from '../lib/api';
import { getPlaylistTracks as getYTPlaylistTracks } from '../lib/api';

interface Playlist {
  id: string;
  name: string;
  folder_id: string | null;
  is_collaborative: boolean;
  invite_code: string | null;
  is_smart: boolean;
  smart_rules: any;
  created_at: string;
}

interface PlaylistFolder {
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
  const [folders, setFolders] = useState<PlaylistFolder[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [activePlaylistTracks, setActivePlaylistTracks] = useState<PlaylistTrack[]>([]);
  
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editNameStr, setEditNameStr] = useState('');
  const [editFolderId, setEditFolderId] = useState<string | null>(null);

  const [showSmartModal, setShowSmartModal] = useState(false);
  const [smartName, setSmartName] = useState('');
  const [smartSource, setSmartSource] = useState('liked');

  const [loading, setLoading] = useState(false);
  const [tracksLoading, setTracksLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchData();
    } else {
      setPlaylists([]);
      setFolders([]);
      setActivePlaylistId(null);
    }
  }, [userId]);

  useEffect(() => {
    if (activePlaylistId) {
      fetchPlaylistData(activePlaylistId);
    } else {
      setActivePlaylistTracks([]);
    }
  }, [activePlaylistId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plRes, fRes] = await Promise.all([
        supabase.from('playlists').select('*').order('created_at', { ascending: false }),
        supabase.from('playlist_folders').select('*').order('created_at', { ascending: true })
      ]);
      if (plRes.error) throw plRes.error;
      if (fRes.error) throw fRes.error;
      
      setPlaylists(plRes.data || []);
      setFolders(fRes.data || []);
    } catch (err: any) {
      toast.error('Failed to load library');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaylistData = async (playlistId: string) => {
    setTracksLoading(true);
    try {
      const pl = playlists.find(p => p.id === playlistId);
      
      if (pl?.is_smart && pl.smart_rules) {
        // Evaluate smart rules (pseudo-implementation)
        // Here we just fetch liked songs if rule says 'source: liked'
        const { data, error } = await supabase.from('liked_songs').select('*').eq('user_id', userId).order('liked_at', { ascending: false });
        if (error) throw error;
        setActivePlaylistTracks(data || []);
      } else {
        const { data, error } = await supabase.from('playlist_tracks').select('*').eq('playlist_id', playlistId).order('added_at', { ascending: true });
        if (error) throw error;
        setActivePlaylistTracks(data || []);
      }
    } catch (err: any) {
      toast.error('Failed to load playlist tracks');
    } finally {
      setTracksLoading(false);
    }
  };

  // --- Folders ---
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const { error } = await supabase.from('playlist_folders').insert([{ name: newFolderName.trim(), user_id: userId }]);
      if (error) throw error;
      toast.success('Folder created');
      setNewFolderName('');
      fetchData();
    } catch (err) {
      toast.error('Failed to create folder');
    }
  };

  const handleDeleteFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this folder? Playlists inside will be moved out.')) return;
    try {
      await supabase.from('playlist_folders').delete().eq('id', folderId);
      toast.success('Folder deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete folder');
    }
  };

  // --- Playlists ---
  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    try {
      const { data, error } = await supabase.from('playlists').insert([{ name: newPlaylistName.trim(), user_id: userId }]).select();
      if (error) throw error;
      toast.success('Playlist created!');
      setNewPlaylistName('');
      fetchData();
      if (data && data[0]) setActivePlaylistId(data[0].id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create playlist');
    }
  };

  const handleCreateSmartPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smartName.trim()) return;
    try {
      const rules = { source: smartSource };
      const { data, error } = await supabase.from('playlists').insert([{ 
        name: smartName.trim(), 
        user_id: userId,
        is_smart: true,
        smart_rules: rules
      }]).select();
      if (error) throw error;
      toast.success('Smart Playlist created!');
      setSmartName('');
      setShowSmartModal(false);
      fetchData();
      if (data && data[0]) setActivePlaylistId(data[0].id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create smart playlist');
    }
  };

  const handleUpdatePlaylist = async (playlistId: string) => {
    try {
      const { error } = await supabase.from('playlists').update({ name: editNameStr, folder_id: editFolderId }).eq('id', playlistId);
      if (error) throw error;
      toast.success('Playlist updated');
      setEditingPlaylistId(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to update playlist');
    }
  };

  const handleDeletePlaylist = async (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this playlist?')) return;
    try {
      await supabase.from('playlists').delete().eq('id', playlistId);
      toast.success('Playlist deleted');
      if (activePlaylistId === playlistId) setActivePlaylistId(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete playlist');
    }
  };

  const handleMakeCollaborative = async (playlistId: string, isCollab: boolean) => {
    try {
      const code = isCollab ? Math.random().toString(36).substring(2, 10) : null;
      await supabase.from('playlists').update({ is_collaborative: isCollab, invite_code: code }).eq('id', playlistId);
      toast.success(isCollab ? 'Playlist is now collaborative' : 'Collaboration disabled');
      fetchData();
    } catch (err) {
      toast.error('Failed to update collaboration settings');
    }
  };

  const handleCopyInvite = (code: string) => {
    const url = `${window.location.origin}?join_playlist=${code}`;
    navigator.clipboard.writeText(url);
    toast.success('Invite link copied to clipboard!');
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (!activePlaylistId) return;
    try {
      await supabase.from('playlist_tracks').delete().eq('playlist_id', activePlaylistId).eq('track_id', trackId);
      toast.success('Song removed');
      fetchPlaylistData(activePlaylistId);
    } catch (err) {
      toast.error('Failed to remove track');
    }
  };

  const handlePlayTrack = (track: PlaylistTrack, index: number) => {
    const mappedTrack: SearchResult = { id: track.track_id, name: track.track_name, artists: track.track_artists, album: track.track_album, cover: track.track_cover };
    const queue: SearchResult[] = activePlaylistTracks.map(t => ({ id: t.track_id, name: t.track_name, artists: t.track_artists, album: t.track_album, cover: t.track_cover }));
    onPlayTrack(mappedTrack, `https://www.youtube.com/watch?v=${track.track_id}`, queue, index);
  };

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center"><FolderClosed className="w-10 h-10 text-zinc-400" /></div>
        <h2 className="text-white text-2xl font-bold m-0">Log in to view Playlists</h2>
        <button onClick={onOpenAuth} className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-full transition-colors mt-2">Sign In / Register</button>
      </div>
    );
  }

  const activePlaylist = playlists.find(p => p.id === activePlaylistId);
  
  // Group playlists by folder
  const playlistsByFolder: Record<string, Playlist[]> = { 'unassigned': [] };
  folders.forEach(f => playlistsByFolder[f.id] = []);
  playlists.forEach(p => {
    if (p.folder_id && playlistsByFolder[p.folder_id]) playlistsByFolder[p.folder_id].push(p);
    else playlistsByFolder['unassigned'].push(p);
  });

  return (
    <div className="w-full flex flex-col pb-12">
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mb-0.5">Your Playlists</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 flex flex-col gap-6">
          
          <div className="flex flex-col gap-2">
            <form onSubmit={handleCreatePlaylist} className="flex gap-2">
              <input type="text" placeholder="New playlist..." value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white" />
              <button type="submit" className="p-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg"><Plus className="w-5 h-5" /></button>
            </form>
            <div className="flex gap-2">
              <form onSubmit={handleCreateFolder} className="flex gap-2 flex-1">
                <input type="text" placeholder="New folder..." value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white" />
                <button type="submit" className="p-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg"><FolderPlus className="w-5 h-5" /></button>
              </form>
              <button onClick={() => setShowSmartModal(true)} className="p-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg" title="Create Smart Playlist">
                <Settings2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Folders */}
              {folders.map(folder => (
                <div key={folder.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between px-2 text-zinc-400 group">
                    <span className="text-xs font-bold uppercase tracking-widest">{folder.name}</span>
                    <button onClick={(e) => handleDeleteFolder(folder.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1"><Trash2 className="w-3 h-3" /></button>
                  </div>
                  {playlistsByFolder[folder.id].length === 0 && <span className="text-xs text-zinc-600 px-2 italic">Empty folder</span>}
                  {playlistsByFolder[folder.id].map(playlist => (
                    <button key={playlist.id} onClick={() => setActivePlaylistId(playlist.id)} className={`flex items-center justify-between p-2 pl-4 rounded-lg text-left text-sm font-semibold transition-all group ${activePlaylistId === playlist.id ? 'bg-emerald-500 text-black' : 'bg-zinc-800/40 text-white hover:bg-zinc-800'}`}>
                      <span className="truncate flex items-center gap-2">{playlist.is_smart ? <Settings2 className="w-4 h-4"/> : playlist.is_collaborative ? <Users className="w-4 h-4"/> : <Music className="w-4 h-4"/>} {playlist.name}</span>
                    </button>
                  ))}
                </div>
              ))}

              {/* Unassigned Playlists */}
              <div className="flex flex-col gap-1">
                {folders.length > 0 && <div className="px-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Playlists</div>}
                {playlistsByFolder['unassigned'].map(playlist => (
                  <button key={playlist.id} onClick={() => setActivePlaylistId(playlist.id)} className={`flex items-center justify-between p-2 rounded-lg text-left text-sm font-semibold transition-all group ${activePlaylistId === playlist.id ? 'bg-emerald-500 text-black' : 'bg-zinc-800/40 text-white hover:bg-zinc-800'}`}>
                    <span className="truncate flex items-center gap-2">{playlist.is_smart ? <Settings2 className="w-4 h-4"/> : playlist.is_collaborative ? <Users className="w-4 h-4"/> : <FolderHeart className="w-4 h-4"/>} {playlist.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-2 bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-4 sm:p-6 min-h-[300px]">
          {activePlaylist ? (
            <div>
              <div className="flex justify-between items-start mb-6 pb-4 border-b border-zinc-800">
                {editingPlaylistId === activePlaylist.id ? (
                  <div className="flex flex-col gap-3 w-full">
                    <input type="text" value={editNameStr} onChange={e => setEditNameStr(e.target.value)} className="w-full px-3 py-2 bg-zinc-800 rounded border border-zinc-700 text-white font-bold" />
                    <select value={editFolderId || ''} onChange={e => setEditFolderId(e.target.value || null)} className="w-full px-3 py-2 bg-zinc-800 rounded border border-zinc-700 text-white text-sm">
                      <option value="">No Folder</option>
                      {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdatePlaylist(activePlaylist.id)} className="px-3 py-1.5 bg-emerald-500 text-black rounded text-sm font-bold">Save</button>
                      <button onClick={() => setEditingPlaylistId(null)} className="px-3 py-1.5 bg-zinc-700 text-white rounded text-sm font-bold">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        {activePlaylist.is_smart && <Settings2 className="w-5 h-5 text-emerald-500" title="Smart Playlist" />}
                        {activePlaylist.is_collaborative && <Users className="w-5 h-5 text-blue-400" title="Collaborative" />}
                        {activePlaylist.name}
                      </h2>
                      <p className="text-xs text-zinc-400 mt-1">{activePlaylistTracks.length} songs</p>
                    </div>
                    <div className="flex gap-2">
                      {activePlaylist.is_collaborative && activePlaylist.invite_code && (
                        <button onClick={() => handleCopyInvite(activePlaylist.invite_code!)} className="p-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded" title="Copy Invite Link"><Link className="w-4 h-4" /></button>
                      )}
                      {!activePlaylist.is_smart && (
                        <button onClick={() => handleMakeCollaborative(activePlaylist.id, !activePlaylist.is_collaborative)} className={`p-2 rounded ${activePlaylist.is_collaborative ? 'bg-blue-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`} title={activePlaylist.is_collaborative ? 'Disable Collaboration' : 'Make Collaborative'}><Share2 className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => { setEditingPlaylistId(activePlaylist.id); setEditNameStr(activePlaylist.name); setEditFolderId(activePlaylist.folder_id); }} className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={(e) => handleDeletePlaylist(activePlaylist.id, e)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </>
                )}
              </div>

              {tracksLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
              ) : activePlaylistTracks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-sm gap-2"><Music className="w-8 h-8" /><span>No songs in playlist.</span></div>
              ) : (
                <div className="flex flex-col gap-1">
                  {activePlaylistTracks.map((track, idx) => (
                    <div key={track.id} className="flex items-center gap-3 p-2 hover:bg-zinc-800/50 rounded-lg group">
                      <button onClick={() => handlePlayTrack(track, idx)} className="w-8 h-8 rounded-full bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-black flex items-center justify-center shrink-0"><Play className="w-3.5 h-3.5 ml-0.5" /></button>
                      {track.track_cover ? <img src={track.track_cover} alt="" className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center"><Music className="w-4 h-4 text-zinc-500" /></div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{track.track_name}</p>
                        <p className="text-xs text-zinc-400 truncate">{track.track_artists}</p>
                      </div>
                      {!activePlaylist.is_smart && (
                        <button onClick={() => handleRemoveTrack(track.track_id)} className="p-1.5 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-sm gap-2 py-20 text-center">
              <FolderHeart className="w-12 h-12" />
              <span className="font-semibold">Select a playlist</span>
            </div>
          )}
        </div>
      </div>

      {/* Smart Playlist Modal */}
      {showSmartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Settings2 className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Create Smart Playlist</h3>
                <p className="text-xs text-zinc-400">Auto-updates based on rules</p>
              </div>
            </div>
            <form onSubmit={handleCreateSmartPlaylist} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Playlist Name</label>
                <input required type="text" value={smartName} onChange={e => setSmartName(e.target.value)} placeholder="e.g. All Liked Songs" className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white outline-none focus:border-emerald-500" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Rule</label>
                <select value={smartSource} onChange={e => setSmartSource(e.target.value)} className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white outline-none focus:border-emerald-500 appearance-none cursor-pointer">
                  <option value="liked">Source: Liked Songs</option>
                  {/* More rules can be added here */}
                </select>
                <p className="text-xs text-zinc-500 mt-1">This playlist will automatically contain all your saved liked tracks.</p>
              </div>
              <div className="flex gap-3 mt-4 pt-4 border-t border-zinc-800">
                <button type="button" onClick={() => setShowSmartModal(false)} className="flex-1 py-3 text-sm font-bold text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 text-sm font-bold text-black bg-emerald-500 hover:bg-emerald-400 rounded-xl">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
