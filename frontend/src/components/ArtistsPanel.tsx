import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Music, Play, UserCheck, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { searchSpotify } from '../lib/api';
import type { SearchResult } from '../lib/api';

interface FollowedArtist {
  id: string;
  artist_name: string;
  created_at: string;
}

interface ArtistsPanelProps {
  userId: string | null;
  onPlayTrack: (track: SearchResult, streamUrl: string, queue: SearchResult[], index: number) => void;
  onOpenAuth: () => void;
}

export const ArtistsPanel: React.FC<ArtistsPanelProps> = ({ userId, onPlayTrack, onOpenAuth }) => {
  const [artists, setArtists] = useState<FollowedArtist[]>([]);
  const [activeArtistName, setActiveArtistName] = useState<string | null>(null);
  const [artistTracks, setArtistTracks] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [tracksLoading, setTracksLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchFollowedArtists();
    } else {
      setArtists([]);
      setActiveArtistName(null);
    }
  }, [userId]);

  useEffect(() => {
    if (activeArtistName) {
      fetchArtistTracks(activeArtistName);
    } else {
      setArtistTracks([]);
    }
  }, [activeArtistName]);

  const fetchFollowedArtists = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('followed_artists')
        .select('*')
        .order('artist_name', { ascending: true });

      if (error) throw error;
      setArtists(data || []);
    } catch (err: any) {
      toast.error('Failed to load followed artists');
    } finally {
      setLoading(false);
    }
  };

  const fetchArtistTracks = async (artistName: string) => {
    setTracksLoading(true);
    try {
      // Pull artist songs using search API
      const tracks = await searchSpotify(artistName, 'track');
      setArtistTracks(tracks || []);
    } catch (err: any) {
      toast.error(`Failed to fetch tracks for ${artistName}`);
    } finally {
      setTracksLoading(false);
    }
  };

  const handleUnfollowArtist = async (artistName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('followed_artists')
        .delete()
        .eq('artist_name', artistName);

      if (error) throw error;
      toast.success(`Unfollowed ${artistName}`);
      if (activeArtistName === artistName) {
        setActiveArtistName(null);
      }
      fetchFollowedArtists();
    } catch (err: any) {
      toast.error('Failed to unfollow artist');
    }
  };

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
          <Users className="w-10 h-10 text-zinc-400" />
        </div>
        <h2 className="text-white text-2xl font-bold m-0">Log in to follow Artists</h2>
        <p className="m-0 text-sm text-zinc-400 text-center max-w-xs">
          Build a list of your favorite artists and instantly load their top tracks on any device.
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

  return (
    <div className="w-full flex flex-col pb-12">
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mb-0.5">
          Followed Artists
        </h1>
        <p className="text-xs text-zinc-400">
          Sync your interested music creators and easily browse their releases.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Artists List */}
        <div className="md:col-span-1 bg-zinc-900/10 border border-zinc-800/80 rounded-xl p-4">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
          ) : artists.length === 0 ? (
            <div className="text-zinc-500 text-sm py-4 text-center">
              You aren't following any artists yet. Find them in the Search tab!
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {artists.map((artist) => (
                <button
                  key={artist.id}
                  onClick={() => setActiveArtistName(artist.artist_name)}
                  className={`flex items-center justify-between p-3 rounded-lg text-left text-sm font-semibold transition-all group ${
                    activeArtistName === artist.artist_name
                      ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/10'
                      : 'bg-zinc-800/40 text-white hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <UserCheck className="w-4 h-4 shrink-0" />
                    <span className="truncate">{artist.artist_name}</span>
                  </div>
                  <button
                    onClick={(e) => handleUnfollowArtist(artist.artist_name, e)}
                    className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 ${
                      activeArtistName === artist.artist_name ? 'text-zinc-950 hover:bg-black/10' : 'text-red-400'
                    }`}
                    title="Unfollow"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column - Artist Tracks Details */}
        <div className="md:col-span-2 bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-4 sm:p-6 min-h-[300px]">
          {activeArtistName ? (
            <div>
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800">
                <div>
                  <h2 className="text-xl font-bold text-white leading-tight">
                    {activeArtistName}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Showing top tracks loaded from your follow feed
                  </p>
                </div>
              </div>

              {tracksLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
              ) : artistTracks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-sm gap-2">
                  <Music className="w-8 h-8 text-zinc-600" />
                  <span>No songs found for this artist.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {artistTracks.map((track, idx) => (
                    <div
                      key={track.id}
                      className="flex items-center gap-3 p-2 hover:bg-zinc-800/50 rounded-lg group transition-colors animate-fade-in"
                    >
                      <button
                        onClick={() => onPlayTrack(track, `https://www.youtube.com/watch?v=${track.id}`, artistTracks, idx)}
                        className="w-8 h-8 rounded-full bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-black flex items-center justify-center transition-colors shrink-0"
                      >
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </button>

                      {track.cover ? (
                        <img src={track.cover} alt="" className="w-10 h-10 rounded shrink-0 object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center shrink-0">
                          <Music className="w-4 h-4 text-zinc-500" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate leading-snug">{track.name}</p>
                        <p className="text-xs text-zinc-400 truncate leading-snug">{track.album || 'Unknown Album'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-sm gap-2 py-20 text-center">
              <Users className="w-12 h-12 text-zinc-700" />
              <span className="font-semibold">Select an artist</span>
              <span className="text-xs text-zinc-600 max-w-xs">Select any followed artist on the left to quickly stream their popular tracks.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
