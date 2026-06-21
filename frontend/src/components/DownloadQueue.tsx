import React from 'react';

const DownloadQueue: React.FC = () => {
  return (
    <div className="p-6 bg-zinc-900 text-white rounded-lg w-full max-w-4xl mx-auto shadow-xl">
      <h2 className="text-2xl font-bold mb-6">Download Queue</h2>
      
      <div className="flex flex-col items-center justify-center py-16 text-zinc-500 border-2 border-dashed border-zinc-800 rounded-lg">
        <div className="text-4xl mb-4">📥</div>
        <p className="text-sm text-center max-w-sm">
          Downloads are now managed natively by your web browser. Check your browser's download manager to view live progress of your streaming tracks.
        </p>
      </div>
    </div>
  );
};

export default DownloadQueue;
