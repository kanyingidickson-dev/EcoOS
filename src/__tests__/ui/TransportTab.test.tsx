import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { describe, it, expect } from "vitest";
import { TransportTab } from "../../app/components/TransportTab";
import { ToastProvider } from "../../app/components/shared";

describe("TransportTab", () => {
  it("renders correctly", () => {
    render(
      <ToastProvider>
        <TransportTab />
      </ToastProvider>
    );

    // "Eco" and "Route" are in separate spans
    expect(screen.getByText(/Eco/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/25/i)).toBeInTheDocument();
    // Use getAllByText since "Car" appears in multiple places (mode buttons, quick trips)
    expect(screen.getAllByText(/Car/i).length).toBeGreaterThanOrEqual(1);
  });

  it("calls API and displays results", async () => {
    const mockResponse = {
      emitted: 15.5,
      emission_factor: "166g CO₂ per km (car)",
      greener_option: "train or bus",
      greener_emission: 2.05,
      savings: 8.3,
      annual_savings: 1992,
      equivalence: "Equivalent to 166 trees planted annually",
      scale_impact: "If 1,000 commuters made this switch: 8.3 tons CO₂/year saved",
      route_context: "Analysis for 50km via car",
      modelUsed: "gemini-2.0-flash"
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as any);

    render(
      <ToastProvider>
        <TransportTab />
      </ToastProvider>
    );

    // Select distance
    const distanceInput = screen.getByPlaceholderText(/25/i);
    fireEvent.change(distanceInput, { target: { value: "50" } });

    // Click analyze
    const analyzeButton = screen.getByRole("button", { name: /calculate emissions/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Check for emission factor text - may appear in multiple places
    const emissionElements = await screen.findAllByText(/166g/i);
    expect(emissionElements.length).toBeGreaterThanOrEqual(1);
  });

  it("displays fallback when API fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("API Error"));

    render(
      <ToastProvider>
        <TransportTab />
      </ToastProvider>
    );

    const distanceInput = screen.getByPlaceholderText(/25/i);
    fireEvent.change(distanceInput, { target: { value: "50" } });

    const calculateButton = screen.getByRole("button", { name: /calculate emissions/i });
    fireEvent.click(calculateButton);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Should show fallback message
    expect(await screen.findByText(/Local calculation/i)).toBeInTheDocument();
  });
});
