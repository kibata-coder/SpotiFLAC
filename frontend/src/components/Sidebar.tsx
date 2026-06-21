import React from 'react';
import { Search, ListMusic, History, Settings, Library } from 'lucide-react';

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
    <aside className="w-[300px] flex flex-col gap-2 h-full select-none">
      
      {/* Top Island: Branding */}
      <div className="bg-[#121212] rounded-lg p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center font-bold text-sm text-black">
            SF
          </div>
          <span className="font-bold text-xl tracking-tight text-white">SpotiFLAC</span>
        </div>
      </div>

      {/* Bottom Island: Navigation / Library */}
      <div className="bg-[#121212] rounded-lg flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-4 pb-2 flex items-center gap-3 text-neutral-400 font-bold transition-colors hover:text-white cursor-pointer">
          <Library className="w-6 h-6" />
          <span>Your Tools</span>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-4 px-3 py-3 rounded-md text-sm font-bold transition duration-200 group ${
                  isActive 
                    ? 'bg-[#232323] text-white' 
                    : 'text-[#b3b3b3] hover:text-white hover:bg-[#1a1a1a]'
                }`}
              >
                <IconComponent className={`w-5 h-5 transition-colors ${isActive ? 'text-white' : 'text-[#b3b3b3] group-hover:text-white'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-6 text-xs font-medium text-[#b3b3b3] hover:text-white transition-colors cursor-pointer">
          Powered by Railway & Cloudflare
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
