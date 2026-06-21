import React, { useState } from 'react';
import { Search as SearchIcon, Download, Loader2, Music, Disc3 } from 'lucide-react';
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
      await downloadTrackWeb(track.id, 'tidal', track.name);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to process and stream file from server.");
    } finally {
      setDownloadingIds(prev => ({ ...prev, [track.id]: false }));
    }
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto text-white flex flex-col gap-8 pb-12">
      
      {/* Search Header Section */}
      <div className="flex flex-col gap-4 sticky top-0 z-10 pt-4 pb-2 bg-[#121212]/95 backdrop-blur-md">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-3xl">
          
          {/* Pill-shaped Search Input */}
          <div className="relative flex-1 group">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#b3b3b3] group-focus-within:text-white transition-colors" />
            <input
              type="text"
              placeholder="What do you want to download?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-[#242424] hover:bg-[#2a2a2a] focus:bg-[#2a2a2a] focus:ring-1 focus:ring-white border border-transparent rounded-full py-3.5 pl-12 pr-4 text-sm font-medium text-white placeholder-[#b3b3b3] outline-none transition-all shadow-sm"
            />
          </div>

          {/* Type Selector */}
          <div className="flex gap-2">
            <div className="relative bg-[#242424] hover:bg-[#2a2a2a] rounded-full flex items-center px-4 transition-colors">
              {searchType === 'track' ? <Music className="w-4 h-4 text-[#b3b3b3] mr-2" /> : <Disc3 className="w-4 h-4 text-[#b3b3b3] mr-2" />}
              <select 
                value={searchType} 
                onChange={(e) => setSearchType(e.target.value)}
                className="bg-transparent text-sm font-bold text-white outline-none appearance-none cursor-pointer pr-4"
              >
                <option value="track" className="bg-[#242424]">Tracks</option>
                <option value="album" className="bg-[#242424]">Albums</option>
              </select>
            </div>
            
            {/* Action Button */}
            <button 
              type="submit" 
              disabled={loading || !query.trim()}
              className="bg-white hover:scale-105 hover:bg-gray-100 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed text-black px-8 py-3.5 rounded-full text-sm font-bold transition-transform duration-200 shadow-sm flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </div>
        </form>
      </div>

      {/* Results Section */}
      <div className="flex flex-col">
        {results.length > 0 && (
          <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-2 text-[#b3b3b3] text-sm font-medium border-b border-[#242424] mb-2 sticky top-[88px] bg-[#121212]/95 backdrop-blur-md z-10">
            <div className="w-8 text-center">#</div>
            <div>Title</div>
            <div className="pr-4">Action</div>
          </div>
        )}

        <div className="space-y-1">
          {results.map((item, index) => (
            <div 
              key={item.id} 
              className="group grid grid-cols-[auto_1fr_auto] gap-4 items-center px-4 py-2 hover:bg-[#1a1a1a] rounded-md transition-colors"
            >
              {/* Row Number */}
              <div className="w-8 text-center text-[#b3b3b3] font-medium text-sm">
                {index + 1}
              </div>

              {/* Track Info */}
              <div className="flex items-center gap-3 overflow-hidden">
                {item.cover ? (
                  <img src={item.cover} alt={`${item.name} cover`} className="w-10 h-10 rounded shadow-sm object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-[#242424] flex items-center justify-center text-neutral-500 flex-shrink-0">
                    <Music className="w-5 h-5" />
                  </div>
                )}
                <div className="flex flex-col truncate">
                  <span className="font-medium text-white text-base truncate">{item.name}</span>
                  <span className="text-sm text-[#b3b3b3] hover:underline cursor-pointer truncate">
                    {item.artists} {item.album ? `• ${item.album}` : ''}
                  </span>
                </div>
              </div>

              {/* Download Button */}
              <div className="flex items-center justify-end">
                <button
                  onClick={() => handleDownload(item)}
                  disabled={downloadingIds[item.id]}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
                    downloadingIds[item.id] 
                      ? 'bg-transparent text-[#1DB954]' 
                      : 'bg-transparent text-[#b3b3b3] border border-[#b3b3b3] hover:text-white hover:border-white hover:scale-105 opacity-0 group-hover:opacity-100 focus:opacity-100'
                  }`}
                >
                  {downloadingIds[item.id] ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download FLAC
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {/* Empty State */}
        {!loading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-full bg-[#242424] flex items-center justify-center mb-6">
              <SearchIcon className="w-8 h-8 text-[#b3b3b3]" />
            </div>
            <h3 className="text-white text-xl font-bold mb-2">Search for content</h3>
            <p className="text-[#b3b3b3] max-w-sm">
              Find your favorite tracks or albums and download them in pure, lossless FLAC quality.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
