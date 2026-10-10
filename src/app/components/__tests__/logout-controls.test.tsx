import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Aside } from "../Aside";
import { Header } from "../Header";

const { logoutMock } = vi.hoisted(() => ({
  logoutMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("next/image", () => ({
  default: ({ alt = "", ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // The image implementation is irrelevant to logout behavior.
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

vi.mock("@/features/user/presentation/context/UserContext", () => ({
  useUser: () => ({ logout: logoutMock }),
}));

vi.mock("../HeaderUser", () => ({
  HeaderUser: () => <div>Test user</div>,
}));

vi.mock("../MobileBottomNav", () => ({
  MobileBottomNav: () => null,
}));

describe("shared logout controls", () => {
  beforeEach(() => {
    logoutMock.mockClear();
  });

  it("uses UserContext.logout from the desktop sidebar", () => {
    render(<Aside />);

    fireEvent.click(screen.getByRole("button", { name: /Logout$/ }));

    expect(logoutMock).toHaveBeenCalledExactlyOnceWith();
  });

  it("uses UserContext.logout from the mobile header", () => {
    render(<Header title="Dashboard" />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    fireEvent.click(screen.getByRole("button", { name: /Logout$/ }));

    expect(logoutMock).toHaveBeenCalledExactlyOnceWith();
  });
});
