import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRecentSessions } from "../useRecentSessions";
import { securitySettingsService } from "../../services/security-settings.service";

vi.mock("@/features/user/presentation/context/UserContext", () => ({
    useUser: () => ({ accessToken: "token", currentUser: { id: "user" } }),
}));
vi.mock("@/features/wallet/presentation/context/WalletContext", () => ({
    useWalletContext: () => ({ isConnected: true }),
}));
vi.mock("../../services/security-settings.service", () => ({
    securitySettingsService: { getRecentSessions: vi.fn() },
}));

describe("useRecentSessions", () => {
    beforeEach(() => vi.clearAllMocks());

    it("uses only API sessions and does not fabricate a wallet session", async () => {
        vi.mocked(securitySettingsService.getRecentSessions).mockResolvedValue([]);

        const { result } = renderHook(() => useRecentSessions());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.sessions).toEqual([]);
        expect(result.current.error).toBeNull();
    });

    it("clears old sessions on failure and recovers from a later successful request", async () => {
        vi.mocked(securitySettingsService.getRecentSessions)
            .mockResolvedValueOnce([{
                id: "real-session",
                createdAt: "2026-10-08T10:00:00Z",
                device: "Real device",
                ipAddress: "192.0.2.2",
                isCurrent: false,
                status: "active",
            }])
            .mockRejectedValueOnce(new Error("network unavailable"))
            .mockResolvedValueOnce([{
                id: "recovered-session",
                createdAt: "2026-10-08T10:00:00Z",
                device: "Recovered device",
                ipAddress: "192.0.2.3",
                isCurrent: true,
                status: "active",
            }]);

        const { result } = renderHook(() => useRecentSessions());
        await waitFor(() => expect(result.current.sessions[0]?.id).toBe("real-session"));

        await act(async () => result.current.reload());
        await waitFor(() => expect(result.current.error).toBe("network unavailable"));
        expect(result.current.sessions).toEqual([]);

        await act(async () => result.current.reload());
        expect(result.current.sessions.map((session) => session.id)).toEqual(["recovered-session"]);
        expect(result.current.error).toBeNull();
    });
});
