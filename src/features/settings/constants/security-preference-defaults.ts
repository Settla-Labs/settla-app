import type { SecurityPreferences } from "../types/security-settings.types";

export const SECURITY_PREFERENCE_DEFAULTS: SecurityPreferences = {
    securityUpdates: true,
    loginAlerts: true,
    transactionNotifications: true,
    escrowStatusUpdates: true,
    emailNotifications: false,
};
