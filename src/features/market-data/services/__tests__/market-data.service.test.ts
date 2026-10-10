// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPriceCache, fetchUsdcPrice } from "../market-data.service";

const fetchMock = vi.fn<typeof fetch>();
const initialTime = new Date("2026-10-09T04:00:00.000Z");

function priceResponse(price: unknown): Response {
  return new Response(JSON.stringify({ price, updatedAt: initialTime.toISOString() }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchUsdcPrice", () => {
  beforeEach(() => {
    clearPriceCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    vi.setSystemTime(initialTime);
  });

  afterEach(() => {
    clearPriceCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("fetches a valid price from the internal route with the supplied abort signal", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValueOnce(priceResponse(1.002));

    await expect(fetchUsdcPrice(controller.signal)).resolves.toBe(1.002);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/market-data/usdc-price", {
      signal: controller.signal,
      cache: "no-store",
    });
  });

  it("returns the cached price without fetching again inside the 45-second TTL", async () => {
    fetchMock.mockResolvedValueOnce(priceResponse(1.002));
    await expect(fetchUsdcPrice()).resolves.toBe(1.002);

    vi.setSystemTime(initialTime.getTime() + 44_999);
    await expect(fetchUsdcPrice()).resolves.toBe(1.002);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refetches at the exact TTL boundary", async () => {
    fetchMock
      .mockResolvedValueOnce(priceResponse(1.002))
      .mockResolvedValueOnce(priceResponse(0.999));
    await fetchUsdcPrice();

    vi.setSystemTime(initialTime.getTime() + 45_000);
    await expect(fetchUsdcPrice()).resolves.toBe(0.999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refetches after expiry and gives the replacement price a fresh TTL", async () => {
    fetchMock
      .mockResolvedValueOnce(priceResponse(1.002))
      .mockResolvedValueOnce(priceResponse(1.001));
    await fetchUsdcPrice();

    vi.setSystemTime(initialTime.getTime() + 60_000);
    await expect(fetchUsdcPrice()).resolves.toBe(1.001);
    vi.setSystemTime(initialTime.getTime() + 104_999);
    await expect(fetchUsdcPrice()).resolves.toBe(1.001);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects an error body with its exact message and does not cache the failed response", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Provider unavailable" })))
      .mockResolvedValueOnce(priceResponse(1.002));

    await expect(fetchUsdcPrice()).rejects.toThrow(new Error("Provider unavailable"));
    await expect(fetchUsdcPrice()).resolves.toBe(1.002);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([0, -1, "1.002", null, undefined])(
    "rejects invalid price %s with the exact validation message and allows a retry",
    async (price) => {
      fetchMock
        .mockResolvedValueOnce(priceResponse(price))
        .mockResolvedValueOnce(priceResponse(1.001));

      await expect(fetchUsdcPrice()).rejects.toThrow(
        new Error(`Invalid price received from market-data route: ${price}`),
      );
      await expect(fetchUsdcPrice()).resolves.toBe(1.001);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it("rejects a non-success status before trying to parse the body", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Not JSON", { status: 503 }));

    await expect(fetchUsdcPrice()).rejects.toThrow(
      new Error("Market-data API responded with 503"),
    );
  });

  it("propagates a network failure without preventing the next request", async () => {
    const failure = new Error("Connection interrupted");
    fetchMock
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(priceResponse(1.002));

    await expect(fetchUsdcPrice()).rejects.toBe(failure);
    await expect(fetchUsdcPrice()).resolves.toBe(1.002);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid JSON without caching it", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("Not JSON"))
      .mockResolvedValueOnce(priceResponse(1.002));

    await expect(fetchUsdcPrice()).rejects.toBeInstanceOf(SyntaxError);
    await expect(fetchUsdcPrice()).resolves.toBe(1.002);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refetches immediately after clearPriceCache even while the old price was fresh", async () => {
    fetchMock
      .mockResolvedValueOnce(priceResponse(1.002))
      .mockResolvedValueOnce(priceResponse(0.998));
    await fetchUsdcPrice();

    clearPriceCache();
    await expect(fetchUsdcPrice()).resolves.toBe(0.998);
    await expect(fetchUsdcPrice()).resolves.toBe(0.998);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
