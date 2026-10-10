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
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOfferCounts } from "../useOfferCounts";

function response(data: unknown, ok = true): Response {
  return { ok, json: vi.fn().mockResolvedValue(data) } as unknown as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("useOfferCounts", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://dummy-api.example");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("starts loading and requests buy and sell with the same abort signal", () => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValue(pending.promise);

    const { result } = renderHook(() => useOfferCounts());

    expect(result.current).toEqual({ buyCount: null, sellCount: null, isLoading: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const signal = fetchMock.mock.calls[0][1]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://dummy-api.example/offers?type=buy", { signal });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://dummy-api.example/offers?type=sell", { signal });
  });

  it.each([
    { description: "null", offer: null, count: 0 },
    { description: "a string", offer: "offer", count: 0 },
    { description: "an object without executed", offer: { id: "open" }, count: 1 },
    { description: "an executed offer", offer: { executed: true }, count: 0 },
  ])("counts $description correctly", async ({ offer, count }) => {
    fetchMock.mockResolvedValueOnce(response([offer])).mockResolvedValueOnce(response([]));

    const { result } = renderHook(() => useOfferCounts());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.buyCount).toBe(count);
    expect(result.current.sellCount).toBe(0);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("reduces the two payloads independently and ignores primitive and executed entries", async () => {
    fetchMock
      .mockResolvedValueOnce(response([null, "offer", 4, true, undefined, {}, { executed: false }, { executed: true }]))
      .mockResolvedValueOnce(response([{ executed: 0 }, { executed: true }, null]));

    const { result } = renderHook(() => useOfferCounts());

    await waitFor(() => expect(result.current).toEqual({ buyCount: 2, sellCount: 1, isLoading: false }));
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns zero for two empty arrays", async () => {
    fetchMock.mockResolvedValue(response([]));

    const { result } = renderHook(() => useOfferCounts());

    await waitFor(() => expect(result.current).toEqual({ buyCount: 0, sellCount: 0, isLoading: false }));
  });

  it.each(["buy", "sell"])("ends loading and logs a rejected %s request", async (type) => {
    const failure = new Error(`${type} failed`);
    fetchMock.mockImplementation((url) =>
      String(url).endsWith(`type=${type}`) ? Promise.reject(failure) : Promise.resolve(response([]))
    );

    const { result } = renderHook(() => useOfferCounts());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.buyCount).toBeNull();
    expect(result.current.sellCount).toBeNull();
    expect(console.error).toHaveBeenCalledExactlyOnceWith("[useOfferCounts]", failure);
  });

  it.each(["buy", "sell"])("rejects an unsuccessful %s response before parsing JSON", async (type) => {
    const buy = response([], type !== "buy");
    const sell = response([], type !== "sell");
    fetchMock.mockResolvedValueOnce(buy).mockResolvedValueOnce(sell);

    const { result } = renderHook(() => useOfferCounts());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.buyCount).toBeNull();
    expect(result.current.sellCount).toBeNull();
    expect(buy.json).not.toHaveBeenCalled();
    expect(sell.json).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledExactlyOnceWith("[useOfferCounts]", expect.objectContaining({ message: "Failed to fetch offer counts" }));
  });

  it("reports a JSON parsing failure without publishing partial counts", async () => {
    const failure = new Error("invalid JSON");
    const buy = response([]);
    vi.mocked(buy.json).mockRejectedValue(failure);
    fetchMock.mockResolvedValueOnce(buy).mockResolvedValueOnce(response([{}]));

    const { result } = renderHook(() => useOfferCounts());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.buyCount).toBeNull();
    expect(result.current.sellCount).toBeNull();
    expect(console.error).toHaveBeenCalledExactlyOnceWith("[useOfferCounts]", failure);
  });

  it("keeps loading unchanged and skips error logging on AbortError", async () => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response([]));
    const { result } = renderHook(() => useOfferCounts());

    await act(async () => {
      const failure = new Error("Request aborted");
      failure.name = "AbortError";
      pending.reject(failure);
      await pending.promise.catch(() => {});
    });

    expect(result.current).toEqual({ buyCount: null, sellCount: null, isLoading: true });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("aborts both outstanding requests on unmount", () => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValue(pending.promise);
    const { unmount } = renderHook(() => useOfferCounts());
    const buySignal = fetchMock.mock.calls[0][1]?.signal;
    const sellSignal = fetchMock.mock.calls[1][1]?.signal;

    unmount();

    expect(buySignal).toBe(sellSignal);
    expect(buySignal?.aborted).toBe(true);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("uses relative endpoints when the API URL is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    fetchMock.mockResolvedValue(response([]));

    const { result } = renderHook(() => useOfferCounts());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/offers?type=buy", "/offers?type=sell"]);
  });

  it("reports a non-array payload instead of publishing misleading counts", async () => {
    fetchMock.mockResolvedValueOnce(response({ offers: [] })).mockResolvedValueOnce(response([{}]));

    const { result } = renderHook(() => useOfferCounts());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.buyCount).toBeNull();
    expect(result.current.sellCount).toBeNull();
    expect(console.error).toHaveBeenCalledExactlyOnceWith("[useOfferCounts]", expect.any(TypeError));
  });

  it("does not overwrite current counts when superseded requests resolve later", async () => {
    const staleBuy = deferred<Response>();
    const staleSell = deferred<Response>();
    fetchMock
      .mockReturnValueOnce(staleBuy.promise)
      .mockReturnValueOnce(staleSell.promise)
      .mockResolvedValueOnce(response([{}, {}]))
      .mockResolvedValueOnce(response([{}]));
    const { result } = renderHook(() => useOfferCounts(), { reactStrictMode: true });

    await waitFor(() => expect(result.current).toEqual({ buyCount: 2, sellCount: 1, isLoading: false }));
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(fetchMock.mock.calls[2][1]?.signal?.aborted).toBe(false);
    await act(async () => {
      staleBuy.resolve(response([{}, {}, {}]));
      staleSell.resolve(response([{}, {}, {}]));
      await Promise.all([staleBuy.promise, staleSell.promise]);
    });
    expect(result.current).toEqual({ buyCount: 2, sellCount: 1, isLoading: false });
    expect(console.error).not.toHaveBeenCalled();
  });
});
