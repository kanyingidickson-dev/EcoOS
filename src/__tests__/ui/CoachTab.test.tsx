import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { describe, it, expect, beforeAll } from "vitest";
import { CoachTab } from "../../app/components/CoachTab";
import { ToastProvider } from "../../app/components/shared";

// Mock scrollIntoView and scrollTo for jsdom
beforeAll(() => {
  window.Element.prototype.scrollIntoView = vi.fn();
  window.Element.prototype.scrollTo = vi.fn();
});

describe("CoachTab", () => {
  it("renders correctly", () => {
    render(
      <ToastProvider>
        <CoachTab />
      </ToastProvider>
    );

    expect(screen.getByText(/Carbon Coach/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask your carbon coach/i)).toBeInTheDocument();
  });

  it("sends message and displays response", async () => {
    const mockResponse = {
      response: "Try reducing meat consumption to lower your carbon footprint.",
      action_items: ["Start with Meatless Mondays", "Try plant-based proteins"],
      encouragement: "Small changes add up!",
      eco_score_delta: 5
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as any);

    render(
      <ToastProvider>
        <CoachTab />
      </ToastProvider>
    );

    const input = screen.getByPlaceholderText(/Ask your carbon coach/i);
    fireEvent.change(input, { target: { value: "How can I reduce my carbon footprint?" } });

    const sendButton = screen.getByRole("button", { name: /send message/i });
    fireEvent.click(sendButton);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    expect(await screen.findByText(/Try reducing meat consumption/i)).toBeInTheDocument();
  });

  it("displays fallback when API fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("API Error"));

    render(
      <ToastProvider>
        <CoachTab />
      </ToastProvider>
    );

    const input = screen.getByPlaceholderText(/Ask your carbon coach/i);
    fireEvent.change(input, { target: { value: "transport advice" } });

    const sendButton = screen.getByRole("button", { name: /send message/i });
    fireEvent.click(sendButton);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Should show fallback advice (transport keyword triggers transport fallback)
    expect(await screen.findByText(/Transportation is often our biggest emissions source/i)).toBeInTheDocument();
  });
});
