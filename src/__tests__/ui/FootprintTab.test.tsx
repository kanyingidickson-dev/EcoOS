import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { describe, it, expect } from "vitest";
import { FootprintTab } from "../../app/components/FootprintTab";
import { ToastProvider } from "../../app/components/shared";

describe("FootprintTab", () => {
  it("renders correctly", () => {
    render(
      <ToastProvider>
        <FootprintTab />
      </ToastProvider>
    );

    // Use getAllByText since "Carbon" and "Mirror" are in separate spans
    expect(screen.getByText(/Carbon/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/commute 20km/i)).toBeInTheDocument();
  });

  it("calls API and displays analysis results", async () => {
    const mockResponse = {
      estimate: 850,
      confidence: "medium",
      breakdown: [
        { category: "Transport", kg: 350, percentage: 41 },
        { category: "Food", kg: 200, percentage: 24 },
        { category: "Energy", kg: 150, percentage: 18 },
        { category: "Consumer", kg: 150, percentage: 17 }
      ],
      explanations: {
        assumptions: "Based on typical urban lifestyle",
        top_drivers: ["Car commuting is your biggest impact", "High meat consumption", "Large home energy use"],
        summary: "Your footprint is slightly above average"
      },
      recommendations: [
        { action: "Switch to public transit", savings_kg_month: 45, difficulty: "Medium", why_it_matters: "Reduces transport emissions" }
      ],
      modelUsed: "gemini-2.0-flash"
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as any);

    render(
      <ToastProvider>
        <FootprintTab />
      </ToastProvider>
    );

    const input = screen.getByPlaceholderText(/commute 20km/i);
    fireEvent.change(input, { target: { value: "I drive 20km daily, eat meat daily, live in apartment" } });

    const analyzeButton = screen.getByRole("button", { name: /analyze/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Look for specific category in the breakdown section
    const transportElements = await screen.findAllByText(/Transport/i);
    expect(transportElements.length).toBeGreaterThanOrEqual(1);
  });

  it("displays reasoning steps during loading", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        estimate: 500,
        confidence: "high",
        breakdown: [],
        explanations: {},
        recommendations: [],
        modelUsed: "gemini-2.0-flash"
      })
    } as any);

    render(
      <ToastProvider>
        <FootprintTab />
      </ToastProvider>
    );

    const input = screen.getByPlaceholderText(/commute 20km/i);
    fireEvent.change(input, { target: { value: "test" } });

    const analyzeButton = screen.getByRole("button", { name: /analyze/i });
    fireEvent.click(analyzeButton);

    // Should show reasoning pipeline heading
    expect(await screen.findByText(/Multi-Step Reasoning/i)).toBeInTheDocument();
  });

  it("displays fallback when API fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("API Error"));

    render(
      <ToastProvider>
        <FootprintTab />
      </ToastProvider>
    );

    const input = screen.getByPlaceholderText(/commute 20km/i);
    fireEvent.change(input, { target: { value: "I drive a lot" } });

    const analyzeButton = screen.getByRole("button", { name: /analyze/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Should show fallback analysis results with CO2 values
    const kgElements = await screen.findAllByText(/kg/i);
    expect(kgElements.length).toBeGreaterThanOrEqual(1);
  });
});
