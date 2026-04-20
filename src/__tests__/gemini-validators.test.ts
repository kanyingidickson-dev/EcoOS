import { describe, it, expect } from "vitest";
import {
  validateCarbonResponse,
  validateWasteResponse,
  validateTransportResponse,
  validateQuestResponse,
  validateWhatIfResponse,
  validateCoachResponse,
} from "../app/api/gemini/route";

describe("Gemini Validators", () => {
  describe("validateCarbonResponse", () => {
    it("should accept valid data", () => {
      const data = {
        estimate: 100,
        confidence: "high",
        breakdown: [
          { category: "Transport", value: 50, detail: "Daily commute and errands." },
          { category: "Food", value: 20, detail: "Mixed diet with occasional meat." },
          { category: "Energy", value: 20, detail: "Moderate home electricity use." },
          { category: "Consumer", value: 10, detail: "Low consumer goods footprint." },
        ],
        explanations: {
          summary: "Transport and food are the main drivers of this estimate.",
          top_drivers: ["Car commuting", "Meat/dairy frequency", "Heating/cooling"],
          assumptions: ["Average grid intensity", "Typical trip distances", "Standard emission factors"],
        },
        recommendations: [
          { action: "Take transit twice per week", savings_kg_month: 10, difficulty: "Easy", why_it_matters: "Transport is a big lever." },
          { action: "Swap 3 meals/week to plant-forward", savings_kg_month: 8, difficulty: "Easy", why_it_matters: "Food changes add up." },
          { action: "Use smart power strips", savings_kg_month: 4, difficulty: "Easy", why_it_matters: "Cuts standby loads." },
          { action: "Buy second-hand clothing", savings_kg_month: 3, difficulty: "Medium", why_it_matters: "Avoids embedded emissions." },
        ],
        suggestions: [
          "Take transit twice per week — saves ~10kg CO2/month",
          "Swap 3 meals/week to plant-forward — saves ~8kg CO2/month",
          "Use smart power strips — saves ~4kg CO2/month",
          "Buy second-hand clothing — saves ~3kg CO2/month",
        ],
      };
      expect(validateCarbonResponse(data)).toBe(true);
    });

    it("should reject missing or invalid estimate", () => {
      expect(validateCarbonResponse({ estimate: -10, confidence: "high", breakdown: [], suggestions: [] })).toBe(false);
      expect(validateCarbonResponse({ estimate: "100", confidence: "high", breakdown: [], suggestions: [] })).toBe(false);
      expect(validateCarbonResponse({ confidence: "high", breakdown: [], suggestions: [] })).toBe(false);
    });

    it("should reject invalid breakdown", () => {
      expect(validateCarbonResponse({ estimate: 100, confidence: "high", breakdown: [], suggestions: ["A"] })).toBe(false);
      expect(validateCarbonResponse({ estimate: 100, confidence: "high", breakdown: [{ category: "A" }], suggestions: ["A"] })).toBe(false);
    });
  });

  describe("validateWasteResponse", () => {
    it("should accept valid data", () => {
      const data = {
        category: "recycle",
        explanation: "Because it is paper.",
        tip: "Keep it dry.",
      };
      expect(validateWasteResponse(data)).toBe(true);
    });

    it("should reject invalid data", () => {
      expect(validateWasteResponse({ explanation: "A", tip: "B" })).toBe(false);
      expect(validateWasteResponse({ category: 123, explanation: "A", tip: "B" })).toBe(false);
    });
  });

  describe("validateTransportResponse", () => {
    it("should accept valid data", () => {
      expect(validateTransportResponse({ emitted: 10, greener_option: "walk", savings: 10 })).toBe(true);
    });

    it("should reject invalid data", () => {
      expect(validateTransportResponse({ greener_option: "walk", savings: 10 })).toBe(false);
      expect(validateTransportResponse({ emitted: -5, greener_option: "walk", savings: 10 })).toBe(false);
    });
  });

  describe("validateQuestResponse", () => {
    it("should accept valid data", () => {
      expect(validateQuestResponse({ title: "A", description: "B", impact: "C", category: "D" })).toBe(true);
    });

    it("should reject invalid data", () => {
      expect(validateQuestResponse({ description: "B", impact: "C", category: "D" })).toBe(false);
    });
  });

  describe("validateWhatIfResponse", () => {
    it("should accept valid data", () => {
      const data = {
        scenario: "A",
        current_impact: { monthly_co2_kg: 10 },
        projected_savings: {},
        equivalence: { trees_equivalent: 5 },
        tips: ["Tip 1"],
      };
      expect(validateWhatIfResponse(data)).toBe(true);
    });

    it("should reject invalid data", () => {
      expect(validateWhatIfResponse({ scenario: "A", current_impact: { monthly_co2_kg: "10" } })).toBe(false);
      expect(validateWhatIfResponse({ scenario: "A", current_impact: { monthly_co2_kg: 10 }, projected_savings: {}, equivalence: { trees_equivalent: 5 }, tips: [] })).toBe(false);
    });
  });

  describe("validateCoachResponse", () => {
    it("should accept valid data", () => {
      const data = {
        response: "Hello",
        action_items: [{ action: "Do this", impact: "High" }],
      };
      expect(validateCoachResponse(data)).toBe(true);
    });

    it("should reject invalid data", () => {
      expect(validateCoachResponse({ response: "Hello", action_items: [] })).toBe(false);
      expect(validateCoachResponse({ response: "Hello", action_items: [{ action: "Do this" }] })).toBe(false);
    });
  });
});
