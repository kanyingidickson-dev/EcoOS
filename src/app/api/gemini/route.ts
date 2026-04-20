import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Model cascade: 2.5-flash (best) → 2.0-flash (fallback) → mock (last resort)
const MODEL_PRIMARY = "gemini-2.5-flash";
const MODEL_FALLBACK = "gemini-2.0-flash";

// Simple in-memory cache for identical requests
const responseCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Circuit breaker for quota protection
let quotaErrors = 0;
let lastQuotaErrorTime = 0;
const QUOTA_ERROR_THRESHOLD = 2;
const QUOTA_COOLDOWN_MS = 5 * 60 * 1000; // 5 min cooldown after quota errors

const getModel = (modelName: string = MODEL_PRIMARY) => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json" },
  });
};

// --- Response Validation ---

export function validateCarbonResponse(data: any): boolean {
  if (typeof data.estimate !== "number" || data.estimate < 0) return false;
  if (!["low", "medium", "high"].includes(data.confidence)) return false;

  const expectedCategories = ["Transport", "Food", "Energy", "Consumer"];
  if (!Array.isArray(data.breakdown) || data.breakdown.length !== expectedCategories.length) return false;
  const seen = new Set<string>();
  for (const item of data.breakdown) {
    if (!item?.category || typeof item.category !== "string") return false;
    if (!expectedCategories.includes(item.category)) return false;
    if (seen.has(item.category)) return false;
    seen.add(item.category);
    if (typeof item.value !== "number" || item.value < 0) return false;
    if (typeof item.detail !== "string" || item.detail.length < 3) return false;
  }

  if (!Array.isArray(data.suggestions) || data.suggestions.length !== 4) return false;
  if (data.suggestions.some((s: any) => typeof s !== "string" || s.length < 6)) return false;

  if (!data.explanations || typeof data.explanations !== "object") return false;
  if (!Array.isArray(data.explanations.assumptions) || data.explanations.assumptions.length < 2) return false;
  if (!Array.isArray(data.explanations.top_drivers) || data.explanations.top_drivers.length < 2) return false;
  if (typeof data.explanations.summary !== "string" || data.explanations.summary.length < 10) return false;

  if (!Array.isArray(data.recommendations) || data.recommendations.length !== 4) return false;
  for (const rec of data.recommendations) {
    if (typeof rec?.action !== "string" || rec.action.length < 6) return false;
    if (typeof rec?.savings_kg_month !== "number" || rec.savings_kg_month < 0) return false;
    if (!['Easy', 'Medium', 'Hard'].includes(rec?.difficulty)) return false;
    if (typeof rec?.why_it_matters !== "string" || rec.why_it_matters.length < 10) return false;
  }

  if (data.comparison && typeof data.comparison !== "string") return false;
  return true;
}

export function validateWasteResponse(data: any): boolean {
  if (!data.category || typeof data.category !== "string") return false;
  if (!data.explanation || typeof data.explanation !== "string") return false;
  if (!data.tip || typeof data.tip !== "string") return false;
  return true;
}

export function validateTransportResponse(data: any): boolean {
  if (typeof data.emitted !== "number" || data.emitted < 0) return false;
  if (!data.greener_option || typeof data.greener_option !== "string") return false;
  if (typeof data.savings !== "number") return false;
  return true;
}

export function validateQuestResponse(data: any): boolean {
  if (!data.title || typeof data.title !== "string") return false;
  if (!data.description || typeof data.description !== "string") return false;
  if (!data.impact || typeof data.impact !== "string") return false;
  if (!data.category || typeof data.category !== "string") return false;
  return true;
}

export function validateWhatIfResponse(data: any): boolean {
  if (!data.scenario || typeof data.scenario !== "string") return false;
  if (!data.current_impact || typeof data.current_impact.monthly_co2_kg !== "number") return false;
  if (!data.projected_savings) return false;
  if (!data.equivalence || typeof data.equivalence.trees_equivalent !== "number") return false;
  if (!Array.isArray(data.tips) || data.tips.length === 0) return false;
  return true;
}

export function validateCoachResponse(data: any): boolean {
  if (!data.response || typeof data.response !== "string") return false;
  if (!Array.isArray(data.action_items) || data.action_items.length === 0) return false;
  for (const item of data.action_items) {
    if (!item.action || !item.impact) return false;
  }
  return true;
}

export const VALIDATORS: Record<string, (data: any) => boolean> = {
  carbon: validateCarbonResponse,
  waste: validateWasteResponse,
  transport: validateTransportResponse,
  quest: validateQuestResponse,
  whatif: validateWhatIfResponse,
  coach: validateCoachResponse,
};

// --- Sanitization (fix common Gemini quirks) ---

export function sanitizeResponse(mode: string, data: any): any {
  const sanitized = { ...data };

  if (mode === "carbon") {
    sanitized.estimate = Math.max(0, Number(sanitized.estimate) || 0);
    sanitized.confidence = ["low", "medium", "high"].includes(sanitized.confidence) ? sanitized.confidence : "medium";

    const expectedCategories = ["Transport", "Food", "Energy", "Consumer"];
    const breakdown = Array.isArray(sanitized.breakdown) ? sanitized.breakdown : [];
    const byCat = new Map<string, any>();
    for (const b of breakdown) {
      if (b?.category && typeof b.category === "string") byCat.set(b.category, b);
    }
    sanitized.breakdown = expectedCategories.map((category) => {
      const b = byCat.get(category) || { category };
      return {
        category,
        value: Math.max(0, Number(b.value) || 0),
        detail: typeof b.detail === "string" && b.detail.length > 0 ? b.detail : "Estimated from typical patterns.",
      };
    });

    if (!sanitized.explanations || typeof sanitized.explanations !== "object") {
      sanitized.explanations = {};
    }
    if (!Array.isArray(sanitized.explanations.assumptions)) sanitized.explanations.assumptions = [];
    if (!Array.isArray(sanitized.explanations.top_drivers)) sanitized.explanations.top_drivers = [];
    sanitized.explanations.summary = typeof sanitized.explanations.summary === "string" ? sanitized.explanations.summary : "Your footprint estimate is based on the activities you described and common emission factors.";

    if (!Array.isArray(sanitized.recommendations)) sanitized.recommendations = [];
    sanitized.recommendations = sanitized.recommendations.slice(0, 4).map((r: any) => ({
      action: typeof r?.action === "string" ? r.action : "Reduce high-impact habit",
      savings_kg_month: Math.max(0, Number(r?.savings_kg_month) || 0),
      difficulty: ["Easy", "Medium", "Hard"].includes(r?.difficulty) ? r.difficulty : "Medium",
      why_it_matters: typeof r?.why_it_matters === "string" ? r.why_it_matters : "This reduces your monthly emissions.",
    }));

    while (sanitized.recommendations.length < 4) {
      sanitized.recommendations.push({
        action: "Swap one high-impact habit",
        savings_kg_month: 10,
        difficulty: "Easy",
        why_it_matters: "Small repeated changes add up quickly.",
      });
    }

    if (!Array.isArray(sanitized.suggestions)) sanitized.suggestions = [];
    sanitized.suggestions = sanitized.suggestions.slice(0, 4).map((s: any, idx: number) => {
      if (typeof s === "string" && s.length > 0) return s;
      const rec = sanitized.recommendations[idx];
      return `${rec.action} — saves ~${Math.round(rec.savings_kg_month)}kg CO2/month`;
    });
    while (sanitized.suggestions.length < 4) {
      const rec = sanitized.recommendations[sanitized.suggestions.length] || { action: "Reduce emissions", savings_kg_month: 10 };
      sanitized.suggestions.push(`${rec.action} — saves ~${Math.round(rec.savings_kg_month)}kg CO2/month`);
    }
  }

  if (mode === "transport") {
    sanitized.emitted = Math.max(0, Number(sanitized.emitted) || 0);
    sanitized.savings = Math.max(0, Number(sanitized.savings) || 0);
    sanitized.greener_emission = Math.max(0, Number(sanitized.greener_emission) || 0);
    sanitized.annual_savings = Math.max(0, Number(sanitized.annual_savings) || 0);
  }

  if (mode === "whatif") {
    if (sanitized.current_impact) {
      sanitized.current_impact.monthly_co2_kg = Math.max(0, Number(sanitized.current_impact.monthly_co2_kg) || 0);
    }
    if (sanitized.projected_savings) {
      for (const period of ["monthly", "six_months", "yearly"]) {
        if (sanitized.projected_savings[period]) {
          sanitized.projected_savings[period].co2_kg = Math.max(0, Number(sanitized.projected_savings[period].co2_kg) || 0);
        }
      }
    }
    if (sanitized.equivalence) {
      sanitized.equivalence.trees_equivalent = Math.max(0, Number(sanitized.equivalence.trees_equivalent) || 0);
    }
  }

  if (mode === "quest") {
    sanitized.points = Math.max(5, Math.min(100, Number(sanitized.points) || 20));
  }

  if (mode === "coach") {
    sanitized.eco_score_delta = Math.max(-5, Math.min(15, Number(sanitized.eco_score_delta) || 0));
  }

  return sanitized;
}

// --- Compressed prompts (optimized for token efficiency) ---

const PROMPTS: Record<string, string> = {
  carbon: `Analyze carbon footprint. Output JSON only.

Input: {input}
Context: {personalization}

Return:
{
  "estimate": <monthly kg CO2>,
  "confidence": "<low|medium|high>",
  "breakdown": [
    { "category": "Transport", "value": <number>, "detail": "<reason>" },
    { "category": "Food", "value": <number>, "detail": "<reason>" },
    { "category": "Energy", "value": <number>, "detail": "<reason>" },
    { "category": "Consumer", "value": <number>, "detail": "<reason>" }
  ],
  "explanations": { "summary": "<drivers>", "top_drivers": ["a","b","c"], "assumptions": ["a","b","c"] },
  "recommendations": [
    { "action": "<action>", "savings_kg_month": <number>, "difficulty": "<Easy|Medium|Hard>", "why_it_matters": "<reason>" }
  ],
  "suggestions": ["<action — saves ~Xkg>"],
  "comparison": "<vs average>"
}`,

  waste: `Classify waste item. Output JSON only.

Rules: No recycling greasy paper/cardboard. Composite items=landfill. No rinsing paper.

Item: {input}

Return:
{
  "category": "<recycle|compost|landfill|hazardous|e-waste>",
  "materials": ["a","b"],
  "explanation": "<why>",
  "tip": "<reduction tip>",
  "decomposition_time": "<time>"
}`,

  transport: `Calculate transport emissions. Output JSON only.

Route: {input}
Distance: {distance}km
Mode: {mode}

Return:
{
  "emitted": <kg CO2>,
  "emission_factor": "<X g/km>",
  "greener_option": "<alternative>",
  "greener_emission": <kg>,
  "savings": <kg>,
  "annual_savings": <kg>,
  "scale_impact": "<10k users = X tons/yr>",
  "equivalence": "<trees/miles>",
  "route_context": "<comment>"
}`,

  quest: `Create eco-challenge. Output JSON only.

Context: {personalization}

Return:
{
  "title": "<name>",
  "description": "<what to do>",
  "impact": "<quantified benefit>",
  "category": "<Food|Transport|Waste|Energy|Water>",
  "difficulty": "<Easy|Medium|Hard>",
  "points": <10-100>,
  "duration": "<time>"
}`,

  whatif: `Simulate lifestyle change impact. Output JSON only.

Scenario: {input}
Context: {personalization}

Return:
{
  "scenario": "<summary>",
  "current_impact": { "monthly_co2_kg": <number>, "description": "<cost>" },
  "projected_savings": {
    "monthly": { "co2_kg": <number>, "money_saved": "<$>" },
    "six_months": { "co2_kg": <number>, "money_saved": "<$>" },
    "yearly": { "co2_kg": <number>, "money_saved": "<$>" }
  },
  "equivalence": { "trees_equivalent": <number>, "flights_equivalent": "<flights>", "driving_equivalent": "<km>" },
  "difficulty": "<Easy|Medium|Hard>",
  "tips": ["<tip1>","<tip2>"],
  "community_scale": "<10k people = X>"
}`,

  coach: `Coach on sustainability. Output JSON only.

Context: {context}
Message: {input}

Return:
{
  "response": "<coaching response>",
  "action_items": [{ "action": "<step>", "impact": "<savings>" }],
  "encouragement": "<closing line>",
  "eco_score_delta": <-5 to 15>
}`,
};

// --- Mock data for fallback ---

const MOCK_DATA: Record<string, any> = {
  carbon: {
    estimate: 245,
    confidence: "medium",
    breakdown: [
      { category: "Transport", value: 120, detail: "Daily car commute of 20km contributes significantly to transport emissions." },
      { category: "Food", value: 75, detail: "Occasional meat consumption places food emissions in the moderate range." },
      { category: "Energy", value: 35, detail: "Small apartment with standard appliances uses moderate electricity." },
      { category: "Consumer", value: 15, detail: "Average consumer goods and online shopping footprint." },
    ],
    explanations: {
      summary: "Your footprint is primarily driven by transport (commuting) and diet-related emissions, with smaller contributions from home energy and consumer purchases.",
      top_drivers: [
        "Regular gasoline car commuting",
        "Mixed diet with some meat and dairy",
        "Routine online shopping / new goods"
      ],
      assumptions: [
        "Average emission factors for a gasoline car and typical occupancy",
        "Average grid intensity for household electricity",
        "Consumer goods impact estimated from typical spending patterns"
      ]
    },
    recommendations: [
      { action: "Replace 3 commute days/week with transit, bike, or carpool", savings_kg_month: 48, difficulty: "Medium", why_it_matters: "Transport is your largest category, so small shifts create outsized savings." },
      { action: "Swap 5 meals/week to plant-forward options", savings_kg_month: 35, difficulty: "Easy", why_it_matters: "Diet changes compound weekly and reduce high-impact proteins." },
      { action: "Install LED bulbs + smart power strips", savings_kg_month: 12, difficulty: "Easy", why_it_matters: "Reduces wasted electricity from lighting and standby loads." },
      { action: "Buy second-hand for clothing and electronics upgrades", savings_kg_month: 8, difficulty: "Medium", why_it_matters: "Avoids embedded emissions from manufacturing new products." },
    ],
    suggestions: [
      "Switch to public transit 3 days/week — saves ~48kg CO2/month",
      "Adopt plant-based meals on weekdays — saves ~35kg CO2/month",
      "Install LED bulbs and smart power strips — saves ~12kg CO2/month",
      "Buy second-hand clothing for 6 months — saves ~8kg CO2/month",
    ],
    comparison: "Your footprint is ~15% above the global average of 213kg/month per capita.",
  },
  waste: {
    category: "compost",
    materials: ["cardboard", "organic grease"],
    explanation: "Pizza boxes with significant grease or food residue cannot be recycled because the oil prevents paper fibers from rebonding. However, they are excellent for industrial composting.",
    tip: "Separate the clean lid to recycle it, and compost only the greasy bottom half!",
    decomposition_time: "2-3 months in compost, 25+ years in landfill",
  },
  transport: {
    emitted: 4.15,
    emission_factor: "166 g CO2/km for gasoline car",
    greener_option: "Train",
    greener_emission: 0.88,
    savings: 3.27,
    annual_savings: 817.5,
    scale_impact: "If 10,000 commuters switched, we'd save 8,175 tons of CO2 per year",
    equivalence: "Equivalent to planting 380 trees or avoiding 3,350 km of driving",
  },
  quest: [
    {
      title: "Phantom Power Purge",
      description: "Unplug every device and charger in your home that isn't actively in use. Check behind TVs, desks, and kitchen counters. The average home has 20+ phantom loads.",
      impact: "Saves ~0.5 kWh of electricity today, preventing 0.35kg CO2",
      category: "Energy",
      difficulty: "Easy",
      points: 15,
      duration: "15 minutes",
    },
    {
      title: "Meatless Monday Champion",
      description: "Eat only plant-based meals today. Try a lentil curry, veggie stir-fry, or a hearty bean chili. Document your favorite recipe to share!",
      impact: "Saves ~2.5kg of CO2 and 1,100 liters of water vs. a meat-based day",
      category: "Food",
      difficulty: "Medium",
      points: 30,
      duration: "All day",
    },
    {
      title: "Zero-Waste Lunch",
      description: "Pack a lunch using only reusable containers — no plastic wrap, no disposable bags, no single-use utensils. Bonus: bring a cloth napkin.",
      impact: "Prevents 3-5 pieces of single-use plastic from reaching landfill",
      category: "Waste",
      difficulty: "Easy",
      points: 20,
      duration: "Lunch break",
    },
    {
      title: "Walk the Last Mile",
      description: "For every trip today under 2km, walk or cycle instead of driving. Track your steps and calculate the emissions you avoided.",
      impact: "Each 2km walk saves ~0.33kg CO2 vs. driving",
      category: "Transport",
      difficulty: "Medium",
      points: 25,
      duration: "Throughout the day",
    },
  ],
  whatif: {
    scenario: "Stopping Uber rides and using public transit instead",
    current_impact: { monthly_co2_kg: 84, description: "20 rideshare trips/month averaging 15km each produces significant per-passenger emissions." },
    projected_savings: {
      monthly: { co2_kg: 58.8, money_saved: "$120" },
      six_months: { co2_kg: 352.8, money_saved: "$720" },
      yearly: { co2_kg: 705.6, money_saved: "$1,440" },
    },
    equivalence: {
      trees_equivalent: 32,
      flights_equivalent: "3.5 short-haul flights (NYC→Chicago)",
      driving_equivalent: "2,880 km of gasoline car driving",
    },
    difficulty: "Medium",
    tips: [
      "Start with just 2-3 days per week and gradually increase",
      "Use transit time productively — read, listen to podcasts, or plan your day",
    ],
    community_scale: "If 10,000 people made this switch, we'd eliminate 7,056 tons of CO2 annually — equivalent to taking 1,530 cars off the road",
  },
  coach: {
    response: "That's a really honest starting point, and I appreciate you sharing it. Eating meat daily puts your food-related carbon footprint at roughly 2.5-3x higher than a plant-based diet — we're talking about 100-150kg of CO2 per month just from food choices.\n\nBut here's the thing: you don't need to go vegan overnight. Research shows that even reducing meat intake by 50% has a massive impact. Start with what feels natural — maybe swap your lunch for a veggie option 3 days a week. A good lentil dal or a black bean burrito can be just as satisfying.\n\nThe key is finding plant-based meals you genuinely enjoy, not forcing yourself to eat salads. Explore cuisines that are naturally plant-forward — Indian, Ethiopian, Thai, and Mexican food all have incredible meatless options that don't feel like 'diet food.'",
    action_items: [
      { action: "Try 'Meatless Mondays & Wednesdays' for the first month", impact: "~20kg CO2/month saved" },
      { action: "Replace beef specifically with chicken or fish when you do eat meat", impact: "~15kg CO2/month saved" },
      { action: "Learn 3 plant-based recipes you genuinely love", impact: "Long-term habit sustainability" },
    ],
    encouragement: "Every single meal is a choice, and every plant-based meal is a win. You're already ahead of most people just by thinking about this. 🌱",
    eco_score_delta: 5,
  },
};

function getMockResponse(mode: string, input?: string, distance?: string, transportMode?: string, image?: string, fallbackReason?: "placeholder" | "quota" | "error") {
  if (mode === "quest") {
    const quests = MOCK_DATA.quest;
    return quests[Math.floor(Math.random() * quests.length)];
  }
  
  const baseMock = MOCK_DATA[mode];
  if (!baseMock) return { error: "Unknown mode" };

  // Deep clone to avoid mutating the original
  const mock = JSON.parse(JSON.stringify(baseMock));
  const query = input ? input.toLowerCase() : "";

  if (mode === "waste") {
    // If an image was uploaded but we can't analyze it, return accurate reason
    if (image) {
      if (fallbackReason === "quota") {
        return {
          category: "unknown",
          materials: ["analysis pending - API quota exceeded"],
          explanation: "Image analysis is temporarily unavailable because the Gemini API quota has been exhausted. Please try again later or type the item name for text-based classification.",
          tip: "API quota limit reached. Try again in a few minutes, or switch to text input for instant classification.",
          decomposition_time: "N/A - quota exceeded",
        };
      }
      if (fallbackReason === "placeholder") {
        return {
          category: "unknown",
          materials: ["unknown - API key not configured"],
          explanation: "Image analysis requires a valid Gemini API key. Please add your GEMINI_API_KEY to .env.local to analyze uploaded images.",
          tip: "Add GEMINI_API_KEY to your .env.local file to enable AI-powered image analysis.",
          decomposition_time: "N/A - API key missing",
        };
      }
      // Generic error fallback
      return {
        category: "unknown",
        materials: ["analysis failed - API error"],
        explanation: "Image analysis could not be completed due to an API error. Please try again or type the item name instead.",
        tip: "Try again in a moment, or use text input for reliable classification.",
        decomposition_time: "N/A - try again later",
      };
    }
    // Specific item definitions for accurate mock responses
    const specificItems: Record<string, { category: string; materials: string[]; decomposition: string; tip: string; explanation: string }> = {
      "egg carton": {
        category: "recycle",
        materials: ["paperboard", "cellulose fiber"],
        decomposition: "2-6 months (paper in landfill); never (styrofoam—persists 500+ years as microplastics)",
        tip: "Paper egg cartons are recyclable and compostable. Styrofoam ones go in landfill—consider switching to paper cartons!",
        explanation: "Paper egg cartons are molded pulp, recyclable and compostable. Styrofoam (EPS) never biodegrades—it fragments into microplastics that persist indefinitely."
      },
      "pizza box": {
        category: "compost",
        materials: ["cardboard", "organic residue"],
        decomposition: "3-6 months in compost; 2+ years in landfill",
        tip: "Tear off the clean lid for recycling, put the greasy bottom in compost. Never recycle heavily soiled pizza boxes!",
        explanation: "Grease and cheese residue prevent cardboard fibers from being reprocessed. Industrial composting can handle these food-soiled materials."
      },
      "chip bag": {
        category: "landfill",
        materials: ["multilayer plastic", "aluminum foil"],
        decomposition: "100-1,000 years",
        tip: "These multi-layer bags cannot be recycled in standard streams. Look for TerraCycle programs for chip bag recycling.",
        explanation: "Chip bags combine plastic and metal layers bonded together—too complex to separate for recycling."
      },
      "starbucks cup": {
        category: "landfill",
        materials: ["paper", "polyethylene lining"],
        decomposition: "20-30 years",
        tip: "The plastic lining prevents recycling. Use a reusable cup—many cafes offer discounts!",
        explanation: "Disposable coffee cups have a thin plastic (PE) lining that makes them unrecyclable in standard paper streams."
      },
      "coffee cup": {
        category: "landfill",
        materials: ["paper", "polyethylene lining"],
        decomposition: "20-30 years",
        tip: "The plastic lining prevents recycling. Use a reusable cup—many cafes offer discounts!",
        explanation: "Disposable coffee cups have a thin plastic (PE) lining that makes them unrecyclable in standard paper streams."
      },
      "milk carton": {
        category: "recycle",
        materials: ["paperboard", "polyethylene", "aluminum (shelf-stable)"],
        decomposition: "5+ years",
        tip: "Rinse and recycle with paper/cardboard. Shelf-stable cartons have extra aluminum layers but are still recyclable.",
        explanation: "Milk cartons are gable-top or aseptic containers made primarily from paperboard with thin plastic/foil barriers—recyclable as carton material."
      },
      "yogurt cup": {
        category: "recycle",
        materials: ["polypropylene (PP #5)"],
        decomposition: "20-500 years",
        tip: "Rinse and recycle. Check for #5 symbol. Some areas don't take PP—verify local guidelines.",
        explanation: "Yogurt cups are typically #5 plastic (polypropylene), widely recyclable though less common than #1/#2."
      },
      "banana peel": {
        category: "compost",
        materials: ["organic matter", "cellulose"],
        decomposition: "2-10 weeks in compost; 3-4 weeks in nature",
        tip: "Perfect for home composting! Breaks down quickly and adds potassium to soil.",
        explanation: "Fruit peels are organic waste that decomposes rapidly and returns nutrients to soil through composting."
      },
      "plastic bag": {
        category: "landfill",
        materials: ["low-density polyethylene (LDPE #4)"],
        decomposition: "20+ years (film plastic)",
        tip: "Return to grocery store plastic film recycling bins. Never put in curbside recycling—they jam machinery!",
        explanation: "Plastic bags are #4 LDPE film plastic that requires specialized recycling. Curbside sorting equipment cannot handle them."
      },
      "bread bag": {
        category: "landfill",
        materials: ["polyethylene film"],
        decomposition: "20+ years",
        tip: "Return to grocery store plastic film recycling. Do not place in curbside bins.",
        explanation: "Bread bags are soft plastic film that jams recycling machinery—return to designated store drop-offs."
      },
      "shampoo bottle": {
        category: "recycle",
        materials: ["high-density polyethylene (HDPE #2)"],
        decomposition: "100-1,000 years",
        tip: "Rinse empty, remove pump (trash), recycle the bottle. HDPE is one of the most recyclable plastics.",
        explanation: "Shampoo bottles are typically #2 HDPE plastic, widely accepted in recycling programs."
      },
      "toothbrush": {
        category: "landfill",
        materials: ["nylon bristles", "polypropylene handle"],
        decomposition: "400-1,000 years",
        tip: "Consider bamboo toothbrushes. For plastic ones, some specialty programs (TerraCycle) accept them.",
        explanation: "Standard toothbrushes combine multiple plastic types and nylon—too complex for standard recycling."
      },
      "razor blade": {
        category: "hazardous",
        materials: ["steel", "plastic handle"],
        decomposition: "50+ years",
        tip: "Wrap in tape or paper and place in sharps container. Do not put loose in trash—safety risk!",
        explanation: "Razor blades pose injury risk to sanitation workers. Some areas have metal recycling for the blade portion."
      },
      "styrofoam": {
        category: "landfill",
        materials: ["expanded polystyrene (EPS #6)"],
        decomposition: "500+ years (does not biodegrade)",
        tip: "Styrofoam is rarely recycled and breaks into microplastics. Avoid when possible—choose paper alternatives.",
        explanation: "Expanded polystyrene (#6) is not biodegradable and is difficult to recycle due to low density and contamination."
      },
      "alufoil": {
        category: "recycle",
        materials: ["aluminum"],
        decomposition: "200-500 years",
        tip: "Clean foil can be recycled. Crumble into a ball. Food-soiled foil goes in landfill.",
        explanation: "Clean aluminum foil is recyclable as metal. Food residue contaminates it for recycling streams."
      },
      "aluminum foil": {
        category: "recycle",
        materials: ["aluminum"],
        decomposition: "200-500 years",
        tip: "Clean foil can be recycled. Crumble into a ball. Food-soiled foil goes in landfill.",
        explanation: "Clean aluminum foil is recyclable as metal. Food residue contaminates it for recycling streams."
      },
      "tissues": {
        category: "compost",
        materials: ["paper fiber"],
        decomposition: "3-6 weeks in compost; 2-5 months in landfill",
        tip: "Tissues, paper towels, and napkins go in compost. Their short fibers aren't suitable for paper recycling.",
        explanation: "Tissues and paper towels have fibers too short for paper recycling but decompose quickly in compost. Landfill anaerobic conditions slow breakdown."
      },
      "wine bottle": {
        category: "recycle",
        materials: ["glass (soda-lime)"],
        decomposition: "1,000,000+ years (glass never decomposes)",
        tip: "Rinse and recycle with glass. Keep lids on (metal caps) or remove based on local rules.",
        explanation: "Glass bottles are infinitely recyclable without quality loss. They never biodegrade, making recycling essential."
      },
      "broken glass": {
        category: "landfill",
        materials: ["glass"],
        decomposition: "1,000,000+ years",
        tip: "Wrap in paper/cardboard and label. Some programs accept broken glass in recycling—check locally.",
        explanation: "Broken glass can be recycled but poses safety risks. Many programs require it be landfilled for worker safety."
      },
      "balloon": {
        category: "landfill",
        materials: ["latex (natural) or mylar (plastic)"],
        decomposition: "6 months-4 years (latex); 100+ years (mylar)",
        tip: "Latex balloons are 'biodegradable' but take years and harm wildlife. Mylar is plastic—avoid both.",
        explanation: "Latex balloons decompose slowly and animals mistake them for food. Mylar is metallicized plastic."
      },
      "iphone": {
        category: "e-waste",
        materials: ["lithium battery", "rare earth metals", "glass", "aluminum"],
        decomposition: "Never decomposes; batteries can leak after 10-20 years",
        tip: "Take to Apple Store or e-waste drop-off. Contains valuable rare earth metals—never trash!",
        explanation: "Electronics contain recoverable rare metals and hazardous batteries requiring specialized e-waste handling."
      },
      "old iphone": {
        category: "e-waste",
        materials: ["lithium battery", "rare earth metals", "glass", "aluminum"],
        decomposition: "Never decomposes; batteries can leak after 10-20 years",
        tip: "Take to Apple Store or e-waste drop-off. Contains valuable rare earth metals—never trash!",
        explanation: "Electronics contain recoverable rare metals and hazardous batteries requiring specialized e-waste handling."
      },
      "used batteries": {
        category: "hazardous",
        materials: ["lithium", "cobalt", "nickel", "acid (lead-acid)"],
        decomposition: "100+ years; leaks toxins",
        tip: "Drop off at hardware stores, e-waste events, or hazardous waste facilities. Never put in trash!",
        explanation: "Batteries contain heavy metals and acids that contaminate soil and water. Specialized recycling recovers materials."
      },
      "car battery": {
        category: "hazardous",
        materials: ["lead", "sulfuric acid", "plastic"],
        decomposition: "100+ years; highly toxic",
        tip: "Return to auto parts store for core refund. Illegal to trash in most areas—extremely hazardous!",
        explanation: "Lead-acid batteries are highly toxic and 99% recyclable. Return to retailers—it's often required by law."
      },
      "charger cable": {
        category: "e-waste",
        materials: ["copper", "plastic (PVC)", "rubber"],
        decomposition: "100-1,000 years",
        tip: "E-waste recycling recovers copper. Some electronics stores accept cables.",
        explanation: "Cables contain recyclable copper wires but mixed materials make them e-waste."
      },
      "earbuds": {
        category: "e-waste",
        materials: ["plastic", "copper", "lithium battery"],
        decomposition: "100-1,000 years",
        tip: "E-waste recycling for small electronics. Some brands have take-back programs.",
        explanation: "Wireless earbuds contain small lithium batteries and electronics requiring e-waste handling."
      },
      "laptop": {
        category: "e-waste",
        materials: ["lithium battery", "rare earth metals", "aluminum", "glass"],
        decomposition: "Never decomposes",
        tip: "E-waste drop-off or trade-in programs. Remove hard drive for data security before recycling.",
        explanation: "Laptops contain recoverable metals and hazardous batteries requiring e-waste processing."
      },
      "tv remote": {
        category: "e-waste",
        materials: ["plastic", "circuit board", "coin battery"],
        decomposition: "100-1,000 years",
        tip: "E-waste recycling. Remove batteries first and recycle those separately.",
        explanation: "Remotes contain circuit boards and small batteries—e-waste for material recovery."
      },
      "broken cfl": {
        category: "hazardous",
        materials: ["glass", "mercury vapor", "metal"],
        decomposition: "N/A (mercury is toxic forever)",
        tip: "Hazardous waste drop-off ONLY. Mercury is toxic. Air out room if broken, don't vacuum.",
        explanation: "CFL bulbs contain mercury, a neurotoxin. Never trash—requires hazardous waste handling."
      },
      "broken cfl light bulb": {
        category: "hazardous",
        materials: ["glass", "mercury vapor", "metal"],
        decomposition: "N/A (mercury is toxic forever)",
        tip: "Hazardous waste drop-off ONLY. Mercury is toxic. Air out room if broken, don't vacuum.",
        explanation: "CFL bulbs contain mercury, a neurotoxin. Never trash—requires hazardous waste handling."
      },
      "wax paper": {
        category: "landfill",
        materials: ["paper", "paraffin wax"],
        decomposition: "2-6 months",
        tip: "Wax coating makes it non-recyclable and non-compostable (synthetic wax). Use parchment (compostable) instead.",
        explanation: "Wax paper has a petroleum-based coating that contaminates both recycling and composting streams."
      },
      "butter wrapper": {
        category: "landfill",
        materials: ["paper", "grease", "foil lining"],
        decomposition: "2-5 years",
        tip: "Food-soiled and multi-layer packaging goes to landfill. Consider bulk butter to reduce packaging.",
        explanation: "Butter wrappers combine paper, grease, and often foil—making them unrecyclable and uncompostable."
      },
      "gum wrapper": {
        category: "landfill",
        materials: ["aluminum foil", "paper", "wax"],
        decomposition: "20-100 years",
        tip: "Too small and multi-layer for recycling. Dispose in landfill.",
        explanation: "Small multi-layer wrappers cannot be separated for recycling and are too contaminated."
      },
      "rubber glove": {
        category: "landfill",
        materials: ["latex or nitrile rubber"],
        decomposition: "5+ years (latex); 100+ years (synthetic)",
        tip: "Synthetic rubber gloves are landfill. Some industrial composting accepts latex. Consider reusable gloves.",
        explanation: "Rubber gloves are made from synthetic or natural rubber that does not break down easily."
      },
      "mirror": {
        category: "landfill",
        materials: ["glass", "silver backing"],
        decomposition: "1,000,000+ years",
        tip: "Mirrors cannot be recycled with glass due to chemical backing. Wrap and landfill.",
        explanation: "Mirrors have metallic/chemical coatings that contaminate standard glass recycling."
      },
      "water bottle": {
        category: "recycle",
        materials: ["PET plastic (#1)"],
        decomposition: "450+ years (never fully decomposes—fragments into microplastics)",
        tip: "Empty and replace cap—caps are recyclable too! Better yet, switch to a reusable bottle.",
        explanation: "PET plastic (#1) is widely recyclable. However, plastic bottles never truly biodegrade—they break into harmful microplastics that persist indefinitely."
      },
      "soda can": {
        category: "recycle",
        materials: ["aluminum"],
        decomposition: "200-500 years",
        tip: "Rinse and recycle! Aluminum is infinitely recyclable and saves 95% energy vs. making new cans.",
        explanation: "Aluminum cans are one of the most valuable recyclables—they can be recycled endlessly with no quality loss."
      },
      "apple core": {
        category: "compost",
        materials: ["organic matter", "cellulose"],
        decomposition: "2-4 weeks in compost; 1-2 months in landfill",
        tip: "Apple cores decompose quickly! Perfect for home composting or municipal green bins.",
        explanation: "Fruit scraps are nitrogen-rich 'greens' that break down rapidly in compost, returning nutrients to soil."
      },
      "orange peel": {
        category: "compost",
        materials: ["organic matter", "citrus oil"],
        decomposition: "6-12 months (slow due to citrus oils); 1-2 years in landfill",
        tip: "Orange peels take longer to decompose due to oils. Chop them small to speed breakdown in compost.",
        explanation: "Citrus peels decompose slower than other fruits due to limonene oils. They can also repel some composting worms—use sparingly in vermicomposting."
      },
      "plastic straw": {
        category: "landfill",
        materials: ["polypropylene (#5) or polystyrene (#6)"],
        decomposition: "200+ years (fragments into microplastics)",
        tip: "Too small and lightweight for recycling machinery—goes to landfill. Consider reusable metal/glass/bamboo straws!",
        explanation: "Plastic straws are rarely recyclable due to size and lightweight nature. They often escape into oceans where they harm marine life and persist as microplastics."
      },
      "takeout container": {
        category: "landfill",
        materials: ["mixed plastic", "polystyrene foam", "or paper with plastic coating"],
        decomposition: "Never (foam); 20-30 years (plastic); 20-30 years (coated paper)",
        tip: "Most takeout containers are unrecyclable due to food residue and mixed materials. Foam is worst—avoid when possible.",
        explanation: "Takeout containers combine food contamination with mixed materials (foam #6, coated paper, or mixed plastics), making them non-recyclable in standard streams."
      },
      "napkin": {
        category: "compost",
        materials: ["paper fiber"],
        decomposition: "2-6 weeks in compost; 2-5 months in landfill",
        tip: "Paper napkins go in compost, not recycling. Food-soiled napkins especially belong in compost.",
        explanation: "Napkins have short paper fibers unsuitable for recycling. They break down quickly in composting environments but slower in landfills due to lack of oxygen."
      }
    };

    // Check for specific items first (most accurate)
    let matched = false;
    for (const [itemKey, itemData] of Object.entries(specificItems)) {
      if (query.includes(itemKey)) {
        mock.category = itemData.category;
        mock.materials = itemData.materials;
        mock.decomposition_time = itemData.decomposition;
        mock.tip = itemData.tip;
        mock.explanation = itemData.explanation;
        matched = true;
        break;
      }
    }

    // Fallback to keyword-based classification if no specific match
    // ORDER MATTERS: Check specific/composite materials BEFORE general categories
    if (!matched) {
      // Define material type flags (checked in priority order below)
      const isHazardous = query.includes("bulb") || query.includes("paint") || query.includes("chemical") || query.includes("motor oil") || query.includes("pesticide");
      const isEWaste = query.includes("battery") || query.includes("electronic") || query.includes("phone") || query.includes("cable") || query.includes("laptop") || query.includes("computer") || query.includes("tablet") || query.includes("charger");
      const isCoffeeCup = query.includes("coffee") || query.includes("starbucks") || query.includes("dunkin");
      const isGreasy = query.includes("grease") || query.includes("oil") || query.includes("dirty") || query.includes("pizza");
      const isCompostable = query.includes("peel") || query.includes("apple") || query.includes("banana") || query.includes("food waste") || query.includes("vegetable") || query.includes("fruit") || query.includes("coffee grounds") || query.includes("eggshell") || query.includes("core");
      const isPaper = query.includes("paper") || query.includes("box") || query.includes("cardboard") || query.includes("carton") || query.includes("newspaper") || query.includes("magazine") || query.includes("mail");
      const isGlass = query.includes("glass") || query.includes("jar") || query.includes("wine bottle") || query.includes("beer bottle");
      const isMetal = query.includes("can") || query.includes("metal") || query.includes("aluminum") || query.includes("tin") || query.includes("steel");
      const isFilmPlastic = query.includes("bag") || query.includes("wrap") || query.includes("film");
      const isPlasticContainer = query.includes("plastic") || query.includes("jug") || query.includes("container") || query.includes("tub");
      const isBeverageBottle = query.includes("bottle") && !query.includes("wine") && !query.includes("glass");

      // 1. HAZARDOUS (check first—safety priority)
      if (isHazardous) {
        mock.category = "hazardous";
        mock.materials = ["mixed chemicals", "toxic substances"];
        mock.tip = "Never put these in regular bins. Look for local 'Hazardous Household Waste' drop-off days.";
        mock.decomposition_time = "Varies (can leak toxins for decades)";
        mock.explanation = "Hazardous materials require specialized disposal to prevent soil and water contamination.";
      // 2. E-WASTE (before general electronics)
      } else if (isEWaste) {
        mock.category = "e-waste";
        mock.materials = ["mixed electronics", "circuit boards", "batteries"];
        mock.tip = "Take these to a dedicated e-waste collection point. They contain rare metals that can be recovered!";
        mock.decomposition_time = "Does not decompose; toxic components last 10-100+ years";
        mock.explanation = "Electronics contain recoverable rare earth metals and hazardous materials requiring specialized handling.";
      // 3. COFFEE CUPS (composite—check before paper/plastic)
      } else if (isCoffeeCup) {
        mock.category = "landfill";
        mock.materials = ["paper", "polyethylene plastic lining"];
        mock.tip = "Most disposable cups have a hidden plastic lining that makes them un-recyclable. Switch to a reusable cup!";
        mock.decomposition_time = "20-30 years";
        mock.explanation = "The plastic polyethylene lining prevents paper recycling and the paper prevents it from being pure plastic waste.";
      // 4. GREASY PAPER (composite—check before clean paper)
      } else if (isGreasy && isPaper) {
        mock.category = "compost";
        mock.materials = ["paper fiber", "organic residue"];
        mock.tip = "Grease prevents paper recycling, but composting handles it! Remove any plastic windows/stickers first.";
        mock.decomposition_time = "2-6 months";
        mock.explanation = "Grease-contaminated paper cannot be recycled but breaks down well in composting environments.";
      // 5. FOOD/COMPOSTABLES
      } else if (isCompostable) {
        mock.category = "compost";
        mock.materials = ["organic matter"];
        mock.tip = "Food scraps are perfect for composting—home or industrial. They return nutrients to soil quickly.";
        mock.decomposition_time = "2-12 weeks depending on conditions";
        mock.explanation = "Organic food waste decomposes rapidly and creates valuable soil amendment through composting.";
      // 5. CLEAN PAPER/CARDBOARD (check after greasy paper, before glass/metal)
      } else if (isPaper) {
        mock.category = "recycle";
        mock.materials = ["paper fiber"];
        mock.tip = "Keep paper dry and clean! Wet or food-soiled paper goes in compost, not recycling.";
        mock.decomposition_time = "2-6 months in landfill (anaerobic slows decomposition); 2-4 weeks in compost";
        mock.explanation = "Clean paper and cardboard are recyclable and can be reprocessed into new paper products multiple times. In landfills, lack of oxygen slows decomposition significantly.";
      // 6. GLASS (check before metal—more specific in some regions)
      } else if (isGlass) {
        mock.category = "recycle";
        mock.materials = ["glass"];
        mock.tip = "Rinse containers. Glass is infinitely recyclable without quality loss—one of the best materials to recycle!";
        mock.decomposition_time = "1,000,000+ years (never decomposes)";
        mock.explanation = "Glass never biodegrades, making recycling essential. It can be recycled endlessly without degradation.";
      // 7. METAL
      } else if (isMetal) {
        mock.category = "recycle";
        mock.materials = ["aluminum", "steel", "tin"];
        mock.tip = "Rinse cans and containers. Metal recycling saves 95% of energy vs. making new metal from ore!";
        mock.decomposition_time = "200-500 years";
        mock.explanation = "Metals are highly recyclable and valuable. Aluminum and steel can be recycled indefinitely.";
      // 8. FILM PLASTIC (bags/wrap—check before rigid plastic)
      } else if (isFilmPlastic) {
        mock.category = "landfill";
        mock.materials = ["plastic film (LDPE)"];
        mock.tip = "Plastic bags/film cannot go in curbside recycling—they jam equipment. Return to grocery store drop-offs.";
        mock.decomposition_time = "20-1,000 years depending on type";
        mock.explanation = "Plastic film requires specialized recycling at grocery stores. Curbside machinery cannot process it.";
      // 9. RIGID PLASTIC CONTAINERS/BOTTLES
      } else if (isPlasticContainer || isBeverageBottle) {
        mock.category = "recycle";
        mock.materials = ["plastic (#1 PET or #2 HDPE typical)"];
        mock.tip = "Rinse out food residue. Check for recycling number. Bottles and containers are widely recyclable.";
        mock.decomposition_time = "100-1,000 years";
        mock.explanation = "Clean plastic containers are recyclable and get new life as fiber, containers, or other products.";
      } else {
        mock.category = "landfill";
        mock.materials = ["mixed materials"];
        mock.tip = "When in doubt, throw it out. Putting non-recyclables in recycling causes contamination and rejects entire loads.";
        mock.decomposition_time = "Varies widely; synthetic materials 100-1,000+ years";
        mock.explanation = "Some items are too complex, contaminated, or composed of mixed materials that cannot be economically separated.";
      }
    }
  }

  if (mode === "carbon" && query) {
    // Specific carbon footprint scenarios with realistic emission data
    // Monthly values in kg CO2. Sources: EPA, IPCC, academic lifecycle analyses
    const carbonScenarios: Record<string, {
      estimate: number;
      breakdown: { category: string; value: number; detail: string }[];
      explanations: { summary: string; top_drivers: string[]; assumptions: string[] };
      recommendations: { action: string; savings_kg_month: number; difficulty: string; why_it_matters: string }[];
      suggestions: string[];
      comparison: string;
    }> = {
      // TRANSPORT SCENARIOS
      "transit": {
        estimate: 195,
        breakdown: [
          { category: "Transport", value: 55, detail: "Public transit (bus/rail) commuting emits ~55kg CO2/month—60% lower than solo driving." },
          { category: "Food", value: 85, detail: "Average omnivore diet estimated at ~85kg CO2/month." },
          { category: "Energy", value: 40, detail: "Small apartment/home energy estimated at ~40kg CO2/month." },
          { category: "Consumer", value: 15, detail: "Average consumer goods estimated at ~15kg CO2/month." }
        ],
        explanations: {
          summary: "Great choice—public transit cuts your transport emissions 60% vs solo driving. Buses and rail spread emissions across many passengers, making them highly efficient.",
          top_drivers: ["Transit mode (bus vs rail—rail is cleaner)", "Distance to transit stop (access/egress travel)", "Transit frequency and reliability"],
          assumptions: ["Mixed bus and rail commute", "25km round trip daily", "Walk/bike to transit stop", "Average occupancy rates"]
        },
        recommendations: [
          { action: "Switch to rail if currently on bus", savings_kg_month: 15, difficulty: "Easy", why_it_matters: "Electric rail emits 30% less than diesel buses per passenger-km." },
          { action: "Bike to transit instead of driving to park-and-ride", savings_kg_month: 25, difficulty: "Medium", why_it_matters: "Eliminates car leg entirely—park-and-rides still involve driving emissions." },
          { action: "Advocate for better transit frequency", savings_kg_month: 0, difficulty: "Easy", why_it_matters: "Systemic: better transit attracts more riders, increasing occupancy and efficiency." },
          { action: "Work from home 1-2 days/week to eliminate commute", savings_kg_month: 22, difficulty: "Medium", why_it_matters: "Even transit has emissions—eliminating trips beats efficiency." }
        ],
        suggestions: [
          "Transit saves 225kg CO2/month vs driving—great choice!",
          "Rail beats bus by 30%—switch lines if you can",
          "Bike + transit combo? Eliminates all car use"
        ],
        comparison: "Your footprint is ~10% below global average—transit users are climate leaders."
      },

      "bike": {
        estimate: 165,
        breakdown: [
          { category: "Transport", value: 25, detail: "Year-round bicycle commuting emits ~25kg CO2/month (mostly from food calories to power the bike, plus minimal manufacturing amortization)." },
          { category: "Food", value: 95, detail: "Active cyclist diet (higher caloric intake) estimated at ~95kg CO2/month." },
          { category: "Energy", value: 30, detail: "Small apartment/home energy estimated at ~30kg CO2/month." },
          { category: "Consumer", value: 15, detail: "Bike maintenance and gear estimated at ~15kg CO2/month." }
        ],
        explanations: {
          summary: "Excellent—your bicycle commuting keeps transport emissions at just 15% of car commuters. Your food emissions are slightly elevated due to higher caloric needs, but net footprint is ~60% below car commuters.",
          top_drivers: ["Increased food consumption (fuel for cycling)", "Occasional car rental/public transit", "Bike manufacturing/maintenance"],
          assumptions: ["Year-round cycling (fair weather assumed)", "25km round trip daily", "Increased diet by ~500 cal/day", "Occasional car use for bad weather"]
        },
        recommendations: [
          { action: "Reduce meat to compensate for higher food needs", savings_kg_month: 45, difficulty: "Easy", why_it_matters: "Your higher caloric intake means food choices matter more—switch to plant proteins." },
          { action: "Buy local/seasonal to reduce food transport emissions", savings_kg_month: 15, difficulty: "Easy", why_it_matters: "Higher food consumption = higher transport emissions from supply chain." },
          { action: "Maintain bike well to extend lifespan", savings_kg_month: 8, difficulty: "Easy", why_it_matters: "Amortizing manufacturing emissions over 10+ years vs replacing every 3 years." },
          { action: "Advocate for bike lanes to encourage others", savings_kg_month: 0, difficulty: "Easy", why_it_matters: "Systemic change: if 1,000 people switched to bikes, that's 250 tons saved monthly." }
        ],
        suggestions: [
          "Your bike commute saves ~255kg CO2/month vs a car—outstanding!",
          "Higher food needs from cycling? Choose low-carbon proteins—saves 45kg",
          "You're at 25% of global average for transport—role model material"
        ],
        comparison: "Your footprint is ~25% below global average—bicycle transport is transformative."
      },

      "daily car commute": {
        estimate: 420,
        breakdown: [
          { category: "Transport", value: 280, detail: "Daily 25km each way gasoline car commute (~12,500 km/year) emits ~280kg CO2/month." },
          { category: "Food", value: 85, detail: "Average omnivore diet estimated at ~85kg CO2/month." },
          { category: "Energy", value: 45, detail: "Small apartment/home energy estimated at ~45kg CO2/month." },
          { category: "Consumer", value: 10, detail: "Average consumer goods estimated at ~10kg CO2/month." }
        ],
        explanations: {
          summary: "Your footprint is dominated by car commuting, which represents 67% of your estimated emissions. Switching to even partial transit/bike use would have major impact.",
          top_drivers: ["Single-occupancy gasoline vehicle commuting", "No carpooling or transit usage", "Typical suburban commute distance"],
          assumptions: ["Average gasoline sedan (8L/100km)", "25km one-way distance", "5-day work week", "Average US grid intensity for home energy"]
        },
        recommendations: [
          { action: "Switch to transit or bike 2 days/week", savings_kg_month: 75, difficulty: "Medium", why_it_matters: "Each transit day replaces ~37km of driving, saving ~37kg CO2 per trip." },
          { action: "Carpool with one colleague daily", savings_kg_month: 140, difficulty: "Easy", why_it_matters: "Halving the vehicle load per person nearly halves commute emissions." },
          { action: "Switch to an electric vehicle (renewable grid)", savings_kg_month: 180, difficulty: "Hard", why_it_matters: "EVs on renewable grids cut transport emissions by ~60-70%." },
          { action: "Negotiate 1 work-from-home day/week", savings_kg_month: 56, difficulty: "Easy", why_it_matters: "Eliminates 20% of weekly commute distance entirely." }
        ],
        suggestions: [
          "Try bike commuting—even 1 day/week saves 37kg CO2",
          "Join a carpool: split emissions, save 140kg/month",
          "Consider an EV for your next car—cuts transport emissions 60%"
        ],
        comparison: "Your footprint is ~95% above the global average (~215kg/month) due to car-dependent commuting."
      },

      "suv": {
        estimate: 580,
        breakdown: [
          { category: "Transport", value: 420, detail: "Large SUV/truck daily commuting (~12L/100km fuel consumption) emits ~420kg CO2/month." },
          { category: "Food", value: 95, detail: "Average omnivore diet estimated at ~95kg CO2/month." },
          { category: "Energy", value: 50, detail: "Suburban home energy estimated at ~50kg CO2/month." },
          { category: "Consumer", value: 15, detail: "Average consumer goods estimated at ~15kg CO2/month." }
        ],
        explanations: {
          summary: "Your footprint is extremely transport-heavy due to SUV fuel consumption (~50% higher than sedans). Vehicle choice is your highest-impact decision.",
          top_drivers: ["Large SUV fuel consumption (12L/100km vs 8L/100km)", "Single-occupancy driving", "Typical suburban commute distance"],
          assumptions: ["Large SUV/truck (12L/100km)", "25km one-way commute", "5-day work week"]
        },
        recommendations: [
          { action: "Switch to a hybrid or smaller sedan", savings_kg_month: 140, difficulty: "Hard", why_it_matters: "Right-sizing your vehicle cuts fuel use by ~35% immediately." },
          { action: "Carpool with one colleague daily", savings_kg_month: 210, difficulty: "Easy", why_it_matters: "Sharing the ride halves per-person SUV emissions." },
          { action: "Switch to transit/bike 2 days/week", savings_kg_month: 112, difficulty: "Medium", why_it_matters: "Each day off the road saves ~56kg CO2 with an SUV." },
          { action: "Combine trips and reduce weekend driving", savings_kg_month: 45, difficulty: "Easy", why_it_matters: "Non-commute driving adds up—trip chaining cuts waste." }
        ],
        suggestions: [
          "SUVs burn 50% more fuel than sedans—consider downsizing",
          "Carpooling saves 210kg CO2/month—huge impact for little effort",
          "Even 2 transit days/week cuts 112kg with an SUV's thirst"
        ],
        comparison: "Your footprint is ~170% above global average due to SUV fuel consumption."
      },

      "fly": {
        estimate: 680,
        breakdown: [
          { category: "Transport", value: 480, detail: "Air travel: 2 round-trip flights/month (short-haul) emit ~480kg CO2/month." },
          { category: "Food", value: 120, detail: "Airport/restaurant food consumption adds ~120kg CO2/month." },
          { category: "Energy", value: 55, detail: "Home energy estimated at ~55kg CO2/month." },
          { category: "Consumer", value: 25, detail: "Travel-related consumption estimated at ~25kg CO2/month." }
        ],
        explanations: {
          summary: "Air travel dominates your footprint—each flight hour emits ~90kg CO2. A single round-trip transatlantic flight equals months of car commuting.",
          top_drivers: ["Frequent short-haul flights (high per-km emissions)", "Radiative forcing multiplier (2.7x for contrails)", "Ground transport to/from airports"],
          assumptions: ["2 short-haul round trips/month (~800km each)", "Radiative forcing included (2.7x)", "Economy class seating"]
        },
        recommendations: [
          { action: "Replace 1 flight/month with train/bus", savings_kg_month: 240, difficulty: "Medium", why_it_matters: "Ground transport emits 80-90% less CO2 per km than flying." },
          { action: "Bundle trips—fly less often, stay longer", savings_kg_month: 160, difficulty: "Easy", why_it_matters: "Take-off/landing burns 25% of fuel—fewer trips saves significantly." },
          { action: "Choose direct flights (no layovers)", savings_kg_month: 80, difficulty: "Easy", why_it_matters: "Take-off cycles burn extra fuel—connections add 15-25% emissions." },
          { action: "Offset verified carbon credits for work travel", savings_kg_month: 0, difficulty: "Easy", why_it_matters: "Offsets don't eliminate emissions but fund reduction projects." }
        ],
        suggestions: [
          "One round-trip NYC-London = 1,000kg CO2—take the train for shorter hops",
          "Direct flights save 80kg CO2 vs connections—avoid layovers",
          "Flying is 10-50x worse than train per km—choose rail under 1,000km"
        ],
        comparison: "Your footprint is ~215% above global average due to frequent flying."
      },

      "transatlantic flight": {
        estimate: 850,
        breakdown: [
          { category: "Transport", value: 650, detail: "One round-trip transatlantic flight (~8,000km each way, with radiative forcing) emits ~650kg CO2." },
          { category: "Food", value: 110, detail: "Airport and travel food adds ~110kg CO2/month." },
          { category: "Energy", value: 60, detail: "Home energy during absence estimated at ~60kg CO2/month." },
          { category: "Consumer", value: 30, detail: "Travel consumption estimated at ~30kg CO2/month." }
        ],
        explanations: {
          summary: "A single transatlantic round-trip equals ~2.5 months of typical car commuting. Aviation's altitude effects (contrails, NOx) amplify warming 2.7x.",
          top_drivers: ["Long-haul aviation (highest per-km emissions)", "Radiative forcing from contrails", "Jet fuel carbon intensity"],
          assumptions: ["One round-trip transatlantic/month", "NYC-London distance (~5,500km one-way)", "Radiative forcing multiplier (2.7x)", "Economy class"]
        },
        recommendations: [
          { action: "Reduce to 1 transatlantic trip per quarter", savings_kg_month: 433, difficulty: "Medium", why_it_matters: "Cutting frequency by half slashes transport emissions proportionally." },
          { action: "Extend trips—work remotely from destination", savings_kg_month: 325, difficulty: "Easy", why_it_matters: "Stay 2 weeks instead of 2 separate 1-week trips—halves flights." },
          { action: "Choose destinations reachable by train", savings_kg_month: 520, difficulty: "Medium", why_it_matters: "European train travel emits 90% less than short-haul flights." },
          { action: "Purchase verified SAF (sustainable aviation fuel) credits", savings_kg_month: 0, difficulty: "Easy", why_it_matters: "SAF cuts lifecycle emissions ~80% but costs 3-5x conventional fuel." }
        ],
        suggestions: [
          "One transatlantic flight = 650kg CO2—consider video calls",
          "Stay longer, fly less—2 weeks remote saves 325kg vs 2 trips",
          "Trains under 1,000km save 90% vs flying—choose rail in Europe"
        ],
        comparison: "One transatlantic trip/month puts you at ~300% of global average footprint."
      },

      "electric car": {
        estimate: 320,
        breakdown: [
          { category: "Transport", value: 180, detail: "Electric vehicle daily commute (~25km each way) on average US grid emits ~180kg CO2/month." },
          { category: "Food", value: 85, detail: "Average omnivore diet estimated at ~85kg CO2/month." },
          { category: "Energy", value: 45, detail: "Home energy including EV charging estimated at ~45kg CO2/month." },
          { category: "Consumer", value: 10, detail: "Average consumer goods estimated at ~10kg CO2/month." }
        ],
        explanations: {
          summary: "Your EV cuts transport emissions ~55% vs a gasoline car. On a renewable grid, this drops further to near-zero for driving.",
          top_drivers: ["EV charging from grid mix (varies by region)", "Battery production amortized over lifetime", "Still some fossil fuel in grid"],
          assumptions: ["EV efficiency 0.2 kWh/km", "Average US grid (420g CO2/kWh)", "25km one-way commute", "5-day work week"]
        },
        recommendations: [
          { action: "Switch to 100% renewable electricity plan", savings_kg_month: 140, difficulty: "Easy", why_it_matters: "Clean grid makes EV transport near-zero emissions." },
          { action: "Install home solar for charging", savings_kg_month: 160, difficulty: "Hard", why_it_matters: "Self-generated clean power eliminates grid emissions entirely." },
          { action: "Use workplace EV charging (if renewable)", savings_kg_month: 40, difficulty: "Easy", why_it_matters: "Offsets some home charging with potentially cleaner power." },
          { action: "Combine trips to reduce total mileage", savings_kg_month: 25, difficulty: "Easy", why_it_matters: "Even EVs have upstream manufacturing emissions—drive less overall." }
        ],
        suggestions: [
          "Your EV already saves ~100kg/month vs gas—great start!",
          "Renewable grid power cuts another 140kg—switch your utility plan",
          "Solar + EV = near-zero driving emissions—consider panels"
        ],
        comparison: "Your EV footprint is ~50% above global average, but 35% below typical US car owners."
      },

      // FOOD SCENARIOS
      "meat lover": {
        estimate: 340,
        breakdown: [
          { category: "Food", value: 210, detail: "High meat consumption (beef 3x/week, chicken/pork daily) emits ~210kg CO2/month." },
          { category: "Transport", value: 85, detail: "Average transport estimated at ~85kg CO2/month." },
          { category: "Energy", value: 35, detail: "Average home energy estimated at ~35kg CO2/month." },
          { category: "Consumer", value: 10, detail: "Average consumer goods estimated at ~10kg CO2/month." }
        ],
        explanations: {
          summary: "Beef is the highest-impact food (~60kg CO2/kg). Your diet is 3x higher-carbon than plant-based alternatives. Ruminant meat (beef/lamb) drives 60% of food emissions.",
          top_drivers: ["Beef consumption (highest livestock emissions)", "Daily meat intake", "Dairy consumption"],
          assumptions: ["Beef 3x/week (150g servings)", "Chicken/pork daily", "Average omnivore other foods", "US food system emission factors"]
        },
        recommendations: [
          { action: "Replace beef with chicken/pork (4x lower impact)", savings_kg_month: 85, difficulty: "Easy", why_it_matters: "Ruminant meat has 4-8x the emissions of poultry/pork." },
          { action: "Adopt 'weekday vegetarian'—meat only weekends", savings_kg_month: 105, difficulty: "Medium", why_it_matters: "5 plant-based days/week cuts food emissions by half." },
          { action: "Switch to plant-based meat alternatives", savings_kg_month: 95, difficulty: "Easy", why_it_matters: "Beyond/Impossible burgers emit 90% less than beef." },
          { action: "Reduce portion sizes (150g → 100g meat)", savings_kg_month: 45, difficulty: "Easy", why_it_matters: "Linear reduction—eating 33% less meat cuts emissions 33%." }
        ],
        suggestions: [
          "Beef has 4x chicken's emissions—switching saves 85kg/month",
          "Weekday vegetarian cuts 105kg—try Meatless Mondays first",
          "Plant-based burgers taste similar, save 95kg vs beef"
        ],
        comparison: "Your diet produces 60% more emissions than plant-based eaters."
      },

      "vegan": {
        estimate: 180,
        breakdown: [
          { category: "Food", value: 65, detail: "Plant-based diet (no animal products) emits ~65kg CO2/month—lowest dietary footprint." },
          { category: "Transport", value: 80, detail: "Average transport estimated at ~80kg CO2/month." },
          { category: "Energy", value: 30, detail: "Average home energy estimated at ~30kg CO2/month." },
          { category: "Consumer", value: 5, detail: "Lower consumer goods (often accompanies vegan lifestyle) estimated at ~5kg CO2/month." }
        ],
        explanations: {
          summary: "Your plant-based diet emits 70% less than meat-heavy diets. Food is no longer your primary footprint driver—transport and energy dominate.",
          top_drivers: ["Some high-emission plant foods (avocado, almond, out-of-season imports)", "Food waste", "Processing/packaging of plant alternatives"],
          assumptions: ["No animal products", "Local/seasonal when possible", "Average plant-protein consumption", "Food system emission factors"]
        },
        recommendations: [
          { action: "Minimize air-freighted produce (asparagus, berries)", savings_kg_month: 12, difficulty: "Easy", why_it_matters: "Air freight adds 10-50x the emissions of sea freight." },
          { action: "Reduce food waste (plan meals, use leftovers)", savings_kg_month: 18, difficulty: "Easy", why_it_matters: "Wasted food wastes all its embedded emissions." },
          { action: "Choose whole foods over heavily processed alternatives", savings_kg_month: 8, difficulty: "Easy", why_it_matters: "Processing adds manufacturing energy—whole foods are cleaner." },
          { action: "Grow herbs/tomatoes at home", savings_kg_month: 3, difficulty: "Easy", why_it_matters: "Eliminates transport emissions for high-frequency items." }
        ],
        suggestions: [
          "Your vegan diet is excellent—focus now on transport/energy",
          "Air-freighted asparagus adds 50x emissions—buy local/seasonal",
          "Food waste costs 18kg/month—plan your meals better"
        ],
        comparison: "Your footprint is ~20% below global average—excellent! Most impact now comes from transport and energy."
      },

      "vegetarian": {
        estimate: 240,
        breakdown: [
          { category: "Food", value: 115, detail: "Vegetarian diet (eggs/dairy, no meat) emits ~115kg CO2/month—moderate footprint." },
          { category: "Transport", value: 85, detail: "Average transport estimated at ~85kg CO2/month." },
          { category: "Energy", value: 35, detail: "Average home energy estimated at ~35kg CO2/month." },
          { category: "Consumer", value: 5, detail: "Average consumer goods estimated at ~5kg CO2/month." }
        ],
        explanations: {
          summary: "Your vegetarian diet cuts ~50% of meat-related emissions. Cheese and dairy still contribute significantly—reducing these would lower footprint further.",
          top_drivers: ["Cheese consumption (high dairy emissions)", "Eggs (moderate impact)", "Some processed meat substitutes"],
          assumptions: ["No meat/fish", "Dairy and eggs consumed regularly", "Average vegetarian diet composition"]
        },
        recommendations: [
          { action: "Reduce cheese consumption (highest dairy impact)", savings_kg_month: 35, difficulty: "Easy", why_it_matters: "Cheese has 4x the emissions of milk due to concentration." },
          { action: "Switch to oat/soy milk from dairy", savings_kg_month: 22, difficulty: "Easy", why_it_matters: "Plant milks emit 70-80% less than cow's milk." },
          { action: "Try 3 vegan days/week", savings_kg_month: 38, difficulty: "Medium", why_it_matters: "Cutting dairy/eggs 40% of the time reduces those emissions proportionally." },
          { action: "Choose local, seasonal produce", savings_kg_month: 12, difficulty: "Easy", why_it_matters: "Eliminates greenhouse heating and air-freight emissions." }
        ],
        suggestions: [
          "Cheese is dairy's biggest emitter—cutting it saves 35kg/month",
          "Oat milk tastes great and saves 22kg vs dairy",
          "3 vegan days/week saves 38kg—an easy next step"
        ],
        comparison: "Your footprint is ~10% above global average—better than most Western diets."
      },

      // ENERGY SCENARIOS
      "large house": {
        estimate: 450,
        breakdown: [
          { category: "Energy", value: 180, detail: "Large home (250+ sq m) with heating/cooling emits ~180kg CO2/month." },
          { category: "Transport", value: 110, detail: "Suburban driving pattern estimated at ~110kg CO2/month." },
          { category: "Food", value: 110, detail: "Average omnivore diet estimated at ~110kg CO2/month." },
          { category: "Consumer", value: 50, detail: "Higher consumption pattern estimated at ~50kg CO2/month." }
        ],
        explanations: {
          summary: "Home size is your primary driver—heating/cooling 250+ sq m uses 3x the energy of an apartment. Poor insulation and large volumes dominate energy emissions.",
          top_drivers: ["Large conditioned volume (250+ sq m)", "Suburban location requiring driving", "Likely older construction/less insulation"],
          assumptions: ["2,500+ sq ft home", "Mixed heating (gas/electric)", "Suburban location", "Average US grid intensity"]
        },
        recommendations: [
          { action: "Install heat pump (replaces furnace/AC)", savings_kg_month: 65, difficulty: "Hard", why_it_matters: "Heat pumps are 3-4x more efficient than furnaces—massive savings." },
          { action: "Improve insulation (attic, walls, windows)", savings_kg_month: 45, difficulty: "Medium", why_it_matters: "Cuts heating/cooling loads by 20-30%." },
          { action: "Install smart thermostat with zoning", savings_kg_month: 25, difficulty: "Easy", why_it_matters: "Heat only occupied rooms, automatically optimize schedules." },
          { action: "Switch to 100% renewable electricity plan", savings_kg_month: 85, difficulty: "Easy", why_it_matters: "Eliminates grid emissions for all electric usage (HVAC, appliances)." }
        ],
        suggestions: [
          "Heat pumps cut 65kg/month—best home upgrade you can make",
          "Insulation saves 45kg—cheapest energy investment",
          "Smart thermostats pay back in 6 months, save 25kg CO2"
        ],
        comparison: "Your footprint is ~110% above global average—large homes in suburbs multiply emissions."
      },

      "air conditioning": {
        estimate: 380,
        breakdown: [
          { category: "Energy", value: 140, detail: "Heavy air conditioning usage (hot climate, 8+ hrs/day) emits ~140kg CO2/month." },
          { category: "Transport", value: 95, detail: "Average transport estimated at ~95kg CO2/month." },
          { category: "Food", value: 105, detail: "Average omnivore diet estimated at ~105kg CO2/month." },
          { category: "Consumer", value: 40, detail: "Average consumer goods estimated at ~40kg CO2/month." }
        ],
        explanations: {
          summary: "Air conditioning is your largest energy load—older units and poor insulation multiply consumption. Each degree cooler adds 3-5% to energy use.",
          top_drivers: ["Air conditioning intensity (hours/day)", "Inefficient older AC unit (SEER <14)", "Poor insulation/house leaks"],
          assumptions: ["AC usage 8+ hrs/day in hot months", "Average efficiency unit", "Mixed climate", "Average US grid"]
        },
        recommendations: [
          { action: "Raise thermostat 2°F (1°C)", savings_kg_month: 22, difficulty: "Easy", why_it_matters: "Each degree cooler adds 3-5% energy use—2°F = ~8-10% savings." },
          { action: "Upgrade to high-efficiency heat pump", savings_kg_month: 55, difficulty: "Hard", why_it_matters: "Modern heat pumps use 40-50% less electricity for cooling." },
          { action: "Improve insulation and seal air leaks", savings_kg_month: 35, difficulty: "Medium", why_it_matters: "Less cool air escapes = less energy to maintain temperature." },
          { action: "Use fans + natural ventilation when possible", savings_kg_month: 28, difficulty: "Easy", why_it_matters: "Fans use 90% less energy than AC—supplement to reduce AC hours." }
        ],
        suggestions: [
          "2°F warmer saves 22kg—barely noticeable, real impact",
          "Heat pumps cut AC costs 55kg—upgrade when your unit dies",
          "Fans use 90% less power—try natural cooling first"
        ],
        comparison: "Your footprint is ~75% above global average—climate control in hot regions is energy-intensive."
      },

      "renewable energy": {
        estimate: 195,
        breakdown: [
          { category: "Energy", value: 15, detail: "100% renewable electricity (solar/wind) emits ~15kg CO2/month (minimal grid reliance)." },
          { category: "Transport", value: 90, detail: "Average transport estimated at ~90kg CO2/month." },
          { category: "Food", value: 85, detail: "Average omnivore diet estimated at ~85kg CO2/month." },
          { category: "Consumer", value: 5, detail: "Lower consumption pattern estimated at ~5kg CO2/month." }
        ],
        explanations: {
          summary: "Excellent—your renewable energy eliminates grid emissions. Home energy is now a minor contributor. Transport and food are your remaining significant sources.",
          top_drivers: ["Transport emissions (now dominant)", "Food choices", "Some gas heating if not fully electric"],
          assumptions: ["100% renewable electricity plan or solar", "Electric home (no gas)", "Green-e certified or equivalent"]
        },
        recommendations: [
          { action: "Add an electric vehicle (powered by your clean energy)", savings_kg_month: 95, difficulty: "Hard", why_it_matters: "Your clean electricity makes EV transport near-zero emission." },
          { action: "Switch to electric heat pump (from gas)", savings_kg_month: 35, difficulty: "Hard", why_it_matters: "Eliminates last fossil fuel use in home, powered by clean electricity." },
          { action: "Reduce meat consumption", savings_kg_month: 45, difficulty: "Easy", why_it_matters: "Food is now your #1 emission source—easier to cut than transport." },
          { action: "Offset remaining emissions via verified credits", savings_kg_month: 0, difficulty: "Easy", why_it_matters: "Final step to carbon neutrality while addressing hard-to-cut categories." }
        ],
        suggestions: [
          "Great job on clean energy! Now focus on transport—add an EV",
          "If you have gas heating, switch to heat pump for another 35kg saved",
          "You're close to carbon neutral—food and transport are last hurdles"
        ],
        comparison: "Your footprint is ~10% below global average—excellent! Clean energy is your superpower."
      },

      // CONSUMER SCENARIOS
      "fast fashion": {
        estimate: 295,
        breakdown: [
          { category: "Consumer", value: 85, detail: "Buying 5+ new garments/month (fast fashion) emits ~85kg CO2/month from manufacturing/transport." },
          { category: "Transport", value: 80, detail: "Average transport estimated at ~80kg CO2/month." },
          { category: "Food", value: 95, detail: "Average omnivore diet estimated at ~95kg CO2/month." },
          { category: "Energy", value: 35, detail: "Average home energy estimated at ~35kg CO2/month." }
        ],
        explanations: {
          summary: "Fast fashion is surprisingly carbon-intensive—one cotton t-shirt = 8kg CO2. Polyester is worse (oil-based). Your clothing habit rivals food emissions.",
          top_drivers: ["Frequent new purchases (5+ items/month)", "Synthetic fabrics (polyester = plastic)", "Global shipping from manufacturing hubs", "Short garment lifespan"],
          assumptions: ["5+ new garments/month", "Mix of cotton and synthetic", "Average manufacturing emissions", "Global supply chain transport"]
        },
        recommendations: [
          { action: "Buy second-hand for 50% of purchases", savings_kg_month: 42, difficulty: "Easy", why_it_matters: "Second-hand has near-zero production emissions—just transport." },
          { action: "Reduce to 2 new garments/month", savings_kg_month: 52, difficulty: "Medium", why_it_matters: "Linear reduction—buying 60% less saves 60% of fashion emissions." },
          { action: "Choose natural fibers (organic cotton, linen)", savings_kg_month: 18, difficulty: "Easy", why_it_matters: "Synthetics emit 2-3x the CO2 of natural fibers over lifecycle." },
          { action: "Extend garment life (repair, proper care)", savings_kg_month: 25, difficulty: "Easy", why_it_matters: "Doubling lifespan halves annual replacement emissions." }
        ],
        suggestions: [
          "One new t-shirt = 8kg CO2—thrift stores save 100% of that",
          "Buying 3 fewer items/month saves 52kg—small change, big impact",
          "Polyester is plastic—choose cotton/linen for 18kg savings"
        ],
        comparison: "Your footprint is ~35% above global average—fast fashion consumption is a hidden driver."
      },

      // DEFAULT / MIXED LIFESTYLE
      "default": {
        estimate: 245,
        breakdown: [
          { category: "Transport", value: 105, detail: "Mixed transport (some car, some transit) estimated at ~105kg CO2/month." },
          { category: "Food", value: 80, detail: "Moderate meat consumption estimated at ~80kg CO2/month." },
          { category: "Energy", value: 45, detail: "Average apartment/small home energy estimated at ~45kg CO2/month." },
          { category: "Consumer", value: 15, detail: "Average consumer goods estimated at ~15kg CO2/month." }
        ],
        explanations: {
          summary: "Your footprint reflects average Western lifestyle patterns. Transport and food are the biggest levers—small changes in either would have measurable impact.",
          top_drivers: ["Mixed transport patterns", "Moderate meat consumption", "Standard home energy use"],
          assumptions: ["Some driving, some transit", "Meat 2-3x/week", "Average home size", "Typical consumption patterns"]
        },
        recommendations: [
          { action: "Replace 2 car days/week with transit/bike", savings_kg_month: 35, difficulty: "Medium", why_it_matters: "Transport is your largest category—reducing driving has big impact." },
          { action: "Eat meat-free 3 days/week", savings_kg_month: 32, difficulty: "Easy", why_it_matters: "Food is your #2 source—plant-based days cut this significantly." },
          { action: "Switch to LED bulbs and smart power strips", savings_kg_month: 12, difficulty: "Easy", why_it_matters: "Low-hanging fruit—small investment, immediate returns." },
          { action: "Buy second-hand for next clothing purchase", savings_kg_month: 8, difficulty: "Easy", why_it_matters: "Avoids embedded manufacturing emissions." }
        ],
        suggestions: [
          "2 car-free days/week saves 35kg—start with Friday remote work",
          "3 meatless days save 32kg—try the 'flexitarian' approach",
          "LED bulbs pay for themselves in 3 months—save 12kg CO2"
        ],
        comparison: "Your footprint is ~15% above the global average of ~215kg/month per capita."
      }
    };

    // Match specific scenarios
    let matchedScenario = carbonScenarios.default;
    const matchedKey = Object.keys(carbonScenarios).find(key => {
      if (key === "default") return false;
      return query.includes(key) || key.split(" ").every(word => query.includes(word));
    });
    
    if (matchedKey) {
      matchedScenario = carbonScenarios[matchedKey];
    } else {
      // Keyword-based matching for partial matches
      // ORDER MATTERS: More specific scenarios must be checked before general ones
      
      // 1. BIKES/E-BIKES (check BEFORE car/commute to avoid misclassifying bike commuters)
      if (query.includes("bike") || query.includes("bicycle") || query.includes("cycling") || query.includes("cyclist") || query.includes("e-bike") || query.includes("ebike")) {
        matchedScenario = carbonScenarios.bike;
      // 2. TRANSIT (check before car to catch "bus", "train", "subway", "metro")
      } else if (query.includes("bus") || query.includes("train") || query.includes("rail") || query.includes("subway") || query.includes("metro") || query.includes("transit")) {
        matchedScenario = carbonScenarios.transit;
      // 3. SUVs/TRUCKS (check before general car to catch large vehicles)
      } else if (query.includes("suv") || query.includes("truck") || query.includes("pickup")) {
        matchedScenario = carbonScenarios.suv;
      // 4. FLYING (check transatlantic first for specificity)
      } else if (query.includes("fly") || query.includes("flight") || query.includes("airport") || query.includes("plane") || query.includes("flying")) {
        matchedScenario = query.includes("transatlantic") || query.includes("london") || query.includes("paris") || query.includes("europe") || query.includes("asia")
          ? carbonScenarios["transatlantic flight"]
          : carbonScenarios.fly;
      // 5. CARS (check electric variants first within the car block)
      } else if (query.includes("car") || query.includes("drive") || query.includes("motor") || (query.includes("commute") && !query.includes("bike"))) {
        matchedScenario = query.includes("electric") || query.includes("tesla") || query.includes("ev") || query.includes("hybrid")
          ? carbonScenarios["electric car"]
          : carbonScenarios["daily car commute"];
      // 6. FOOD: VEGAN (check before vegetarian and meat to catch strict plant-based)
      } else if (query.includes("vegan") || query.includes("plant-based") || query.includes("plant based") || query.includes("no meat") || query.includes("no animal")) {
        matchedScenario = carbonScenarios.vegan;
      // 7. FOOD: VEGETARIAN (check before meat to catch egg/dairy diets)
      } else if (query.includes("vegetarian") || query.includes("pescatarian") || query.includes("lacto") || query.includes("ovo")) {
        matchedScenario = carbonScenarios.vegetarian;
      // 8. FOOD: MEAT (catch all meat-heavy diets last in food category)
      } else if (query.includes("beef") || query.includes("meat") || query.includes("steak") || query.includes("burger") || query.includes("pork") || query.includes("chicken") || query.includes("lamb")) {
        matchedScenario = carbonScenarios["meat lover"];
      // 9. HOME: RENEWABLE ENERGY (check before AC/large house to prioritize clean energy)
      } else if (query.includes("solar") || query.includes("renewable") || query.includes("wind power") || query.includes("green energy") || query.includes("clean energy")) {
        matchedScenario = carbonScenarios["renewable energy"];
      // 10. HOME: AIR CONDITIONING (check before general house to catch cooling-specific)
      } else if (query.includes("ac") || query.includes("air conditioning") || query.includes("air con") || (query.includes("cooling") && !query.includes("passive") && !query.includes("solar"))) {
        matchedScenario = carbonScenarios["air conditioning"];
      // 11. HOME: LARGE HOUSE (check to catch mansion/large home keywords)
      } else if (query.includes("house") || query.includes("mansion") || query.includes("sq ft") || query.includes("square feet") || query.includes("sqft") || query.includes("large home") || query.includes("big house")) {
        matchedScenario = carbonScenarios["large house"];
      // 12. CONSUMER: FAST FASHION (last to avoid catching general "shopping")
      } else if (query.includes("fashion") || query.includes("clothes") || query.includes("h&m") || query.includes("zara") || query.includes("fast fashion") || (query.includes("shopping") && (query.includes("clothes") || query.includes("shirts") || query.includes("pants") || query.includes("dress")))) {
        matchedScenario = carbonScenarios["fast fashion"];
      }
    }

    // Apply matched scenario
    mock.estimate = matchedScenario.estimate;
    mock.breakdown = matchedScenario.breakdown;
    mock.explanations = matchedScenario.explanations;
    mock.recommendations = matchedScenario.recommendations;
    mock.suggestions = matchedScenario.suggestions;
    mock.comparison = matchedScenario.comparison;
    mock.confidence = matchedKey ? "medium" : "low";
  }

  if (mode === "whatif" && query) {
    // Comprehensive scenario detection with realistic CO2 data
    const q = query;
    const inputStr = (input || "").toLowerCase();
    
    // Define realistic scenarios with proper data
    const scenarios: Record<string, {
      title: string;
      current: { kg: number; desc: string };
      savings: { monthly: number; money: number };
      difficulty: string;
      tips: string[];
      community: string;
    }> = {
      // Transport
      "sold car": {
        title: "Selling car and using public transit",
        current: { kg: 180, desc: "Monthly car ownership: 1,200km driving + maintenance + insurance carbon cost" },
        savings: { monthly: 95, money: 450 },
        difficulty: "Hard",
        tips: ["Start by using transit for 2-3 days/week", "Keep car for emergencies initially", "Calculate total cost of ownership vs transit pass"],
        community: "If 10,000 people went car-free, we'd save 11,400 tons CO₂/year — equivalent to removing 2,500 cars from roads."
      },
      "bike": {
        title: "Biking to work instead of driving",
        current: { kg: 85, desc: "15km daily commute by car (30km round trip, 22 work days)" },
        savings: { monthly: 38, money: 120 },
        difficulty: "Medium",
        tips: ["Start with 2 days per week", "Invest in proper rain gear", "Use e-bike for hills or longer distances"],
        community: "If 10,000 commuters biked 15km daily, we'd save 4,560 tons CO₂/year — equivalent to planting 210,000 trees."
      },
      "carpool": {
        title: "Carpooling with 3 colleagues",
        current: { kg: 85, desc: "Solo 20km daily commute (40km round trip)" },
        savings: { monthly: 42, money: 80 },
        difficulty: "Easy",
        tips: ["Use apps like Waze Carpool to find partners", "Set clear pickup schedules", "Rotate driving responsibilities"],
        community: "If 10,000 solo drivers carpooled with 3 people, we'd save 5,040 tons CO₂/year — equivalent to taking 1,100 cars off roads."
      },
      "work from home": {
        title: "Working from home 3 days a week",
        current: { kg: 85, desc: "Full-time office commuting 5 days/week" },
        savings: { monthly: 25, money: 90 },
        difficulty: "Easy",
        tips: ["Set up a dedicated workspace", "Use video calls effectively", "Batch errands on office days"],
        community: "If 10,000 workers went remote 3 days/week, we'd save 3,000 tons CO₂/year from commuting alone."
      },
      "electric vehicle": {
        title: "Switching to an electric vehicle",
        current: { kg: 180, desc: "Gas-powered car: 1,200km/month at 120g CO₂/km" },
        savings: { monthly: 75, money: 60 },
        difficulty: "Hard",
        tips: ["Check local EV incentives", "Calculate home charging costs", "Consider hybrid if full EV isn't feasible"],
        community: "If 10,000 drivers switched to EVs, we'd save 9,000 tons CO₂/year — equivalent to planting 415,000 trees."
      },
      // Diet
      "vegan": {
        title: "Going vegan for a year",
        current: { kg: 220, desc: "Standard omnivore diet with daily meat/dairy consumption" },
        savings: { monthly: 75, money: 80 },
        difficulty: "Medium",
        tips: ["Start with Veganuary or 30-day challenges", "Learn plant-based protein sources", "Try ethnic cuisines (Indian, Thai, Mediterranean)"],
        community: "If 10,000 people went vegan, we'd save 9,000 tons CO₂/year — equivalent to removing 1,950 cars from roads."
      },
      "beef": {
        title: "Stopping beef consumption entirely",
        current: { kg: 45, desc: "Eating beef 3x/week (27kg CO₂/kg beef)" },
        savings: { monthly: 32, money: 45 },
        difficulty: "Easy",
        tips: ["Replace with chicken (5x lower CO₂)", "Try plant-based burgers", "Explore lentils and beans"],
        community: "If 10,000 people stopped eating beef, we'd save 3,840 tons CO₂/year — equivalent to planting 177,000 trees."
      },
      "local food": {
        title: "Eating only local food",
        current: { kg: 35, desc: "Average diet with food transported 2,500km to plate" },
        savings: { monthly: 8, money: 20 },
        difficulty: "Medium",
        tips: ["Shop at farmers markets", "Join a CSA (Community Supported Agriculture)", "Preserve seasonal foods"],
        community: "If 10,000 people ate local, we'd save 960 tons CO₂/year from transport emissions."
      },
      "meal prep": {
        title: "Meal prepping every Sunday",
        current: { kg: 18, desc: "Food waste from unplanned meals + 4 takeout orders/week" },
        savings: { monthly: 12, money: 120 },
        difficulty: "Easy",
        tips: ["Start with 3-4 meals per week", "Invest in good containers", "Cook grains and proteins in batches"],
        community: "If 10,000 people meal prepped, we'd save 1,440 tons CO₂/year from reduced waste + 480 tons from fewer deliveries."
      },
      "delivery": {
        title: "Stopping food delivery entirely",
        current: { kg: 24, desc: "3 deliveries/week with packaging + transport emissions" },
        savings: { monthly: 18, money: 150 },
        difficulty: "Medium",
        tips: ["Cook simple 15-minute meals", "Prep ingredients on weekends", "Use restaurant pickup instead"],
        community: "If 10,000 people stopped delivery, we'd save 2,160 tons CO₂/year — equivalent to taking 470 cars off roads."
      },
      // Energy
      "solar": {
        title: "Installing solar panels",
        current: { kg: 350, desc: "Grid electricity for average home (30kWh/day)" },
        savings: { monthly: 180, money: 85 },
        difficulty: "Hard",
        tips: ["Get multiple quotes from installers", "Check federal/state incentives", "Start with rooftop assessment"],
        community: "If 10,000 homes went solar, we'd save 21,600 tons CO₂/year — equivalent to planting 1M trees."
      },
      "led": {
        title: "Switching all bulbs to LED",
        current: { kg: 8, desc: "Incandescent and CFL bulbs in average home (20 bulbs)" },
        savings: { monthly: 5, money: 12 },
        difficulty: "Easy",
        tips: ["Start with most-used rooms", "Check for utility rebates", "Choose warm white (2700K) for living spaces"],
        community: "If 10,000 homes switched to LEDs, we'd save 600 tons CO₂/year — equivalent to planting 28,000 trees."
      },
      "cold water": {
        title: "Washing everything in cold water",
        current: { kg: 18, desc: "Hot water washing: 90% of laundry energy goes to heating" },
        savings: { monthly: 12, money: 8 },
        difficulty: "Easy",
        tips: ["Use cold-water detergent", "Modern detergents work great in cold", "Only wash full loads"],
        community: "If 10,000 households used cold water, we'd save 1,440 tons CO₂/year — equivalent to taking 310 cars off roads."
      },
      "air dry": {
        title: "Air-drying all clothes",
        current: { kg: 45, desc: "Electric dryer: 3 loads/week uses 3kWh per load" },
        savings: { monthly: 35, money: 18 },
        difficulty: "Easy",
        tips: ["Use drying rack indoors in winter", "Hang clothes on balcony/patio", "Dry synthetics outside, delicates indoors"],
        community: "If 10,000 households air-dried clothes, we'd save 4,200 tons CO₂/year — equivalent to planting 194,000 trees."
      },
      "smart thermostat": {
        title: "Getting a smart thermostat",
        current: { kg: 280, desc: "HVAC inefficiency: heating/cooling empty home, wrong temps" },
        savings: { monthly: 35, money: 25 },
        difficulty: "Medium",
        tips: ["Set schedule based on actual home/away times", "Use eco mode features", "Adjust 7-10°F when away"],
        community: "If 10,000 homes used smart thermostats, we'd save 4,200 tons CO₂/year — equivalent to removing 910 cars."
      },
      // Shopping
      "fast fashion": {
        title: "Stopping fast fashion purchases",
        current: { kg: 65, desc: "Buying 5 new garments/month (polyester/cotton mix)" },
        savings: { monthly: 45, money: 200 },
        difficulty: "Medium",
        tips: ["Try 30-day no-buy challenges", "Host clothing swaps with friends", "Follow 'one in, one out' rule"],
        community: "If 10,000 people quit fast fashion, we'd save 5,400 tons CO₂/year — equivalent to planting 250,000 trees."
      },
      "secondhand": {
        title: "Only buying secondhand clothes",
        current: { kg: 65, desc: "New clothing manufacturing + shipping emissions" },
        savings: { monthly: 52, money: 150 },
        difficulty: "Medium",
        tips: ["Check ThredUp, Poshmark, Depop apps", "Visit local thrift stores regularly", "Learn basic repairs (buttons, hems)"],
        community: "If 10,000 people bought secondhand instead of new, we'd save 6,240 tons CO₂/year — equivalent to removing 1,350 cars."
      },
      "repair": {
        title: "Repairing things instead of replacing",
        current: { kg: 35, desc: "Electronics and appliance replacement cycle" },
        savings: { monthly: 18, money: 80 },
        difficulty: "Medium",
        tips: ["Learn basic sewing for clothes", "Use iFixit for electronics repairs", "Find local repair cafes"],
        community: "If 10,000 people repaired instead of replaced, we'd save 2,160 tons CO₂/year — equivalent to planting 100,000 trees."
      },
      "nothing new": {
        title: "Buying nothing new for a year",
        current: { kg: 180, desc: "Average consumer goods: clothes, electronics, home items" },
        savings: { monthly: 95, money: 400 },
        difficulty: "Hard",
        tips: ["Make exceptions for essentials (food, medicine)", "Borrow tools from library", "Buy experiences instead of things"],
        community: "If 10,000 people bought nothing new for a year, we'd save 11,400 tons CO₂/year — equivalent to removing 2,470 cars."
      },
      "reusable bottle": {
        title: "Using a reusable water bottle",
        current: { kg: 4, desc: "2 plastic bottles/day manufacturing + transport emissions" },
        savings: { monthly: 3, money: 45 },
        difficulty: "Easy",
        tips: ["Keep bottle visible as reminder", "Calculate plastic waste saved", "Get a filter if tap water concerns you"],
        community: "If 10,000 people used reusable bottles, we'd save 360 tons CO₂/year — and eliminate 7.3M plastic bottles."
      }
    };
    
    // Match scenario based on keywords
    let matchedKey = Object.keys(scenarios).find(key => q.includes(key));
    
    // Fallback matching for broader terms
    if (!matchedKey) {
      if (q.includes("meat") || q.includes("vegetarian")) matchedKey = "beef";
      else if (q.includes("car") || q.includes("drive") || q.includes("uber")) matchedKey = "bike";
      else if (q.includes("flight") || q.includes("fly")) matchedKey = "carpool"; // generic transport
      else if (q.includes("energy") || q.includes("electricity")) matchedKey = "led";
      else if (q.includes("water") || q.includes("shower")) matchedKey = "cold water";
      else if (q.includes("fashion") || q.includes("clothes")) matchedKey = "fast fashion";
      else if (q.includes("compost")) matchedKey = "meal prep"; // food waste related
      else if (q.includes("plastic") || q.includes("bag")) matchedKey = "reusable bottle";
    }
    
    const s = matchedKey ? scenarios[matchedKey] : {
      title: input || "Making a sustainable lifestyle change",
      current: { kg: 40, desc: "Estimated baseline carbon footprint for current behavior" },
      savings: { monthly: 15, money: 50 },
      difficulty: "Medium",
      tips: ["Start small and track progress", "Find accountability partners", "Celebrate milestones along the way"],
      community: "If 10,000 people made similar changes, we'd save 1,800 tons CO₂/year — equivalent to planting 83,000 trees."
    };
    
    mock.scenario = s.title;
    mock.difficulty = s.difficulty;
    mock.current_impact = { monthly_co2_kg: s.current.kg, description: s.current.desc };
    mock.projected_savings = {
      monthly: { co2_kg: s.savings.monthly, money_saved: `$${s.savings.money}` },
      six_months: { co2_kg: s.savings.monthly * 6, money_saved: `$${s.savings.money * 6}` },
      yearly: { co2_kg: s.savings.monthly * 12, money_saved: `$${s.savings.money * 12}` }
    };
    mock.tips = s.tips;
    mock.community_scale = s.community;
    mock.equivalence = {
      trees_equivalent: Math.round(s.savings.monthly * 12 * 0.046),
      flights_equivalent: `${(s.savings.monthly * 12 / 255).toFixed(1)} short-haul flights`,
      driving_equivalent: `${Math.round(s.savings.monthly * 12 * 4)} km`
    };
  }

  if (mode === "coach" && query) {
    // Comprehensive realistic coaching scenarios
    const q = query;
    
    // Define realistic coaching responses with proper advice
    const coachScenarios: Record<string, {
      response: string;
      action_items: { action: string; impact: string }[];
      encouragement: string;
    }> = {
      // Guilt/overwhelm scenarios
      "guilt": {
        response: "Feeling guilty about your environmental impact is actually a sign that you care—and that's the first step toward change. But guilt without action is paralyzing. The key is to channel that feeling into small, achievable actions rather than trying to overhaul your entire lifestyle at once. Remember: perfection isn't the goal. A 20% reduction in your carbon footprint is fantastic, and it's more than most people achieve.",
        action_items: [
          { action: "Start with just ONE area (food, transport, or energy) for the first month", impact: "Focus prevents overwhelm" },
          { action: "Track your baseline for 1 week before making changes", impact: "You can't improve what you don't measure" },
          { action: "Celebrate small wins: one meatless meal, one bike ride, one LED bulb", impact: "Builds positive momentum" }
        ],
        encouragement: "Every expert was once a beginner. Your awareness already puts you ahead of 70% of the population. 🌱"
      },
      "overwhelm": {
        response: "Climate anxiety is real, and feeling overwhelmed is completely valid. The trick is to remember: you're not responsible for solving the entire climate crisis alone. You're responsible for your choices—and those choices DO matter when multiplied across millions of people. Start with the 'low-hanging fruit' that require minimal effort but deliver real impact.",
        action_items: [
          { action: "Switch to cold water laundry (zero effort, 12kg CO2/month saved)", impact: "~144kg CO2/year" },
          { action: "Unsubscribe from 3 fast fashion marketing emails", impact: "Reduces impulse buying by ~30%" },
          { action: "Set up a 'no-fly' rule for trips under 500km", impact: "~200kg CO2 per avoided flight" }
        ],
        encouragement: "Progress, not perfection. One small action today beats a perfect plan you'll start tomorrow. 💪"
      },
      // Diet scenarios  
      "meat daily": {
        response: "Eating meat daily puts your diet's carbon footprint around 220kg CO2/month—more than many people's entire monthly footprint. The good news: you don't have to go vegan overnight to make a huge difference. Cutting beef (the highest-impact meat) and reducing overall meat frequency can drop your food emissions by 40-50%.",
        action_items: [
          { action: "Replace beef with chicken or beans (beef = 27kg CO2/kg, chicken = 5kg)", impact: "~32kg CO2/month saved" },
          { action: "Try 4 meatless dinners per week using recipes you already like (pasta, curry, stir-fry)", impact: "~45kg CO2/month saved" },
          { action: "When you do eat meat, make it the side dish (4oz) not the main (8oz+)", impact: "~25kg CO2/month saved" }
        ],
        encouragement: "You don't need to be perfect—just better than yesterday. One plant-based meal is a win! 🌿"
      },
      "vegan": {
        response: "Transitioning to veganism can reduce your food-related emissions by ~75% (from ~220kg to ~55kg CO2/month). The trick is doing it sustainably so you stick with it. Focus on nutrient-dense foods and don't just remove animal products—replace them with satisfying alternatives.",
        action_items: [
          { action: "Learn 5 high-protein vegan meals you genuinely enjoy", impact: "Long-term habit sustainability" },
          { action: "Supplement B12 and consider algae-based omega-3", impact: "Health optimization" },
          { action: "Try ethnic cuisines that are naturally vegan (Ethiopian, Indian, Thai)", impact: "Makes transition enjoyable" }
        ],
        encouragement: "Every plant-based meal is a vote for the world you want to live in. You're making a real difference! 🌍"
      },
      // Transport scenarios
      "commute": {
        response: "A 30-minute car commute (about 15km each way) generates roughly 85kg CO2/month just from driving. That's more than the entire monthly footprint of many Europeans. The biggest impact comes from mode shifts—even working from home 2 days/week cuts your commute emissions by 40%.",
        action_items: [
          { action: "Negotiate 2 remote days/week with your employer", impact: "~34kg CO2/month saved" },
          { action: "Try biking 2 days/week (weather permitting)", impact: "~38kg CO2/month saved + fitness benefits" },
          { action: "Carpool with 1 colleague (cuts both your emissions in half)", impact: "~42kg CO2/month saved" }
        ],
        encouragement: "Your commute is probably your biggest carbon lever. Small changes here = massive impact! 🚴"
      },
      "electric car": {
        response: "An EV on the average US grid produces about 75% fewer emissions than a gas car (50g vs 166g CO2/km). However, manufacturing an EV creates ~8-10 tons CO2 vs ~5 tons for a gas car. The 'break-even' point is typically around 15,000-20,000 miles of driving. If you drive a lot, an EV makes sense. If you rarely drive, keeping your current car longer may be greener.",
        action_items: [
          { action: "Calculate your annual mileage—EVs make sense above 12,000 miles/year", impact: "Avoid premature manufacturing emissions" },
          { action: "If buying EV, prioritize models with smaller batteries (sufficient for your daily range)", impact: "Smaller battery = less manufacturing impact" },
          { action: "Keep your current car if it's efficient and you drive <8,000 miles/year", impact: "Avoid manufacturing footprint" }
        ],
        encouragement: "The greenest car is often the one you already own—drive it efficiently until it truly needs replacement! 🔋"
      },
      // Energy scenarios
      "electricity bill": {
        response: "The average US home uses 877 kWh/month, generating about 350kg CO2 (varies by grid). Heating/cooling is typically 50% of this, followed by water heating, then appliances. The biggest wins come from behavior changes that cost nothing, followed by low-cost efficiency upgrades.",
        action_items: [
          { action: "Adjust thermostat by 3°F (warmer in summer, cooler in winter)", impact: "~50kg CO2/month saved" },
          { action: "Switch all bulbs to LEDs (costs ~$50, saves $15/month)", impact: "~5kg CO2/month saved" },
          { action: "Unplug 'phantom' devices or use smart power strips", impact: "~8kg CO2/month saved" }
        ],
        encouragement: "Energy efficiency pays for itself—and every kWh you don't use is one less coal burned! ⚡"
      },
      "heating": {
        response: "Space heating is the largest energy use in most homes—often 40-50% of total consumption. Gas heating produces about 200g CO2 per kWh of heat delivered. Heat pumps are 3-4x more efficient but expensive upfront. The fastest wins come from reducing heat loss and thermostat discipline.",
        action_items: [
          { action: "Lower thermostat to 65°F (18°C) during day, 60°F at night", impact: "~40kg CO2/month saved" },
          { action: "Seal obvious air leaks around doors/windows with weatherstripping", impact: "~25kg CO2/month saved" },
          { action: "Use a programmable thermostat if you don't have one", impact: "~30kg CO2/month saved" }
        ],
        encouragement: "Every degree lower saves ~3% on heating. Put on a sweater and save the planet! 🧥"
      },
      // Shopping scenarios
      "fast fashion": {
        response: "The average person buys 68 new garments per year, generating about 65kg CO2/month from manufacturing and shipping. Fast fashion is particularly carbon-intensive because items are worn few times before disposal. The solution isn't buying nothing—it's buying intentionally and making things last.",
        action_items: [
          { action: "Set a '24-hour rule' for all non-essential purchases", impact: "Reduces impulse buys by ~40%" },
          { action: "Calculate cost-per-wear: $50 jacket worn 100 times = $0.50/use", impact: "Changes purchasing mindset" },
          { action: "Buy secondhand for 50% of your wardrobe additions", impact: "~35kg CO2/month saved" }
        ],
        encouragement: "The most sustainable clothes are the ones already in your closet. Wear them proudly! 👕"
      },
      "delivery": {
        response: "Online shopping with home delivery typically adds 10-20% to the carbon footprint of an item due to last-mile delivery in vans. But paradoxically, it's often better than driving to a store yourself—delivery vans optimize routes and carry hundreds of packages. The key is consolidating orders, not eliminating them.",
        action_items: [
          { action: "Use 'slow shipping' options (5-7 days)—allows route optimization", impact: "~15% lower delivery emissions" },
          { action: "Consolidate orders: add to cart all week, checkout once", impact: "Reduces trips to your address" },
          { action: "Choose pickup points when available (one van trip serves many)", impact: "More efficient than home delivery" }
        ],
        encouragement: "Conscious consumption beats abstinence. Buy what you need, but buy it thoughtfully! 📦"
      },
      // Mindset/motivation scenarios
      "friends": {
        response: "Navigating social pressure around sustainability is tricky. Research shows that leading by example is more effective than preaching—people are 3x more likely to adopt behaviors they see friends doing than ones they're told to do. Frame changes around personal benefits (saving money, better health) rather than moral superiority.",
        action_items: [
          { action: "Share your wins: 'I saved $80 this month biking to work'", impact: "Motivates without lecturing" },
          { action: "Host a plant-based dinner that's genuinely delicious", impact: "Changes perceptions about 'eco-friendly food'" },
          { action: "Avoid sustainability jargon—talk about health, money, convenience", impact: "Meets people where they are" }
        ],
        encouragement: "Be the change you want to see—but don't be annoying about it. Lead with joy, not judgment! 😊"
      },
      "motivation": {
        response: "Sustainability is a marathon, not a sprint. The key to staying motivated is tracking progress, celebrating milestones, and connecting to a community. Studies show people who track their carbon footprint maintain changes 3x longer than those who don't. Also, focus on the positive—what you're gaining (health, savings, purpose) not just what you're giving up.",
        action_items: [
          { action: "Calculate and track your monthly CO2—watch it decline", impact: "Visual progress is motivating" },
          { action: "Join a local sustainability group or online community", impact: "Social accountability + support" },
          { action: "Reward yourself with experiences, not stuff, when you hit milestones", impact: "Positive reinforcement" }
        ],
        encouragement: "You're doing more than you think. Track it, celebrate it, and keep going! 🎉"
      },
      "individual action": {
        response: "Does individual action matter? Unequivocally yes—but not in the way many think. Your personal footprint reduction matters less than the systemic change your behavior signals. When millions reduce meat consumption, markets shift, restaurants change menus, and agricultural policy follows. Plus, people who make personal changes are more likely to vote for climate policy and talk to others about it.",
        action_items: [
          { action: "Think of yourself as a 'first follower'—early adopters inspire others", impact: "Multiplies your impact socially" },
          { action: "Support climate-conscious businesses with your wallet", impact: "Voting with dollars works" },
          { action: "Contact elected officials about climate policy monthly", impact: "Systemic change > individual change" }
        ],
        encouragement: "You're not just reducing emissions—you're shifting culture. That's powerful! 💪"
      },
      // Getting started scenarios
      "where begin": {
        response: "Starting your sustainability journey doesn't require a complete lifestyle overhaul. The 80/20 rule applies here: 20% of changes deliver 80% of impact. Focus on high-impact, low-effort wins first. For most people in developed countries, the big three are: reduce flying, reduce car use, and eat less beef.",
        action_items: [
          { action: "Eliminate beef completely (easiest high-impact food change)", impact: "~32kg CO2/month saved" },
          { action: "Replace 2 car trips/week with transit, bike, or walking", impact: "~20kg CO2/month saved" },
          { action: "Set a 'no-fly' rule for personal trips under 800km", impact: "~150kg CO2 per avoided flight" }
        ],
        encouragement: "Start where you are, use what you have, do what you can. You've got this! 🌟"
      },
      "easiest": {
        response: "The easiest sustainability wins are behavior changes that require zero ongoing effort after the initial setup. These are 'set it and forget it' changes that keep saving carbon month after month with no willpower required. Think: LED bulbs, cold water laundry, autopay for renewable energy.",
        action_items: [
          { action: "Switch to cold water laundry permanently (change the washer setting once)", impact: "~12kg CO2/month, zero effort" },
          { action: "Install LEDs in your 5 most-used lights (takes 10 minutes)", impact: "~5kg CO2/month for 10 years" },
          { action: "Switch to a renewable energy provider (often same price, 5 min online)", impact: "~300kg CO2/month saved" }
        ],
        encouragement: "The greenest actions are the ones you do automatically. Set them up once, benefit forever! ♻️"
      },
      // Relationship scenarios
      "partner": {
        response: "Navigating sustainability with a partner who isn't on the same page requires empathy and patience. Research shows that couples who make changes gradually and frame them around shared values (saving money, health for future children, home comfort) succeed more than those who frame it as 'being good.' Start with changes that benefit both of you financially or physically.",
        action_items: [
          { action: "Propose a 'no-spend month' challenge—saves money AND carbon", impact: "Dual motivation" },
          { action: "Cook one amazing plant-based meal together per week", impact: "Builds positive associations" },
          { action: "Calculate shared savings from efficiency improvements", impact: "Financial incentive works for both" }
        ],
        encouragement: "Shared values > individual perfection. Find the overlap and grow from there! 💚"
      }
    };
    
    // Match scenario based on keywords
    let matchedKey = Object.keys(coachScenarios).find(key => q.includes(key));
    
    // Fallback matching for broader terms
    if (!matchedKey) {
      if (q.includes("guilt") || q.includes("anxiety") || q.includes("bad person") || q.includes("hopeless")) matchedKey = "guilt";
      else if (q.includes("overwhelm") || q.includes("too much") || q.includes("where start") || q.includes("confused")) matchedKey = "overwhelm";
      else if (q.includes("meat") || q.includes("daily") || q.includes("beef") || q.includes("chicken")) matchedKey = "meat daily";
      else if (q.includes("vegan") || q.includes("plant-based") || q.includes("vegetarian")) matchedKey = "vegan";
      else if (q.includes("commute") || q.includes("work") || q.includes("office") || q.includes("driving")) matchedKey = "commute";
      else if (q.includes("electric") || q.includes("ev") || q.includes("tesla") || q.includes("car")) matchedKey = "electric car";
      else if (q.includes("bill") || q.includes("electricity") || q.includes("save money")) matchedKey = "electricity bill";
      else if (q.includes("heat") || q.includes("cold") || q.includes("winter")) matchedKey = "heating";
      else if (q.includes("fashion") || q.includes("clothes") || q.includes("shopping") || q.includes("buy")) matchedKey = "fast fashion";
      else if (q.includes("amazon") || q.includes("delivery") || q.includes("package")) matchedKey = "delivery";
      else if (q.includes("friend") || q.includes("family") || q.includes("judge") || q.includes("social")) matchedKey = "friends";
      else if (q.includes("motivat") || q.includes("give up") || q.includes("quit") || q.includes("stuck")) matchedKey = "motivation";
      else if (q.includes("individual") || q.includes("matter") || q.includes("make difference") || q.includes("pointless")) matchedKey = "individual action";
      else if (q.includes("begin") || q.includes("start") || q.includes("new")) matchedKey = "where begin";
      else if (q.includes("easy") || q.includes("simple") || q.includes("quick")) matchedKey = "easiest";
      else if (q.includes("partner") || q.includes("spouse") || q.includes("wife") || q.includes("husband")) matchedKey = "partner";
    }
    
    const scenario = matchedKey ? coachScenarios[matchedKey] : {
      response: "Great question! The key to sustainable living is focusing on high-impact changes that fit your lifestyle. Based on typical patterns, most people see the biggest carbon reduction from three areas: transportation (especially reducing driving and flying), diet (particularly reducing beef and dairy), and home energy (heating/cooling efficiency).",
      action_items: [
        { action: "Track your current carbon footprint using our Carbon Mirror tool", impact: "Know your starting point" },
        { action: "Pick ONE high-impact area to focus on for the next 30 days", impact: "Prevents overwhelm" },
        { action: "Set a specific, measurable goal (e.g., 'no beef for 30 days')", impact: "Accountability + clarity" }
      ],
      encouragement: "Every journey starts with a single step. You're already ahead by asking questions! 🌱"
    };
    
    mock.response = scenario.response;
    mock.action_items = scenario.action_items;
    mock.encouragement = scenario.encouragement;
    mock.eco_score_delta = 2;
  }

  // TRANSPORT MODE: Calculate emissions based on distance and vehicle type
  if (mode === "transport") {
    // Use provided distance parameter or extract from input, default to 5km
    const distNum = distance ? parseFloat(distance) : 5;
    const distanceKm = isNaN(distNum) ? 5 : distNum;
    
    // Use provided transportMode or detect from input, default to car
    const q = (input || "").toLowerCase();
    let vehicleMode = transportMode || "car";
    if (!transportMode) {
      if (q.includes("plane") || q.includes("flight") || q.includes("fly") || q.includes("air")) vehicleMode = "plane";
      else if (q.includes("boat") || q.includes("ferry") || q.includes("ship")) vehicleMode = "boat";
      else if (q.includes("motorcycle") || q.includes("motorbike") || q.includes("scooter") || q.includes("moto")) vehicleMode = "motorcycle";
      else if (q.includes("ev") || q.includes("electric") || q.includes("tesla")) vehicleMode = "ev";
      else if (q.includes("bus")) vehicleMode = "bus";
      else if (q.includes("train") || q.includes("rail")) vehicleMode = "train";
      else if (q.includes("bike") || q.includes("bicycle") || q.includes("cycling")) vehicleMode = "bike";
      else if (q.includes("walk") || q.includes("foot")) vehicleMode = "walk";
      else if (q.includes("car") || q.includes("drive")) vehicleMode = "car";
    }
    
    // Realistic emission factors (kg CO2 per km)
    // Sources: EPA, IPCC, European Environment Agency, ICAO, IMO
    const emissionFactors: Record<string, number> = {
      car: 0.166,         // Gasoline car: ~166g CO2/km (average sedan, single occupancy)
      ev: 0.050,          // Electric vehicle: ~50g CO2/km (varies by grid mix)
      bus: 0.089,         // Diesel bus: ~89g CO2/km per passenger (average occupancy)
      train: 0.041,       // Electric train: ~41g CO2/km per passenger
      bike: 0.005,        // Bicycle: ~5g CO2/km (food energy + manufacturing amortized)
      plane: 0.255,       // Short-haul flight: ~255g CO2/km (per passenger, includes radiative forcing)
      boat: 0.190,        // Ferry/boat: ~190g CO2/km per passenger (diesel powered)
      motorcycle: 0.103,  // Motorcycle: ~103g CO2/km (average 125cc)
      walk: 0.000         // Walking: effectively 0 (minimal food energy difference)
    };
    
    // Calculate emissions for selected mode
    const factor = emissionFactors[vehicleMode] || emissionFactors.car;
    const emitted = Math.round(distanceKm * factor * 100) / 100;
    
    // Determine greener alternative and calculate savings
    let greenerOption = "train";
    let greenerFactor = emissionFactors.train;
    let greenerEmission = Math.round(distanceKm * greenerFactor * 100) / 100;
    
    if (vehicleMode === "car") {
      greenerOption = "train or bus";
      greenerFactor = emissionFactors.train;
      greenerEmission = Math.round(distanceKm * greenerFactor * 100) / 100;
    } else if (vehicleMode === "ev") {
      greenerOption = "train or bicycle";
      greenerFactor = emissionFactors.train;
      greenerEmission = Math.round(distanceKm * greenerFactor * 100) / 100;
    } else if (vehicleMode === "bus") {
      greenerOption = "train";
      greenerFactor = emissionFactors.train;
      greenerEmission = Math.round(distanceKm * greenerFactor * 100) / 100;
    } else if (vehicleMode === "train") {
      greenerOption = "bicycle";
      greenerFactor = emissionFactors.bike;
      greenerEmission = Math.round(distanceKm * greenerFactor * 100) / 100;
    } else if (vehicleMode === "bike" || vehicleMode === "walk") {
      greenerOption = "none (you're already at zero!)";
      greenerFactor = 0;
      greenerEmission = 0;
    } else if (vehicleMode === "plane") {
      greenerOption = "train (for shorter routes)";
      greenerFactor = emissionFactors.train;
      greenerEmission = Math.round(distanceKm * greenerFactor * 100) / 100;
    } else if (vehicleMode === "boat") {
      greenerOption = "train or bus";
      greenerFactor = emissionFactors.train;
      greenerEmission = Math.round(distanceKm * greenerFactor * 100) / 100;
    } else if (vehicleMode === "motorcycle") {
      greenerOption = "bus or train";
      greenerFactor = emissionFactors.bus;
      greenerEmission = Math.round(distanceKm * greenerFactor * 100) / 100;
    }
    
    const savings = Math.max(0, Math.round((emitted - greenerEmission) * 100) / 100);
    const annualTrips = 240; // 5 days/week × 48 weeks
    const annualSavings = Math.round(savings * annualTrips * 10) / 10;
    
    // Calculate equivalence (approximate tree planting and distance equivalents)
    const treesPerKg = 0.05; // ~1 tree absorbs 20kg CO2/year
    const treesEquivalent = Math.round(annualSavings * treesPerKg);
    const avoidedKm = Math.round(annualSavings / emissionFactors.car); // Car km avoided
    
    // Scale impact for 10,000 commuters
    const scaleTons = Math.round(savings * 10000 * annualTrips / 1000);
    
    // Update mock with calculated values
    mock.emitted = emitted;
    mock.emission_factor = `${Math.round(factor * 1000)} g CO2/km (${vehicleMode})`;
    mock.greener_option = greenerOption;
    mock.greener_emission = greenerEmission;
    mock.savings = savings;
    mock.annual_savings = annualSavings;
    mock.equivalence = `Equivalent to planting ${treesEquivalent} trees or avoiding ${avoidedKm} km of driving annually`;
    mock.scale_impact = `If 10,000 commuters switched: ${scaleTons} tons CO2/year saved`;
    mock.route_context = `${distanceKm}km via ${vehicleMode}. ${savings > 0 ? `Switching to ${greenerOption} saves ${savings}kg per trip.` : "You're already using the greenest option!"}`;
  }

  return mock;
}

// --- Cache helpers ---

function getCacheKey(mode: string, input: string, distance?: string, transportMode?: string): string {
  // For transport mode, include distance and transportMode in cache key
  if (mode === "transport" && (distance || transportMode)) {
    return `${mode}:${input?.toLowerCase().trim() || ""}:${distance || "0"}:${transportMode || "car"}`;
  }
  return `${mode}:${input?.toLowerCase().trim() || ""}`;
}

function getCachedResponse(mode: string, input: string, distance?: string, transportMode?: string): any | null {
  const key = getCacheKey(mode, input, distance, transportMode);
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[API] Cache hit for ${mode}`);
    return cached.data;
  }
  return null;
}

function setCachedResponse(mode: string, input: string, data: any, distance?: string, transportMode?: string): void {
  const key = getCacheKey(mode, input, distance, transportMode);
  responseCache.set(key, { data, timestamp: Date.now() });
  // Limit cache size
  if (responseCache.size > 100) {
    const firstKey = responseCache.keys().next().value as string;
    responseCache.delete(firstKey);
  }
}

// Check if we're in quota cooldown
function isQuotaCooldownActive(): boolean {
  if (quotaErrors >= QUOTA_ERROR_THRESHOLD) {
    const elapsed = Date.now() - lastQuotaErrorTime;
    if (elapsed < QUOTA_COOLDOWN_MS) {
      console.warn(`[API] Quota cooldown active for ${Math.ceil((QUOTA_COOLDOWN_MS - elapsed) / 1000)}s more`);
      return true;
    }
    // Reset after cooldown
    quotaErrors = 0;
  }
  return false;
}

function recordQuotaError(): void {
  quotaErrors++;
  lastQuotaErrorTime = Date.now();
  console.warn(`[API] Quota error recorded (${quotaErrors}/${QUOTA_ERROR_THRESHOLD})`);
}

function isQuotaError(error: any): boolean {
  const msg = error?.message || "";
  return msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests");
}

// --- Retry helper with tiered fallback (2.5 → 2.0 → mock) ---

const MODELS = ["gemini-2.5-flash-preview-04-17", "gemini-2.0-flash"];

async function generateWithRetry(
  prompt: string | any[],
  maxRetries: number = 1,
  timeoutMs: number = 8000
): Promise<{ text: string; modelUsed: string; tokenUsage?: number }> {
  let lastError: Error | null = null;

  // Check quota cooldown first
  if (isQuotaCooldownActive()) {
    console.warn("[API] Quota cooldown active - skipping API calls");
    throw new Error("QUOTA_COOLDOWN");
  }

  for (let modelIndex = 0; modelIndex < MODELS.length; modelIndex++) {
    const modelName = MODELS[modelIndex];

    // Check if quota cooldown became active after previous model's error
    if (isQuotaCooldownActive()) {
      console.warn(`[API] Quota cooldown active after previous error, skipping ${modelName}`);
      throw new Error("QUOTA_COOLDOWN");
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const model = getModel(modelName);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("timeout")), timeoutMs);
        });

        const result = await Promise.race([model.generateContent(prompt), timeoutPromise]);
        const response = await result.response;
        const text = response.text();

        if (!text) {
          throw new Error("Empty response from Gemini");
        }

        // Log token usage if available
        const usage = result.response?.usageMetadata;
        if (usage) {
          console.log(`[API] Token usage - Prompt: ${usage.promptTokenCount}, Completion: ${usage.candidatesTokenCount}, Total: ${usage.totalTokenCount}`);
        }

        return { text, modelUsed: modelName, tokenUsage: usage?.totalTokenCount };
      } catch (error: any) {
        lastError = error;

        if (isQuotaError(error)) {
          recordQuotaError();
          // If we've hit the quota threshold, don't try remaining models
          if (quotaErrors >= QUOTA_ERROR_THRESHOLD) {
            console.warn(`[API] Quota threshold reached (${quotaErrors}/${QUOTA_ERROR_THRESHOLD}), skipping remaining models`);
            throw new Error("QUOTA_EXHAUSTED");
          }
          console.warn(`[API] Quota/Rate limit hit on ${modelName}, trying next model...`);
          break; // Break to next model, don't retry this one
        }

        if (attempt < maxRetries) {
          const backoff = 1000 * Math.pow(2, attempt); // 1s, 2s exponential
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }
  }

  throw lastError || new Error("All models failed");
}

// --- Example detection for demo mode ---

const EXAMPLE_PATTERNS: Record<string, string[]> = {
  // Carbon footprint presets - lifestyle archetypes
  carbon: [
    // Original
    "suburban commuter", "urban vegan", "frequent flyer", "eco-conscious student",
    // Expanded
    "digital nomad", "remote worker", "bike commuter", "train commuter",
    "meat lover", "pescatarian", "plant-based", "keto dieter",
    "apartment dweller", "homeowner", "tiny house", "off-grid",
    "shopaholic", "minimalist", "zero waste", "thrift shopper",
    "gamer", "streamer", "content creator", "software developer",
    "nurse", "teacher", "construction worker", "office worker",
    "fitness enthusiast", "yoga practitioner", "runner", "cyclist",
    "pet owner", "dog parent", "cat owner", "multiple pets",
    "new parent", "family of four", "empty nester", "single professional",
    "winter heating", "summer ac", "all electric", "gas appliances",
    "coffee addict", "tea drinker", "soda consumer", "water only",
    "fast fashion", "sustainable clothing", "secondhand only", "capsule wardrobe",
    "car every day", "public transit daily", "mixed commute", "work from home",
  ],

  // Waste classification - common items people wonder about
  waste: [
    // Original
    "pizza box", "starbucks", "coffee cup", "iphone", "plastic bag", "banana peel", "light bulb", "batteries", "styrofoam",
    // Expanded - food packaging
    "chip bag", "candy wrapper", "chocolate wrapper", "granola bar wrapper",
    "milk carton", "juice box", "yogurt cup", "butter wrapper",
    "egg carton", "meat tray", "frozen food box", "ice cream container",
    "bread bag", "produce bag", "mesh bag", "rubber band",
    // Expanded - electronics
    "old phone", "cracked screen", "charger cable", "power adapter",
    "earbuds", "headphones", "bluetooth speaker", "smart watch",
    "laptop", "tablet", "keyboard", "mouse",
    "tv remote", "battery", "car battery", "lithium battery",
    // Expanded - household
    "toothbrush", "razor", "makeup container", "shampoo bottle",
    "pill bottle", "inhaler", "contact lenses", "dental floss",
    "tissues", "paper towel", "napkin", "wet wipe",
    "diaper", "cat litter", "dog waste bag", "fish tank water",
    // Expanded - misc
    "broken glass", "mirror", "ceramic plate", "wine bottle",
    "aluminum foil", "wax paper", "parchment paper", "plastic wrap",
    "rubber glove", "balloon", "cigarette butt", "gum",
  ],

  // What-if scenarios - lifestyle changes people consider
  whatif: [
    // Original
    "what if i stop using uber", "what if i go vegetarian", "what if i switch to cold showers",
    "what if i work from home", "what if i stop buying fast fashion", "what if i composted",
    // Expanded - transport
    "what if i sold my car", "what if i bought an electric vehicle", "what if i biked to work",
    "what if i took the bus", "what if i carpooled", "what if i moved closer to work",
    "what if i flew less", "what if i took the train instead of flying",
    // Expanded - home energy
    "what if i installed solar panels", "what if i switched to led bulbs",
    "what if i got a smart thermostat", "what if i insulated my home",
    "what if i unplugged devices", "what if i used a clothesline",
    "what if i washed clothes in cold water", "what if i took shorter showers",
    // Expanded - diet
    "what if i went vegan", "what if i ate local only", "what if i grew my own vegetables",
    "what if i stopped eating beef", "what if i reduced food waste",
    "what if i meal prepped", "what if i stopped ordering delivery",
    "what if i brought my own containers",
    // Expanded - consumption
    "what if i bought nothing new for a year", "what if i repaired instead of replaced",
    "what if i used a reusable water bottle", "what if i brought my own bags",
    "what if i stopped using single-use plastics", "what if i shopped secondhand",
    "what if i borrowed instead of bought", "what if i shared tools with neighbors",
  ],

  // Transport comparisons - mode/distance combos
  transport: [
    // Common commutes
    "daily commute 20km", "work trip 50km", "airport run 30km",
    "grocery trip 5km", "school dropoff 10km", "weekend drive 100km",
    // Vacation travel
    "cross country flight", "train to another city", "bus to neighboring town",
    "road trip 500km", "europe trip", "weekend getaway",
    // Alternatives
    "bike vs car 10km", "walk vs drive 2km", "bus vs car 15km",
    "train vs flight 300km", "ev vs gas car", "scooter vs car",
  ],

  // Daily quests - gamified eco challenges
  quest: [
    // Energy savers
    "phantom power purge", "unplug devices", "led swap", " thermostat adjust",
    "air dry clothes", "cold wash", "shorter shower", "lights off day",
    // Transport challenges
    "walk the last mile", "bike to work", "public transit day", "carpool day",
    "no car day", "electric scooter", "combine errands", "skip the trip",
    // Food challenges
    "meatless monday", "local produce day", "zero food waste", "cook at home",
    "no takeout", "plant-based day", "farmers market", "grow herb",
    // Waste reducers
    "zero waste lunch", "no plastic day", "repair something", "compost kickoff",
    "declutter donate", "swap don't shop", "bring own bag", "refuse receipts",
    // Community actions
    "share with neighbor", "community garden", "beach cleanup", "park cleanup",
    "plant a tree", "start compost", "teach a friend", "social media post",
  ],

  // Coach - topics users might ask about (allow AI for nuanced responses)
  coach: [
    // Keywords that suggest complex advice needed - these go to AI
    "feeling guilty", "overwhelmed", "where to start", "burned out",
    "family doesn't care", "partner resistant", "kids interested", "workplace change",
    "calculate my footprint", "understand my impact", "prioritize actions", "biggest impact",
    // BUT simple/FAQ topics can use mock patterns
    "easy swaps", "quick wins", "beginner tips", "first steps",
  ],
};

function isExampleInput(mode: string, input?: string): boolean {
  if (!input) return false;
  const patterns = EXAMPLE_PATTERNS[mode] || [];
  const normalized = input.toLowerCase();
  return patterns.some(pattern => normalized.includes(pattern));
}

// --- Main handler ---

export async function POST(req: NextRequest) {
  try {
    const key = process.env.GEMINI_API_KEY || "";
    const isPlaceholder = !key || key === "your_api_key_here" || key.trim().length < 10;

    const body = await req.json();
    const { mode, input, distance, transportMode, context, personalization, image } = body;

    // Build personalization context string
    const personalizationStr = personalization
      ? `\nUser personalization context (use to tailor your response):\n${personalization}\n`
      : "";

    let promptText = "";
    if (mode === "carbon" && PROMPTS.carbon) {
      promptText = PROMPTS.carbon
        .replace("{input}", input || "")
        .replace("{personalization}", personalizationStr);
    } else if (mode === "waste" && PROMPTS.waste) {
      promptText = PROMPTS.waste.replace("{input}", input || (image ? "Analyze this image" : ""));
    } else if (mode === "transport" && PROMPTS.transport) {
      promptText = PROMPTS.transport
        .replace("{distance}", distance || "0")
        .replace("{mode}", transportMode || "car")
        .replace("{input}", input || "Unknown route");
    } else if (mode === "quest" && PROMPTS.quest) {
      promptText = PROMPTS.quest.replace("{personalization}", personalizationStr);
    } else if (mode === "whatif" && PROMPTS.whatif) {
      promptText = PROMPTS.whatif
        .replace("{input}", input || "")
        .replace("{personalization}", personalizationStr);
    } else if (mode === "coach" && PROMPTS.coach) {
      promptText = PROMPTS.coach
        .replace("{input}", input || "")
        .replace("{context}", context || "No previous context available.");
    } else {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    let promptPayload: any = promptText;
    if (image && mode === "waste") {
      // Assuming image is a base64 string like "data:image/jpeg;base64,/9j/4AAQ..."
      const mimeTypeMatch = image.match(/^data:([^;]+);base64,/);
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      promptPayload = [
        promptText,
        {
          inlineData: {
            data: base64Data,
            mimeType,
          },
        },
      ];
    }

    // Check cache first
    const cachedResponse = getCachedResponse(mode, input || "", distance, transportMode);
    if (cachedResponse) {
      console.log(`[API] Cache hit for mode: ${mode}`);
      return NextResponse.json(cachedResponse);
    }

    // Demo mode: Use mock for example/preset inputs (no API call)
    if (isExampleInput(mode, input)) {
      console.log(`[API] Example input detected for ${mode}, using enriched mock`);
      const mockData = getMockResponse(mode, input, distance, transportMode, image);
      setCachedResponse(mode, input || "", mockData, distance, transportMode);
      return NextResponse.json(mockData);
    }

    // Check quota cooldown - skip API calls if we're rate limited
    if (isQuotaCooldownActive()) {
      console.warn(`[API] Quota cooldown active, using mock for mode: ${mode}`);
      const mockData = getMockResponse(mode, input, distance, transportMode, image, "quota");
      setCachedResponse(mode, input || "", mockData, distance, transportMode);
      return NextResponse.json(mockData);
    }

    try {
      if (isPlaceholder) {
        console.warn(`[API] Using MOCK DATA fallback for mode: ${mode} (No valid API key)`);
        const mockData = getMockResponse(mode, input, distance, transportMode, image, "placeholder");
        setCachedResponse(mode, input || "", mockData, distance, transportMode);
        return NextResponse.json(mockData);
      }

      // Fast fail for free tier: 0 retries, 4s timeout per model = max 8s before mock fallback
      const result = await generateWithRetry(promptPayload, 0, 4000);
      console.log(`[API] Gemini Response Length: ${result.text.length}, Model: ${result.modelUsed}`);

      let parsed;
      try {
        parsed = JSON.parse(result.text);
      } catch {
        // Try to extract JSON from response
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            throw new Error("Failed to parse extracted JSON");
          }
        } else {
          throw new Error("No JSON found in Gemini response");
        }
      }

      // Sanitize numeric values
      parsed = sanitizeResponse(mode, parsed);

      // Validate response structure
      const validator = VALIDATORS[mode];
      if (validator && !validator(parsed)) {
        console.error(`Validation failed for mode: ${mode}. Received JSON:`, JSON.stringify(parsed, null, 2));
        console.warn(`Falling back to dynamic mock for mode: ${mode}`);
        const mockData = getMockResponse(mode, input, distance, transportMode, image, "error");
        setCachedResponse(mode, input || "", mockData, distance, transportMode);
        return NextResponse.json(mockData);
      }

      // Cache successful response
      setCachedResponse(mode, input || "", parsed, distance, transportMode);
      return NextResponse.json(parsed);
    } catch (error: any) {
      console.error("Gemini API Error:", error?.message || error);

      const isPlaceholderKey =
        !process.env.GEMINI_API_KEY ||
        process.env.GEMINI_API_KEY === "your_api_key_here" ||
        process.env.GEMINI_API_KEY.trim().length < 10;

      if (
        isPlaceholderKey ||
        error.message?.includes("API_KEY_INVALID") ||
        error.message?.includes("API key not valid") ||
        error.message?.includes("quota") ||
        error.message?.includes("429") ||
        error.message?.includes("abort") ||
        error.message?.includes("timeout") ||
        error.message?.includes("fetch") ||
        error.message?.includes("503") ||
        error.message?.includes("500") ||
        error.message?.includes("Service Unavailable") ||
        error.message?.includes("QUOTA_COOLDOWN") ||
        error.message?.includes("QUOTA_EXHAUSTED")
      ) {
        console.warn(`[API] Using MOCK DATA fallback for mode: ${mode} due to error: ${error.message}`);
        // Determine fallback reason based on error type
        let fallbackReason: "placeholder" | "quota" | "error" = "error";
        if (isPlaceholderKey || error.message?.includes("API_KEY_INVALID")) {
          fallbackReason = "placeholder";
        } else if (
          error.message?.includes("quota") ||
          error.message?.includes("429") ||
          error.message?.includes("QUOTA_COOLDOWN") ||
          error.message?.includes("QUOTA_EXHAUSTED")
        ) {
          fallbackReason = "quota";
        }
        const mockData = getMockResponse(mode, input, distance, transportMode, image, fallbackReason);
        setCachedResponse(mode, input || "", mockData, distance, transportMode);
        return NextResponse.json(mockData);
      }

      throw error;
    }
  } catch (error) {
    console.error("Critical Error in Gemini API route:", error);
    return NextResponse.json(
      { error: "A critical server error occurred." },
      { status: 500 }
    );
  }
}
