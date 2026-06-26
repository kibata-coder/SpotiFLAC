// Replace this with your actual Railway URL once deployed
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";

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
    throw new Error(`Search failed: ${response.statusText}`);
  }

  return response.json();
}

export async function downloadTrackWeb(spotifyId: string, service: string, trackName: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      spotify_id: spotifyId,
      service: service
    }),
  });

  if (!response.ok) {
    let errorMsg = "Failed to process and stream audio from the server.";
    try {
      const errorData = await response.json();
      if (errorData.error) errorMsg = errorData.error;
      else if (errorData.message) errorMsg = errorData.message;
      else if (errorData.Error) errorMsg = errorData.Error;
    } catch (e) {}
    throw new Error(errorMsg);
  }

  // Parse the JSON response to get the direct Cobalt URL
  const data = await response.json();
  if (!data.download_url) {
    throw new Error("No download URL returned from server.");
  }

  // Redirect the browser to the direct Cobalt download URL
  const link = document.createElement("a");
  link.href = data.download_url;
  
  // Clean up filename to prevent weird browser saving bugs
  const safeTrackName = trackName.replace(/[^a-zA-Z0-9 -]/g, "");
  link.download = `${safeTrackName}.flac`; // Force download attribute
  
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function getStreamUrl(spotifyId: string, service: string = 'tidal'): string {
  return `${API_BASE_URL}/api/stream?spotify_id=${encodeURIComponent(spotifyId)}&service=${encodeURIComponent(service)}`;
}
