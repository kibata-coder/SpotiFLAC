import React from 'react';

const SettingsPage: React.FC = () => {
  return (
    <div className="p-6 bg-zinc-900 text-white rounded-lg max-w-4xl mx-auto shadow-xl">
      <h2 className="text-2xl font-bold mb-6">Application Settings</h2>
      
      <div className="space-y-6">
        <div className="bg-zinc-800/40 p-5 rounded-md border border-zinc-700/50">
          <h3 className="text-lg font-semibold mb-2">Download Location</h3>
          <p className="text-sm text-zinc-400">
            Because you are using the Web version of SpotiFLAC, your browser will securely manage file storage. 
            All lossless FLAC files will automatically save to your system's default <strong>Downloads</strong> folder.
          </p>
        </div>

        <div className="bg-zinc-800/40 p-5 rounded-md border border-zinc-700/50">
          <h3 className="text-lg font-semibold mb-2">Audio Quality</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Web downloads are hardcoded to pull maximum quality uncompressed FLAC (16-bit/44.1kHz or higher) where available.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
