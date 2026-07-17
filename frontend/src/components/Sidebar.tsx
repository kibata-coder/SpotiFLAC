import React from 'react';
import { Search, ListMusic, History, Settings, Library, Music2, FolderHeart, Users, LogIn, LogOut, User } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  user: SupabaseUser | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange, user, onOpenAuth, onLogout }) => {
  const navItems = [
    { id: 'search', label: 'Search Track', icon: Search },
    { id: 'playlists', label: 'Playlists', icon: FolderHeart },
    { id: 'artists', label: 'Followed Artists', icon: Users },
    { id: 'queue', label: 'Offline Library', icon: ListMusic },
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

        {/* User Profile Section at bottom of Navigation */}
        <div className="px-2 pt-2 pb-2 border-t border-zinc-800/80">
          {user ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/40 text-sm">
              <div className="flex items-center gap-2 truncate pr-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold uppercase shrink-0">
                  {user.user_metadata?.display_name?.charAt(0) || user.email?.charAt(0) || <User className="w-4 h-4" />}
                </div>
                <span className="text-white font-semibold truncate">
                  {user.user_metadata?.display_name || user.email?.split('@')[0]}
                </span>
              </div>
              <button
                onClick={onLogout}
                className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800/60 rounded-lg transition-colors shrink-0"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors shadow-lg shadow-emerald-500/5"
            >
              <LogIn className="w-4 h-4" />
              <span>Connect Sync Account</span>
            </button>
          )}
        </div>

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
