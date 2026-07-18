import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface CookiesStatus {
  cookies_loaded: boolean;
  message: string;
}

export const SettingsPanel: React.FC = () => {
  const [status, setStatus] = useState<CookiesStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/cookies/status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      toast.error('File must be a .txt file');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/cookies/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      toast.success(data.message || 'Cookies uploaded successfully!');
      fetchStatus();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col p-8 max-w-2xl mx-auto w-full h-full animate-in fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Settings</h2>
        <p className="text-zinc-400">Configure app preferences and backend authentications.</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              YouTube Authentication (Bot Bypass)
            </h3>
            <p className="text-sm text-zinc-400 mt-1 max-w-md">
              YouTube frequently blocks SpotiFLAC's backend from streaming audio to verify you aren't a bot. 
              To fix playback and download errors, export your YouTube cookies as a <code className="bg-zinc-800 px-1 rounded text-emerald-400">cookies.txt</code> file and upload it here.
            </p>
          </div>
          <div className="shrink-0 ml-4">
            {loading ? (
              <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-emerald-500 animate-spin" />
            ) : status?.cookies_loaded ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-full text-sm font-bold border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" /> Active
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-rose-500/10 text-rose-500 px-3 py-1.5 rounded-full text-sm font-bold border border-rose-500/20">
                <XCircle className="w-4 h-4" /> Missing
              </div>
            )}
          </div>
        </div>

        {!status?.cookies_loaded && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="text-sm text-amber-200/80">
              <strong>Playback is currently blocked!</strong> You must upload a cookies.txt file to restore streaming and downloading functionality.
              <a href="https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp" target="_blank" rel="noreferrer" className="block mt-2 text-amber-400 hover:underline">
                Read how to extract cookies here &rarr;
              </a>
            </div>
          </div>
        )}

        <label className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-zinc-700 border-dashed rounded-xl cursor-pointer bg-zinc-800/50 hover:bg-zinc-800 hover:border-emerald-500/50 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className={`w-8 h-8 mb-3 ${uploading ? 'text-emerald-500 animate-bounce' : 'text-zinc-400'}`} />
            <p className="mb-2 text-sm text-zinc-300">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-zinc-500">cookies.txt file only</p>
          </div>
          <input type="file" className="hidden" accept=".txt" onChange={handleFileUpload} disabled={uploading} />
        </label>
      </div>
    </div>
  );
};
