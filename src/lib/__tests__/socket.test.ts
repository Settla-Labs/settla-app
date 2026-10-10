import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io-client";
import { createAuthedSocket } from "../socket";

const { io } = vi.hoisted(() => ({ io: vi.fn() }));
vi.mock("socket.io-client", () => ({ io }));

interface ServerEvents {
    update: (value: string) => void;
}
interface ClientEvents {
    send: (value: number) => void;
}

describe("createAuthedSocket", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        io.mockReturnValue({});
    });

    it("uses the shared authenticated websocket and reconnection options", () => {
        const socket = {} as Socket<ServerEvents, ClientEvents>;
        io.mockReturnValue(socket);

        const result = createAuthedSocket("https://api.example/", "jwt");

        expect(result).toBe(socket);
        expect(io).toHaveBeenCalledWith("https://api.example", {
            auth: { token: "jwt" },
            autoConnect: false,
            transports: ["websocket"],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 500,
            reconnectionDelayMax: 5_000,
        });
        // Compile-time regression: both event directions remain typed.
        const typedSocket = result as Socket<ServerEvents, ClientEvents>;
        void typedSocket;
    });

    it.each([undefined, "", "  "])("returns null for missing URL %s", (url) => {
        expect(createAuthedSocket(url, "jwt")).toBeNull();
        expect(io).not.toHaveBeenCalled();
    });

    it("removes all trailing slashes", () => {
        createAuthedSocket("https://api.example///", "jwt");
        expect(io).toHaveBeenCalledWith("https://api.example", expect.any(Object));
    });
});
