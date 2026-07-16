// Use relative paths, but explicitly enforce HTTPS on production to prevent 301 redirects dropping the POST method (causing HTTP 405s)
let API_BASE_URL = "";
if (window.location.hostname.includes("railway.app")) {
  API_BASE_URL = `https://${window.location.hostname}`;
}
export interface SearchResult {
  id: string;
  name: string;
  artists: string;
  album?: string;
  cover?: string;
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
    try {
      errorText = await response.text();
    } catch (e) {}
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
