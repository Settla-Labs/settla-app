import type {
    SecurityPreferences,
    UserSession,
} from "../types/security-settings.types";
import { SECURITY_PREFERENCE_DEFAULTS } from "../constants/security-preference-defaults";

function getApiBaseUrl(): string {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
}

export const securitySettingsService = {
    async getSecuritySettings(accessToken?: string | null): Promise<SecurityPreferences> {
        try {
            const headers: Record<string, string> = {};
            if (accessToken) {
                headers["Authorization"] = `Bearer ${accessToken}`;
            }

            const res = await fetch(`${getApiBaseUrl()}/users/me/security-settings`, {
                method: "GET",
                headers,
            });

            if (!res.ok) {
                // If endpoint doesn't exist yet or fails, fallback to defaults/stored prefs
                return SECURITY_PREFERENCE_DEFAULTS;
            }

            const data = (await res.json()) as Partial<SecurityPreferences>;
            return {
                ...SECURITY_PREFERENCE_DEFAULTS,
                ...data,
            };
        } catch {
            return SECURITY_PREFERENCE_DEFAULTS;
        }
    },

    async updateSecuritySettings(
        updates: Partial<SecurityPreferences>,
        accessToken?: string | null,
    ): Promise<SecurityPreferences> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (accessToken) {
            headers["Authorization"] = `Bearer ${accessToken}`;
        }

        const res = await fetch(`${getApiBaseUrl()}/users/me/security-settings`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(updates),
        });

        if (!res.ok) {
            // If backend is not available or mock environment, simulate update
            if (res.status === 404 || res.status === 501) {
                return {
                    ...SECURITY_PREFERENCE_DEFAULTS,
                    ...updates,
                };
            }
            const errorText = await res.text().catch(() => "Failed to update security preferences");
            throw new Error(errorText || "Failed to update security preferences");
        }

        const data = (await res.json()) as Partial<SecurityPreferences>;
        return {
            ...SECURITY_PREFERENCE_DEFAULTS,
            ...data,
        };
    },

    async getRecentSessions(accessToken?: string | null): Promise<UserSession[]> {
        try {
            const headers: Record<string, string> = {};
            if (accessToken) {
                headers["Authorization"] = `Bearer ${accessToken}`;
            }

            const res = await fetch(`${getApiBaseUrl()}/users/me/sessions`, {
                method: "GET",
                headers,
            });

            if (!res.ok) {
                return [];
            }

            return (await res.json()) as UserSession[];
        } catch {
            return [];
        }
    },
};
