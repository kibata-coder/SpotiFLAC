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

  // Convert the binary stream into a browser download
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = downloadUrl;
  
  // Clean up filename to prevent weird browser saving bugs
  const safeTrackName = trackName.replace(/[^a-zA-Z0-9 -]/g, "");
  link.download = `${safeTrackName}.flac`;
  
  document.body.appendChild(link);
  link.click();
  
  // Memory cleanup
  window.URL.revokeObjectURL(downloadUrl);
  link.remove();
}

export function getStreamUrl(spotifyId: string, service: string = 'tidal'): string {
  return `${API_BASE_URL}/api/stream?spotify_id=${encodeURIComponent(spotifyId)}&service=${encodeURIComponent(service)}`;
}
