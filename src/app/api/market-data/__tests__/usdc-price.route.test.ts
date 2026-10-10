// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../usdc-price/route";

describe("GET /api/market-data/usdc-price", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const now = new Date("2026-10-09T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.stubEnv("NEXT_PUBLIC_MARKET_API_URL", undefined);
    vi.stubEnv("MARKET_API_KEY", undefined);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function respondWithPrice() {
    fetchMock.mockResolvedValueOnce(
      Response.json({ "usd-coin": { usd: 1.0012 } }),
    );
  }

  it("returns the validated price, timestamp, and public cache policy", async () => {
    respondWithPrice();

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      price: 1.0012,
      updatedAt: now.toISOString(),
    });
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=30, stale-while-revalidate=15",
    );
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd",
      expect.objectContaining({
        headers: { Accept: "application/json" },
        signal: expect.any(AbortSignal),
        next: { revalidate: 30 },
      }),
    );
  });

  it("returns 502 for an unsuccessful upstream response without reading its body", async () => {
    const upstream = new Response("not JSON", {
      status: 429,
      statusText: "Too Many Requests",
    });
    const readBody = vi.spyOn(upstream, "json");
    fetchMock.mockResolvedValueOnce(upstream);

    const response = await GET();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Upstream API error: 429 Too Many Requests",
    });
    expect(readBody).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBeNull();
  });

  it("returns 502 when the quote currency is missing", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ "usd-coin": {} }));

    const response = await GET();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Unexpected response structure from market-data provider",
    });
    expect(response.headers.get("Cache-Control")).toBeNull();
  });

  it.each([undefined, ""])(
    "omits the API-key header when MARKET_API_KEY is %s",
    async (apiKey) => {
      vi.stubEnv("MARKET_API_KEY", apiKey);
      respondWithPrice();

      expect((await GET()).status).toBe(200);
      expect(fetchMock.mock.calls[0][1]?.headers).toEqual({
        Accept: "application/json",
      });
    },
  );

  it("uses the configured provider URL and server API key", async () => {
    vi.stubEnv("NEXT_PUBLIC_MARKET_API_URL", "https://market.example.test/v3");
    vi.stubEnv("MARKET_API_KEY", "test-only-api-key");
    respondWithPrice();

    expect((await GET()).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "https://market.example.test/v3/simple/price?ids=usd-coin&vs_currencies=usd",
      expect.objectContaining({
        headers: {
          Accept: "application/json",
          "x-cg-pro-api-key": "test-only-api-key",
        },
      }),
    );
  });

  it("returns 502 when the upstream request rejects", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Provider unavailable"));

    const response = await GET();

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Provider unavailable" });
    expect(response.headers.get("Cache-Control")).toBeNull();
  });
});
