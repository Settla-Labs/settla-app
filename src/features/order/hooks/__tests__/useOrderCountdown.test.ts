import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOrderCountdown, useOrderCountdown } from "../useOrderCountdown";

describe("getOrderCountdown", () => {
    it("formats the remaining time and rounds an active final second up", () => {
        const now = new Date("2026-10-09T12:00:00.000Z").getTime();

        expect(getOrderCountdown("2026-10-09T12:14:52.000Z", now)).toEqual({
            remainingTime: "14:52",
            isExpired: false,
        });
        expect(getOrderCountdown("2026-10-09T12:00:00.001Z", now)).toEqual({
            remainingTime: "00:01",
            isExpired: false,
        });
    });

    it("distinguishes expired deadlines from missing or invalid deadlines", () => {
        const now = new Date("2026-10-09T12:00:00.000Z").getTime();

        expect(getOrderCountdown("2026-10-09T11:59:59.999Z", now)).toEqual({
            remainingTime: null,
            isExpired: true,
        });
        expect(getOrderCountdown(undefined, now)).toEqual({
            remainingTime: null,
            isExpired: false,
        });
        expect(getOrderCountdown("not-a-date", now)).toEqual({
            remainingTime: null,
            isExpired: false,
        });
    });
});

describe("useOrderCountdown", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-10-09T12:00:00.000Z"));
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it("ticks once per second and switches to the expired state", () => {
        const { result } = renderHook(() => useOrderCountdown("2026-10-09T12:00:02.000Z"));

        expect(result.current).toEqual({ remainingTime: "00:02", isExpired: false });

        act(() => vi.advanceTimersByTime(1000));
        expect(result.current).toEqual({ remainingTime: "00:01", isExpired: false });

        act(() => vi.advanceTimersByTime(1000));
        expect(result.current).toEqual({ remainingTime: null, isExpired: true });
        expect(vi.getTimerCount()).toBe(0);
    });

    it("restarts from a new deadline and cleans up on unmount", () => {
        const { result, rerender, unmount } = renderHook(
            ({ expiresAt }) => useOrderCountdown(expiresAt),
            { initialProps: { expiresAt: "2026-10-09T12:00:02.000Z" } },
        );

        rerender({ expiresAt: "2026-10-09T12:01:00.000Z" });
        expect(result.current).toEqual({ remainingTime: "01:00", isExpired: false });
        expect(vi.getTimerCount()).toBe(1);

        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });
});
