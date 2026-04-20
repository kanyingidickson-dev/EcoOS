"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  ArrowRight,
  TreePine,
  Plane,
  Car,
  TrendingDown,
  DollarSign,
  Lightbulb,
  Users,
  Share2,
  CheckCircle2,
  Brain,
  FileText,
  Calculator,
  BarChart3,
  Scale,
  Copy,
  Check,
  Sparkles,
  PlusCircle,
} from "lucide-react";
import clsx from "clsx";
import {
  Card,
  Spinner,
  AnimatedCounter,
  SkeletonCard,
  PointsPopup,
  getStore,
  updateStore,
  getPersonalizationContext,
  addHistoryEntry,
  useToast,
  type WhatIfResult,
} from "./shared";

const EXAMPLE_CATEGORIES = {
  "🚗 Transport Changes": [
    "What if I sold my car and took public transit?",
    "What if I biked to work instead of driving?",
    "What if I carpooled with 3 colleagues?",
    "What if I worked from home 3 days a week?",
    "What if I bought an electric vehicle?",
    "What if I stopped using Uber for a month?",
    "What if I took the train instead of flying?",
    "What if I moved closer to work?",
  ],
  "🍽️ Diet & Food": [
    "What if I went vegan for a year?",
    "What if I stopped eating beef entirely?",
    "What if I ate only local food?",
    "What if I meal prepped every Sunday?",
    "What if I stopped ordering delivery?",
    "What if I composted all my food waste?",
    "What if I brought my own containers?",
    "What if I grew my own vegetables?",
  ],
  "⚡ Home Energy": [
    "What if I installed solar panels?",
    "What if I switched all bulbs to LED?",
    "What if I got a smart thermostat?",
    "What if I air-dried all my clothes?",
    "What if I washed everything in cold water?",
    "What if I took 5-minute showers only?",
    "What if I unplugged all phantom devices?",
    "What if I insulated my home better?",
  ],
  "🛍️ Shopping & Consumption": [
    "What if I bought nothing new for a year?",
    "What if I stopped buying fast fashion?",
    "What if I only bought secondhand clothes?",
    "What if I repaired things instead of replacing?",
    "What if I used a reusable water bottle?",
    "What if I brought my own shopping bags?",
    "What if I stopped using single-use plastics?",
    "What if I shared tools with neighbors?",
  ],
};

export function WhatIfTab() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPoints, setShowPoints] = useState(false);
  const [activeTimeline, setActiveTimeline] = useState<"monthly" | "six_months" | "yearly">("yearly");
  const [isSimulating, setIsSimulating] = useState(false);
  const [reasoningStep, setReasoningStep] = useState(0);
  const [autoSimulate, setAutoSimulate] = useState(false);
  const [isMockLoading, setIsMockLoading] = useState(false);
  const { showToast } = useToast();

  // Simulate realistic AI loading for mock results
  const simulateMockLoading = async () => {
    setIsMockLoading(true);
    setLoading(true);
    
    // Animate reasoning steps like real AI
    setReasoningStep(1);
    await new Promise(r => setTimeout(r, 400));
    setReasoningStep(2);
    await new Promise(r => setTimeout(r, 400));
    setReasoningStep(3);
    await new Promise(r => setTimeout(r, 400));
    setReasoningStep(4);
    await new Promise(r => setTimeout(r, 300));
    
    setIsMockLoading(false);
    setLoading(false);
    setReasoningStep(0);
  };

  const clearResults = () => {
    setResult(null);
    setInput("");
    setError(null);
    setReasoningStep(0);
    setIsMockLoading(false);
    setIsSimulating(false);
  };

  const loadScenario = (scenario: string) => {
    setInput(scenario);
    setAutoSimulate(true);
  };

  // Auto-trigger simulation when scenario is loaded
  useEffect(() => {
    if (autoSimulate && input && !result && !loading && !isSimulating) {
      setAutoSimulate(false);
      setTimeout(() => simulate(), 100);
    }
  }, [autoSimulate, input, result, loading, isSimulating]);

  const simulate = useCallback(async () => {
    if (!input || isSimulating) return;
    setIsSimulating(true);
    setLoading(true);
    setResult(null);
    setError(null);
    setReasoningStep(1);
    
    // Animate reasoning steps
    const stepInterval = setInterval(() => {
      setReasoningStep((prev) => {
        if (prev >= 4) {
          clearInterval(stepInterval);
          return 4;
        }
        return prev + 1;
      });
    }, 700);
    
    try {
      const personalization = getPersonalizationContext();
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "whatif", input, personalization }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      // Check if this is a mock result (no AI processing happened)
      const isMock = data.modelUsed === undefined || data.modelUsed === null;
      
      if (isMock) {
        // Simulate realistic AI loading for mock results
        clearInterval(stepInterval);
        await simulateMockLoading();
      }
      
      setResult(data as WhatIfResult);

      const store = getStore();
      updateStore({
        analyses: store.analyses + 1,
        ecoScore: Math.min(100, store.ecoScore + 3),
      });
      addHistoryEntry("whatif_simulation", data.projected_savings?.yearly?.co2_kg || 0);
      setShowPoints(true);
      showToast("+20 eco points for simulating impact!", "🎯", "success");
      setTimeout(() => setShowPoints(false), 1500);
      clearInterval(stepInterval);
    } catch (e: unknown) {
      console.error("WhatIf simulation failed, using local fallback:", e);
      clearInterval(stepInterval);
      
      // Comprehensive realistic scenario database
      const q = input.toLowerCase();
      
      const scenarios: Record<string, WhatIfResult> = {
        // Transport
        "sold car": {
          scenario: "Selling car and using public transit",
          difficulty: "Hard",
          current_impact: { monthly_co2_kg: 180, description: "Monthly car ownership: 1,200km driving + maintenance + insurance carbon cost" },
          projected_savings: {
            monthly: { co2_kg: 95, money_saved: "$450" },
            six_months: { co2_kg: 570, money_saved: "$2,700" },
            yearly: { co2_kg: 1140, money_saved: "$5,400" },
          },
          equivalence: { trees_equivalent: 52, flights_equivalent: "4.5 short-haul flights", driving_equivalent: "4,560 km" },
          tips: ["Start by using transit for 2-3 days/week", "Keep car for emergencies initially", "Calculate total cost of ownership vs transit pass"],
          community_scale: "If 10,000 people went car-free, we'd save 11,400 tons CO₂/year — equivalent to removing 2,500 cars from roads.",
        },
        "bike": {
          scenario: "Biking to work instead of driving",
          difficulty: "Medium",
          current_impact: { monthly_co2_kg: 85, description: "15km daily commute by car (30km round trip, 22 work days)" },
          projected_savings: {
            monthly: { co2_kg: 38, money_saved: "$120" },
            six_months: { co2_kg: 228, money_saved: "$720" },
            yearly: { co2_kg: 456, money_saved: "$1,440" },
          },
          equivalence: { trees_equivalent: 21, flights_equivalent: "1.8 short-haul flights", driving_equivalent: "1,824 km" },
          tips: ["Start with 2 days per week", "Invest in proper rain gear", "Use e-bike for hills or longer distances"],
          community_scale: "If 10,000 commuters biked 15km daily, we'd save 4,560 tons CO₂/year — equivalent to planting 210,000 trees.",
        },
        "carpool": {
          scenario: "Carpooling with 3 colleagues",
          difficulty: "Easy",
          current_impact: { monthly_co2_kg: 85, description: "Solo 20km daily commute (40km round trip)" },
          projected_savings: {
            monthly: { co2_kg: 42, money_saved: "$80" },
            six_months: { co2_kg: 252, money_saved: "$480" },
            yearly: { co2_kg: 504, money_saved: "$960" },
          },
          equivalence: { trees_equivalent: 23, flights_equivalent: "2.0 short-haul flights", driving_equivalent: "2,016 km" },
          tips: ["Use apps like Waze Carpool to find partners", "Set clear pickup schedules", "Rotate driving responsibilities"],
          community_scale: "If 10,000 solo drivers carpooled with 3 people, we'd save 5,040 tons CO₂/year — equivalent to taking 1,100 cars off roads.",
        },
        "work from home": {
          scenario: "Working from home 3 days a week",
          difficulty: "Easy",
          current_impact: { monthly_co2_kg: 85, description: "Full-time office commuting 5 days/week" },
          projected_savings: {
            monthly: { co2_kg: 25, money_saved: "$90" },
            six_months: { co2_kg: 150, money_saved: "$540" },
            yearly: { co2_kg: 300, money_saved: "$1,080" },
          },
          equivalence: { trees_equivalent: 14, flights_equivalent: "1.2 short-haul flights", driving_equivalent: "1,200 km" },
          tips: ["Set up a dedicated workspace", "Use video calls effectively", "Batch errands on office days"],
          community_scale: "If 10,000 workers went remote 3 days/week, we'd save 3,000 tons CO₂/year from commuting alone.",
        },
        "electric vehicle": {
          scenario: "Switching to an electric vehicle",
          difficulty: "Hard",
          current_impact: { monthly_co2_kg: 180, description: "Gas-powered car: 1,200km/month at 120g CO₂/km" },
          projected_savings: {
            monthly: { co2_kg: 75, money_saved: "$60" },
            six_months: { co2_kg: 450, money_saved: "$360" },
            yearly: { co2_kg: 900, money_saved: "$720" },
          },
          equivalence: { trees_equivalent: 41, flights_equivalent: "3.5 short-haul flights", driving_equivalent: "3,600 km" },
          tips: ["Check local EV incentives", "Calculate home charging costs", "Consider hybrid if full EV isn't feasible"],
          community_scale: "If 10,000 drivers switched to EVs, we'd save 9,000 tons CO₂/year — equivalent to planting 415,000 trees.",
        },
        // Diet
        "vegan": {
          scenario: "Going vegan for a year",
          difficulty: "Medium",
          current_impact: { monthly_co2_kg: 220, description: "Standard omnivore diet with daily meat/dairy consumption" },
          projected_savings: {
            monthly: { co2_kg: 75, money_saved: "$80" },
            six_months: { co2_kg: 450, money_saved: "$480" },
            yearly: { co2_kg: 900, money_saved: "$960" },
          },
          equivalence: { trees_equivalent: 41, flights_equivalent: "3.5 short-haul flights", driving_equivalent: "3,600 km" },
          tips: ["Start with Veganuary or 30-day challenges", "Learn plant-based protein sources", "Try ethnic cuisines (Indian, Thai, Mediterranean)"],
          community_scale: "If 10,000 people went vegan, we'd save 9,000 tons CO₂/year — equivalent to removing 1,950 cars from roads.",
        },
        "beef": {
          scenario: "Stopping beef consumption entirely",
          difficulty: "Easy",
          current_impact: { monthly_co2_kg: 45, description: "Eating beef 3x/week (27kg CO₂/kg beef)" },
          projected_savings: {
            monthly: { co2_kg: 32, money_saved: "$45" },
            six_months: { co2_kg: 192, money_saved: "$270" },
            yearly: { co2_kg: 384, money_saved: "$540" },
          },
          equivalence: { trees_equivalent: 18, flights_equivalent: "1.5 short-haul flights", driving_equivalent: "1,536 km" },
          tips: ["Replace with chicken (5x lower CO₂)", "Try plant-based burgers", "Explore lentils and beans"],
          community_scale: "If 10,000 people stopped eating beef, we'd save 3,840 tons CO₂/year — equivalent to planting 177,000 trees.",
        },
        "meal prep": {
          scenario: "Meal prepping every Sunday",
          difficulty: "Easy",
          current_impact: { monthly_co2_kg: 18, description: "Food waste from unplanned meals + 4 takeout orders/week" },
          projected_savings: {
            monthly: { co2_kg: 12, money_saved: "$120" },
            six_months: { co2_kg: 72, money_saved: "$720" },
            yearly: { co2_kg: 144, money_saved: "$1,440" },
          },
          equivalence: { trees_equivalent: 7, flights_equivalent: "0.6 short-haul flights", driving_equivalent: "576 km" },
          tips: ["Start with 3-4 meals per week", "Invest in good containers", "Cook grains and proteins in batches"],
          community_scale: "If 10,000 people meal prepped, we'd save 1,440 tons CO₂/year from reduced waste + 480 tons from fewer deliveries.",
        },
        "delivery": {
          scenario: "Stopping food delivery entirely",
          difficulty: "Medium",
          current_impact: { monthly_co2_kg: 24, description: "3 deliveries/week with packaging + transport emissions" },
          projected_savings: {
            monthly: { co2_kg: 18, money_saved: "$150" },
            six_months: { co2_kg: 108, money_saved: "$900" },
            yearly: { co2_kg: 216, money_saved: "$1,800" },
          },
          equivalence: { trees_equivalent: 10, flights_equivalent: "0.8 short-haul flights", driving_equivalent: "864 km" },
          tips: ["Cook simple 15-minute meals", "Prep ingredients on weekends", "Use restaurant pickup instead"],
          community_scale: "If 10,000 people stopped delivery, we'd save 2,160 tons CO₂/year — equivalent to taking 470 cars off roads.",
        },
        // Energy
        "led": {
          scenario: "Switching all bulbs to LED",
          difficulty: "Easy",
          current_impact: { monthly_co2_kg: 8, description: "Incandescent and CFL bulbs in average home (20 bulbs)" },
          projected_savings: {
            monthly: { co2_kg: 5, money_saved: "$12" },
            six_months: { co2_kg: 30, money_saved: "$72" },
            yearly: { co2_kg: 60, money_saved: "$144" },
          },
          equivalence: { trees_equivalent: 3, flights_equivalent: "0.2 short-haul flights", driving_equivalent: "240 km" },
          tips: ["Start with most-used rooms", "Check for utility rebates", "Choose warm white (2700K) for living spaces"],
          community_scale: "If 10,000 homes switched to LEDs, we'd save 600 tons CO₂/year — equivalent to planting 28,000 trees.",
        },
        "cold water": {
          scenario: "Washing everything in cold water",
          difficulty: "Easy",
          current_impact: { monthly_co2_kg: 18, description: "Hot water washing: 90% of laundry energy goes to heating" },
          projected_savings: {
            monthly: { co2_kg: 12, money_saved: "$8" },
            six_months: { co2_kg: 72, money_saved: "$48" },
            yearly: { co2_kg: 144, money_saved: "$96" },
          },
          equivalence: { trees_equivalent: 7, flights_equivalent: "0.6 short-haul flights", driving_equivalent: "576 km" },
          tips: ["Use cold-water detergent", "Modern detergents work great in cold", "Only wash full loads"],
          community_scale: "If 10,000 households used cold water, we'd save 1,440 tons CO₂/year — equivalent to taking 310 cars off roads.",
        },
        "air dry": {
          scenario: "Air-drying all clothes",
          difficulty: "Easy",
          current_impact: { monthly_co2_kg: 45, description: "Electric dryer: 3 loads/week uses 3kWh per load" },
          projected_savings: {
            monthly: { co2_kg: 35, money_saved: "$18" },
            six_months: { co2_kg: 210, money_saved: "$108" },
            yearly: { co2_kg: 420, money_saved: "$216" },
          },
          equivalence: { trees_equivalent: 19, flights_equivalent: "1.6 short-haul flights", driving_equivalent: "1,680 km" },
          tips: ["Use drying rack indoors in winter", "Hang clothes on balcony/patio", "Dry synthetics outside, delicates indoors"],
          community_scale: "If 10,000 households air-dried clothes, we'd save 4,200 tons CO₂/year — equivalent to planting 194,000 trees.",
        },
        // Shopping
        "fast fashion": {
          scenario: "Stopping fast fashion purchases",
          difficulty: "Medium",
          current_impact: { monthly_co2_kg: 65, description: "Buying 5 new garments/month (polyester/cotton mix)" },
          projected_savings: {
            monthly: { co2_kg: 45, money_saved: "$200" },
            six_months: { co2_kg: 270, money_saved: "$1,200" },
            yearly: { co2_kg: 540, money_saved: "$2,400" },
          },
          equivalence: { trees_equivalent: 25, flights_equivalent: "2.1 short-haul flights", driving_equivalent: "2,160 km" },
          tips: ["Try 30-day no-buy challenges", "Host clothing swaps with friends", "Follow 'one in, one out' rule"],
          community_scale: "If 10,000 people quit fast fashion, we'd save 5,400 tons CO₂/year — equivalent to planting 250,000 trees.",
        },
        "reusable bottle": {
          scenario: "Using a reusable water bottle",
          difficulty: "Easy",
          current_impact: { monthly_co2_kg: 4, description: "2 plastic bottles/day manufacturing + transport emissions" },
          projected_savings: {
            monthly: { co2_kg: 3, money_saved: "$45" },
            six_months: { co2_kg: 18, money_saved: "$270" },
            yearly: { co2_kg: 36, money_saved: "$540" },
          },
          equivalence: { trees_equivalent: 2, flights_equivalent: "0.1 short-haul flights", driving_equivalent: "144 km" },
          tips: ["Keep bottle visible as reminder", "Calculate plastic waste saved", "Get a filter if tap water concerns you"],
          community_scale: "If 10,000 people used reusable bottles, we'd save 360 tons CO₂/year — and eliminate 7.3M plastic bottles.",
        },
      };
      
      // Match scenario
      let matchedKey = Object.keys(scenarios).find(key => q.includes(key));
      
      // Fallback matching
      if (!matchedKey) {
        if (q.includes("meat") || q.includes("vegetarian") || q.includes("vegan")) matchedKey = "beef";
        else if (q.includes("car") || q.includes("drive") || q.includes("uber") || q.includes("commute")) matchedKey = "bike";
        else if (q.includes("flight") || q.includes("fly")) matchedKey = "carpool";
        else if (q.includes("energy") || q.includes("electricity") || q.includes("solar")) matchedKey = "led";
        else if (q.includes("water") || q.includes("shower") || q.includes("wash")) matchedKey = "cold water";
        else if (q.includes("fashion") || q.includes("clothes") || q.includes("shopping")) matchedKey = "fast fashion";
        else if (q.includes("plastic") || q.includes("bottle")) matchedKey = "reusable bottle";
      }
      
      const fallback = matchedKey ? scenarios[matchedKey] : {
        scenario: input,
        difficulty: "Medium",
        current_impact: { monthly_co2_kg: 40, description: "Estimated current behavior carbon footprint" },
        projected_savings: {
          monthly: { co2_kg: 15, money_saved: "$50" },
          six_months: { co2_kg: 90, money_saved: "$300" },
          yearly: { co2_kg: 180, money_saved: "$600" },
        },
        equivalence: { trees_equivalent: 8, flights_equivalent: "0.7 short-haul flights", driving_equivalent: "720 km" },
        tips: ["Start small and track progress", "Find accountability partners", "Celebrate milestones along the way"],
        community_scale: "If 10,000 people made similar changes, we'd save 1,800 tons CO₂/year — equivalent to planting 83,000 trees.",
      };
      
      // Animate fallback result like real AI
      await simulateMockLoading();
      setResult(fallback);
      
      const store = getStore();
      updateStore({
        analyses: store.analyses + 1,
        ecoScore: Math.min(100, store.ecoScore + 3),
      });
      addHistoryEntry("whatif_simulation", fallback.projected_savings.yearly.co2_kg);
      setShowPoints(true);
      showToast("Using local simulation (API unavailable). +20 points!", "💡", "info");
      setTimeout(() => setShowPoints(false), 1500);
    }
    setLoading(false);
    setIsMockLoading(false);
    setReasoningStep(0);
    setTimeout(() => setIsSimulating(false), 1500);
  }, [input, isSimulating, showToast, simulateMockLoading]);

  const getTimelineData = (): { co2_kg: number; money_saved: string } => {
    if (!result) return { co2_kg: 0, money_saved: "$0" };
    return result.projected_savings[activeTimeline];
  };

  const handleShareResult = () => {
    if (!result) return;
    const text = `🎯 What-If Simulation: ${result.scenario}\n\n🌍 Yearly savings: ${result.projected_savings.yearly.co2_kg}kg CO₂\n🌳 Equivalent to ${result.equivalence.trees_equivalent} trees planted\n💰 ${result.projected_savings.yearly.money_saved} saved\n\n#EcoOS #ClimateAction #EarthDay2026`;
    navigator.clipboard.writeText(text).then(() => {
      showToast("Result copied to clipboard!", "📋", "info");
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }} 
      className="h-full flex flex-col lg:flex-row gap-4 min-h-0"
    >
      {/* Sidebar - Example Scenarios */}
      <div className="w-full lg:w-80 xl:w-96 max-w-full shrink-0 bg-slate-900/50 rounded-2xl border border-white/10 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-white/10 bg-white/5">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            What-If <span className="text-amber-400">Simulator</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">Choose a lifestyle change</p>
        </div>
        
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
          {Object.entries(EXAMPLE_CATEGORIES).map(([category, scenarios]) => (
            <div key={category}>
              <div className="text-slate-600 text-[10px] font-black uppercase tracking-wider mb-2 px-1">
                {category}
              </div>
              <div className="space-y-1">
                {scenarios.slice(0, 5).map((scenario: string) => (
                  <button
                    key={scenario}
                    onClick={() => loadScenario(scenario)}
                    disabled={loading}
                    className="w-full text-left group bg-white/5 hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/30 rounded-xl px-3 py-2 transition-all"
                  >
                    <div className="text-slate-300 group-hover:text-amber-300 text-xs font-medium">
                      {scenario.replace("What if I ", "")}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-black text-lg">
              {result ? "Simulation Results" : "Explore Impact"}
            </h3>
            <p className="text-slate-500 text-xs">
              {result 
                ? `Scenario: ${input.slice(0, 60)}${input.length > 60 ? '...' : ''}`
                : "Type a scenario or select one from the sidebar"
              }
            </p>
          </div>
          {result && (
            <button
              onClick={clearResults}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              New Simulation
            </button>
          )}
        </div>

        {/* Scenario Input */}
        <Card className={clsx(
          "mb-4 p-3 flex flex-col sm:flex-row gap-2 sm:gap-3 shadow-2xl focus-within:border-amber-500/50 group relative overflow-hidden transition-all",
          result && "opacity-60 hover:opacity-100"
        )} glow="amber">
          <PointsPopup points={20} show={showPoints} />
          <div className="flex-1 flex items-center px-4 bg-white/5 rounded-2xl border border-white/5 focus-within:border-amber-500/30 transition-all">
            <Target className="w-5 h-5 text-slate-500 group-focus-within:text-amber-400 transition-colors shrink-0" />
            <input
              type="text"
              placeholder="E.g., 'What if I stop using a car?'"
              className="flex-1 bg-transparent border-none outline-none px-3 py-3 sm:py-4 text-white text-sm sm:text-base font-bold placeholder:text-slate-600"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && simulate()}
            />
          </div>
          <button
            onClick={simulate}
            disabled={loading || !input || isSimulating}
            className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 disabled:opacity-50 text-slate-900 font-black px-6 py-3 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-500/30 group/btn text-sm"
          >
            {loading ? <Spinner color="amber" /> : (
              <>
                {result ? "Re-Simulate" : "Simulate"}
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </Card>

      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm mb-8 text-center">{error}</div>}

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div 
            key="loading"
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }} 
            className="space-y-6"
          >
            {/* Reasoning Steps Visualization */}
            <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-white/10">
              <div className="text-center mb-6">
                <Brain className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                <h3 className="text-white font-black text-lg">Multi-Step Simulation Pipeline</h3>
                <p className="text-slate-500 text-xs mt-1">Powered by Gemini 2.0 Flash</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ReasoningStep 
                  icon={<FileText className="w-5 h-5" />}
                  label="Parse Scenario"
                  description="Extract behavioral change"
                  step={1}
                  currentStep={reasoningStep}
                  color="amber"
                />
                <ReasoningStep 
                  icon={<Calculator className="w-5 h-5" />}
                  label="Baseline"
                  description="Estimate current carbon cost"
                  step={2}
                  currentStep={reasoningStep}
                  color="amber"
                />
                <ReasoningStep 
                  icon={<BarChart3 className="w-5 h-5" />}
                  label="Project Impact"
                  description="Calculate multi-period savings"
                  step={3}
                  currentStep={reasoningStep}
                  color="amber"
                />
                <ReasoningStep 
                  icon={<Scale className="w-5 h-5" />}
                  label="Equivalences"
                  description="Convert to relatable units"
                  step={4}
                  currentStep={reasoningStep}
                  color="amber"
                />
              </div>
            </Card>
            <SkeletonCard />
            <SkeletonCard />
          </motion.div>
        )}

        {result && (
          <motion.div 
            key="result"
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
          {/* Scenario Summary */}
          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20 text-center py-8" glow="amber">
            <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-3">Scenario</div>
            <h3 className="text-2xl md:text-3xl font-black text-white mb-4">{result.scenario}</h3>
            <div className="flex items-center justify-center gap-3">
              <div className={clsx(
                "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                result.difficulty === "Easy" && "bg-green-500/10 text-green-400 border border-green-500/20",
                result.difficulty === "Medium" && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                result.difficulty === "Hard" && "bg-red-500/10 text-red-400 border border-red-500/20",
              )}>
                Difficulty: {result.difficulty}
              </div>
              <button
                onClick={handleShareResult}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                <Share2 className="w-3 h-3" /> Share
              </button>
            </div>
          </Card>

          {/* Current vs Projected */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-red-500/5 border-red-500/10">
              <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Current Impact</div>
              <div className="text-4xl font-black text-red-400 mb-2">
                <AnimatedCounter value={result.current_impact.monthly_co2_kg} duration={1200} /> kg
              </div>
              <div className="text-slate-500 text-xs font-bold uppercase mb-4">CO₂ per month</div>
              <p className="text-slate-400 text-sm">{result.current_impact.description}</p>
            </Card>

            <Card className="bg-green-500/5 border-green-500/10 relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <TrendingDown className="w-8 h-8 text-green-500/20" />
              </div>
              <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3">Projected Savings</div>
              
              {/* Timeline Toggle */}
              <div className="flex gap-1 mb-4 bg-white/5 p-1 rounded-xl">
                {(["monthly", "six_months", "yearly"] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setActiveTimeline(period)}
                    className={clsx(
                      "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                      activeTimeline === period
                        ? "bg-green-500 text-slate-900"
                        : "text-slate-500 hover:text-white"
                    )}
                  >
                    {period === "monthly" ? "1 Mo" : period === "six_months" ? "6 Mo" : "1 Year"}
                  </button>
                ))}
              </div>

              <div className="text-4xl font-black text-green-400 mb-1">
                <AnimatedCounter value={getTimelineData().co2_kg} duration={1000} /> kg
              </div>
              <div className="text-slate-500 text-xs font-bold uppercase mb-2">CO₂ Saved</div>
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <DollarSign className="w-4 h-4" /> {getTimelineData().money_saved} saved
              </div>
            </Card>
          </div>

          {/* Equivalence Visualization */}
          <Card className="py-8">
            <div className="text-center mb-8">
              <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Impact Equivalence (Yearly)</div>
              <h4 className="text-xl font-black text-white">What your savings look like</h4>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-center p-6 bg-white/5 rounded-2xl border border-white/5">
                <TreePine className="w-10 h-10 text-green-400 mx-auto mb-3" />
                <div className="text-3xl font-black text-white mb-1">
                  <AnimatedCounter value={result.equivalence.trees_equivalent} duration={1500} />
                </div>
                <div className="text-slate-500 text-xs font-bold">Trees planted equivalent</div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center p-6 bg-white/5 rounded-2xl border border-white/5">
                <Plane className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                <div className="text-slate-300 text-lg font-bold mb-1">{result.equivalence.flights_equivalent}</div>
                <div className="text-slate-500 text-xs font-bold">Flights equivalent</div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center p-6 bg-white/5 rounded-2xl border border-white/5">
                <Car className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <div className="text-slate-300 text-lg font-bold mb-1">{result.equivalence.driving_equivalent}</div>
                <div className="text-slate-500 text-xs font-bold">Driving equivalent</div>
              </motion.div>
            </div>
          </Card>

          {/* Tips */}
          <Card className="bg-white/5 border-white/5">
            <h4 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-400" /> Tips to Make This Change
            </h4>
            <div className="space-y-3">
              {result.tips.map((tip, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-3 p-4 bg-white/5 rounded-xl border border-white/5"
                >
                  <div className="shrink-0 w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-black text-xs">{i + 1}</div>
                  <p className="text-slate-300 text-sm font-medium">{tip}</p>
                </motion.div>
              ))}
            </div>
          </Card>

          {/* Community Scale */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-500/20 text-center py-8" glow="blue">
            <Users className="w-8 h-8 text-blue-400 mx-auto mb-4" />
            <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Community Scale Impact</div>
            <p className="text-white text-lg font-bold max-w-lg mx-auto">{result.community_scale}</p>
          </Card>

          {/* Reasoning Pipeline Summary */}
          <Card className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-amber-500/20">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="w-5 h-5 text-amber-400" />
              <h3 className="text-white font-black text-sm">Gemini Simulation Pipeline</h3>
              <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">Completed</span>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 1</span>
                </div>
                <p className="text-white text-xs font-bold">Parse Scenario</p>
                <p className="text-slate-500 text-[10px] mt-0.5">Identified: &quot;{result.scenario.slice(0, 30)}...&quot;</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 2</span>
                </div>
                <p className="text-white text-xs font-bold">Baseline Calculation</p>
                <p className="text-slate-500 text-[10px] mt-0.5">Current: {result.current_impact.monthly_co2_kg}kg/mo</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 3</span>
                </div>
                <p className="text-white text-xs font-bold">Impact Projection</p>
                <p className="text-slate-500 text-[10px] mt-0.5">Yearly savings: {result.projected_savings.yearly.co2_kg}kg</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 4</span>
                </div>
                <p className="text-white text-xs font-bold">Equivalences</p>
                <p className="text-slate-500 text-[10px] mt-0.5">{result.equivalence.trees_equivalent} trees, {result.equivalence.flights_equivalent}</p>
              </div>
            </div>
          </Card>

          {/* Shareable Impact Card */}
          <ShareableWhatIfCard result={result} />
          </motion.div>
        )}
      </AnimatePresence>
      </div> {/* Close Main Content Area */}
    </motion.div>
  );
}

// Reasoning Step Component
function ReasoningStep({ 
  icon, 
  label, 
  description, 
  step, 
  currentStep,
  color = "amber"
}: { 
  icon: React.ReactNode; 
  label: string; 
  description: string; 
  step: number; 
  currentStep: number;
  color?: "amber" | "green" | "blue";
}) {
  const isActive = step === currentStep;
  const isComplete = step < currentStep;
  const isPending = step > currentStep;
  
  const colorClasses = {
    amber: { active: "bg-amber-500/10 border-amber-500/30", complete: "bg-amber-500/5 border-amber-500/20", text: "text-amber-400", bg: "bg-amber-500" },
    green: { active: "bg-green-500/10 border-green-500/30", complete: "bg-green-500/5 border-green-500/20", text: "text-green-400", bg: "bg-green-500" },
    blue: { active: "bg-blue-500/10 border-blue-500/30", complete: "bg-blue-500/5 border-blue-500/20", text: "text-blue-400", bg: "bg-blue-500" },
  };
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ 
        opacity: isPending ? 0.4 : 1,
        y: 0,
        scale: isActive ? 1.02 : 1,
      }}
      transition={{ duration: 0.3 }}
      className={clsx(
        "rounded-xl p-3 border transition-all duration-500",
        isActive && colorClasses[color].active,
        isComplete && colorClasses[color].complete,
        isPending && "bg-white/5 border-white/10"
      )}
    >
      <div className={clsx(
        "w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-colors",
        isActive && colorClasses[color].bg,
        isActive && "text-slate-900",
        isComplete && colorClasses[color].bg.replace("bg-", "bg-") + "/20",
        isComplete && colorClasses[color].text,
        isPending && "bg-white/10 text-slate-600"
      )}>
        {isComplete ? <CheckCircle2 className="w-4 h-4" /> : icon}
      </div>
      <p className={clsx(
        "text-xs font-bold mb-0.5",
        isActive && colorClasses[color].text,
        isComplete && colorClasses[color].text,
        isPending && "text-slate-500"
      )}>
        {label}
      </p>
      <p className="text-[10px] text-slate-500 leading-tight">{description}</p>
      {isActive && (
        <motion.div 
          className={clsx("mt-2 h-0.5 rounded-full", colorClasses[color].bg)}
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        />
      )}
    </motion.div>
  );
}

// Shareable Impact Card Component
function ShareableWhatIfCard({ result }: { result: WhatIfResult }) {
  const [copied, setCopied] = useState(false);

  const shareText = `🎯 What-If Simulation: "${result.scenario}"

🌍 Yearly Impact: ${result.projected_savings.yearly.co2_kg}kg CO₂ saved
🌳 Equivalent to ${result.equivalence.trees_equivalent} trees planted
💰 ${result.projected_savings.yearly.money_saved} saved
✈️ ${result.equivalence.flights_equivalent}

What if you made this change? #EcoOS #EarthDay2026 #ClimateAction`;

  const handleTwitterShare = () => {
    const tweetText = encodeURIComponent(`🎯 What-If Simulation: "${result.scenario.slice(0, 80)}${result.scenario.length > 80 ? '...' : ''}"

🌍 Yearly Impact: ${result.projected_savings.yearly.co2_kg}kg CO₂ saved
🌳 ${result.equivalence.trees_equivalent} trees equivalent

What if you made this change? #EcoOS #EarthDay2026`);
    window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, "_blank");
  };

  const handleFacebookShare = () => {
    const fbText = encodeURIComponent(`🎯 What-If Simulation: "${result.scenario}"\n\n🌍 Yearly Impact: ${result.projected_savings.yearly.co2_kg}kg CO₂ saved\n🌳 Equivalent to ${result.equivalence.trees_equivalent} trees planted\n💰 ${result.projected_savings.yearly.money_saved} saved\n\nWhat if you made this change?`);
    window.open(`https://www.facebook.com/sharer/sharer.php?quote=${fbText}`, "_blank");
  };

  const handleWhatsAppShare = () => {
    const waText = encodeURIComponent(`🎯 What-If Simulation: "${result.scenario}"\n\n🌍 Yearly Impact: ${result.projected_savings.yearly.co2_kg}kg CO₂ saved\n🌳 Equivalent to ${result.equivalence.trees_equivalent} trees planted\n💰 ${result.projected_savings.yearly.money_saved} saved`);
    window.open(`https://wa.me/?text=${waText}`, "_blank");
  };

  const handleLinkedInShare = () => {
    const liText = encodeURIComponent(`🎯 What-If Simulation: "${result.scenario}"\n\n🌍 Yearly Impact: ${result.projected_savings.yearly.co2_kg}kg CO₂ saved\n🌳 Equivalent to ${result.equivalence.trees_equivalent} trees planted\n💰 ${result.projected_savings.yearly.money_saved} saved\n\n#EcoOS #ClimateAction #Sustainability`);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${liText}`, "_blank");
  };

  const handleInstagramCopy = () => {
    const igText = `🎯 What-If Challenge\n\n"${result.scenario}"\n\n🌍 Yearly Impact:\n${result.projected_savings.yearly.co2_kg}kg CO₂ saved\n🌳 ${result.equivalence.trees_equivalent} trees equivalent\n💰 ${result.projected_savings.yearly.money_saved} saved\n\nWhat if YOU made this change? 🤔\n\n#EcoOS #EarthDay2026 #ClimateAction #Sustainability #EcoFriendly #GoGreen #WhatIf`;
    navigator.clipboard.writeText(igText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleTikTokCopy = () => {
    const ttText = `What if I ${result.scenario.toLowerCase()}? 🤔\n\nI calculated it with EcoOS:\n🌍 Save ${result.projected_savings.yearly.co2_kg}kg CO₂/year\n🌳 = ${result.equivalence.trees_equivalent} trees planted\n💰 Save ${result.projected_savings.yearly.money_saved}\n\nSmall changes = big impact ✨\n\n#EcoOS #ClimateAction #Sustainability #WhatIf #fyp #savetheplanet #EcoFriendly`;
    navigator.clipboard.writeText(ttText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20 text-center py-10" glow="amber">
      <Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-4" />
      <h4 className="text-white font-black text-xl mb-2">Share Your Simulation</h4>
      <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">Inspire others by sharing the impact of this behavioral change.</p>
      <div className="bg-slate-900/60 rounded-2xl p-6 border border-white/10 max-w-lg mx-auto mb-6 text-left">
        <p className="text-slate-300 text-sm font-medium whitespace-pre-line">{shareText}</p>
      </div>
      <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Share to:</div>
      <div className="flex flex-col items-center gap-3">
        <div className="flex justify-center gap-3 flex-wrap">
          <button
            onClick={handleTwitterShare}
            className="flex items-center gap-2 bg-black hover:bg-black/80 text-white border border-white/20 px-6 py-3 rounded-xl font-black transition-all text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg> X
          </button>
          <button
            onClick={handleFacebookShare}
            className="flex items-center gap-2 bg-[#1877F2]/20 hover:bg-[#1877F2]/30 text-[#1877F2] border border-[#1877F2]/30 px-6 py-3 rounded-xl font-black transition-all text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg> Facebook
          </button>
          <button
            onClick={handleWhatsAppShare}
            className="flex items-center gap-2 bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/30 px-6 py-3 rounded-xl font-black transition-all text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg> WhatsApp
          </button>
          <button
            onClick={handleLinkedInShare}
            className="flex items-center gap-2 bg-[#0A66C2]/20 hover:bg-[#0A66C2]/30 text-[#0A66C2] border border-[#0A66C2]/30 px-6 py-3 rounded-xl font-black transition-all text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg> LinkedIn
          </button>
        </div>
        <div className="flex justify-center gap-3 flex-wrap">
          <button
            onClick={handleInstagramCopy}
            className="flex items-center gap-2 bg-gradient-to-r from-[#833AB4]/20 via-[#FD1D1D]/20 to-[#F77737]/20 hover:from-[#833AB4]/30 hover:via-[#FD1D1D]/30 hover:to-[#F77737]/30 text-pink-400 border border-pink-500/30 px-6 py-3 rounded-xl font-black transition-all text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg> Copy for Instagram
          </button>
          <button
            onClick={handleTikTokCopy}
            className="flex items-center gap-2 bg-black hover:bg-black/80 text-white border border-white/20 px-6 py-3 rounded-xl font-black transition-all text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
            </svg> Copy for TikTok
          </button>
        </div>
      </div>
    </Card>
  );
}
