/**
 * fetch wrapper that aborts after `timeoutMs`. Throws AbortError on timeout
 * so callers can distinguish slow upstream from network/HTTP failures.
 */
export async function fetchWithTimeout(
    url: string,
    init: RequestInit = {},
    timeoutMs = 15000
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}
