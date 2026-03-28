/**
 * Reverse geocoding utility using Nominatim (OpenStreetMap).
 * Free, no API key required. Rate limit: 1 request/second.
 */

interface NominatimResult {
    address?: {
        road?: string;
        street?: string;
        neighbourhood?: string;
        suburb?: string;
    };
}

// Simple in-memory cache to avoid re-fetching the same coordinates
const geocodeCache = new Map<string, string | null>();

// Queue to respect Nominatim's 1 req/sec rate limit
let lastRequestTime = 0;
const RATE_LIMIT_MS = 1100; // 1.1 seconds between requests

const waitForRateLimit = async () => {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < RATE_LIMIT_MS) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
    }
    lastRequestTime = Date.now();
};

/**
 * Get street name from coordinates via Nominatim reverse geocoding.
 * Returns the road/street name, or null if not found.
 */
export const getStreetName = async (lat: number, lng: number): Promise<string | null> => {
    const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;

    if (geocodeCache.has(cacheKey)) {
        return geocodeCache.get(cacheKey) || null;
    }

    try {
        await waitForRateLimit();

        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        const response = await fetch(url, {
            headers: { 'Accept-Language': 'pt-BR,pt,en' }
        });

        if (!response.ok) {
            geocodeCache.set(cacheKey, null);
            return null;
        }

        const data: NominatimResult = await response.json();
        const street = data.address?.road || data.address?.street || null;

        geocodeCache.set(cacheKey, street);
        return street;
    } catch (error) {
        console.warn('[Geocoding] Failed to reverse geocode:', error);
        geocodeCache.set(cacheKey, null);
        return null;
    }
};

/**
 * Get street names for multiple cables based on their "far end" coordinates
 * (the end opposite to the CTO being edited).
 * Returns a map of cableId -> streetName.
 */
export const getCableStreetNames = async (
    cables: { id: string; coordinates: { lat: number; lng: number }[]; fromNodeId?: string | null; toNodeId?: string | null; streetName?: string }[],
    ctoId: string
): Promise<Map<string, string>> => {
    const results = new Map<string, string>();

    for (const cable of cables) {
        // Skip cables that already have a street name
        if (cable.streetName) {
            results.set(cable.id, cable.streetName);
            continue;
        }

        if (!cable.coordinates || cable.coordinates.length < 2) continue;

        // Pick the "far end" - the end NOT connected to this CTO
        // If fromNodeId === ctoId, the far end is the last coordinate
        // If toNodeId === ctoId, the far end is the first coordinate
        let farPoint: { lat: number; lng: number };
        if (cable.fromNodeId === ctoId) {
            farPoint = cable.coordinates[cable.coordinates.length - 1];
        } else {
            farPoint = cable.coordinates[0];
        }

        const street = await getStreetName(farPoint.lat, farPoint.lng);
        if (street) {
            results.set(cable.id, street);
        }
    }

    return results;
};
