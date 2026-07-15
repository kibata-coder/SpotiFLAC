import { set, get, del } from 'idb-keyval';
import type { SearchResult } from './api';

export interface OfflineTrack {
  track: SearchResult;
  blobUrl?: string; // transient url created during runtime
  timestamp: number;
}

const STORE_KEY_PREFIX = 'track_blob_';
const METADATA_KEY = 'offline_metadata';

export async function saveDownloadedTrack(track: SearchResult, blob: Blob) {
  // Save the blob
  await set(`${STORE_KEY_PREFIX}${track.id}`, blob);
  
  // Update metadata
  const metadata: Record<string, OfflineTrack> = (await get(METADATA_KEY)) || {};
  metadata[track.id] = {
    track,
    timestamp: Date.now(),
  };
  await set(METADATA_KEY, metadata);
}

export async function getDownloadedTracks(): Promise<OfflineTrack[]> {
  const metadata: Record<string, OfflineTrack> = (await get(METADATA_KEY)) || {};
  return Object.values(metadata).sort((a, b) => b.timestamp - a.timestamp);
}

export async function getTrackBlob(id: string): Promise<Blob | undefined> {
  return await get(`${STORE_KEY_PREFIX}${id}`);
}

export async function deleteDownloadedTrack(id: string) {
  await del(`${STORE_KEY_PREFIX}${id}`);
  const metadata: Record<string, OfflineTrack> = (await get(METADATA_KEY)) || {};
  delete metadata[id];
  await set(METADATA_KEY, metadata);
}
