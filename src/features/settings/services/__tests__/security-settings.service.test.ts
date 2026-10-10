import { describe, it, expect, vi, beforeEach } from "vitest";
import { securitySettingsService } from "../security-settings.service";

describe("securitySettingsService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("fetches security settings with bearer token", async () => {
        const mockPrefs = {
            securityUpdates: true,
            loginAlerts: false,
            transactionNotifications: true,
            escrowStatusUpdates: true,
            emailNotifications: true,
        };

        global.fetch = vi.fn().mockResolvedValueOnce(
            new Response(JSON.stringify(mockPrefs), { status: 200 })
        );

        const result = await securitySettingsService.getSecuritySettings("test-jwt");

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining("/users/me/security-settings"),
            expect.objectContaining({
                method: "GET",
                headers: { Authorization: "Bearer test-jwt" },
            }),
        );
        expect(result.source).toBe("server");
        expect(result.preferences.loginAlerts).toBe(false);
        expect(result.preferences.emailNotifications).toBe(true);
    });

    it("patches security settings", async () => {
        const updatedPrefs = {
            securityUpdates: true,
            loginAlerts: true,
            transactionNotifications: true,
            escrowStatusUpdates: true,
            emailNotifications: true,
        };

        global.fetch = vi.fn().mockResolvedValueOnce(
            new Response(JSON.stringify(updatedPrefs), { status: 200 })
        );

        const result = await securitySettingsService.updateSecuritySettings(
            { emailNotifications: true },
            "test-jwt",
        );

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining("/users/me/security-settings"),
            expect.objectContaining({
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer test-jwt",
                },
                body: JSON.stringify({ emailNotifications: true }),
            }),
        );
        expect(result.source).toBe("server");
        expect(result.preferences.emailNotifications).toBe(true);
    });

    it("fetches recent sessions", async () => {
        const mockSessions = [
            {
                id: "s1",
                createdAt: "2026-07-14T09:30:00Z",
                ipAddress: "192.0.2.1",
                device: "Chrome on Windows",
                isCurrent: true,
                status: "active",
            },
        ];

        global.fetch = vi.fn().mockResolvedValueOnce(
            new Response(JSON.stringify(mockSessions), { status: 200 })
        );

        const result = await securitySettingsService.getRecentSessions("test-jwt");

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining("/users/me/sessions"),
            expect.objectContaining({
                method: "GET",
                headers: { Authorization: "Bearer test-jwt" },
            }),
        );
        expect(result.source).toBe("server");
        expect(result.sessions).toHaveLength(1);
        expect(result.sessions[0].id).toBe("s1");
    });

    it.each([401, 500])("surfaces a %i security-settings failure", async (status) => {
        global.fetch = vi.fn().mockResolvedValueOnce(
            new Response("settings unavailable", { status }),
        );

        await expect(
            securitySettingsService.getSecuritySettings("test-jwt"),
        ).rejects.toThrow("settings unavailable");
    });

    it("marks an unimplemented security-settings endpoint as an explicit fallback", async () => {
        global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 501 }));

        const result = await securitySettingsService.getSecuritySettings("test-jwt");

        expect(result.source).toBe("unsupported-fallback");
        expect(result.preferences.securityUpdates).toBe(true);
    });

    it("rejects a malformed security-settings body", async () => {
        global.fetch = vi.fn().mockResolvedValueOnce(
            Response.json({ loginAlerts: "yes" }, { status: 200 }),
        );

        await expect(
            securitySettingsService.getSecuritySettings("test-jwt"),
        ).rejects.toThrow("Invalid security settings response");
    });

    it("surfaces recent-session failures instead of returning an empty history", async () => {
        global.fetch = vi.fn().mockResolvedValueOnce(
            new Response("sessions unavailable", { status: 500 }),
        );

        await expect(
            securitySettingsService.getRecentSessions("test-jwt"),
        ).rejects.toThrow("sessions unavailable");
    });

    it("marks an unimplemented sessions endpoint as an explicit fallback", async () => {
        global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 }));

        const result = await securitySettingsService.getRecentSessions("test-jwt");

        expect(result).toEqual({ sessions: [], source: "unsupported-fallback" });
    });
});
