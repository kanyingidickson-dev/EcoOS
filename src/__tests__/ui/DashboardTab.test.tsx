import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { beforeAll, describe, it, expect } from "vitest";
import { DashboardTab } from "../../app/components/DashboardTab";
import { ToastProvider } from "../../app/components/shared";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock intersection observer for framer-motion
beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", vi.fn(() => ({
    disconnect: vi.fn(),
    observe: vi.fn(),
    takeRecords: vi.fn(),
    unobserve: vi.fn(),
  })));
});

describe("DashboardTab", () => {
  it("renders the dashboard correctly", () => {
    render(
      <ToastProvider>
        <DashboardTab />
      </ToastProvider>
    );

    expect(screen.getByText(/Reimagining/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Carbon Mirror/i })).toBeInTheDocument();
    // Check for Quick Link cards (6 feature shortcuts)
    expect(screen.getAllByText(/Overview/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Waste/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Coach/i).length).toBeGreaterThan(0);
  });

  it("handles the Global Impact Simulation mode", () => {
    render(
      <ToastProvider>
        <DashboardTab />
      </ToastProvider>
    );

    const toggle = screen.getByText(/Global Impact Simulation/i);
    expect(toggle).toBeInTheDocument();
    
    // Check if moving the slider works
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "2000" } });
    expect(slider).toHaveValue("2000");
    
    // The scale impact insight should update
    expect(screen.getByText(/people used EcoOS/i)).toBeInTheDocument();
  });
});
