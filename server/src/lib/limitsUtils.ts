/**
 * Plan limits resolution helpers.
 *
 * A company's effective limits are the plan's defaults with any per-company
 * overrides from `Company.customLimits` applied on top, key by key.
 *
 * Example: plan = {maxProjects: 1, maxCTOs: 1000}
 *          customLimits = {maxProjects: 5}
 *          effective    = {maxProjects: 5, maxCTOs: 1000}
 *
 * Keys with `null`/`undefined` in customLimits are ignored (fall through to plan).
 */

export interface PlanLimits {
    maxProjects?: number;
    maxUsers?: number;
    maxCTOs?: number;
    maxPOPs?: number;
}

/**
 * Merge plan limits with company-specific overrides.
 * Both arguments may be null/undefined; result is always a (possibly empty) object.
 */
export const getEffectiveLimits = (
    planLimits: unknown,
    customLimits: unknown
): PlanLimits => {
    const base: PlanLimits = (planLimits && typeof planLimits === 'object')
        ? { ...(planLimits as PlanLimits) }
        : {};
    if (customLimits && typeof customLimits === 'object') {
        for (const [key, value] of Object.entries(customLimits as Record<string, unknown>)) {
            // Only override when the value is a real number — null/undefined fall through
            if (typeof value === 'number' && !Number.isNaN(value)) {
                (base as any)[key] = value;
            }
        }
    }
    return base;
};
