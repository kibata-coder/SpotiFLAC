import React from "react";
import { Download, FolderOpen, CheckCircle, XCircle, FileText, FileCheck, Globe, ImageDown, Play, Pause } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger, } from "@/components/ui/tooltip";
import type { TrackMetadata, TrackAvailability } from "@/types/api";
import { usePreview } from "@/hooks/usePreview";
import { AvailabilityLinks, hasAvailabilityLinks } from "./AvailabilityLinks";
import { buildClickableArtists, getClickableArtistKey } from "@/lib/artist-links";
interface TrackInfoProps {
    track: TrackMetadata & {
        album_name: string;
        release_date: string;
    };
    isDownloading: boolean;
    downloadingTrack: string | null;
    isDownloaded: boolean;
    isFailed: boolean;
    isSkipped: boolean;
    downloadingLyricsTrack?: string | null;
    downloadedLyrics?: boolean;
    failedLyrics?: boolean;
    skippedLyrics?: boolean;
    checkingAvailability?: boolean;
    availability?: TrackAvailability;
    downloadingCover?: boolean;
    downloadedCover?: boolean;
    failedCover?: boolean;
    skippedCover?: boolean;
    onDownload: (id: string, name: string, artists: string, albumName?: string, spotifyId?: string, playlistName?: string, durationMs?: number, position?: number, albumArtist?: string, releaseDate?: string, coverUrl?: string, spotifyTrackNumber?: number, spotifyDiscNumber?: number, spotifyTotalTracks?: number, spotifyTotalDiscs?: number, copyright?: string, publisher?: string) => void;
    onDownloadLyrics?: (spotifyId: string, name: string, artists: string, albumName?: string, albumArtist?: string, releaseDate?: string, discNumber?: number) => void;
    onCheckAvailability?: (spotifyId: string) => void;
    onDownloadCover?: (coverUrl: string, trackName: string, artistName: string, albumName?: string, playlistName?: string, position?: number, trackId?: string, albumArtist?: string, releaseDate?: string, discNumber?: number) => void;
    onOpenFolder: () => void;
    onAlbumClick?: (album: {
        id: string;
        name: string;
        external_urls: string;
    }) => void;
    onArtistClick?: (artist: {
        id: string;
        name: string;
        external_urls: string;
    }) => void;
    onBack?: () => void;
}
export function TrackInfo({ track, isDownloading, downloadingTrack, isDownloaded, isFailed, isSkipped, downloadingLyricsTrack, downloadedLyrics, failedLyrics, skippedLyrics, checkingAvailability, availability, downloadingCover, downloadedCover, failedCover, skippedCover, onDownload, onDownloadLyrics, onCheckAvailability, onDownloadCover, onOpenFolder, onAlbumClick, onArtistClick, onBack, }: TrackInfoProps) {
    const { playPreview, loadingPreview, playingTrack } = usePreview();
    const hasAlbumClick = !!(onAlbumClick && track.album_id && track.album_url);
    const clickableArtists = buildClickableArtists(track.artists, track.artists_data, track.artist_id, track.artist_url);
    const formatDuration = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };
    const formatPlays = (plays: string) => {
        const num = parseInt(plays, 10);
        if (isNaN(num))
            return plays;
        return num.toLocaleString();
    };
    return (
    <div
      className="relative rounded-xl overflow-hidden animate-fade-in"
      style={{ background: 'var(--sp-elevated)', border: '1px solid var(--sp-border)' }}
    >
      {/* Gradient backdrop overlay */}
      <div
        className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, rgba(29,185,84,0.12) 0%, rgba(18,18,18,0) 100%)' }}
      />

      {/* Back button */}
      {onBack && (
        <div className="absolute top-4 right-4 z-20">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors"
            style={{ background: 'rgba(0,0,0,0.4)', color: 'var(--sp-subdued)' }}
          >
            <XCircle className="h-5 w-5"/>
          </button>
        </div>
      )}

      <div className="relative z-10 p-6 flex gap-6 items-start">
        {/* Cover art */}
        {track.images && (
          <div className="shrink-0 group relative">
            <img
              src={track.images}
              alt={track.name}
              className="w-44 h-44 rounded-lg object-cover sp-cover-lg transition-transform duration-300 group-hover:scale-[1.02]"
            />
            {/* Duration chip on cover */}
            <span
              className="absolute bottom-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.75)', color: '#fff' }}
            >
              {formatDuration(track.duration_ms)}
            </span>
          </div>
        )}

        {/* Info */}
        <div className="flex-1 space-y-5 min-w-0">
          {/* Type label */}
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--sp-subdued)' }}>
            Single
          </p>

          {/* Title row */}
          <div className="flex items-start gap-3">
            <h1 className="text-3xl font-black text-white tracking-tight leading-tight break-words">
              {track.name}
            </h1>
            {track.is_explicit && (
              <span className="sp-explicit mt-1.5 shrink-0" title="Explicit">E</span>
            )}
            {isSkipped
              ? <FileCheck className="h-6 w-6 mt-1 shrink-0" style={{ color: '#facc15' }}/>
              : isDownloaded
              ? <CheckCircle className="h-6 w-6 mt-1 shrink-0" style={{ color: 'var(--sp-green)' }}/>
              : isFailed
              ? <XCircle className="h-6 w-6 mt-1 shrink-0" style={{ color: '#e91429' }}/>
              : null}
          </div>

          {/* Artist + album line */}
          <p className="text-base font-semibold" style={{ color: 'var(--sp-subdued)' }}>
            {clickableArtists.length > 0
              ? clickableArtists.map((artist, index) => (
                  <span key={getClickableArtistKey(artist)}>
                    {onArtistClick ? (
                      <button
                        type="button"
                        className="hover:underline bg-transparent border-0 p-0 text-inherit cursor-pointer"
                        onClick={() => onArtistClick({ id: artist.id, name: artist.name, external_urls: artist.external_urls })}
                      >
                        {artist.name}
                      </button>
                    ) : artist.name}
                    {index < clickableArtists.length - 1 && ', '}
                  </span>
                ))
              : track.artists}
            {track.album_name && (
              <span style={{ color: 'var(--sp-muted)' }}>
                {' · '}
                {hasAlbumClick ? (
                  <button
                    type="button"
                    className="hover:underline bg-transparent border-0 p-0 text-inherit cursor-pointer"
                    onClick={() => onAlbumClick?.({ id: track.album_id!, name: track.album_name, external_urls: track.album_url! })}
                  >
                    {track.album_name}
                  </button>
                ) : track.album_name}
              </span>
            )}
          </p>

          {/* Metadata chips */}
          <div className="flex flex-wrap gap-2">
            {track.release_date && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--sp-subdued)' }}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                {track.release_date}
              </span>
            )}
            {track.plays && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--sp-subdued)' }}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                </svg>
                {formatPlays(track.plays)} plays
              </span>
            )}
            {track.copyright && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium truncate max-w-64"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'var(--sp-muted)' }}
                title={track.copyright}
              >
                {track.copyright}
              </span>
            )}
          </div>

          {/* Action buttons */}
          {track.spotify_id && (
            <div className="flex gap-2 flex-wrap items-center pt-1">
              {/* Primary download button */}
              <button
                type="button"
                className="sp-btn-primary"
                onClick={() => onDownload(track.spotify_id || "", track.name, track.artists, track.album_name, track.spotify_id, undefined, track.duration_ms, track.track_number, track.album_artist, track.release_date, track.images, track.track_number, track.disc_number, track.total_tracks, track.total_discs, track.copyright, track.publisher)}
                disabled={isDownloading || downloadingTrack === track.spotify_id}
              >
                {downloadingTrack === track.spotify_id ? (
                  <><Spinner /><span>Downloading…</span></>
                ) : (<>
                  <Download className="h-4 w-4"/>
                  Download FLAC
                </>)}
              </button>

              {/* Preview */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="sp-btn-outline flex items-center justify-center w-10 h-10 p-0 rounded-full"
                    style={{ padding: 0 }}
                    onClick={() => playPreview(track.spotify_id!, track.name)}
                    disabled={loadingPreview === track.spotify_id}
                  >
                    {loadingPreview === track.spotify_id
                      ? <Spinner />
                      : playingTrack === track.spotify_id
                      ? <Pause className="h-4 w-4"/>
                      : <Play className="h-4 w-4"/>}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{playingTrack === track.spotify_id ? "Stop Preview" : "Play Preview"}</p>
                </TooltipContent>
              </Tooltip>

              {/* Lyrics */}
              {onDownloadLyrics && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="sp-btn-outline flex items-center justify-center w-10 h-10 p-0 rounded-full"
                      style={{ padding: 0 }}
                      onClick={() => onDownloadLyrics(track.spotify_id!, track.name, track.artists, track.album_name, track.album_artist, track.release_date, track.disc_number)}
                      disabled={downloadingLyricsTrack === track.spotify_id}
                    >
                      {downloadingLyricsTrack === track.spotify_id
                        ? <Spinner />
                        : skippedLyrics ? <FileCheck className="h-4 w-4" style={{ color: '#facc15' }}/>
                        : downloadedLyrics ? <CheckCircle className="h-4 w-4" style={{ color: 'var(--sp-green)' }}/>
                        : failedLyrics ? <XCircle className="h-4 w-4" style={{ color: '#e91429' }}/>
                        : <FileText className="h-4 w-4"/>}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent><p>Download Lyrics</p></TooltipContent>
                </Tooltip>
              )}

              {/* Cover */}
              {track.images && onDownloadCover && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="sp-btn-outline flex items-center justify-center w-10 h-10 p-0 rounded-full"
                      style={{ padding: 0 }}
                      onClick={() => onDownloadCover(track.images, track.name, track.artists, track.album_name, undefined, undefined, track.spotify_id, track.album_artist, track.release_date, track.disc_number)}
                      disabled={downloadingCover}
                    >
                      {downloadingCover ? <Spinner />
                        : skippedCover ? <FileCheck className="h-4 w-4" style={{ color: '#facc15' }}/>
                        : downloadedCover ? <CheckCircle className="h-4 w-4" style={{ color: 'var(--sp-green)' }}/>
                        : failedCover ? <XCircle className="h-4 w-4" style={{ color: '#e91429' }}/>
                        : <ImageDown className="h-4 w-4"/>}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent><p>Download Cover Art</p></TooltipContent>
                </Tooltip>
              )}

              {/* Availability */}
              {onCheckAvailability && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="sp-btn-outline flex items-center justify-center w-10 h-10 p-0 rounded-full"
                      style={{ padding: 0 }}
                      onClick={() => onCheckAvailability(track.spotify_id!)}
                      disabled={checkingAvailability}
                    >
                      {checkingAvailability ? <Spinner />
                        : availability
                        ? hasAvailabilityLinks(availability)
                          ? <CheckCircle className="h-4 w-4" style={{ color: 'var(--sp-green)' }}/>
                          : <XCircle className="h-4 w-4" style={{ color: '#e91429' }}/>
                        : <Globe className="h-4 w-4"/>}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="pointer-events-auto">
                    <AvailabilityLinks availability={availability}/>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Open folder */}
              {isDownloaded && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="sp-btn-outline flex items-center justify-center w-10 h-10 p-0 rounded-full"
                      style={{ padding: 0 }}
                      onClick={onOpenFolder}
                    >
                      <FolderOpen className="h-4 w-4"/>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent><p>Open Folder</p></TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
