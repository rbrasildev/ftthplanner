/**
 * Plan limits resolution helpers (frontend mirror of server/src/lib/limitsUtils.ts).
 *
 * Effective limits = plan defaults + per-company overrides from `customLimits`.
 * Keys present in customLimits override the plan; missing/null keys fall through.
 */

export interface PlanLimits {
    maxProjects?: number;
    maxUsers?: number;
    maxCTOs?: number;
    maxPOPs?: number;
}

export const getEffectiveLimits = (
    planLimits: unknown,
    customLimits: unknown
): PlanLimits => {
    const base: PlanLimits = (planLimits && typeof planLimits === 'object')
        ? { ...(planLimits as PlanLimits) }
        : {};
    if (customLimits && typeof customLimits === 'object') {
        for (const [key, value] of Object.entries(customLimits as Record<string, unknown>)) {
            if (typeof value === 'number' && !Number.isNaN(value)) {
                (base as any)[key] = value;
            }
        }
    }
    return base;
};
