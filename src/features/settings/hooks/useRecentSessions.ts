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

    const loadSessions = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSessions([]);
        try {
            const data = await securitySettingsService.getRecentSessions(accessToken);
            setSessions(data);
        } catch (err) {
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
        reload: loadSessions,
    };
}
