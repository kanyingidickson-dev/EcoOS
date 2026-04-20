import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getStore,
  saveStore,
  updateStore,
  addHistoryEntry,
  getPersonalizationContext
} from "../../app/components/shared";

describe("Shared Utilities", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("getStore", () => {
    it("returns default store when localStorage is empty", () => {
      const store = getStore();
      expect(store.ecoScore).toBe(50);
      expect(store.totalCO2Saved).toBe(0);
      expect(store.completedQuests).toBe(0);
      expect(store.analyses).toBe(0);
    });

    it("returns parsed store from localStorage", () => {
      const mockStore = {
        ecoScore: 75,
        totalCO2Saved: 100,
        completedQuests: 5,
        analyses: 10,
        history: [],
        recentWasteItems: [],
        questHistory: [],
        coachMessages: [],
        coachTopics: []
      };
      localStorage.setItem("eco-store", JSON.stringify(mockStore));

      const store = getStore();
      expect(store.ecoScore).toBe(75);
      expect(store.totalCO2Saved).toBe(100);
    });
  });

  describe("updateStore", () => {
    it("updates specific fields in store", () => {
      updateStore({ ecoScore: 80 });
      const store = getStore();
      expect(store.ecoScore).toBe(80);
      expect(store.totalCO2Saved).toBe(0); // unchanged
    });

    it("merges multiple updates", () => {
      updateStore({ ecoScore: 85, totalCO2Saved: 50 });
      const store = getStore();
      expect(store.ecoScore).toBe(85);
      expect(store.totalCO2Saved).toBe(50);
    });
  });

  describe("addHistoryEntry", () => {
    it("adds entry to history", () => {
      addHistoryEntry("test_action", 10);
      const store = getStore();
      expect(store.history.length).toBe(1);
      expect(store.history[0].type).toBe("test_action");
      expect(store.history[0].co2).toBe(10);
    });

    it("maintains max 50 history entries", () => {
      for (let i = 0; i < 55; i++) {
        addHistoryEntry(`action_${i}`, i);
      }
      const store = getStore();
      expect(store.history.length).toBe(50);
    });
  });

  describe("getPersonalizationContext", () => {
    it("returns context with default values for new user", () => {
      const context = getPersonalizationContext();
      expect(context).toContain("Eco Score: 50/100");
      expect(context).toContain("Total CO₂ Saved: 0kg");
    });

    it("returns context with updated values", () => {
      updateStore({ ecoScore: 70, totalCO2Saved: 25.5, analyses: 3 });
      const context = getPersonalizationContext();
      expect(context).toContain("Eco Score: 70/100");
      expect(context).toContain("Total CO₂ Saved: 25.5kg");
      expect(context).toContain("Analyses completed: 3");
    });
  });

  describe("saveStore", () => {
    it("handles localStorage quota exceeded gracefully", () => {
      // Mock localStorage to throw quota exceeded error
      const mockSetItem = vi.spyOn(Storage.prototype, "setItem");
      mockSetItem.mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      // Should not throw
      expect(() => updateStore({ ecoScore: 90 })).not.toThrow();

      mockSetItem.mockRestore();
    });
  });
});
