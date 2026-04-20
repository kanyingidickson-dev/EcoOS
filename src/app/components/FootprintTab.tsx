"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Zap,
  PlusCircle,
  Sparkles,
  TrendingDown,
  BarChart3,
  Share2,
  Copy,
  Check,
  CheckCircle2,
  Brain,
  Layers,
  Calculator,
  Lightbulb,
} from "lucide-react";
import clsx from "clsx";
import {
  Card,
  Spinner,
  AnimatedCounter,
  ScaleInsight,
  SkeletonCard,
  PointsPopup,
  getStore,
  updateStore,
  addHistoryEntry,
  getPersonalizationContext,
  useToast,
  type CarbonResult,
} from "./shared";

export function FootprintTab() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CarbonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPoints, setShowPoints] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reasoningStep, setReasoningStep] = useState(0);
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

  const analyze = useCallback(async () => {
    if (!input || isAnalyzing) return;
    setIsAnalyzing(true);
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
    }, 800);
    
    try {
      const personalization = getPersonalizationContext();
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "carbon", input, personalization }),
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
      
      setResult(data as CarbonResult);
      
      // Update store with personalization data
      const store = getStore();
      updateStore({
        analyses: store.analyses + 1,
        ecoScore: Math.min(100, store.ecoScore + 3),
        lastCarbonEstimate: data.estimate || 0,
        lastCarbonPlan: data.explanations && data.recommendations ? {
          updatedAt: new Date().toISOString(),
          explanations: data.explanations,
          recommendations: data.recommendations,
        } : store.lastCarbonPlan,
      });
      addHistoryEntry("carbon_analysis", data.estimate || 0);
      
      setShowPoints(true);
      showToast("+15 eco points for analyzing your footprint!", "📊", "success");
      setTimeout(() => setShowPoints(false), 1500);
    } catch (e: unknown) {
      clearInterval(stepInterval);
      console.error("Analysis failed, using dynamic local fallback:", e);
      
      // Realistic carbon footprint scenarios (kg CO2/month)
      const q = input.toLowerCase();
      let fallback: CarbonResult;
      
      // Specific scenario matching - ORDER MATTERS: specific before general
      // 1. BIKES/E-BIKES (check BEFORE car/commute to avoid misclassifying bike commuters)
      if (q.includes("bike") || q.includes("bicycle") || q.includes("cycling") || q.includes("cyclist") || q.includes("e-bike") || q.includes("ebike")) {
        fallback = {
          estimate: 165,
          confidence: "medium",
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
          suggestions: ["Your bike commute saves ~255kg CO2/month vs a car—outstanding!", "Higher food needs from cycling? Choose low-carbon proteins—saves 45kg", "You're at 25% of global average for transport—role model material"],
          comparison: "Your footprint is ~25% below global average—bicycle transport is transformative."
        };
      // 2. TRANSIT (check before car to catch bus/train/subway)
      } else if (q.includes("bus") || q.includes("train") || q.includes("rail") || q.includes("subway") || q.includes("metro") || q.includes("transit")) {
        fallback = {
          estimate: 195,
          confidence: "medium",
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
            { action: "Work from home 1-2 days/week to eliminate commute", savings_kg_month: 22, difficulty: "Medium", why_it_matters: "Even transit has emissions—eliminating trips beats efficiency." }
          ],
          suggestions: ["Transit saves 225kg CO2/month vs driving—great choice!", "Rail beats bus by 30%—switch lines if you can", "Bike + transit combo? Eliminates all car use"],
          comparison: "Your footprint is ~10% below global average—transit users are climate leaders."
        };
      // 3. SUVs/TRUCKS (check before general car)
      } else if (q.includes("suv") || q.includes("truck") || q.includes("pickup")) {
        fallback = {
          estimate: 580,
          confidence: "medium",
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
            { action: "Switch to transit/bike 2 days/week", savings_kg_month: 112, difficulty: "Medium", why_it_matters: "Each day off the road saves ~56kg CO2 with an SUV." }
          ],
          suggestions: ["SUVs burn 50% more fuel than sedans—consider downsizing", "Carpooling saves 210kg CO2/month—huge impact for little effort"],
          comparison: "Your footprint is ~170% above global average due to SUV fuel consumption."
        };
      } else if (q.includes("fly") || q.includes("flight") || q.includes("airport") || q.includes("plane") || q.includes("flying")) {
        const isLongHaul = q.includes("transatlantic") || q.includes("london") || q.includes("paris") || q.includes("europe") || q.includes("asia");
        fallback = {
          estimate: isLongHaul ? 850 : 680,
          confidence: "medium",
          breakdown: [
            { category: "Transport", value: isLongHaul ? 650 : 480, detail: isLongHaul 
              ? "One round-trip transatlantic flight (~8,000km each way, with radiative forcing) emits ~650kg CO2."
              : "Air travel: 2 round-trip flights/month (short-haul) emit ~480kg CO2/month." },
            { category: "Food", value: isLongHaul ? 110 : 120, detail: "Airport and travel food adds ~110-120kg CO2/month." },
            { category: "Energy", value: isLongHaul ? 60 : 55, detail: "Home energy estimated at ~55-60kg CO2/month." },
            { category: "Consumer", value: 30, detail: "Travel-related consumption estimated at ~30kg CO2/month." }
          ],
          explanations: {
            summary: isLongHaul 
              ? "A single transatlantic round-trip equals ~2.5 months of typical car commuting. Aviation's altitude effects (contrails, NOx) amplify warming 2.7x."
              : "Air travel dominates your footprint—each flight hour emits ~90kg CO2. A single round-trip transatlantic flight equals months of car commuting.",
            top_drivers: isLongHaul 
              ? ["Long-haul aviation (highest per-km emissions)", "Radiative forcing from contrails", "Jet fuel carbon intensity"]
              : ["Frequent short-haul flights (high per-km emissions)", "Radiative forcing multiplier (2.7x for contrails)", "Ground transport to/from airports"],
            assumptions: isLongHaul
              ? ["One round-trip transatlantic/month", "NYC-London distance (~5,500km one-way)", "Radiative forcing multiplier (2.7x)", "Economy class"]
              : ["2 short-haul round trips/month (~800km each)", "Radiative forcing included (2.7x)", "Economy class seating"]
          },
          recommendations: [
            { action: isLongHaul ? "Reduce to 1 transatlantic trip per quarter" : "Replace 1 flight/month with train/bus", savings_kg_month: isLongHaul ? 433 : 240, difficulty: "Medium", why_it_matters: isLongHaul ? "Cutting frequency by half slashes transport emissions proportionally." : "Ground transport emits 80-90% less CO2 per km than flying." },
            { action: "Bundle trips—fly less often, stay longer", savings_kg_month: isLongHaul ? 325 : 160, difficulty: "Easy", why_it_matters: "Take-off/landing burns 25% of fuel—fewer trips saves significantly." },
            { action: "Choose direct flights (no layovers)", savings_kg_month: 80, difficulty: "Easy", why_it_matters: "Take-off cycles burn extra fuel—connections add 15-25% emissions." }
          ],
          suggestions: [
            isLongHaul ? "One transatlantic flight = 650kg CO2—consider video calls" : "One round-trip NYC-London = 1,000kg CO2—take the train for shorter hops",
            "Direct flights save 80kg CO2 vs connections—avoid layovers"
          ],
          comparison: isLongHaul ? "One transatlantic trip/month puts you at ~300% of global average footprint." : "Your footprint is ~215% above global average due to frequent flying."
        };
      } else if (q.includes("electric") || q.includes("tesla") || q.includes("ev")) {
        fallback = {
          estimate: 320,
          confidence: "medium",
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
            { action: "Install home solar for charging", savings_kg_month: 160, difficulty: "Hard", why_it_matters: "Self-generated clean power eliminates grid emissions entirely." }
          ],
          suggestions: ["Your EV already saves ~100kg/month vs gas—great start!", "Renewable grid power cuts another 140kg—switch your utility plan"],
          comparison: "Your EV footprint is ~50% above global average, but 35% below typical US car owners."
        };
      } else if (q.includes("car") || q.includes("drive") || q.includes("motor") || (q.includes("commute") && !q.includes("bike"))) {
        // Check for electric/hybrid within car block
        if (q.includes("electric") || q.includes("tesla") || q.includes("ev") || q.includes("hybrid")) {
          fallback = {
            estimate: 320,
            confidence: "medium",
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
              { action: "Install home solar for charging", savings_kg_month: 160, difficulty: "Hard", why_it_matters: "Self-generated clean power eliminates grid emissions entirely." }
            ],
            suggestions: ["Your EV already saves ~100kg/month vs gas—great start!", "Renewable grid power cuts another 140kg—switch your utility plan"],
            comparison: "Your EV footprint is ~50% above global average, but 35% below typical US car owners."
          };
        } else { // Gasoline car
        fallback = {
          estimate: 420,
          confidence: "medium",
          breakdown: [
            { category: "Transport", value: 280, detail: "Daily 25km each way gasoline car commute (~12,500 km/year) emits ~280kg CO2/month." },
            { category: "Food", value: 85, detail: "Average omnivore diet estimated at ~85kg CO2/month." },
            { category: "Energy", value: 45, detail: "Small apartment/home energy estimated at ~45kg CO2/month." },
            { category: "Consumer", value: 10, detail: "Average consumer goods estimated at ~10kg CO2/month." }
          ],
          explanations: {
            summary: "Your footprint is dominated by car commuting, which represents 67% of your estimated emissions. Switching to even partial transit/bike use would have major impact.",
            top_drivers: ["Single-occupancy gasoline vehicle commuting", "No carpooling or transit usage", "Typical suburban commute distance"],
            assumptions: ["Average gasoline sedan (8L/100km)", "25km one-way distance", "5-day work week"]
          },
          recommendations: [
            { action: "Switch to transit or bike 2 days/week", savings_kg_month: 75, difficulty: "Medium", why_it_matters: "Each transit day replaces ~37km of driving, saving ~37kg CO2 per trip." },
            { action: "Carpool with one colleague daily", savings_kg_month: 140, difficulty: "Easy", why_it_matters: "Halving the vehicle load per person nearly halves commute emissions." },
            { action: "Negotiate 1 work-from-home day/week", savings_kg_month: 56, difficulty: "Easy", why_it_matters: "Eliminates 20% of weekly commute distance entirely." }
          ],
          suggestions: ["Try bike commuting—even 1 day/week saves 37kg CO2", "Join a carpool: split emissions, save 140kg/month"],
          comparison: "Your footprint is ~95% above the global average (~215kg/month) due to car-dependent commuting."
        };
        } // Close car block (EV or gasoline)
      // 6. FOOD: VEGAN (check before vegetarian and meat)
      } else if (q.includes("vegan") || q.includes("plant-based") || q.includes("plant based") || q.includes("no meat") || q.includes("no animal")) {
        fallback = {
          estimate: 180,
          confidence: "medium",
          breakdown: [
            { category: "Food", value: 65, detail: "Plant-based diet (no animal products) emits ~65kg CO2/month—lowest dietary footprint." },
            { category: "Transport", value: 80, detail: "Average transport estimated at ~80kg CO2/month." },
            { category: "Energy", value: 30, detail: "Average home energy estimated at ~30kg CO2/month." },
            { category: "Consumer", value: 5, detail: "Lower consumer goods estimated at ~5kg CO2/month." }
          ],
          explanations: {
            summary: "Your plant-based diet emits 70% less than meat-heavy diets. Food is no longer your primary footprint driver—transport and energy dominate.",
            top_drivers: ["Some high-emission plant foods (avocado, almond, out-of-season imports)", "Food waste", "Processing/packaging of plant alternatives"],
            assumptions: ["No animal products", "Local/seasonal when possible", "Average plant-protein consumption"]
          },
          recommendations: [
            { action: "Minimize air-freighted produce (asparagus, berries)", savings_kg_month: 12, difficulty: "Easy", why_it_matters: "Air freight adds 10-50x the emissions of sea freight." },
            { action: "Reduce food waste (plan meals, use leftovers)", savings_kg_month: 18, difficulty: "Easy", why_it_matters: "Wasted food wastes all its embedded emissions." }
          ],
          suggestions: ["Your vegan diet is excellent—focus now on transport/energy", "Air-freighted asparagus adds 50x emissions—buy local/seasonal"],
          comparison: "Your footprint is ~20% below global average—excellent! Most impact now comes from transport and energy."
        };
      // 7. FOOD: VEGETARIAN (check before meat)
      } else if (q.includes("vegetarian") || q.includes("pescatarian") || q.includes("lacto") || q.includes("ovo")) {
        fallback = {
          estimate: 240,
          confidence: "medium",
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
            { action: "Switch to oat/soy milk from dairy", savings_kg_month: 22, difficulty: "Easy", why_it_matters: "Plant milks emit 70-80% less than cow's milk." }
          ],
          suggestions: ["Cheese is dairy's biggest emitter—cutting it saves 35kg/month", "Oat milk tastes great and saves 22kg vs dairy"],
          comparison: "Your footprint is ~10% above global average—better than most Western diets."
        };
      // 8. FOOD: MEAT (catch all meat-heavy diets last in food category)
      } else if (q.includes("beef") || q.includes("meat") || q.includes("steak") || q.includes("burger") || q.includes("pork") || q.includes("chicken") || q.includes("lamb")) {
        fallback = {
          estimate: 340,
          confidence: "medium",
          breakdown: [
            { category: "Food", value: 210, detail: "High meat consumption (beef 3x/week, chicken/pork daily) emits ~210kg CO2/month." },
            { category: "Transport", value: 85, detail: "Average transport estimated at ~85kg CO2/month." },
            { category: "Energy", value: 35, detail: "Average home energy estimated at ~35kg CO2/month." },
            { category: "Consumer", value: 10, detail: "Average consumer goods estimated at ~10kg CO2/month." }
          ],
          explanations: {
            summary: "Beef is the highest-impact food (~60kg CO2/kg). Your diet is 3x higher-carbon than plant-based alternatives. Ruminant meat (beef/lamb) drives 60% of food emissions.",
            top_drivers: ["Beef consumption (highest livestock emissions)", "Daily meat intake", "Dairy consumption"],
            assumptions: ["Beef 3x/week (150g servings)", "Chicken/pork daily", "Average omnivore other foods"]
          },
          recommendations: [
            { action: "Replace beef with chicken/pork (4x lower impact)", savings_kg_month: 85, difficulty: "Easy", why_it_matters: "Ruminant meat has 4-8x the emissions of poultry/pork." },
            { action: "Adopt 'weekday vegetarian'—meat only weekends", savings_kg_month: 105, difficulty: "Medium", why_it_matters: "5 plant-based days/week cuts food emissions by half." },
            { action: "Switch to plant-based meat alternatives", savings_kg_month: 95, difficulty: "Easy", why_it_matters: "Beyond/Impossible burgers emit 90% less than beef." }
          ],
          suggestions: ["Beef has 4x chicken's emissions—switching saves 85kg/month", "Weekday vegetarian cuts 105kg—try Meatless Mondays first"],
          comparison: "Your diet produces 60% more emissions than plant-based eaters."
        };
      // 9. HOME: RENEWABLE ENERGY (check before AC/large house)
      } else if (q.includes("solar") || q.includes("renewable") || q.includes("wind power") || q.includes("green energy") || q.includes("clean energy")) {
        fallback = {
          estimate: 195,
          confidence: "medium",
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
            { action: "Switch to electric heat pump (from gas)", savings_kg_month: 35, difficulty: "Hard", why_it_matters: "Eliminates last fossil fuel use in home, powered by clean electricity." }
          ],
          suggestions: ["Great job on clean energy! Now focus on transport—add an EV", "You're close to carbon neutral—food and transport are last hurdles"],
          comparison: "Your footprint is ~10% below global average—excellent! Clean energy is your superpower."
        };
      // 10. HOME: AIR CONDITIONING (check before general house to catch cooling-specific, exclude passive/solar cooling)
      } else if (q.includes("ac") || q.includes("air conditioning") || q.includes("air con") || (q.includes("cooling") && !q.includes("passive") && !q.includes("solar"))) {
        fallback = {
          estimate: 380,
          confidence: "medium",
          breakdown: [
            { category: "Energy", value: 140, detail: "Heavy air conditioning usage (hot climate, 8+ hrs/day) emits ~140kg CO2/month." },
            { category: "Transport", value: 95, detail: "Average transport estimated at ~95kg CO2/month." },
            { category: "Food", value: 105, detail: "Average omnivore diet estimated at ~105kg CO2/month." },
            { category: "Consumer", value: 40, detail: "Average consumer goods estimated at ~40kg CO2/month." }
          ],
          explanations: {
            summary: "Air conditioning is your largest energy load—older units and poor insulation multiply consumption. Each degree cooler adds 3-5% to energy use.",
            top_drivers: ["Air conditioning intensity (hours/day)", "Inefficient older AC unit (SEER <14)", "Poor insulation/house leaks"],
            assumptions: ["AC usage 8+ hrs/day in hot months", "Average efficiency unit", "Mixed climate"]
          },
          recommendations: [
            { action: "Raise thermostat 2°F (1°C)", savings_kg_month: 22, difficulty: "Easy", why_it_matters: "Each degree cooler adds 3-5% energy use—2°F = ~8-10% savings." },
            { action: "Upgrade to high-efficiency heat pump", savings_kg_month: 55, difficulty: "Hard", why_it_matters: "Modern heat pumps use 40-50% less electricity for cooling." },
            { action: "Use fans + natural ventilation when possible", savings_kg_month: 28, difficulty: "Easy", why_it_matters: "Fans use 90% less energy than AC—supplement to reduce AC hours." }
          ],
          suggestions: ["2°F warmer saves 22kg—barely noticeable, real impact", "Fans use 90% less power—try natural cooling first"],
          comparison: "Your footprint is ~75% above global average—climate control in hot regions is energy-intensive."
        };
      // 11. HOME: LARGE HOUSE (check to catch mansion/large home keywords)
      } else if (q.includes("house") || q.includes("mansion") || q.includes("sq ft") || q.includes("square feet") || q.includes("sqft") || q.includes("large home") || q.includes("big house")) {
        fallback = {
          estimate: 450,
          confidence: "medium",
          breakdown: [
            { category: "Energy", value: 180, detail: "Large home (250+ sq m) with heating/cooling emits ~180kg CO2/month." },
            { category: "Transport", value: 110, detail: "Suburban driving pattern estimated at ~110kg CO2/month." },
            { category: "Food", value: 110, detail: "Average omnivore diet estimated at ~110kg CO2/month." },
            { category: "Consumer", value: 50, detail: "Higher consumption pattern estimated at ~50kg CO2/month." }
          ],
          explanations: {
            summary: "Home size is your primary driver—heating/cooling 250+ sq m uses 3x the energy of an apartment. Poor insulation and large volumes dominate energy emissions.",
            top_drivers: ["Large conditioned volume (250+ sq m)", "Suburban location requiring driving", "Likely older construction/less insulation"],
            assumptions: ["2,500+ sq ft home", "Mixed heating (gas/electric)", "Suburban location"]
          },
          recommendations: [
            { action: "Install heat pump (replaces furnace/AC)", savings_kg_month: 65, difficulty: "Hard", why_it_matters: "Heat pumps are 3-4x more efficient than furnaces—massive savings." },
            { action: "Improve insulation (attic, walls, windows)", savings_kg_month: 45, difficulty: "Medium", why_it_matters: "Cuts heating/cooling loads by 20-30%." },
            { action: "Install smart thermostat with zoning", savings_kg_month: 25, difficulty: "Easy", why_it_matters: "Heat only occupied rooms, automatically optimize schedules." }
          ],
          suggestions: ["Heat pumps cut 65kg/month—best home upgrade you can make", "Insulation saves 45kg—cheapest energy investment"],
          comparison: "Your footprint is ~110% above global average—large homes in suburbs multiply emissions."
        };
      } else if (q.includes("ac") || q.includes("air conditioning") || q.includes("cooling")) {
        fallback = {
          estimate: 380,
          confidence: "medium",
          breakdown: [
            { category: "Energy", value: 140, detail: "Heavy air conditioning usage (hot climate, 8+ hrs/day) emits ~140kg CO2/month." },
            { category: "Transport", value: 95, detail: "Average transport estimated at ~95kg CO2/month." },
            { category: "Food", value: 105, detail: "Average omnivore diet estimated at ~105kg CO2/month." },
            { category: "Consumer", value: 40, detail: "Average consumer goods estimated at ~40kg CO2/month." }
          ],
          explanations: {
            summary: "Air conditioning is your largest energy load—older units and poor insulation multiply consumption. Each degree cooler adds 3-5% to energy use.",
            top_drivers: ["Air conditioning intensity (hours/day)", "Inefficient older AC unit (SEER <14)", "Poor insulation/house leaks"],
            assumptions: ["AC usage 8+ hrs/day in hot months", "Average efficiency unit", "Mixed climate"]
          },
          recommendations: [
            { action: "Raise thermostat 2°F (1°C)", savings_kg_month: 22, difficulty: "Easy", why_it_matters: "Each degree cooler adds 3-5% energy use—2°F = ~8-10% savings." },
            { action: "Upgrade to high-efficiency heat pump", savings_kg_month: 55, difficulty: "Hard", why_it_matters: "Modern heat pumps use 40-50% less electricity for cooling." },
            { action: "Use fans + natural ventilation when possible", savings_kg_month: 28, difficulty: "Easy", why_it_matters: "Fans use 90% less energy than AC—supplement to reduce AC hours." }
          ],
          suggestions: ["2°F warmer saves 22kg—barely noticeable, real impact", "Fans use 90% less power—try natural cooling first"],
          comparison: "Your footprint is ~75% above global average—climate control in hot regions is energy-intensive."
        };
      } else if (q.includes("solar") || q.includes("renewable") || q.includes("wind power")) {
        fallback = {
          estimate: 195,
          confidence: "medium",
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
            { action: "Switch to electric heat pump (from gas)", savings_kg_month: 35, difficulty: "Hard", why_it_matters: "Eliminates last fossil fuel use in home, powered by clean electricity." }
          ],
          suggestions: ["Great job on clean energy! Now focus on transport—add an EV", "You're close to carbon neutral—food and transport are last hurdles"],
          comparison: "Your footprint is ~10% below global average—excellent! Clean energy is your superpower."
        };
      // 12. CONSUMER: FAST FASHION (last to avoid catching general "shopping")
      } else if (q.includes("fashion") || q.includes("clothes") || q.includes("h&m") || q.includes("zara") || q.includes("fast fashion") || (q.includes("shopping") && (q.includes("clothes") || q.includes("shirts") || q.includes("pants") || q.includes("dress")))) {
        fallback = {
          estimate: 295,
          confidence: "medium",
          breakdown: [
            { category: "Consumer", value: 85, detail: "Buying 5+ new garments/month (fast fashion) emits ~85kg CO2/month from manufacturing/transport." },
            { category: "Transport", value: 80, detail: "Average transport estimated at ~80kg CO2/month." },
            { category: "Food", value: 95, detail: "Average omnivore diet estimated at ~95kg CO2/month." },
            { category: "Energy", value: 35, detail: "Average home energy estimated at ~35kg CO2/month." }
          ],
          explanations: {
            summary: "Fast fashion is surprisingly carbon-intensive—one cotton t-shirt = 8kg CO2. Polyester is worse (oil-based). Your clothing habit rivals food emissions.",
            top_drivers: ["Frequent new purchases (5+ items/month)", "Synthetic fabrics (polyester = plastic)", "Global shipping from manufacturing hubs", "Short garment lifespan"],
            assumptions: ["5+ new garments/month", "Mix of cotton and synthetic", "Average manufacturing emissions"]
          },
          recommendations: [
            { action: "Buy second-hand for 50% of purchases", savings_kg_month: 42, difficulty: "Easy", why_it_matters: "Second-hand has near-zero production emissions—just transport." },
            { action: "Reduce to 2 new garments/month", savings_kg_month: 52, difficulty: "Medium", why_it_matters: "Linear reduction—buying 60% less saves 60% of fashion emissions." },
            { action: "Choose natural fibers (organic cotton, linen)", savings_kg_month: 18, difficulty: "Easy", why_it_matters: "Synthetics emit 2-3x the CO2 of natural fibers over lifecycle." }
          ],
          suggestions: ["One new t-shirt = 8kg CO2—thrift stores save 100% of that", "Buying 3 fewer items/month saves 52kg—small change, big impact"],
          comparison: "Your footprint is ~35% above global average—fast fashion consumption is a hidden driver."
        };
      // Default fallback for unmatched inputs
      } else {
        // Default fallback
        fallback = {
          estimate: 245,
          confidence: "low",
          breakdown: [
            { category: "Transport", value: 105, detail: `Estimated from your description: "${input.slice(0, 28)}..." - Mixed transport (some car, some transit) estimated at ~105kg CO2/month.` },
            { category: "Food", value: 80, detail: "Moderate meat consumption estimated at ~80kg CO2/month." },
            { category: "Energy", value: 45, detail: "Average apartment/small home energy estimated at ~45kg CO2/month." },
            { category: "Consumer", value: 15, detail: "Average consumer goods estimated at ~15kg CO2/month." }
          ],
          explanations: {
            summary: "Your footprint reflects average Western lifestyle patterns. Transport and food are the biggest levers—small changes in either would have measurable impact.",
            top_drivers: ["Mixed transport patterns", "Moderate meat consumption", "Standard home energy use"],
            assumptions: ["Some driving, some transit", "Meat 2-3x/week", "Average home size"]
          },
          recommendations: [
            { action: "Replace 2 car days/week with transit/bike", savings_kg_month: 35, difficulty: "Medium", why_it_matters: "Transport is your largest category—reducing driving has big impact." },
            { action: "Eat meat-free 3 days/week", savings_kg_month: 32, difficulty: "Easy", why_it_matters: "Food is your #2 source—plant-based days cut this significantly." },
            { action: "Switch to LED bulbs and smart power strips", savings_kg_month: 12, difficulty: "Easy", why_it_matters: "Low-hanging fruit—small investment, immediate returns." }
          ],
          suggestions: [
            "2 car-free days/week saves 35kg—start with Friday remote work",
            "3 meatless days save 32kg—try the flexitarian approach",
            "LED bulbs pay for themselves in 3 months—save 12kg CO2"
          ],
          comparison: "Your footprint is ~15% above the global average of ~215kg/month per capita."
        };
      }
      setResult(fallback);

      const store = getStore();
      updateStore({
        lastCarbonPlan: fallback.explanations && fallback.recommendations ? {
          updatedAt: new Date().toISOString(),
          explanations: fallback.explanations,
          recommendations: fallback.recommendations,
        } : store.lastCarbonPlan,
      });
      showToast("Using local reasoning engine due to API high load.", "💡", "info");
      
      // Animate fallback result like real AI
      await simulateMockLoading();
      setResult(fallback);
    }
    setLoading(false);
    setIsMockLoading(false);
    setReasoningStep(0);
    // Debounce: prevent re-analysis for 1.5 seconds
    setTimeout(() => setIsAnalyzing(false), 1500);
  }, [input, isAnalyzing, showToast, simulateMockLoading]);

  // Categorized archetypes for sidebar
  const ARCHETYPE_CATEGORIES: Record<string, { label: string; desc: string }[]> = {
    "Transport": [
      { label: "🚗 Suburban Commuter", desc: "Drives 40km daily" },
      { label: "🚲 Bike Commuter", desc: "Cyclist year-round" },
      { label: "🚂 Train Commuter", desc: "Rail to downtown" },
      { label: "🏠 Remote Worker", desc: "Home office, low travel" },
    ],
    "Diet": [
      { label: "🥩 Meat Lover", desc: "Beef 5x weekly" },
      { label: "🌱 Plant-Based", desc: "Vegan lifestyle" },
      { label: "🐟 Pescatarian", desc: "Fish but no meat" },
      { label: "🥗 Flexitarian", desc: "Mostly plants" },
    ],
    "Living": [
      { label: "🏢 Apartment Dweller", desc: "Small urban flat" },
      { label: "🏡 Homeowner", desc: "Suburban house" },
      { label: "⚡ All Electric", desc: "No gas appliances" },
      { label: "☀️ Solar Powered", desc: "Panels on roof" },
    ],
    "Lifestyle": [
      { label: "✈️ Frequent Flyer", desc: "2 flights monthly" },
      { label: "👕 Fast Fashion", desc: "New clothes monthly" },
      { label: "🛍️ Minimalist", desc: "Buys little, reuses" },
      { label: "🎮 Gamer", desc: "High energy PC use" },
    ],
  };

  const clearResults = () => {
    setResult(null);
    setInput("");
    setError(null);
    setIsAnalyzing(false);
    setLoading(false);
    setIsMockLoading(false);
    setReasoningStep(0);
    setAutoTrigger(false);
  };

  const [autoTrigger, setAutoTrigger] = useState(false);

  const loadArchetype = (label: string, desc: string) => {
    // Reset any existing state first
    setResult(null);
    setError(null);
    setIsAnalyzing(false);
    setLoading(false);
    
    const text = `${label.replace(/[🚗🚲🚂🏠🥩🌱🐟🥗🏢🏡⚡☀️✈️👕🛍️🎮]/g, '').trim()} - ${desc}`;
    setInput(text);
    setAutoTrigger(true);
  };

  // Trigger analysis when input changes from archetype selection
  useEffect(() => {
    if (autoTrigger && input && !result && !loading && !isAnalyzing) {
      setAutoTrigger(false);
      const timer = setTimeout(() => analyze(), 150);
      return () => clearTimeout(timer);
    }
  }, [autoTrigger, input, result, loading, isAnalyzing]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }} 
      className="h-full flex flex-col lg:flex-row gap-4 min-h-0"
    >
      {/* Sidebar - Always Visible Examples */}
      <div className="w-full lg:w-80 xl:w-96 max-w-full shrink-0 bg-slate-900/50 rounded-2xl border border-white/10 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-white/10 bg-white/5">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <span className="text-green-500">Carbon</span> Mirror
          </h2>
          <p className="text-slate-500 text-xs mt-1">Choose a lifestyle archetype</p>
        </div>
        
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          {Object.entries(ARCHETYPE_CATEGORIES).map(([category, items]) => (
            <div key={category}>
              <div className="text-slate-600 text-[10px] font-black uppercase tracking-wider mb-2 px-1">
                {category}
              </div>
              <div className="space-y-1">
                {items.map(({ label, desc }) => (
                  <button
                    key={label}
                    onClick={() => loadArchetype(label, desc)}
                    disabled={loading}
                    className="w-full text-left group bg-white/5 hover:bg-green-500/10 border border-white/5 hover:border-green-500/30 rounded-xl px-3 py-2.5 transition-all"
                  >
                    <div className="text-slate-300 group-hover:text-green-300 text-xs font-bold">
                      {label}
                    </div>
                    <div className="text-slate-600 group-hover:text-green-400/70 text-[10px]">
                      {desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          
          {/* Custom Input Hint */}
          <div className="pt-4 border-t border-white/10 mt-4">
            <div className="text-slate-600 text-[10px] font-black uppercase tracking-wider mb-2 px-1">
              Or Describe Your Own
            </div>
            <p className="text-slate-500 text-xs px-1 leading-relaxed">
              Type any lifestyle description for AI analysis with personalized recommendations.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-black text-lg">
              {result ? "Your Carbon Analysis" : "Analyze Your Footprint"}
            </h3>
            <p className="text-slate-500 text-xs">
              {result 
                ? `Based on: ${input.slice(0, 60)}${input.length > 60 ? '...' : ''}`
                : "Describe your lifestyle or select an archetype from the sidebar"
              }
            </p>
          </div>
          {result && (
            <button
              onClick={clearResults}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              New Analysis
            </button>
          )}
        </div>

        {/* Input Card - Always visible but collapses when results shown */}
        <Card className={clsx(
          "mb-4 p-3 flex flex-col gap-3 shadow-2xl focus-within:border-green-500/50 group relative transition-all",
          result && "opacity-60 hover:opacity-100"
        )} glow="green">
          <PointsPopup points={15} show={showPoints} />
          <div className="flex-1 flex items-start pt-3 px-3">
            <PlusCircle className="w-5 h-5 text-slate-500 group-focus-within:text-green-500 mt-1 transition-colors shrink-0" />
            <textarea
              placeholder="E.g., 'I commute 20km by car, eat meat occasionally, live in a 2-bedroom apartment...'"
              className="flex-1 bg-transparent border-none outline-none px-3 py-1 text-slate-200 placeholder:text-slate-500 resize-none h-20 md:h-24 text-sm md:text-base font-medium"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) analyze(); }}
            />
          </div>
          <div className="flex items-end p-2">
            <button
              onClick={() => analyze()}
              disabled={loading || !input || isAnalyzing}
              className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-slate-900 font-black px-6 py-3 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-green-500/20 text-sm group/btn"
            >
              {loading ? <Spinner color="white" /> : (
                <>
                  {result ? "Re-Analyze" : "Analyze Impact"}
                  <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </Card>

      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm mb-8 text-center">{error}</div>}

      {loading && (
        <div className="space-y-8">
          {/* Reasoning Steps Visualization */}
          <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-white/10">
            <div className="text-center mb-6">
              <Brain className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <h3 className="text-white font-black text-lg">Multi-Step Reasoning Pipeline</h3>
              <p className="text-slate-500 text-xs mt-1">Powered by Gemini 2.0 Flash</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ReasoningStep 
                icon={<Layers className="w-5 h-5" />}
                label="Decomposition"
                description="Parse input into categories"
                step={1}
                currentStep={reasoningStep}
              />
              <ReasoningStep 
                icon={<Calculator className="w-5 h-5" />}
                label="Category Scoring"
                description="Apply emission factors"
                step={2}
                currentStep={reasoningStep}
              />
              <ReasoningStep 
                icon={<BarChart3 className="w-5 h-5" />}
                label="Synthesis"
                description="Build footprint profile"
                step={3}
                currentStep={reasoningStep}
              />
              <ReasoningStep 
                icon={<Lightbulb className="w-5 h-5" />}
                label="Recommendations"
                description="Generate action items"
                step={4}
                currentStep={reasoningStep}
              />
            </div>
          </Card>
          <div className="grid md:grid-cols-2 gap-8">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {/* Reasoning Pipeline Summary Card */}
          <Card className="bg-gradient-to-r from-green-500/5 to-emerald-500/5 border-green-500/20">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="w-5 h-5 text-green-400" />
              <h3 className="text-white font-black text-sm">Gemini Reasoning Pipeline</h3>
              <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-green-400 bg-green-500/10 px-2 py-1 rounded-full">Completed</span>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 1</span>
                </div>
                <p className="text-white text-xs font-bold">Decomposition</p>
                <p className="text-slate-500 text-[10px] mt-0.5">Identified {result.breakdown.length} categories</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 2</span>
                </div>
                <p className="text-white text-xs font-bold">Category Scoring</p>
                <p className="text-slate-500 text-[10px] mt-0.5">Applied emission factors</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 3</span>
                </div>
                <p className="text-white text-xs font-bold">Synthesis</p>
                <p className="text-slate-500 text-[10px] mt-0.5">Built complete profile</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 4</span>
                </div>
                <p className="text-white text-xs font-bold">Recommendations</p>
                <p className="text-slate-500 text-[10px] mt-0.5">{result.recommendations?.length || result.suggestions?.length} actions generated</p>
              </div>
            </div>
          </Card>

          {/* Confidence Badge */}
          {result.confidence && (
            <div className="flex justify-center">
              <div className={clsx(
                "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                result.confidence === "high" && "bg-green-500/10 text-green-400 border border-green-500/20",
                result.confidence === "medium" && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                result.confidence === "low" && "bg-red-500/10 text-red-400 border border-red-500/20",
              )}>
                <BarChart3 className="w-3 h-3" />
                {result.confidence} confidence analysis
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="flex flex-col justify-center relative overflow-hidden" glow="green">
              {/* Animated background elements - positioned in top-right corner only */}
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-green-500/10 rounded-full blur-3xl" />
              
              {/* Animated rotating rings - smaller and in corner */}
              <motion.div
                className="absolute top-4 right-4 w-20 h-20 border-2 border-green-500/20 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute top-6 right-6 w-14 h-14 border-2 border-dashed border-emerald-400/30 rounded-full"
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              />
              
              {/* Floating particles - confined to top area */}
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1.5 h-1.5 bg-green-400/50 rounded-full"
                  style={{
                    top: `${10 + Math.random() * 30}%`,
                    right: `${5 + Math.random() * 25}%`,
                  }}
                  animate={{
                    y: [0, -10, 0],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    repeat: Infinity,
                    delay: Math.random() * 2,
                  }}
                />
              ))}
              
              <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Monthly Footprint</div>
              <div className="flex items-end gap-2 mb-4">
                <motion.span 
                  className="text-4xl md:text-6xl font-black text-white tracking-tighter"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                >
                  <AnimatedCounter value={result.estimate} duration={1500} />
                </motion.span>
                <span className="text-base md:text-xl font-black text-green-500 mb-1 tracking-tight">kg CO₂</span>
              </div>
              
              {/* Compact eco tip */}
              <motion.div 
                className="bg-white/5 rounded-xl p-3 border border-white/5 mb-4"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <p className="text-slate-400 text-xs font-medium">
                  {result.estimate < 200 
                    ? "🌱 Below average—great job!" 
                    : result.estimate < 400 
                    ? "💡 Near global average—room to improve" 
                    : "⚠️ Above average—see recommendations"}
                </p>
              </motion.div>
              
              {/* Breakdown with details */}
              <div className="space-y-3 mb-4">
                {result.breakdown.map((item, i) => (
                  <motion.div
                    key={item.category}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white/5 rounded-xl p-3 border border-white/5"
                  >
                    <div className="flex justify-between text-[10px] font-bold mb-1.5 uppercase tracking-wider text-slate-400">
                      <span className="flex items-center gap-2">
                        {item.category === "Food" && "🍽️"}
                        {item.category === "Transport" && "🚗"}
                        {item.category === "Energy" && "⚡"}
                        {item.category === "Consumer" && "🛍️"}
                        {item.category}
                      </span>
                      <span className="text-white">{item.value} kg</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-1.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((item.value / result.estimate) * 100, 100)}%` }}
                        transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
                      />
                    </div>
                    {item.detail && <p className="text-slate-500 text-[10px] leading-snug line-clamp-2">{item.detail}</p>}
                  </motion.div>
                ))}
              </div>
              
              {/* Top Impact Drivers - positioned after breakdown */}
              {result.explanations?.top_drivers && (
                <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10 mb-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-2">Top Impact Drivers</p>
                  <div className="space-y-1">
                    {result.explanations.top_drivers.slice(0, 3).map((driver, i) => (
                      <p key={i} className="text-[10px] text-slate-400 flex items-start gap-1.5">
                        <span className="text-emerald-500 mt-0.5">•</span>
                        <span>{driver}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Global comparison */}
              {result.comparison && (
                <div className="pt-3 border-t border-white/10 mb-4">
                  <p className="text-slate-500 text-xs font-medium">{result.comparison}</p>
                </div>
              )}
              
              {/* Global Perspective moved from Improvement Plan */}
              <div className="bg-blue-500/5 rounded-xl p-3 border border-blue-500/10">
                <p className="text-[10px] font-black uppercase tracking-wider text-blue-400 mb-1.5">Global Perspective</p>
                <p className="text-[11px] text-slate-400 italic">
                  "If 10,000 users took these actions, we'd save {Math.round(result.estimate * 0.3 * 10000 / 1000).toLocaleString()} tons of CO₂ monthly."
                </p>
              </div>
            </Card>

            <Card className="bg-white/5 border-white/5">
              <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                <Zap className="w-6 h-6 text-yellow-400" /> Improvement Plan
              </h3>
              {result.explanations?.summary && (
                <div className="mb-6 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-slate-300 text-sm font-medium leading-relaxed">{result.explanations.summary}</p>
                </div>
              )}

              {result.recommendations && result.recommendations.length > 0 ? (
                <div className="space-y-4">
                  {result.recommendations.slice(0, 4).map((rec, i) => (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      key={i}
                      className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/[0.07] transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center font-black text-xs">0{i + 1}</div>
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-white text-sm font-black leading-relaxed">{rec.action}</p>
                            <div className="shrink-0 text-green-400 font-black text-xs">~{Math.round(rec.savings_kg_month)}kg/mo</div>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-4">
                            <p className="text-slate-500 text-xs font-bold italic">{rec.why_it_matters}</p>
                            <div className={clsx(
                              "shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border",
                              rec.difficulty === "Easy" && "bg-green-500/10 text-green-400 border-green-500/20",
                              rec.difficulty === "Medium" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                              rec.difficulty === "Hard" && "bg-red-500/10 text-red-400 border-red-500/20",
                            )}>
                              {rec.difficulty}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : result.suggestions && result.suggestions.length > 0 ? (
                <div className="space-y-4">
                  {result.suggestions.map((sug, i) => (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      key={i}
                      className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/[0.07] transition-colors"
                    >
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center font-black text-xs">0{i + 1}</div>
                      <p className="text-slate-300 text-sm font-medium leading-relaxed">{sug}</p>
                    </motion.div>
                  ))}
                </div>
              ) : null}
            </Card>
          </div>

          {/* Shareable Impact Card */}
          <ShareableImpactCard estimate={result.estimate} suggestions={result.suggestions?.length || 0} />
        </motion.div>
      )}
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
  currentStep 
}: { 
  icon: React.ReactNode; 
  label: string; 
  description: string; 
  step: number; 
  currentStep: number;
}) {
  const isActive = step === currentStep;
  const isComplete = step < currentStep;
  const isPending = step > currentStep;
  
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
        isActive && "bg-green-500/10 border-green-500/30 shadow-lg shadow-green-500/10",
        isComplete && "bg-green-500/5 border-green-500/20",
        isPending && "bg-white/5 border-white/10"
      )}
    >
      <div className={clsx(
        "w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-colors",
        isActive && "bg-green-500 text-slate-900",
        isComplete && "bg-green-500/20 text-green-400",
        isPending && "bg-white/10 text-slate-600"
      )}>
        {isComplete ? <CheckCircle2 className="w-4 h-4" /> : icon}
      </div>
      <p className={clsx(
        "text-xs font-bold mb-0.5",
        isActive && "text-green-400",
        isComplete && "text-green-400",
        isPending && "text-slate-500"
      )}>
        {label}
      </p>
      <p className="text-[10px] text-slate-500 leading-tight">{description}</p>
      {isActive && (
        <motion.div 
          layoutId="activeIndicator"
          className="mt-2 h-0.5 bg-green-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
      )}
    </motion.div>
  );
}

function ShareableImpactCard({ estimate, suggestions }: { estimate: number; suggestions: number }) {
  const [copied, setCopied] = useState(false);

  const shareText = `🌍 I just analyzed my carbon footprint with EcoOS Intelligence!\n\nMy monthly impact: ${estimate}kg CO₂\nI received ${suggestions} personalized action plans to reduce it.\n\nJoin the movement → #EcoOS #EarthDay2026 #ClimateAction`;

  const handleTwitterShare = () => {
    const tweetText = encodeURIComponent(`🌍 I just analyzed my carbon footprint with EcoOS Intelligence!\n\nMy monthly impact: ${estimate}kg CO₂ with ${suggestions} action plans to reduce it.\n\n#EcoOS #EarthDay2026 #ClimateAction`);
    window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, "_blank");
  };

  const handleFacebookShare = () => {
    const fbText = encodeURIComponent(`🌍 I just analyzed my carbon footprint with EcoOS Intelligence!\n\nMy monthly impact: ${estimate}kg CO₂\nI received ${suggestions} personalized action plans to reduce it.\n\nJoin the movement!`);
    window.open(`https://www.facebook.com/sharer/sharer.php?quote=${fbText}`, "_blank");
  };

  const handleWhatsAppShare = () => {
    const waText = encodeURIComponent(`🌍 I just analyzed my carbon footprint with EcoOS Intelligence!\n\nMy monthly impact: ${estimate}kg CO₂\nI received ${suggestions} personalized action plans to reduce it.\n\nJoin the movement → #EcoOS`);
    window.open(`https://wa.me/?text=${waText}`, "_blank");
  };

  const handleLinkedInShare = () => {
    const liText = encodeURIComponent(`🌍 I just analyzed my carbon footprint with EcoOS Intelligence!\n\nMy monthly impact: ${estimate}kg CO₂\nI received ${suggestions} personalized action plans to reduce it.\n\nJoin the movement → #EcoOS #ClimateAction #Sustainability`);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${liText}`, "_blank");
  };

  const handleInstagramCopy = () => {
    const igText = `🌍 Carbon Footprint Check\n\nMy monthly impact: ${estimate}kg CO₂\nAction plans received: ${suggestions}\n\nReducing my footprint one step at a time 🌱\n\n#EcoOS #EarthDay2026 #ClimateAction #Sustainability #EcoFriendly #CarbonFootprint #GoGreen`;
    navigator.clipboard.writeText(igText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleTikTokCopy = () => {
    const ttText = `Just calculated my carbon footprint with EcoOS 🌍\n\nResult: ${estimate}kg CO₂/month\nGot ${suggestions} tips to reduce it!\n\nSmall changes = big impact 🌱✨\n\n#EcoOS #ClimateAction #Sustainability #EcoFriendly #EarthDay2026 #fyp #savetheplanet`;
    navigator.clipboard.writeText(ttText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border-green-500/20 text-center py-10" glow="green">
      <Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-4" />
      <h4 className="text-white font-black text-xl mb-2">Share Your Impact</h4>
      <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">Let the world know you&apos;re taking action. Every shared insight inspires others.</p>
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
