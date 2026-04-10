/**
 * Subscription expiration helpers (frontend mirror of server/src/lib/subscriptionUtils.ts).
 *
 * Semantic: `subscriptionExpiresAt` is the *due date* — the customer remains
 * valid through the END of that day. Only treat as expired once the calendar
 * day stored in `subscriptionExpiresAt` has fully passed.
 */

export const startOfTodayUTC = (): Date => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
};

export const isSubscriptionExpired = (expiresAt: Date | string | null | undefined): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < startOfTodayUTC();
};
