import React from 'react';
import { Search, ListMusic, History, Settings } from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const navItems = [
    { id: 'search', label: 'Search Track', icon: Search },
    { id: 'queue', label: 'Download Queue', icon: ListMusic },
    { id: 'history', label: 'History Log', icon: History },
    { id: 'settings', label: 'Configuration', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full select-none">
      <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center font-bold text-sm text-white">SF</div>
        <span className="font-bold text-lg tracking-tight">SpotiFLAC Web</span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition duration-150 ${
                isActive 
                  ? 'bg-zinc-800 text-green-500 border border-zinc-700/50' 
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              <IconComponent className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-800 text-xs text-zinc-500 text-center">
        Powered by Railway & Cloudflare
      </div>
    </aside>
  );
};

export default Sidebar;
