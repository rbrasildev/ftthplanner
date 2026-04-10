/**
 * Subscription expiration helpers.
 *
 * Semantic: `subscriptionExpiresAt` is the *due date* — the customer remains
 * valid through the END of that day. We only consider the subscription
 * expired once the calendar day stored in `subscriptionExpiresAt` has fully
 * passed (i.e. today's date is strictly after it).
 *
 * Without this normalization, a value stored as `2026-04-10T00:00:00Z` would
 * be treated as expired the very instant April 10 begins, suspending the
 * customer on their own due date.
 */

/**
 * Returns midnight (UTC) of the current day.
 */
export const startOfTodayUTC = (): Date => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
};

/**
 * True only if the subscription's due date is strictly before today
 * (i.e. it expired yesterday or earlier).
 */
export const isSubscriptionExpired = (expiresAt: Date | null | undefined): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < startOfTodayUTC();
};
