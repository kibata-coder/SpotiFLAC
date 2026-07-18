import React from 'react';
import { SlidersHorizontal, Settings2, ShieldCheck, Zap } from 'lucide-react';

export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 4000, 16000];

export const EQ_PRESETS: Record<string, number[]> = {
  'Flat': [0, 0, 0, 0, 0, 0, 0, 0],
  'Bass Boost': [6, 5, 4, 1, 0, 0, 0, 0],
  'Vocal Clarity': [0, 0, 0, 2, 4, 5, 2, 0],
  'Rock': [5, 4, -1, -2, -1, 2, 4, 5],
  'Classical': [4, 3, 0, -1, 0, 1, 3, 4],
};

interface EqualizerPanelProps {
  eqGains: number[];
  setEqGain: (index: number, value: number) => void;
  applyPreset: (preset: number[]) => void;
  isLossless: boolean;
  setIsLossless: (v: boolean) => void;
  crossfadeSecs: number;
  setCrossfadeSecs: (v: number) => void;
  onClose: () => void;
}

export const EqualizerPanel: React.FC<EqualizerPanelProps> = ({
  eqGains,
  setEqGain,
  applyPreset,
  isLossless,
  setIsLossless,
  crossfadeSecs,
  setCrossfadeSecs,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Audio Settings</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white px-3 py-1 bg-zinc-800 rounded-lg text-xs font-bold">
            Done
          </button>
        </div>

        <div className="p-6 flex flex-col gap-8 overflow-y-auto max-h-[80vh]">
          {/* EQ Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5" /> 8-Band Equalizer
              </h4>
            </div>
            
            {/* Sliders */}
            <div className="flex justify-between items-end h-40 gap-1 md:gap-2 px-2 bg-zinc-950 rounded-xl p-4 border border-zinc-800/50">
              {EQ_BANDS.map((freq, i) => (
                <div key={freq} className="flex flex-col items-center gap-3 flex-1">
                  <span className="text-[10px] text-zinc-500 font-bold">{eqGains[i] > 0 ? '+' : ''}{eqGains[i]}</span>
                  <div className="relative h-24 w-1.5 md:w-2 bg-zinc-800 rounded-full">
                    {/* Fill track from center */}
                    <div 
                      className="absolute w-full bg-emerald-500 rounded-full"
                      style={{
                        bottom: eqGains[i] >= 0 ? '50%' : `${50 + (eqGains[i] / 12) * 50}%`,
                        height: `${Math.abs(eqGains[i] / 12) * 50}%`,
                        backgroundColor: eqGains[i] >= 0 ? '#10b981' : '#f43f5e'
                      }}
                    />
                    <input 
                      type="range"
                      min="-12" max="12" step="1"
                      value={eqGains[i]}
                      onChange={(e) => setEqGain(i, parseInt(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize"
                      style={{ writingMode: 'vertical-lr', direction: 'rtl' } as any}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-bold">{freq >= 1000 ? `${freq/1000}k` : freq}</span>
                </div>
              ))}
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-2 mt-4">
              {Object.keys(EQ_PRESETS).map(preset => (
                <button 
                  key={preset}
                  onClick={() => applyPreset(EQ_PRESETS[preset])}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-zinc-800" />

          {/* Quality & Crossfade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" /> Audio Quality
              </h4>
              <div 
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${isLossless ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'}`}
                onClick={() => setIsLossless(!isLossless)}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isLossless ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">High-Fidelity</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Stream best native audio</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Crossfade
              </h4>
              <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900 flex flex-col justify-center h-full gap-3">
                <div className="flex justify-between text-xs font-bold text-white">
                  <span>{crossfadeSecs}s fade</span>
                  <span className="text-zinc-500">12s max</span>
                </div>
                <input 
                  type="range" min="0" max="12" step="1"
                  value={crossfadeSecs}
                  onChange={(e) => setCrossfadeSecs(parseInt(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
