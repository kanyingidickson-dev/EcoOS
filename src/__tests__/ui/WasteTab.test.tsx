import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { vi } from "vitest";
import { describe, it, expect } from "vitest";
import { WasteTab } from "../../app/components/WasteTab";
import { ToastProvider } from "../../app/components/shared";

describe("WasteTab", () => {
  it("renders correctly", () => {
    render(
      <ToastProvider>
        <WasteTab />
      </ToastProvider>
    );

    expect(screen.getByRole("heading", { name: /Waste\s*Wise/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type item name/i)).toBeInTheDocument();
  });

  it("calls API and displays results for Quick Scan", async () => {
    const mockResponse = {
      category: "compost",
      materials: ["organic"],
      explanation: "This is compostable.",
      tip: "Put it in green bin.",
      decomposition_time: "2 weeks",
      modelUsed: "gemini-2.0-flash"
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as any);

    render(
      <ToastProvider>
        <WasteTab />
      </ToastProvider>
    );

    const bananaButton = screen.getByText("Banana peel");
    fireEvent.click(bananaButton);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    expect(await screen.findByRole("heading", { name: /compost/i })).toBeInTheDocument();
    // Use getAllByText and check first occurrence due to reasoning pipeline summary showing tip text twice
    const explanations = screen.getAllByText(/This is compostable/i);
    expect(explanations.length).toBeGreaterThanOrEqual(1);
    const tips = screen.getAllByText(/Put it in green bin/i);
    expect(tips.length).toBeGreaterThanOrEqual(1);
  });

  it("handles image upload button visibility", () => {
    render(
      <ToastProvider>
        <WasteTab />
      </ToastProvider>
    );

    expect(screen.getByText("Snap")).toBeInTheDocument();
  });
});
