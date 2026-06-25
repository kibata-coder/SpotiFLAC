import { CHECK_TIMEOUT_MS, withTimeout } from "@/lib/async-timeout";
export type ApiCheckStatus = "checking" | "online" | "offline" | "idle";
export interface ApiSource {
    id: string;
    type: string;
    name: string;
    url: string;
}
interface SoudMusicNextSource {
    id: string;
    name: string;
    statusKey?: string;
    statusPrefix?: string;
}
type SoudMusicNextStatusResponse = Partial<Record<string, string>>;
export const API_SOURCES: ApiSource[] = [
    { id: "tidal", type: "tidal", name: "Tidal", url: "" },
    { id: "qobuz", type: "qobuz", name: "Qobuz", url: "" },
    { id: "amazon", type: "amazon", name: "Amazon Music", url: "" },
];
export const SOUDMUSIC_NEXT_SOURCES: SoudMusicNextSource[] = [
    { id: "tidal", name: "Tidal", statusPrefix: "tidal_" },
    { id: "qobuz", name: "Qobuz", statusPrefix: "qobuz_" },
    { id: "amazon", name: "Amazon Music", statusPrefix: "amazon_" },
    { id: "deezer", name: "Deezer", statusPrefix: "deezer_" },
    { id: "apple", name: "Apple Music", statusKey: "apple" },
];
const SOUDMUSIC_STATUS_URL = "https://gist.githubusercontent.com/afkarxyz/6e57cd362cbd67f889e3a91a76254a5e/raw";
const SOUDMUSIC_CURRENT_STATUS_URL = "https://gist.githubusercontent.com/afkarxyz/7e392bc94ec2faaf74ef7d80025636eb/raw";
const SOUDMUSIC_STATUS_MAX_ATTEMPTS = 3;
const SOUDMUSIC_STATUS_RETRY_DELAY_MS = 1200;
const LogStatusConsole = (level: string, message: string): Promise<void> => (window as any)["go"]["main"]["App"]["LogStatusConsole"](level, message);
type ApiStatusState = {
    checkingSources: Record<string, boolean>;
    statuses: Record<string, ApiCheckStatus>;
    nextStatuses: Record<string, ApiCheckStatus>;
};
let apiStatusState: ApiStatusState = {
    checkingSources: {},
    statuses: {},
    nextStatuses: {},
};
let activeCheckCurrentOnly: Promise<void> | null = null;
let activeCheckNextOnly: Promise<void> | null = null;
let activeStatusPayloadFetch: Promise<SoudMusicNextStatusResponse> | null = null;
let activeCurrentStatusPayloadFetch: Promise<SoudMusicNextStatusResponse> | null = null;
const activeSourceChecks = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
function emitApiStatusChange() {
    for (const listener of listeners) {
        listener();
    }
}
function setApiStatusState(updater: (current: ApiStatusState) => ApiStatusState) {
    apiStatusState = updater(apiStatusState);
    emitApiStatusChange();
}
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}
function sendStatusConsole(level: "info" | "warning" | "error", message: string): void {
    try {
        void LogStatusConsole(level, message);
    }
    catch {
        return;
    }
}
function logStatusError(message: string): void {
    sendStatusConsole("error", message);
}
function anyNextVariantUp(values: Array<string | undefined>): ApiCheckStatus {
    return values.some((value) => value === "up") ? "online" : "offline";
}
function getNextSourceValues(payload: SoudMusicNextStatusResponse, source: SoudMusicNextSource): string[] {
    if (source.statusKey) {
        const value = payload[source.statusKey];
        return typeof value === "string" ? [value] : [];
    }
    if (!source.statusPrefix) {
        return [];
    }
    const values: string[] = [];
    for (const [key, value] of Object.entries(payload)) {
        if (key.startsWith(source.statusPrefix) && typeof value === "string") {
            values.push(value);
        }
    }
    return values;
}
function getSafeNextStatusesFallback(currentStatuses: Record<string, ApiCheckStatus>): Record<string, ApiCheckStatus> {
    return SOUDMUSIC_NEXT_SOURCES.reduce<Record<string, ApiCheckStatus>>((acc, source) => {
        const current = currentStatuses[source.id];
        acc[source.id] = current === "online" || current === "offline" ? current : "idle";
        return acc;
    }, {});
}
function hasCurrentResults(): boolean {
    return API_SOURCES.some((source) => {
        const status = apiStatusState.statuses[source.id];
        return status === "online" || status === "offline";
    });
}
function hasSoudMusicNextResults(): boolean {
    return SOUDMUSIC_NEXT_SOURCES.some((source) => {
        const status = apiStatusState.nextStatuses[source.id];
        return status === "online" || status === "offline";
    });
}
async function fetchStatusPayloadOnce(url: string): Promise<SoudMusicNextStatusResponse> {
    const response = await withTimeout(fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: {
            Accept: "application/json",
        },
    }), CHECK_TIMEOUT_MS, "SoudMusic status check timed out after 10 seconds");
    if (!response.ok) {
        throw new Error(`SoudMusic status returned ${response.status}`);
    }
    return (await response.json()) as SoudMusicNextStatusResponse;
}
async function fetchStatusPayloadWithRetry(url: string): Promise<SoudMusicNextStatusResponse> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= SOUDMUSIC_STATUS_MAX_ATTEMPTS; attempt++) {
        try {
            return await fetchStatusPayloadOnce(url);
        }
        catch (error) {
            lastError = error;
            if (attempt < SOUDMUSIC_STATUS_MAX_ATTEMPTS) {
                await delay(SOUDMUSIC_STATUS_RETRY_DELAY_MS * attempt);
            }
        }
    }
    throw lastError instanceof Error ? lastError : new Error("SoudMusic status check failed");
}
async function fetchSoudMusicStatusPayload(): Promise<SoudMusicNextStatusResponse> {
    if (activeStatusPayloadFetch) {
        return activeStatusPayloadFetch;
    }
    activeStatusPayloadFetch = fetchStatusPayloadWithRetry(SOUDMUSIC_STATUS_URL);
    try {
        return await activeStatusPayloadFetch;
    }
    finally {
        activeStatusPayloadFetch = null;
    }
}
async function fetchSoudMusicCurrentStatusPayload(): Promise<SoudMusicNextStatusResponse> {
    if (activeCurrentStatusPayloadFetch) {
        return activeCurrentStatusPayloadFetch;
    }
    activeCurrentStatusPayloadFetch = fetchStatusPayloadWithRetry(SOUDMUSIC_CURRENT_STATUS_URL);
    try {
        return await activeCurrentStatusPayloadFetch;
    }
    finally {
        activeCurrentStatusPayloadFetch = null;
    }
}
async function checkSourceStatus(source: ApiSource): Promise<ApiCheckStatus> {
    try {
        const payload = await fetchSoudMusicCurrentStatusPayload();
        return payload[source.id] === "up" ? "online" : "offline";
    }
    catch (error) {
        logStatusError(`[Status][${source.name}] Status check failed: ${error instanceof Error ? error.message : String(error)}`);
        return "offline";
    }
}
async function checkSoudMusicNextStatuses(): Promise<Record<string, ApiCheckStatus>> {
    const payload = await fetchSoudMusicStatusPayload();
    return SOUDMUSIC_NEXT_SOURCES.reduce<Record<string, ApiCheckStatus>>((acc, source) => {
        acc[source.id] = anyNextVariantUp(getNextSourceValues(payload, source));
        return acc;
    }, {});
}
export function getApiStatusState(): ApiStatusState {
    return apiStatusState;
}
export function subscribeApiStatus(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
export async function checkCurrentApiStatusesOnly(): Promise<void> {
    if (activeCheckCurrentOnly) {
        return activeCheckCurrentOnly;
    }
    activeCheckCurrentOnly = (async () => {
        await Promise.all(API_SOURCES.map((source) => checkApiStatus(source.id)));
    })();
    try {
        await activeCheckCurrentOnly;
    }
    finally {
        activeCheckCurrentOnly = null;
    }
}
export async function checkSoudMusicNextStatusesOnly(): Promise<void> {
    if (activeCheckNextOnly) {
        return activeCheckNextOnly;
    }
    activeCheckNextOnly = (async () => {
        const checkingNextStatuses = Object.fromEntries(SOUDMUSIC_NEXT_SOURCES.map((source) => [source.id, "checking" as ApiCheckStatus]));
        setApiStatusState((current) => ({
            ...current,
            nextStatuses: {
                ...current.nextStatuses,
                ...checkingNextStatuses,
            },
        }));
        try {
            const nextStatuses = await checkSoudMusicNextStatuses();
            setApiStatusState((current) => ({
                ...current,
                nextStatuses: {
                    ...current.nextStatuses,
                    ...nextStatuses,
                },
            }));
        }
        catch {
            setApiStatusState((current) => ({
                ...current,
                nextStatuses: getSafeNextStatusesFallback(current.nextStatuses),
            }));
        }
    })();
    try {
        await activeCheckNextOnly;
    }
    finally {
        activeCheckNextOnly = null;
    }
}
export function ensureApiStatusCheckStarted(): void {
    if (!activeCheckCurrentOnly && !hasCurrentResults()) {
        void checkCurrentApiStatusesOnly();
    }
    if (!activeCheckNextOnly && !hasSoudMusicNextResults()) {
        void checkSoudMusicNextStatusesOnly();
    }
}
export function ensureSoudMusicNextStatusCheckStarted(): void {
    ensureApiStatusCheckStarted();
}
export async function checkApiStatus(sourceId: string): Promise<void> {
    const source = API_SOURCES.find((item) => item.id === sourceId);
    if (!source) {
        return;
    }
    const activeCheck = activeSourceChecks.get(sourceId);
    if (activeCheck) {
        return activeCheck;
    }
    const task = (async () => {
        setApiStatusState((current) => ({
            ...current,
            checkingSources: {
                ...current.checkingSources,
                [sourceId]: true,
            },
            statuses: {
                ...current.statuses,
                [sourceId]: "checking",
            },
        }));
        try {
            const status = await checkSourceStatus(source);
            setApiStatusState((current) => ({
                ...current,
                statuses: {
                    ...current.statuses,
                    [sourceId]: status,
                },
            }));
        }
        finally {
            setApiStatusState((current) => ({
                ...current,
                checkingSources: {
                    ...current.checkingSources,
                    [sourceId]: false,
                },
            }));
            activeSourceChecks.delete(sourceId);
        }
    })();
    activeSourceChecks.set(sourceId, task);
    return task;
}
