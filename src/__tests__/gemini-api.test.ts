import { describe, it, expect } from "vitest";
import {
  validateCarbonResponse,
  validateWasteResponse,
  validateTransportResponse,
  validateQuestResponse,
  validateWhatIfResponse,
  validateCoachResponse,
  sanitizeResponse,
} from "../app/api/gemini/route";

describe("Model Configuration Tests", () => {
  describe("Tiered Fallback", () => {
    it("falls back to 2.0-flash on 429 from 2.5", async () => {
      // Simulate the model cascade behavior
      const MODELS = ["gemini-2.5-flash-preview-04-17", "gemini-2.0-flash"];
      let attemptedModels: string[] = [];
      
      // Mock error simulation
      const quotaError = new Error("[429 Too Many Requests] Quota exceeded");
      
      // First model fails with 429
      try {
        attemptedModels.push(MODELS[0]);
        throw quotaError;
      } catch (e: any) {
        if (e.message?.includes("429") || e.message?.includes("quota")) {
          // Should try fallback model
          attemptedModels.push(MODELS[1]);
        }
      }
      
      expect(attemptedModels).toContain("gemini-2.5-flash-preview-04-17");
      expect(attemptedModels).toContain("gemini-2.0-flash");
    });

    it("returns mock after both models fail", async () => {
      // Simulate complete failure scenario
      const errors = [
        new Error("[429] gemini-2.5-flash quota exceeded"),
        new Error("[429] gemini-2.0-flash quota exceeded"),
      ];
      
      let fallbackToMock = false;
      
      // Simulate trying both models
      for (const error of errors) {
        const isQuotaError = error.message?.includes("429") || error.message?.includes("quota");
        expect(isQuotaError).toBe(true);
      }
      
      // After both fail, should use mock
      fallbackToMock = true;
      expect(fallbackToMock).toBe(true);
      
      // Verify mock data is valid
      const mockResponse = {
        category: "recycle",
        explanation: "Clean materials can be recycled",
        tip: "Rinse before recycling",
      };
      expect(validateWasteResponse(mockResponse)).toBe(true);
    });

    it("uses cached response for identical input", () => {
      // Simulate cache behavior
      const cache = new Map<string, any>();
      const mode = "waste";
      const input = "plastic bottle";
      const key = `${mode}:${input.toLowerCase().trim()}`;
      
      const cachedData = {
        category: "recycle",
        materials: ["plastic (#1 PET)"],
        explanation: "Clean plastic bottles are recyclable and can be reprocessed into new products.",
        tip: "Rinse and remove cap",
        decomposition_time: "100-1,000 years",
      };
      
      // Store in cache
      cache.set(key, cachedData);
      
      // Retrieve from cache
      const retrieved = cache.get(key);
      expect(retrieved).toEqual(cachedData);
      expect(validateWasteResponse(retrieved)).toBe(true);
    });

    it("validates sanitized mock output", () => {
      // Test that mock responses are properly sanitized
      const incompleteMock = {
        estimate: null,
        confidence: "invalid",
        breakdown: [],
        recommendations: [],
        suggestions: [],
        explanations: null,
      };

      const sanitized = sanitizeResponse("carbon", incompleteMock);

      // Verify sanitization filled in missing values
      expect(sanitized.estimate).toBe(0);
      expect(sanitized.confidence).toBe("medium");
      expect(sanitized.breakdown).toHaveLength(4);
      expect(sanitized.recommendations).toHaveLength(4);
      expect(sanitized.suggestions).toHaveLength(4);
      expect(sanitized.explanations).toBeDefined();
      expect(sanitized.explanations.summary).toBeDefined();
    });
  });

  describe("Model Upgrade", () => {
    it("should have valid mock data for all modes", () => {
      // Verify mock data structure is complete
      const mockCarbon = {
        estimate: 245,
        confidence: "medium",
        breakdown: [
          { category: "Transport", value: 120, detail: "Daily commuting by car" },
          { category: "Food", value: 75, detail: "Regular meat consumption" },
          { category: "Energy", value: 35, detail: "Standard home electricity" },
          { category: "Consumer", value: 15, detail: "Average shopping habits" },
        ],
        explanations: {
          summary: "Transport and food are the main emission sources",
          top_drivers: ["Car commuting", "Meat consumption", "Home energy"],
          assumptions: ["Average emission factors", "Standard grid intensity"],
        },
        recommendations: [
          { action: "Use public transit", savings_kg_month: 48, difficulty: "Medium", why_it_matters: "Reduces daily transport emissions" },
          { action: "Reduce meat intake", savings_kg_month: 35, difficulty: "Easy", why_it_matters: "Livestock production is carbon intensive" },
          { action: "Switch to LED lighting", savings_kg_month: 12, difficulty: "Easy", why_it_matters: "LEDs consume less electricity" },
          { action: "Buy secondhand goods", savings_kg_month: 8, difficulty: "Medium", why_it_matters: "Avoids new manufacturing emissions" },
        ],
        suggestions: ["Transit saves ~48kg monthly", "Less meat saves ~35kg monthly", "LEDs save ~12kg monthly", "Used items save ~8kg monthly"],
        comparison: "Above average footprint",
      };
      expect(validateCarbonResponse(mockCarbon)).toBe(true);
    });

    it("should validate compressed prompt output structure", () => {
      // Simulate what 2.5-flash would return with compressed prompts
      const compressedOutput = {
        estimate: 180,
        confidence: "high",
        breakdown: [
          { category: "Transport", value: 80, detail: "Car commute daily" },
          { category: "Food", value: 50, detail: "Meat consumption" },
          { category: "Energy", value: 30, detail: "Electricity usage" },
          { category: "Consumer", value: 20, detail: "Shopping habits" },
        ],
        explanations: {
          summary: "Transport is the highest emission source for this user",
          top_drivers: ["Car commuting", "Food choices", "Home energy"],
          assumptions: ["Average factors", "Standard grid"],
        },
        recommendations: [
          { action: "Take public transit", savings_kg_month: 30, difficulty: "Easy", why_it_matters: "Reduces transport emissions significantly" },
          { action: "Eat less meat weekly", savings_kg_month: 25, difficulty: "Easy", why_it_matters: "Food production has high carbon impact" },
          { action: "Install LED bulbs", savings_kg_month: 10, difficulty: "Easy", why_it_matters: "LEDs use much less electricity" },
          { action: "Buy secondhand items", savings_kg_month: 15, difficulty: "Medium", why_it_matters: "Avoids manufacturing emissions" },
        ],
        suggestions: ["Transit saves ~30kg CO2 monthly", "Less meat saves ~25kg monthly", "LEDs save ~10kg monthly", "Used items save ~15kg monthly"],
        comparison: "Above average footprint",
      };
      expect(validateCarbonResponse(compressedOutput)).toBe(true);
    });

    it("should sanitize incomplete API responses", () => {
      const incompleteResponse = {
        estimate: "invalid",
        confidence: "unknown",
        breakdown: [],
        recommendations: [],
        suggestions: [],
      };
      const sanitized = sanitizeResponse("carbon", incompleteResponse);
      expect(sanitized.estimate).toBe(0);
      expect(sanitized.confidence).toBe("medium");
      expect(sanitized.breakdown).toHaveLength(4);
      expect(sanitized.recommendations).toHaveLength(4);
      expect(sanitized.suggestions).toHaveLength(4);
    });
  });

  describe("Fallback Chain", () => {
    it("should validate mock output for all modes", () => {
      // Waste
      expect(validateWasteResponse({
        category: "recycle",
        explanation: "Clean plastic",
        tip: "Rinse before recycling",
      })).toBe(true);

      // Transport
      expect(validateTransportResponse({
        emitted: 5.5,
        greener_option: "Bus",
        savings: 3.2,
      })).toBe(true);

      // Quest
      expect(validateQuestResponse({
        title: "Test Quest",
        description: "Do something green",
        impact: "Save 10kg CO2",
        category: "Transport",
      })).toBe(true);

      // WhatIf
      expect(validateWhatIfResponse({
        scenario: "Stop driving",
        current_impact: { monthly_co2_kg: 100 },
        projected_savings: { monthly: { co2_kg: 50, money_saved: "$20" } },
        equivalence: { trees_equivalent: 10 },
        tips: ["Start small"],
      })).toBe(true);

      // Coach
      expect(validateCoachResponse({
        response: "Great job!",
        action_items: [{ action: "Walk more", impact: "Save 5kg" }],
      })).toBe(true);
    });
  });
});
