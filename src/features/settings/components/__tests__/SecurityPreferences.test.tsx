import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SecurityPreferences } from "../SecurityPreferences";
import * as securityHooksModule from "../../hooks/useSecuritySettings";

vi.mock("../../hooks/useSecuritySettings", () => ({
    useSecuritySettings: vi.fn(),
}));

describe("SecurityPreferences", () => {
    const mockUpdatePreference = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders all security preference toggles with their current state", () => {
        vi.spyOn(securityHooksModule, "useSecuritySettings").mockReturnValue({
            preferences: {
                securityUpdates: true,
                loginAlerts: true,
                transactionNotifications: false,
                escrowStatusUpdates: true,
                emailNotifications: false,
            },
            isLoading: false,
            error: null,
            isFallback: false,
            updatingKeys: {},
            updatePreference: mockUpdatePreference,
            reload: vi.fn(),
        });

        render(<SecurityPreferences />);

        expect(screen.getByText("Security Updates")).toBeTruthy();
        expect(screen.getByText("Login Alerts")).toBeTruthy();
        expect(screen.getByText("Transaction Notifications")).toBeTruthy();
        expect(screen.getByText("Escrow Status Updates")).toBeTruthy();
        expect(screen.getByText("Email Notifications")).toBeTruthy();

        const securityUpdatesToggle = screen.getByRole("switch", { name: /toggle security updates/i });
        expect(securityUpdatesToggle.getAttribute("aria-checked")).toBe("true");

        const txToggle = screen.getByRole("switch", { name: /toggle transaction notifications/i });
        expect(txToggle.getAttribute("aria-checked")).toBe("false");
    });

    it("calls updatePreference when toggle is clicked", () => {
        vi.spyOn(securityHooksModule, "useSecuritySettings").mockReturnValue({
            preferences: {
                securityUpdates: true,
                loginAlerts: true,
                transactionNotifications: false,
                escrowStatusUpdates: true,
                emailNotifications: false,
            },
            isLoading: false,
            error: null,
            isFallback: false,
            updatingKeys: {},
            updatePreference: mockUpdatePreference,
            reload: vi.fn(),
        });

        render(<SecurityPreferences />);

        const txToggle = screen.getByRole("switch", { name: /toggle transaction notifications/i });
        fireEvent.click(txToggle);

        expect(mockUpdatePreference).toHaveBeenCalledWith("transactionNotifications", true);
    });

    it("shows a retryable error instead of default-looking toggles", () => {
        const reload = vi.fn();
        vi.spyOn(securityHooksModule, "useSecuritySettings").mockReturnValue({
            preferences: {
                securityUpdates: true,
                loginAlerts: true,
                transactionNotifications: true,
                escrowStatusUpdates: true,
                emailNotifications: false,
            },
            isLoading: false,
            error: "Failed to load security settings (500)",
            isFallback: false,
            updatingKeys: {},
            updatePreference: mockUpdatePreference,
            reload,
        });

        render(<SecurityPreferences />);

        expect(screen.getByRole("alert").textContent).toContain("Failed to load");
        expect(screen.queryAllByRole("switch")).toHaveLength(0);
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("labels unsupported-endpoint values as a local fallback", () => {
        vi.spyOn(securityHooksModule, "useSecuritySettings").mockReturnValue({
            preferences: {
                securityUpdates: true,
                loginAlerts: true,
                transactionNotifications: true,
                escrowStatusUpdates: true,
                emailNotifications: false,
            },
            isLoading: false,
            error: null,
            isFallback: true,
            updatingKeys: {},
            updatePreference: mockUpdatePreference,
            reload: vi.fn(),
        });

        render(<SecurityPreferences />);

        expect(screen.getByText(/explicit fallback values are local only/i)).toBeTruthy();
        expect(screen.getAllByRole("switch")).toHaveLength(5);
    });
});
