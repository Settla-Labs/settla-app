"use client";

import { useEffect, useState } from "react";

export interface OrderCountdown {
    remainingTime: string | null;
    isExpired: boolean;
}

export function getOrderCountdown(expiresAt: string | null | undefined, now = Date.now()): OrderCountdown {
    if (!expiresAt) {
        return { remainingTime: null, isExpired: false };
    }

    const target = new Date(expiresAt).getTime();
    if (!Number.isFinite(target)) {
        return { remainingTime: null, isExpired: false };
    }

    const remainingMilliseconds = target - now;
    if (remainingMilliseconds <= 0) {
        return { remainingTime: null, isExpired: true };
    }

    // Round up so an active order never displays a misleading frozen 00:00.
    const remainingSeconds = Math.ceil(remainingMilliseconds / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    return {
        remainingTime: `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
        isExpired: false,
    };
}

export function useOrderCountdown(expiresAt: string | null | undefined): OrderCountdown {
    const [, renderNextSecond] = useState(0);
    const countdown = getOrderCountdown(expiresAt);

    useEffect(() => {
        const initialCountdown = getOrderCountdown(expiresAt);
        if (!initialCountdown.remainingTime) {
            return;
        }

        const intervalId = window.setInterval(() => {
            const nextCountdown = getOrderCountdown(expiresAt);
            renderNextSecond((tick) => tick + 1);

            if (nextCountdown.isExpired || !nextCountdown.remainingTime) {
                window.clearInterval(intervalId);
            }
        }, 1000);

        return () => window.clearInterval(intervalId);
    }, [expiresAt]);

    return countdown;
}
