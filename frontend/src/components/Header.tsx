import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { openExternal } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/relative-time";
import { Zap } from "lucide-react";

interface HeaderProps {
  version: string;
  hasUpdate: boolean;
  releaseDate?: string | null;
}

export function Header({ version, hasUpdate, releaseDate }: HeaderProps) {
  return (
    <div className="flex items-center gap-3 animate-fade-in">
      {/* Logo */}
      <button
        type="button"
        className="shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2"
        style={{ '--tw-ring-color': 'var(--sp-green)' } as React.CSSProperties}
        onClick={() => window.location.reload()}
        aria-label="Reload SoudMusic"
      >
        <img src="/icon.svg" alt="" className="w-9 h-9" />
      </button>

      {/* Title */}
      <h1 className="text-xl font-black tracking-tight text-white leading-none">
        <button
          type="button"
          className="cursor-pointer rounded border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 transition-opacity hover:opacity-80"
          onClick={() => window.location.reload()}
        >
          SoudMusic
        </button>
      </h1>

      {/* Version badge */}
      <div className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => openExternal("https://github.com/spotbye/SoudMusic/releases")}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold"
                style={{
                  background: hasUpdate ? 'rgba(29,185,84,0.18)' : 'rgba(255,255,255,0.08)',
                  color: hasUpdate ? 'var(--sp-green)' : 'var(--sp-subdued)',
                  border: `1px solid ${hasUpdate ? 'rgba(29,185,84,0.3)' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                {hasUpdate && <Zap className="w-3 h-3" />}
                v{version}
              </span>
            </button>
          </TooltipTrigger>
          {hasUpdate && releaseDate && (
            <TooltipContent>
              <p>Update available · {formatRelativeTime(releaseDate)}</p>
            </TooltipContent>
          )}
        </Tooltip>

        {/* Pulsing dot for update */}
        {hasUpdate && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: 'var(--sp-green)' }}
            />
            <span
              className="relative inline-flex rounded-full h-2.5 w-2.5"
              style={{ background: 'var(--sp-green)' }}
            />
          </span>
        )}
      </div>
    </div>
  );
}
