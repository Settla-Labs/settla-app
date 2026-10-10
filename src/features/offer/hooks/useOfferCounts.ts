"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";

const PAGE_SIZE = 100;

async function fetchActiveOfferCount(
  type: "buy" | "sell",
  signal: AbortSignal,
): Promise<number> {
  let skip = 0;
  let total = 0;

  for (;;) {
    const params = new URLSearchParams({
      type,
      status: "active",
      skip: String(skip),
      take: String(PAGE_SIZE),
    });
    const page = await apiFetch<unknown[]>(`/offers?${params}`, { signal });

    if (!Array.isArray(page)) {
      throw new Error("Offer list response must be an array");
    }

    total += page.length;
    if (page.length < PAGE_SIZE) return total;
    skip += PAGE_SIZE;
  }
}

interface OfferCountsResult {
  buyCount: number | null;
  sellCount: number | null;
  isLoading: boolean;
}

/**
 * Fetches the total number of active buy and sell offers from the backend.
 *
 * The backend does not expose a summary/count endpoint, so each type is read
 * through every page of the authenticated `/offers` contract. The backend's
 * `status=active` filter defines which offers are included; the client only
 * sums page lengths and never infers active state from response objects.
 */
export function useOfferCounts(): OfferCountsResult {
  const [buyCount, setBuyCount] = useState<number | null>(null);
  const [sellCount, setSellCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    void Promise.all([
      fetchActiveOfferCount("buy", controller.signal),
      fetchActiveOfferCount("sell", controller.signal),
    ])
      .then(([nextBuyCount, nextSellCount]) => {
        if (cancelled) return;
        setBuyCount(nextBuyCount);
        setSellCount(nextSellCount);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("[useOfferCounts]", err);
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return { buyCount, sellCount, isLoading };
}
