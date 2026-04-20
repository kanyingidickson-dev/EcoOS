import { describe, it, expect } from "vitest";
import { sanitizeResponse } from "../app/api/gemini/route";

describe("Gemini Sanitization", () => {
  describe("carbon mode", () => {
    it("should sanitize numeric values and confidence", () => {
      const data = {
        estimate: "-100",
        confidence: "unknown",
        breakdown: [
          { category: "Transport", value: "50" },
          { category: "Food", value: null },
        ],
      };
      const result = sanitizeResponse("carbon", data);
      expect(result.estimate).toBe(0);
      expect(result.confidence).toBe("medium");
      expect(result.breakdown).toHaveLength(4);
      expect(result.breakdown[0].category).toBe("Transport");
      expect(result.breakdown[0].value).toBe(50);
      expect(result.breakdown[1].category).toBe("Food");
      expect(result.breakdown[1].value).toBe(0);
      expect(result.breakdown[2].category).toBe("Energy");
      expect(result.breakdown[3].category).toBe("Consumer");
      expect(result.explanations).toBeTruthy();
      expect(result.recommendations).toHaveLength(4);
      expect(result.suggestions).toHaveLength(4);
    });
  });

  describe("transport mode", () => {
    it("should sanitize negative or string numbers", () => {
      const data = {
        emitted: "-5",
        savings: "10.5",
        greener_emission: null,
        annual_savings: undefined,
      };
      const result = sanitizeResponse("transport", data);
      expect(result.emitted).toBe(0);
      expect(result.savings).toBe(10.5);
      expect(result.greener_emission).toBe(0);
      expect(result.annual_savings).toBe(0);
    });
  });

  describe("quest mode", () => {
    it("should clamp points between 5 and 100", () => {
      expect(sanitizeResponse("quest", { points: -10 }).points).toBe(5);
      expect(sanitizeResponse("quest", { points: 150 }).points).toBe(100);
      expect(sanitizeResponse("quest", { points: "50" }).points).toBe(50);
      expect(sanitizeResponse("quest", { points: null }).points).toBe(20);
    });
  });

  describe("coach mode", () => {
    it("should clamp eco_score_delta between -5 and 15", () => {
      expect(sanitizeResponse("coach", { eco_score_delta: -10 }).eco_score_delta).toBe(-5);
      expect(sanitizeResponse("coach", { eco_score_delta: 20 }).eco_score_delta).toBe(15);
      expect(sanitizeResponse("coach", { eco_score_delta: "5" }).eco_score_delta).toBe(5);
      expect(sanitizeResponse("coach", { eco_score_delta: null }).eco_score_delta).toBe(0);
    });
  });
});
