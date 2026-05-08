/**
 * Subscription expiration helpers.
 *
 * Semantic: `subscriptionExpiresAt` is the *due date* in São Paulo time —
 * the customer remains valid through the END of that local calendar day.
 * Comparisons must therefore be anchored to BR-midnight, not UTC-midnight,
 * because timestamps stored as `2026-05-08 02:59 UTC` (= 2026-05-07 23:59 BRT)
 * would otherwise stay "valid" for nearly a full extra day.
 */

// Returns midnight of today in São Paulo (UTC-3, no DST since 2019).
// The returned Date's underlying UTC timestamp is "today 03:00 UTC", which
// represents "today 00:00 BRT".
export const startOfTodayBR = (): Date => {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const [y, m, d] = fmt.format(new Date()).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 3, 0, 0));
};

/**
 * True only if the subscription's due date is strictly before today (BRT)
 * — i.e. the customer's local calendar day stored in `expiresAt` has fully
 * passed.
 */
export const isSubscriptionExpired = (expiresAt: Date | null | undefined): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < startOfTodayBR();
};
