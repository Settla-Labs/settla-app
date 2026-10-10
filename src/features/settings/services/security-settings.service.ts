import type {
    RecentSessionsResult,
    SecurityPreferences,
    SecuritySettingsResult,
    UserSession,
} from "../types/security-settings.types";

function getApiBaseUrl(): string {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
}

const DEFAULT_PREFERENCES: SecurityPreferences = {
    securityUpdates: true,
    loginAlerts: true,
    transactionNotifications: true,
    escrowStatusUpdates: true,
    emailNotifications: false,
};

const UNSUPPORTED_STATUSES = new Set([404, 501]);

async function getResponseError(res: Response, fallback: string): Promise<Error> {
    const detail = await res.text().catch(() => "");
    return new Error(detail || `${fallback} (${res.status})`);
}

function parsePreferences(data: unknown): SecurityPreferences {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Invalid security settings response");
    }

    const partial = data as Partial<SecurityPreferences>;
    for (const key of Object.keys(DEFAULT_PREFERENCES) as Array<keyof SecurityPreferences>) {
        if (partial[key] !== undefined && typeof partial[key] !== "boolean") {
            throw new Error("Invalid security settings response");
        }
    }

    return { ...DEFAULT_PREFERENCES, ...partial };
}

export const securitySettingsService = {
    async getSecuritySettings(accessToken?: string | null): Promise<SecuritySettingsResult> {
        const headers: Record<string, string> = {};
        if (accessToken) {
            headers["Authorization"] = `Bearer ${accessToken}`;
        }

        const res = await fetch(`${getApiBaseUrl()}/users/me/security-settings`, {
            method: "GET",
            headers,
        });

        if (!res.ok) {
            if (UNSUPPORTED_STATUSES.has(res.status)) {
                return {
                    preferences: { ...DEFAULT_PREFERENCES },
                    source: "unsupported-fallback",
                };
            }
            throw await getResponseError(res, "Failed to load security settings");
        }

        return {
            preferences: parsePreferences(await res.json()),
            source: "server",
        };
    },

    async updateSecuritySettings(
        updates: Partial<SecurityPreferences>,
        accessToken?: string | null,
    ): Promise<SecuritySettingsResult> {
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
            // Keep the development fallback explicit instead of presenting it
            // as a response persisted by the server.
            if (UNSUPPORTED_STATUSES.has(res.status)) {
                return {
                    preferences: { ...DEFAULT_PREFERENCES, ...updates },
                    source: "unsupported-fallback",
                };
            }
            throw await getResponseError(res, "Failed to update security preferences");
        }

        return {
            preferences: parsePreferences(await res.json()),
            source: "server",
        };
    },

    async getRecentSessions(accessToken?: string | null): Promise<RecentSessionsResult> {
        const headers: Record<string, string> = {};
        if (accessToken) {
            headers["Authorization"] = `Bearer ${accessToken}`;
        }

        const res = await fetch(`${getApiBaseUrl()}/users/me/sessions`, {
            method: "GET",
            headers,
        });

        if (!res.ok) {
            if (UNSUPPORTED_STATUSES.has(res.status)) {
                return { sessions: [], source: "unsupported-fallback" };
            }
            throw await getResponseError(res, "Failed to load recent sessions");
        }

        const data: unknown = await res.json();
        if (!Array.isArray(data)) {
            throw new Error("Invalid recent sessions response");
        }

        return { sessions: data as UserSession[], source: "server" };
    },
};
