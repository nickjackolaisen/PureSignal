export const PLAN_FLAGS = {
    free: {
        partnerRelay: false,
        advancedAnalytics: false,
        signedUpdates: false,
        cloudSync: false,
        desktopAdvanced: false,
        prioritySupport: false
    },
    ext_pro: {
        partnerRelay: true,
        advancedAnalytics: true,
        signedUpdates: true,
        cloudSync: true,
        desktopAdvanced: false,
        prioritySupport: true
    },
    desktop_pro: {
        partnerRelay: false,
        advancedAnalytics: false,
        signedUpdates: false,
        cloudSync: true,
        desktopAdvanced: true,
        prioritySupport: true
    },
    bundle_pro: {
        partnerRelay: true,
        advancedAnalytics: true,
        signedUpdates: true,
        cloudSync: true,
        desktopAdvanced: true,
        prioritySupport: true
    }
};
export function normalizePlanCode(value) {
    const key = String(value || "free");
    return PLAN_FLAGS[key] ? key : "free";
}
