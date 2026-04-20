"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Car,
  ArrowRight,
  MapPin,
  Wind,
  TrendingDown,
  Zap as EvIcon,
  Bus,
  Train,
  Bike,
  Globe,
  TreePine,
  Calendar,
} from "lucide-react";
import clsx from "clsx";
import {
  Card,
  Spinner,
  AnimatedCounter,
  SkeletonCard,
  PointsPopup,
  ScaleInsight,
  getStore,
  updateStore,
  addHistoryEntry,
  useToast,
  type TransportResult,
} from "./shared";

export function TransportTab() {
  const [distance, setDistance] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState("car");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TransportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPoints, setShowPoints] = useState(false);
  const { showToast } = useToast();

  // Trip presets for all transport modes
  const quickTrips = [
    { emoji: "🏢", label: "Daily Commute", distance: "20", mode: "car", desc: "Home to office" },
    { emoji: "🛒", label: "Grocery Run", distance: "5", mode: "car", desc: "Store round trip" },
    { emoji: "✈️", label: "Airport Trip", distance: "35", mode: "car", desc: "To airport" },
    { emoji: "⚡", label: "EV Commute", distance: "25", mode: "ev", desc: "Electric to work" },
    { emoji: "🔌", label: "EV Road Trip", distance: "150", mode: "ev", desc: "Long distance EV" },
    { emoji: "🏍️", label: "Moto Commute", distance: "15", mode: "motorcycle", desc: "Scooter to work" },
    { emoji: "🚌", label: "Bus Commute", distance: "12", mode: "bus", desc: "Bus to office" },
    { emoji: "🚂", label: "City to City", distance: "300", mode: "train", desc: "Intercity travel" },
    { emoji: "🚲", label: "Bike Commute", distance: "12", mode: "bike", desc: "Cycling to work" },
    { emoji: "🚶", label: "Walk to Store", distance: "2", mode: "walk", desc: "Quick errand" },
    { emoji: "✈️", label: "Short Flight", distance: "500", mode: "plane", desc: "Regional flight" },
    { emoji: "🚢", label: "Ferry Ride", distance: "15", mode: "boat", desc: "Harbor crossing" },
  ];

  const loadQuickTrip = (trip: typeof quickTrips[0]) => {
    setDistance(trip.distance);
    setMode(trip.mode);
    setDescription(trip.desc);
    // Auto-analyze after a short delay
    setTimeout(() => analyzeWithParams(trip.distance, trip.mode, trip.desc), 100);
  };

  const analyzeWithParams = async (dist: string, m: string, desc: string) => {
    if (!dist) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "transport", distance: dist, transportMode: m, input: desc }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data as TransportResult);

      const store = getStore();
      updateStore({
        analyses: store.analyses + 1,
        ecoScore: Math.min(100, store.ecoScore + 2),
        totalCO2Saved: store.totalCO2Saved + (data.savings || 0),
      });
      addHistoryEntry("route_analysis", data.savings || 0);
      setShowPoints(true);
      showToast("+10 eco points for route optimization!", "🚗", "success");
      setTimeout(() => setShowPoints(false), 1500);
    } catch (e: unknown) {
      console.error("Transport analysis failed, using local fallback:", e);
      const distanceNum = parseFloat(dist) || 0;
      const factors: Record<string, number> = {
        car: 0.166, ev: 0.050, motorcycle: 0.103, bus: 0.089,
        train: 0.041, bike: 0.005, walk: 0.000, plane: 0.255, boat: 0.190,
      };
      const emitted = Math.round(distanceNum * factors[m] * 100) / 100;
      const greenerOptions = m === "car" ? "train" : m === "ev" ? "bicycle or train" : "bicycle";
      const greenerFactor = m === "car" ? 0.041 : m === "ev" ? 0.005 : 0;
      const savings = Math.max(0, Math.round((emitted - (distanceNum * greenerFactor)) * 100) / 100);
      
      const fallback: TransportResult = {
        emitted,
        emission_factor: `${Math.round(factors[m] * 1000)} g CO2/km (${m})`,
        greener_option: greenerOptions,
        greener_emission: Math.round(distanceNum * greenerFactor * 100) / 100,
        savings,
        annual_savings: Math.round(savings * 240),
        equivalence: `Equivalent to planting ${Math.round(savings * 12)} trees annually`,
        scale_impact: `If 10,000 commuters switched: ${Math.round(savings * 10000 * 240 / 1000)} tons CO2/year saved`,
        route_context: `${distanceNum}km via ${m}. ${savings > 0 ? `Switching to ${greenerOptions} saves ${savings}kg per trip.` : "You're already at zero!"}`,
      };
      setResult(fallback);
      
      const store = getStore();
      updateStore({
        analyses: store.analyses + 1,
        ecoScore: Math.min(100, store.ecoScore + 2),
        totalCO2Saved: store.totalCO2Saved + savings,
      });
      addHistoryEntry("route_analysis", savings);
      setShowPoints(true);
      showToast("Using local calculation. +10 points!", "💡", "info");
      setTimeout(() => setShowPoints(false), 1500);
    }
    setLoading(false);
  };

  // Calculate emissions for all modes for comparison
  const getAllModeEmissions = (dist: number) => {
    const allFactors = {
      car: { factor: 0.166, label: "Car (Gas)", emoji: "🚗" },
      ev: { factor: 0.050, label: "Electric Car", emoji: "⚡" },
      motorcycle: { factor: 0.103, label: "Motorcycle", emoji: "🏍️" },
      bus: { factor: 0.089, label: "Bus", emoji: "🚌" },
      train: { factor: 0.041, label: "Train", emoji: "🚂" },
      bike: { factor: 0.005, label: "Bicycle", emoji: "🚲" },
      walk: { factor: 0.000, label: "Walk", emoji: "🚶" },
      plane: { factor: 0.255, label: "Plane", emoji: "✈️" },
      boat: { factor: 0.190, label: "Boat/Ferry", emoji: "🚢" },
    };
    return Object.entries(allFactors)
      .map(([id, data]) => ({
        id,
        label: data.label,
        emoji: data.emoji,
        emission: Math.round(dist * data.factor * 100) / 100,
        factor: Math.round(data.factor * 1000),
      }))
      .sort((a, b) => b.emission - a.emission);
  };

  const analyze = async () => {
    if (!distance) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "transport", distance, transportMode: mode, input: description }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data as TransportResult);

      const store = getStore();
      updateStore({
        analyses: store.analyses + 1,
        ecoScore: Math.min(100, store.ecoScore + 2),
        totalCO2Saved: store.totalCO2Saved + (data.savings || 0),
      });
      addHistoryEntry("route_analysis", data.savings || 0);
      setShowPoints(true);
      showToast("+10 eco points for route optimization!", "🚗", "success");
      setTimeout(() => setShowPoints(false), 1500);
    } catch (e: unknown) {
      console.error("Transport analysis failed, using local fallback:", e);
      // Dynamic local fallback using hardcoded emission factors
      const distanceNum = parseFloat(distance) || 0;
      const factors: Record<string, number> = {
        car: 0.166,        // Gasoline car: ~166g CO2/km
        ev: 0.050,         // Electric vehicle: ~50g CO2/km
        motorcycle: 0.103, // Motorcycle: ~103g CO2/km
        bus: 0.089,        // Diesel bus: ~89g CO2/km
        train: 0.041,      // Electric train: ~41g CO2/km
        bike: 0.005,       // Bicycle: ~5g CO2/km
        walk: 0.000,       // Walking: effectively 0
        plane: 0.255,      // Short-haul flight: ~255g CO2/km
        boat: 0.190,       // Ferry/boat: ~190g CO2/km
      };
      
      const emitted = Math.round(distanceNum * factors[mode] * 100) / 100;
      const greenerOptions = mode === "car" ? "train or bus" : mode === "ev" ? "bicycle or train" : "bicycle";
      const greenerFactor = mode === "car" ? 0.040 : mode === "ev" ? 0 : 0;
      const savings = Math.max(0, Math.round((emitted - (distanceNum * greenerFactor)) * 100) / 100);
      
      const fallback: TransportResult = {
        emitted,
        emission_factor: `${factors[mode] * 1000}g CO₂ per km (${mode})`,
        greener_option: greenerOptions,
        savings,
        annual_savings: Math.round(savings * 240), // 240 work days/year
        equivalence: `Equivalent to ${Math.round(savings * 20)} trees planted annually`,
        scale_impact: `If 1,000 commuters made this switch: ${Math.round(savings * 1000 * 240 / 1000)} tons CO₂/year saved`,
        route_context: `Local calculation for ${distanceNum}km via ${mode}. AI service temporarily unavailable - using verified emission factors.`,
      };
      
      setResult(fallback);
      
      const store = getStore();
      updateStore({
        analyses: store.analyses + 1,
        ecoScore: Math.min(100, store.ecoScore + 2),
        totalCO2Saved: store.totalCO2Saved + savings,
      });
      addHistoryEntry("route_analysis", savings);
      setShowPoints(true);
      showToast("Using local calculation (API unavailable). +10 points!", "💡", "info");
      setTimeout(() => setShowPoints(false), 1500);
    }
    setLoading(false);
  };

  const transportModes = [
    { id: "car", label: "Car (Gas)", icon: <Car className="w-5 h-5" /> },
    { id: "ev", label: "Electric Car", icon: <EvIcon className="w-5 h-5" /> },
    { id: "motorcycle", label: "Motorcycle", icon: <span className="text-lg">🏍️</span> },
    { id: "bus", label: "Bus", icon: <Bus className="w-5 h-5" /> },
    { id: "train", label: "Train", icon: <Train className="w-5 h-5" /> },
    { id: "bike", label: "Bicycle", icon: <Bike className="w-5 h-5" /> },
    { id: "walk", label: "Walk", icon: <span className="text-lg">🚶</span> },
    { id: "plane", label: "Plane", icon: <span className="text-lg">✈️</span> },
    { id: "boat", label: "Boat/Ferry", icon: <span className="text-lg">🚢</span> },
  ];

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 p-4 min-h-0">
      {/* Sidebar - Quick Trip Presets */}
      <div className="w-full lg:w-72 xl:w-80 max-w-full shrink-0 bg-slate-900/50 rounded-2xl border border-white/10 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-white/10 bg-white/5">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            Eco<span className="text-emerald-400">Route</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">Choose a trip preset • {quickTrips.length} options</p>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 relative">
          {quickTrips.map((trip) => (
            <button
              key={trip.label}
              onClick={() => loadQuickTrip(trip)}
              disabled={loading}
              className="w-full text-left group bg-white/5 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/30 rounded-xl px-3 py-3 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-slate-300 group-hover:text-emerald-300 text-xs font-bold">{trip.emoji} {trip.label}</span>
                <span className="text-slate-600 text-[10px]">{trip.distance}km</span>
              </div>
              <div className="text-slate-600 group-hover:text-emerald-400/70 text-[10px] mt-1">
                {trip.desc} • {trip.mode}
              </div>
            </button>
          ))}
          {/* Scroll indicator */}
          <div className="sticky bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-900/50 to-transparent pointer-events-none flex items-end justify-center pb-1">
            <span className="text-slate-600 text-[10px] bg-slate-900/80 px-2 py-0.5 rounded-full">↓ Scroll for more</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl md:text-4xl font-black text-white mb-2 tracking-tighter">
              {result ? "Route Analysis" : "Calculate Route Emissions"}
            </h2>
            <p className="text-slate-400 text-sm">
              {result 
                ? `${distance}km via ${mode}${description ? ` (${description})` : ''}`
                : "Enter trip details or select a preset"
              }
            </p>
          </div>

          {/* Input Form */}
          <Card className="p-6 mb-6" glow="green">
            <PointsPopup points={10} show={showPoints} />
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Route Description</label>
                  <input
                    type="text"
                    placeholder="E.g., 'Work to Home'..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm font-bold outline-none focus:border-emerald-500/50 transition-all"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Distance (km)</label>
                  <input
                    type="number"
                    placeholder="25"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-xl font-black outline-none focus:border-emerald-500/50 transition-all"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Transport Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {transportModes.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className={clsx(
                          "flex flex-col items-center gap-1 p-3 rounded-xl border transition-all duration-300",
                          mode === m.id
                            ? "bg-emerald-500 border-emerald-400 text-slate-900 shadow-lg shadow-emerald-500/20"
                            : "bg-white/5 border-white/5 text-slate-500 hover:border-white/20"
                        )}
                      >
                        {m.icon}
                        <span className="text-[9px] font-black uppercase">{m.id}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-between h-full">
                {/* Animated Eco Illustration */}
                <div className="flex-1 flex items-center justify-center relative">
                  <motion.div 
                    className="relative w-48 h-48"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    {/* Background glow */}
                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-3xl" />
                    
                    {/* Animated circles */}
                    <motion.div
                      className="absolute inset-4 border-2 border-emerald-500/30 rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.div
                      className="absolute inset-8 border-2 border-dashed border-emerald-400/40 rounded-full"
                      animate={{ rotate: -360 }}
                      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    />
                    
                    {/* Center icon based on selected mode */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div
                        key={mode}
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="text-6xl"
                      >
                        {mode === "car" && "🚗"}
                        {mode === "ev" && "⚡"}
                        {mode === "motorcycle" && "🏍️"}
                        {mode === "bus" && "🚌"}
                        {mode === "train" && "🚂"}
                        {mode === "bike" && "🚲"}
                        {mode === "walk" && "🚶"}
                        {mode === "plane" && "✈️"}
                        {mode === "boat" && "🚢"}
                      </motion.div>
                    </div>
                    
                    {/* Floating particles */}
                    {[...Array(6)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-emerald-400/60 rounded-full"
                        style={{
                          top: `${20 + Math.random() * 60}%`,
                          left: `${20 + Math.random() * 60}%`,
                        }}
                        animate={{
                          y: [0, -20, 0],
                          opacity: [0.3, 0.8, 0.3],
                        }}
                        transition={{
                          duration: 2 + Math.random() * 2,
                          repeat: Infinity,
                          delay: Math.random() * 2,
                        }}
                      />
                    ))}
                  </motion.div>
                </div>
                
                {/* Tips text */}
                <div className="text-center mb-4">
                  <p className="text-slate-500 text-xs">
                    {mode === "car" && "💡 Cars emit ~166g CO₂/km"}
                    {mode === "ev" && "💡 EVs emit ~50g CO₂/km"}
                    {mode === "motorcycle" && "💡 Motorcycles emit ~103g CO₂/km"}
                    {mode === "bus" && "💡 Buses emit ~89g CO₂/km per passenger"}
                    {mode === "train" && "🌱 Trains are 4x greener than cars"}
                    {mode === "bike" && "🌱 Cycling is nearly carbon neutral"}
                    {mode === "walk" && "🌱 Walking is zero emissions"}
                    {mode === "plane" && "⚠️ Planes emit ~255g CO₂/km"}
                    {mode === "boat" && "💡 Ferries emit ~190g CO₂/km"}
                  </p>
                </div>
                
                <button
                  onClick={() => analyzeWithParams(distance, mode, description)}
                  disabled={loading || !distance}
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 text-slate-900 font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 text-xl shadow-2xl shadow-emerald-500/20 group/go"
                >
                  {loading ? <Spinner color="white" /> : (
                    <>
                      Calculate Emissions
                      <ArrowRight className="w-5 h-5 group-hover/go:translate-x-2 transition-transform" />
                    </>
                  )}
                </button>
                {error && <p className="mt-3 text-red-400 text-xs text-center font-bold">{error}</p>}
              </div>
            </div>
          </Card>

          {loading && <SkeletonCard />}

          {/* Results - Split Layout */}
          {result && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left - Analysis */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <Card className="flex items-center justify-between" glow="green">
                  <div>
                    <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Route Footprint</div>
                    <div className="text-5xl font-black text-white tracking-tighter">
                      <AnimatedCounter value={Math.round(result.emitted * 10) / 10} duration={1200} />
                      <span className="text-lg font-bold text-slate-500 ml-2">kg CO₂</span>
                    </div>
                    {result.emission_factor && (
                      <div className="text-slate-600 text-xs mt-2">{result.emission_factor}</div>
                    )}
                  </div>
                  <div className="p-6 bg-white/5 rounded-2xl">
                    <Wind className="w-12 h-12 text-slate-600" />
                  </div>
                </Card>

                {result.route_context && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-slate-400 text-sm italic">
                    &ldquo;{result.route_context}&rdquo;
                  </div>
                )}

                {result.savings > 0 && (
                  <Card className="bg-emerald-500/10 border-emerald-500/20">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                        <TrendingDown className="w-7 h-7 text-slate-900" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-emerald-500 text-slate-900 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">Optimization</span>
                          <h3 className="text-emerald-400 font-black text-lg">Try {result.greener_option}</h3>
                        </div>
                        <p className="text-slate-400 text-sm">
                          Save <strong className="text-white font-black">{result.savings} kg</strong> CO₂ per trip
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-emerald-500/20">
                      <div className="text-center">
                        <Calendar className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                        <div className="text-lg font-black text-white">{Math.round(result.annual_savings || 0)} kg</div>
                        <div className="text-slate-500 text-[9px] uppercase">Annual</div>
                      </div>
                      <div className="text-center">
                        <TreePine className="w-4 h-4 text-green-400 mx-auto mb-1" />
                        <div className="text-xs text-slate-300 font-bold leading-tight">{result.equivalence?.split(' ').slice(2, 4).join(' ')}</div>
                        <div className="text-slate-500 text-[9px] uppercase">Impact</div>
                      </div>
                      <div className="text-center">
                        <Globe className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                        <div className="text-xs text-slate-300 font-bold leading-tight">{result.scale_impact?.split(' ').slice(-2)[0]} tons</div>
                        <div className="text-slate-500 text-[9px] uppercase">At Scale</div>
                      </div>
                    </div>
                  </Card>
                )}
              </motion.div>

              {/* Right - Comparison */}
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold text-lg">Compare All Modes</h3>
                  <span className="text-slate-500 text-xs">{distance}km trip</span>
                </div>
                <div className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden">
                  <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
                    {getAllModeEmissions(parseFloat(distance) || 0).map((modeData) => {
                      const isSelected = modeData.id === mode;
                      const maxEmission = Math.max(...getAllModeEmissions(parseFloat(distance) || 0).map(m => m.emission));
                      const percentage = maxEmission > 0 ? (modeData.emission / maxEmission) * 100 : 0;
                      return (
                        <div 
                          key={modeData.id}
                          className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                            isSelected ? "bg-emerald-500/20 border border-emerald-500/30" : "bg-white/5 border border-white/5"
                          }`}
                        >
                          <span className="text-xl">{modeData.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className={`font-bold text-xs ${isSelected ? "text-emerald-400" : "text-white"}`}>
                                {modeData.label}{isSelected && " ★"}
                              </span>
                              <span className="text-white font-black text-xs">{modeData.emission} kg</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    modeData.emission === 0 ? "bg-green-500" : 
                                    modeData.emission < 0.1 ? "bg-emerald-400" :
                                    modeData.emission < 0.5 ? "bg-yellow-400" :
                                    modeData.emission < 1 ? "bg-orange-400" : "bg-red-400"
                                  }`}
                                  style={{ width: `${Math.max(percentage, 2)}%` }}
                                />
                              </div>
                              <span className="text-slate-500 text-[10px] w-12 text-right">{modeData.factor}g/km</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-3 py-2 bg-white/5 border-t border-white/10 text-xs text-slate-500">
                    💡 Lower emissions = greener choice
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
