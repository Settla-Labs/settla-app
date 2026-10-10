import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectButton } from "../ConnectButton";
import * as WalletContextModule from "../../context/WalletContext";

vi.mock("../../context/WalletContext", () => ({
    useWalletContext: vi.fn(),
}));

const mockedUseWalletContext = vi.mocked(
    WalletContextModule.useWalletContext,
);
const connect = vi.fn();
const disconnect = vi.fn();

function setWalletContext(walletId: string | null, isConnected = true) {
    mockedUseWalletContext.mockReturnValue({
        walletId,
        isConnected,
        isLoading: false,
        error: null,
        connect,
        disconnect,
    } as unknown as ReturnType<
        typeof WalletContextModule.useWalletContext
    >);
}

function renderWalletMenu() {
    return render(
        <div role="menu">
            <ConnectButton
                label="Freighter"
                description="Browser extension"
                walletId="freighter-id"
                menuItem
            />
            <ConnectButton
                label="Lobstr"
                description="Mobile wallet"
                walletId="lobstr-id"
                menuItem
            />
            <ConnectButton
                label="xBull"
                description="Browser extension"
                walletId="xbull-id"
                menuItem
            />
        </div>,
    );
}

describe("ConnectButton wallet menu state", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows one active disconnect affordance and keeps other wallets selectable", () => {
        setWalletContext("lobstr-id");
        renderWalletMenu();

        expect(screen.getAllByText("Disconnect Wallet")).toHaveLength(1);
        expect(screen.getAllByText("Connected")).toHaveLength(1);

        const items = screen.getAllByRole("menuitem");
        expect(items).toHaveLength(3);
        expect(items[1].getAttribute("aria-current")).toBe("true");
        expect((items[0] as HTMLButtonElement).disabled).toBe(false);
        expect((items[2] as HTMLButtonElement).disabled).toBe(false);

        fireEvent.click(items[0]);
        expect(connect).toHaveBeenCalledExactlyOnceWith("freighter-id");
        expect(disconnect).not.toHaveBeenCalled();
    });

    it("disconnects only from the entry for the connected wallet", () => {
        setWalletContext("freighter-id");
        renderWalletMenu();

        const activeItem = screen
            .getByText("Disconnect Wallet")
            .closest("button");
        expect(activeItem).not.toBeNull();

        fireEvent.click(activeItem!);
        expect(disconnect).toHaveBeenCalledTimes(1);
        expect(connect).not.toHaveBeenCalled();
    });

    it("renders every wallet as a connect action when no wallet is connected", () => {
        setWalletContext(null, false);
        renderWalletMenu();

        expect(screen.queryByText("Disconnect Wallet")).toBeNull();
        expect(screen.queryByText("Connected")).toBeNull();
        expect(screen.getAllByRole("menuitem")).toHaveLength(3);
    });
});
