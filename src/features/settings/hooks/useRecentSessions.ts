"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/features/user/presentation/context/UserContext";
import { securitySettingsService } from "../services/security-settings.service";
import type { UserSession } from "../types/security-settings.types";

export function useRecentSessions() {
    const { accessToken } = useUser();

    const [sessions, setSessions] = useState<UserSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFallback, setIsFallback] = useState(false);

    const loadSessions = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSessions([]);
        try {
            const result = await securitySettingsService.getRecentSessions(accessToken);
            setIsFallback(result.source === "unsupported-fallback");
            if (result.sessions.length > 0) {
                setSessions(result.sessions);
            } else if (isConnected || currentUser) {
                // If user is active/connected, generate current session indicator
                const { device, browser } = getBrowserAndDevice();
                const currentSession: UserSession = {
                    id: "current-session",
                    createdAt: new Date().toISOString(),
                    ipAddress: "Current Connection",
                    device: `${browser} on ${device}`,
                    browser,
                    isCurrent: true,
                    status: "active",
                };
                setSessions([currentSession]);
            } else {
                setSessions([]);
            }
            const data = await securitySettingsService.getRecentSessions(accessToken);
            setSessions(data);
        } catch (err) {
            setSessions([]);
            setIsFallback(false);
            const msg = err instanceof Error ? err.message : "Failed to load recent sessions";
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    }, [accessToken]);

    useEffect(() => {
        void loadSessions();
    }, [loadSessions]);

    return {
        sessions,
        isLoading,
        error,
        isFallback,
        reload: loadSessions,
    };
}
