// Empty string = use relative URLs → hits Cloudflare Pages Function proxy → Railway
const API_BASE_URL = "";

export interface SearchResult {
  id: string;
  name: string;
  artists: string;
  album?: string;
  cover?: string;
  type?: 'track' | 'album' | 'artist' | 'playlist';
  year?: string;
}

export async function searchSpotify(query: string, searchType: string = 'track'): Promise<SearchResult[]> {
  const response = await fetch(`${API_BASE_URL}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: query,
      search_type: searchType,
      limit: 20,
      offset: 0
    }),
  });

  if (!response.ok) {
    let errorText = '';
    try { errorText = await response.text(); } catch (e) {}
    throw new Error(`Search failed: HTTP ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

export async function downloadTrackWeb(spotifyId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/download?spotify_id=${encodeURIComponent(spotifyId)}`, {
    method: "GET",
  });

  if (!response.ok) {
    let errorMsg = "Download failed. Please try again.";
    try {
      const errorData = await response.json();
      if (errorData.error)   errorMsg = errorData.error;
      else if (errorData.message) errorMsg = errorData.message;
    } catch (e) {}
    throw new Error(errorMsg);
  }

  return await response.blob();
}

export function getStreamUrl(spotifyId: string): string {
  return `${API_BASE_URL}/api/stream?spotify_id=${encodeURIComponent(spotifyId)}`;
}

export async function getLyrics(spotifyId: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/lyrics?spotify_id=${encodeURIComponent(spotifyId)}`);
  
  if (!response.ok) {
    let errorMsg = "Lyrics not available.";
    try {
      const errorData = await response.json();
      if (errorData.error) errorMsg = errorData.error;
    } catch (e) {}
    throw new Error(errorMsg);
  }
  
  const data = await response.json();
  return data.lyrics || "";
}

export async function getRadio(videoId: string): Promise<SearchResult[]> {
  const response = await fetch(`${API_BASE_URL}/api/radio?video_id=${encodeURIComponent(videoId)}`);
  if (!response.ok) {
    throw new Error("Failed to load radio");
  }
  const data = await response.json();
  return data.tracks || [];
}

export async function getArtistTopTracks(channelId: string): Promise<{ tracks: SearchResult[]; artist_name: string }> {
  const response = await fetch(`${API_BASE_URL}/api/artist-top-tracks?channel_id=${encodeURIComponent(channelId)}`);
  if (!response.ok) throw new Error("Failed to load artist tracks");
  return response.json();
}

// ─── Phase 2: Discovery ────────────────────────────────────────────────────

export interface ChartTrack extends SearchResult {
  rank?: number;
  trend?: 'UP' | 'DOWN' | 'NEUTRAL';
}

export interface MoodCategory {
  title: string;
  params: string;
  cover: string;
  section: string;
}

export interface MoodPlaylist {
  id: string;
  name: string;
  cover: string;
}

export interface PlaylistMeta {
  title: string;
  description: string;
  cover: string;
  trackCount: number;
}

export async function getCharts(country = 'ZZ'): Promise<{ songs: ChartTrack[]; trending: SearchResult[] }> {
  const res = await fetch(`${API_BASE_URL}/api/charts?country=${country}`);
  if (!res.ok) throw new Error('Charts unavailable');
  return res.json();
}

export async function getMoods(): Promise<{ categories: MoodCategory[] }> {
  const res = await fetch(`${API_BASE_URL}/api/moods`);
  if (!res.ok) throw new Error('Moods unavailable');
  return res.json();
}

export async function getMoodPlaylists(params: string): Promise<{ playlists: MoodPlaylist[] }> {
  const res = await fetch(`${API_BASE_URL}/api/mood-playlists?params=${encodeURIComponent(params)}`);
  if (!res.ok) throw new Error('Mood playlists unavailable');
  return res.json();
}

export async function getPlaylistTracks(playlistId: string): Promise<{ tracks: SearchResult[]; meta: PlaylistMeta }> {
  const res = await fetch(`${API_BASE_URL}/api/playlist-tracks?playlist_id=${encodeURIComponent(playlistId)}`);
  if (!res.ok) throw new Error('Playlist tracks unavailable');
  return res.json();
}

export async function getRecommendations(seedIds: string[]): Promise<{ tracks: SearchResult[] }> {
  const res = await fetch(`${API_BASE_URL}/api/recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed_ids: seedIds }),
  });
  if (!res.ok) throw new Error('Recommendations unavailable');
  return res.json();
}

export async function getArtistReleases(channelId: string): Promise<{ releases: Array<{ id: string; name: string; type: string; year: string; cover: string }>; artist_name: string }> {
  const res = await fetch(`${API_BASE_URL}/api/artist-releases?channel_id=${encodeURIComponent(channelId)}`);
  if (!res.ok) throw new Error('Artist releases unavailable');
  return res.json();
}

