import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCsrfToken, setTokenProvider } from "@/lib/api/client";
import { useOfferCounts } from "../useOfferCounts";

const fetchMock = vi.fn<typeof fetch>();

function page(length: number): Response {
  return Response.json(Array.from({ length }, () => ({})));
}

describe("useOfferCounts", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    setTokenProvider(() => "session-token");
  });

  afterEach(() => {
    setTokenProvider(null);
    resetCsrfToken();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fetches every active-offer page with session authorization", async () => {
    const pageSizes: Record<string, number> = {
      "buy:0": 100,
      "buy:100": 23,
      "sell:0": 100,
      "sell:100": 100,
      "sell:200": 5,
    };

    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      const key = `${url.searchParams.get("type")}:${url.searchParams.get("skip")}`;

      expect(url.pathname).toBe("/offers");
      expect(url.searchParams.get("status")).toBe("active");
      expect(url.searchParams.get("take")).toBe("100");
      return page(pageSizes[key] ?? 0);
    });

    const { result } = renderHook(() => useOfferCounts());

    await waitFor(() => {
      expect(result.current).toEqual({
        buyCount: 123,
        sellCount: 205,
        isLoading: false,
      });
    });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options).toEqual(
        expect.objectContaining({
          credentials: "include",
          headers: expect.objectContaining({
            Authorization: "Bearer session-token",
          }),
        }),
      );
    }
  });

  it("stops loading without publishing partial totals when a page fails", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.searchParams.get("type") === "sell") {
        return Response.json({ message: "Unavailable" }, { status: 503 });
      }
      return page(4);
    });

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = renderHook(() => useOfferCounts());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.buyCount).toBeNull();
    expect(result.current.sellCount).toBeNull();
    consoleError.mockRestore();
  });
});
