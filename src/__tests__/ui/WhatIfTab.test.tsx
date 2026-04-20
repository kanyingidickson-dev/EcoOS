import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { describe, it, expect } from "vitest";
import { WhatIfTab } from "../../app/components/WhatIfTab";
import { ToastProvider } from "../../app/components/shared";

describe("WhatIfTab", () => {
  it("renders correctly", () => {
    render(
      <ToastProvider>
        <WhatIfTab />
      </ToastProvider>
    );

    expect(screen.getByRole("heading", { name: /What-If\s*Simulator/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/E\.g\.,\s*'What if I stop using a car\?'/i)).toBeInTheDocument();
  });

  it("handles form submission and displays simulated impact", async () => {
    const mockResponse = {
      scenario: "Stop eating meat",
      current_impact: { monthly_co2_kg: 100, description: "Current meat diet" },
      projected_savings: {
        monthly: { co2_kg: 80, money_saved: "$50" },
        six_months: { co2_kg: 480, money_saved: "$300" },
        yearly: { co2_kg: 960, money_saved: "$600" }
      },
      equivalence: {
        trees_equivalent: 45,
        flights_equivalent: "2 flights",
        driving_equivalent: "1000 km"
      },
      difficulty: "Medium",
      tips: ["Start with one day"],
      community_scale: "Massive impact",
      modelUsed: "gemini-2.0-flash"
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as any);

    render(
      <ToastProvider>
        <WhatIfTab />
      </ToastProvider>
    );

    const input = screen.getByPlaceholderText(/E\.g\.,\s*'What if I stop using a car\?'/i);
    fireEvent.change(input, { target: { value: "stop eating meat" } });
    
    const simulateBtn = screen.getByRole("button", { name: /Simulate/i });
    fireEvent.click(simulateBtn);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    expect(await screen.findByText(/Trees planted equivalent/i)).toBeInTheDocument();
    expect(screen.getByText(/Massive impact/i)).toBeInTheDocument();
  });
});
