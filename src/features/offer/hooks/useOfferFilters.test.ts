import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOfferFilters } from "./useOfferFilters";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { DEFAULT_FILTERS } from "../types/offer-filter.types";

vi.mock("next/navigation", () => ({
    useRouter: vi.fn(),
    useSearchParams: vi.fn(),
    usePathname: vi.fn(),
}));

describe("useOfferFilters (#108)", () => {
    let mockReplace: any;
    let mockSearchParams: URLSearchParams;

    beforeEach(() => {
        vi.clearAllMocks();
        mockReplace = vi.fn();
        mockSearchParams = new URLSearchParams();

        vi.mocked(useRouter).mockReturnValue({
            replace: mockReplace,
        } as any);

        vi.mocked(usePathname).mockReturnValue("/offers");
        vi.mocked(useSearchParams).mockImplementation(() => mockSearchParams as any);
    });

    it("resets filters without leaving a dangling bare '?' in the URL", () => {
        mockSearchParams = new URLSearchParams("asset=USDC&minAmount=50");
        const { result } = renderHook(() => useOfferFilters());

        act(() => {
            result.current.clearFilters();
        });

        // Expect target URL to be "/offers" without bare trailing "?"
        expect(mockReplace).toHaveBeenCalledWith("/offers", { scroll: false });
        expect(result.current.draftFilters).toEqual(DEFAULT_FILTERS);
    });

    it("pushes query string to URL when filters are non-default", () => {
        const { result } = renderHook(() => useOfferFilters());

        act(() => {
            result.current.setFilter("asset", "USDC");
        });

        expect(mockReplace).toHaveBeenCalledWith("/offers?asset=USDC", { scroll: false });
    });

    it("pushes clean path without bare '?' when resetting a single filter to default", () => {
        mockSearchParams = new URLSearchParams("asset=USDC");
        const { result } = renderHook(() => useOfferFilters());

        act(() => {
            result.current.setFilter("asset", "");
        });

        expect(mockReplace).toHaveBeenCalledWith("/offers", { scroll: false });
    });

    it("resyncs draftFilters with URL-derived filters upon URL update", () => {
        mockSearchParams = new URLSearchParams();
        const { result, rerender } = renderHook(() => useOfferFilters());

        expect(result.current.draftFilters.asset).toBe("");

        // Simulate desktop URL update or browser navigation
        mockSearchParams = new URLSearchParams("asset=XLM&paymentMethod=bank");
        rerender();

        expect(result.current.filters.asset).toBe("XLM");
        expect(result.current.filters.paymentMethod).toBe("bank");
        expect(result.current.draftFilters.asset).toBe("XLM");
        expect(result.current.draftFilters.paymentMethod).toBe("bank");
    });
});
