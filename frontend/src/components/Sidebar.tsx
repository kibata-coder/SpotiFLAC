import React from 'react';
import { Search, ListMusic, History, Settings, Library, Music2 } from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const navItems = [
    { id: 'search', label: 'Search Track', icon: Search },
    { id: 'queue', label: 'Your Library', icon: ListMusic },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-[280px] flex flex-col gap-2 h-full select-none shrink-0">

      {/* Top Island: Branding */}
      <div
        className="rounded-xl p-5 flex items-center gap-3"
        style={{ background: 'var(--sp-surface)' }}
      >
        {/* Animated logo mark */}
        <div className="relative w-9 h-9 shrink-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'var(--sp-green)' }}
          >
            <Music2 className="w-5 h-5 text-black" strokeWidth={2.5} />
          </div>
          {/* green glow ring */}
          <div
            className="absolute inset-0 rounded-full opacity-0 hover:opacity-100 transition-opacity"
            style={{ boxShadow: '0 0 0 3px rgba(29,185,84,0.4)' }}
          />
        </div>
        <div>
          <span className="font-black text-[1.15rem] tracking-tight text-white leading-none block">
            SoudMusic
          </span>
          <span className="text-xs font-medium leading-none" style={{ color: 'var(--sp-subdued)' }}>
            Lossless Downloader
          </span>
        </div>
      </div>

      {/* Bottom Island: Navigation */}
      <div
        className="rounded-xl flex-1 flex flex-col overflow-hidden"
        style={{ background: 'var(--sp-surface)' }}
      >
        {/* Library header */}
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <Library className="w-5 h-5" style={{ color: 'var(--sp-subdued)' }} />
          <span className="text-sm font-bold" style={{ color: 'var(--sp-subdued)' }}>
            Your Tools
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 pb-2 space-y-0.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item, i) => {
            const IconComponent = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => onTabChange(item.id)}
                className="sp-nav-item animate-fade-in"
                style={{
                  animationDelay: `${i * 40}ms`,
                  background: isActive ? 'rgba(255,255,255,0.1)' : undefined,
                  color: isActive ? '#fff' : undefined,
                }}
              >
                <IconComponent
                  className="w-5 h-5 shrink-0"
                  style={{ color: isActive ? '#fff' : 'var(--sp-subdued)' }}
                />
                <span>{item.label}</span>
                {/* Active indicator dot */}
                {isActive && (
                  <div
                    className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: 'var(--sp-green)' }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          className="px-5 py-4 border-t text-xs font-medium leading-relaxed"
          style={{
            borderColor: 'var(--sp-border)',
            color: 'var(--sp-muted)',
          }}
        >
          <p>Powered by Railway &amp; Cloudflare</p>
          <p
            className="mt-0.5 text-[10px]"
            style={{ color: 'rgba(255,255,255,0.2)' }}
          >
            Not affiliated with Spotify AB
          </p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
