import React, { useState } from 'react';
import { searchSpotify, downloadTrackWeb } from '../lib/api'; 
import type { SearchResult } from '../lib/api';

export const SearchPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('track');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState<Record<string, boolean>>({});

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const data = await searchSpotify(query, searchType);
      setResults(data || []);
    } catch (error) {
      console.error("Search error:", error);
      alert("Search failed. Ensure your backend is reachable.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (track: SearchResult) => {
    if (downloadingIds[track.id]) return;
    
    setDownloadingIds(prev => ({ ...prev, [track.id]: true }));

    try {
      // Passes parameters safely down to your stream engine
      await downloadTrackWeb(track.id, 'tidal', track.name);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to process and stream file from server.");
    } finally {
      setDownloadingIds(prev => ({ ...prev, [track.id]: false }));
    }
  };

  return (
    <div className="p-6 bg-zinc-900 text-white rounded-lg w-full max-w-4xl mx-auto shadow-xl">
      <h2 className="text-2xl font-bold mb-6">SpotiFLAC Web Search</h2>
      
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <select 
          value={searchType} 
          onChange={(e) => setSearchType(e.target.value)}
          className="bg-zinc-800 text-sm rounded-md border border-zinc-700 px-4 py-3 outline-none focus:border-green-500"
        >
          <option value="track">Songs</option>
          <option value="album">Albums</option>
        </select>
        
        <input
          type="text"
          placeholder="Enter a track or album name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-4 py-3 text-sm outline-none focus:border-green-500"
        />
        
        <button 
          type="submit" 
          disabled={loading}
          className="bg-green-600 hover:bg-green-500 disabled:bg-zinc-600 px-8 py-3 rounded-md text-sm font-semibold transition"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
        {results.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-4 bg-zinc-800/40 hover:bg-zinc-800 rounded-md transition border border-zinc-800/50">
            <div className="flex items-center gap-4">
              {item.cover ? (
                <img src={item.cover} alt="cover" className="w-14 h-14 rounded shadow-sm object-cover" />
              ) : (
                <div className="w-14 h-14 rounded bg-zinc-700 flex items-center justify-center text-xl">🎵</div>
              )}
              <div>
                <div className="font-semibold text-sm mb-1">{item.name}</div>
                <div className="text-xs text-zinc-400">
                  {item.artists} {item.album ? `• ${item.album}` : ''}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleDownload(item)}
              disabled={downloadingIds[item.id]}
              className={`px-5 py-2 rounded-md text-xs font-bold transition ${
                downloadingIds[item.id] 
                  ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' 
                  : 'bg-white text-black hover:bg-zinc-200 shadow-md'
              }`}
            >
              {downloadingIds[item.id] ? 'Extracting FLAC...' : 'Download'}
            </button>
          </div>
        ))}
        
        {!loading && results.length === 0 && (
          <div className="text-center py-12 text-zinc-500 text-sm">
            Search for a track to begin pulling lossless audio.
          </div>
        )}
      </div>
    </div>
  );
};
