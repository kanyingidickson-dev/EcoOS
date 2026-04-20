"use client";

import React, { useState, useEffect, useMemo, memo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Leaf,
  ArrowRight,
  Activity,
  Zap,
  Wind,
  Recycle,
  Car,
  TrendingDown,
  Trophy,
  ArrowUpRight,
  Sparkles,
  Target,
  MessageCircle,
  Brain,
  User,
  BarChart3,
  Award,
  Calendar,
  Footprints,
  CheckCircle,
  PartyPopper,
  X,
} from "lucide-react";
import clsx from "clsx";
import {
  Card,
  Spinner,
  AnimatedCounter,
  EcoScoreRing,
  PointsPopup,
  getStore,
  updateStore,
  getPersonalizationContext,
  useToast,
  useDebounce,
  type QuestResult,
} from "./shared";

const tabToRoute: Record<string, string> = {
  dashboard: "/dashboard",
  footprint: "/footprint",
  waste: "/waste",
  transport: "/transport",
  whatif: "/what-if",
  coach: "/coach",
};

// --- Simulated Activity Feed ---

const COMMUNITY_ACTIVITIES = [
  { initials: "AS", name: "Aisha S.", action: "saved 18kg CO₂ via Carbon Mirror", points: 15, color: "from-green-500 to-emerald-600" },
  { initials: "MR", name: "Marco R.", action: "completed Meatless Monday quest", points: 30, color: "from-blue-500 to-indigo-600" },
  { initials: "LP", name: "Luna P.", action: "optimized commute with EcoRoute", points: 12, color: "from-amber-500 to-orange-600" },
  { initials: "TC", name: "Tao C.", action: "ran a What-If simulation", points: 20, color: "from-purple-500 to-violet-600" },
  { initials: "KW", name: "Kwame W.", action: "classified 5 items via WasteWise", points: 25, color: "from-pink-500 to-rose-600" },
  { initials: "SJ", name: "Sofia J.", action: "started a coaching session", points: 10, color: "from-cyan-500 to-teal-600" },
  { initials: "DR", name: "Diego R.", action: "reduced footprint by 22kg", points: 35, color: "from-emerald-500 to-green-600" },
  { initials: "NK", name: "Nia K.", action: "completed Phantom Power Purge", points: 15, color: "from-indigo-500 to-blue-600" },
];

export function DashboardTab() {
  const router = useRouter();
  const [store, setStore] = useState(getStore());
  const [currentActivityIdx, setCurrentActivityIdx] = useState(0);

  useEffect(() => {
    setStore(getStore());
  }, []);

  // Rotate activity feed every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentActivityIdx((prev) => (prev + 1) % COMMUNITY_ACTIVITIES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const currentActivity = COMMUNITY_ACTIVITIES[currentActivityIdx];

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [celebration, setCelebration] = useState<{ show: boolean; message: string } | null>(null);

  // Delay onboarding check until after hydration to prevent mismatch
  useEffect(() => {
    setShowOnboarding(store.analyses === 0);
  }, [store.analyses]);

  // Check for eco-score milestones
  useEffect(() => {
    const prevScore = store.ecoScore;
    const checkMilestone = () => {
      const newStore = getStore();
      const newScore = newStore.ecoScore;
      if (prevScore < 70 && newScore >= 70) {
        setCelebration({ show: true, message: "Level Up! B Grade Achieved!" });
        setTimeout(() => setCelebration(null), 3000);
      } else if (prevScore < 80 && newScore >= 80) {
        setCelebration({ show: true, message: "Level Up! A Grade Achieved!" });
        setTimeout(() => setCelebration(null), 3000);
      } else if (prevScore < 90 && newScore >= 90) {
        setCelebration({ show: true, message: "Level Up! A+ Grade Achieved!" });
        setTimeout(() => setCelebration(null), 3000);
      }
    };
    // Poll for score changes every 2 seconds
    const interval = setInterval(checkMilestone, 2000);
    return () => clearInterval(interval);
  }, [store.ecoScore]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8 md:space-y-10">
      {/* Celebration Animation */}
      <CelebrationOverlay celebration={celebration} />

      {/* First Steps Onboarding Banner */}
      {showOnboarding && (
        <OnboardingBanner onDismiss={() => setShowOnboarding(false)} onNavigate={(tab) => router.push(tabToRoute[tab] || "/dashboard")} />
      )}

      {/* Hero */}
      <section className="relative py-4 md:py-6">
        <div className="max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest mb-4 md:mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              Earth Day Edition 2026
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-white mb-4 md:mb-6 tracking-tighter leading-[0.9]">
              Reimagining <br />
              <span className="text-gradient">Sustainability</span>.
            </h1>
            <p className="text-slate-400 text-base md:text-lg max-w-xl leading-relaxed font-medium mb-6 md:mb-8">
              A real-time behavioral operating system for climate action. Track, analyze, and optimize your impact in seconds.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => router.push("/footprint")}
                className="group flex items-center justify-center gap-3 bg-white text-slate-900 px-6 py-3.5 rounded-2xl font-black transition-all hover:scale-105 active:scale-95 shadow-xl shadow-white/5 text-sm md:text-base"
              >
                Analyze Footprint
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => router.push("/what-if")}
                className="group flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white px-6 py-3.5 rounded-2xl font-black border border-white/10 transition-all hover:scale-105 active:scale-95 text-sm md:text-base"
              >
                <Target className="w-4 h-4 text-amber-400" />
                What-If Simulator
              </button>
            </div>
          </motion.div>
        </div>

        {/* Floating 3D Element — hidden on mobile/tablet for cleaner layout */}
        <div className="hidden xl:block absolute top-0 right-0 w-1/3 h-full">
          <div className="relative w-full h-full flex items-center justify-center">
            <motion.div
              animate={{ y: [0, -20, 0], rotate: [0, 3, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10 w-52 h-52 bg-gradient-to-br from-green-400/20 to-emerald-600/40 backdrop-blur-3xl rounded-[3rem] border border-white/20 shadow-2xl flex items-center justify-center"
            >
              <Leaf className="w-24 h-24 text-white opacity-50 drop-shadow-2xl" />
              <div className="absolute -top-6 -right-6 w-20 h-20 bg-blue-500/20 rounded-full blur-2xl" />
              <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-green-500/20 rounded-full blur-3xl" />
            </motion.div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 border-2 border-white/5 rounded-full border-dashed animate-[spin_20s_linear_infinite]" />
          </div>
        </div>
      </section>

      {/* Quick Feature Access - Moved up for visibility */}
      <section className="grid grid-cols-3 sm:grid-cols-6 gap-2 md:gap-3">
        <QuickLinkCard 
          title="Overview" 
          desc="Your eco dashboard" 
          detail={`${store.analyses} analyses done`}
          icon={<Activity className="w-4 h-4 text-green-400" />} 
          color="green"
          onClick={() => router.push("/dashboard")} 
        />
        <QuickLinkCard 
          title="Carbon Mirror" 
          desc="Analyze your footprint" 
          detail={`${Math.round(store.totalCO2Saved)}kg saved so far`}
          icon={<Wind className="w-4 h-4 text-green-400" />} 
          color="green"
          onClick={() => router.push("/footprint")} 
        />
        <QuickLinkCard 
          title="WasteWise" 
          desc="Smart recycling guide" 
          detail="AI-powered sorting"
          icon={<Recycle className="w-4 h-4 text-blue-400" />} 
          color="blue"
          onClick={() => router.push("/waste")} 
        />
        <QuickLinkCard 
          title="EcoRoute" 
          desc="Greener transport" 
          detail="Compare travel modes"
          icon={<Car className="w-4 h-4 text-emerald-400" />} 
          color="emerald"
          onClick={() => router.push("/transport")} 
        />
        <QuickLinkCard 
          title="What-If" 
          desc="Impact simulator" 
          detail="See potential changes"
          icon={<Target className="w-4 h-4 text-amber-400" />} 
          color="amber"
          onClick={() => router.push("/what-if")} 
        />
        <QuickLinkCard 
          title="Coach" 
          desc="Personal advisor" 
          detail={`${store.completedQuests} quests completed`}
          icon={<MessageCircle className="w-4 h-4 text-purple-400" />} 
          color="purple"
          onClick={() => router.push("/coach")} 
        />
      </section>

      {/* User Profile Strip + Eco Score */}
      <UserProfileStrip store={store} />

      {/* Live Stats + Quest Grid */}
      <section className="grid lg:grid-cols-5 gap-4">
        {/* Stats Card — takes 3 cols */}
        <Card className="lg:col-span-3 relative overflow-hidden group" glow="green">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
            <TrendingDown className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 bg-green-500/10 rounded-xl text-green-400"><Activity className="w-4 h-4" /></div>
              <h3 className="text-lg font-black text-white">System Health</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <StatMetric label="Global Impact" value={4200000 + store.totalCO2Saved} suffix="kg" />
              <StatMetric label="Active Users" value={12847} />
              <StatMetric label="Your Saves" value={Math.round(store.totalCO2Saved)} suffix="kg" />
              <StatMetric label="Quests Done" value={store.completedQuests} className="hidden sm:block" />
            </div>

            {/* Dynamic Activity Feed */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 overflow-hidden backdrop-blur-sm group-hover:bg-white/10 transition-colors">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentActivityIdx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.5, ease: "circOut" }}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={clsx("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-xs font-black text-white shrink-0 shadow-lg", currentActivity.color)}>
                      {currentActivity.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-white text-sm font-bold truncate">{currentActivity.name}</div>
                      <div className="text-slate-500 text-[10px] font-medium truncate">{currentActivity.action}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="text-green-400 font-black text-xs shrink-0">+{currentActivity.points}</div>
                    <div className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">points</div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Mini History Sparkline */}
            {store.history.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Recent Activity</div>
                  <div className="text-slate-600 text-[9px] font-bold">{store.history.length} actions</div>
                </div>
                <div className="flex items-end gap-[3px] h-6">
                  {store.history.slice(0, 15).reverse().map((entry, i) => {
                    const maxCo2 = Math.max(...store.history.slice(0, 15).map(h => h.co2), 1);
                    const height = Math.max(3, (entry.co2 / maxCo2) * 24);
                    return (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height }}
                        transition={{ delay: i * 0.04, duration: 0.25 }}
                        className="flex-1 bg-gradient-to-t from-green-500/40 to-green-400/70 rounded-t-[2px] min-h-[3px] max-w-[12px]"
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Quest Card — takes 2 cols */}
        <div className="lg:col-span-2">
          <EcoQuestCard />
        </div>
      </section>


      {/* Carbon Mirror Action Plan (Core WOW) */}
      <section>
        <Card className="relative overflow-hidden" glow="green">
          <div className="absolute top-0 right-0 p-6 opacity-[0.04]">
            <Wind className="w-28 h-28" />
          </div>
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-black uppercase tracking-widest mb-3">
                  <Sparkles className="w-3 h-3" /> Carbon Mirror Action Plan
                </div>
                <h3 className="text-xl md:text-2xl font-black text-white mb-2 tracking-tight">
                  Your next 4 highest-impact moves
                </h3>
                <p className="text-slate-500 text-sm font-medium max-w-2xl">
                  {store.lastCarbonPlan?.explanations.summary || "Run Carbon Mirror once to generate a personalized plan with quantified savings."}
                </p>
              </div>
              <button
                onClick={() => router.push("/footprint")}
                className="shrink-0 bg-green-500 hover:bg-green-600 text-slate-900 font-black px-5 py-3 rounded-2xl transition-all flex items-center gap-2 shadow-xl shadow-green-500/20"
              >
                Open Carbon Mirror
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {store.lastCarbonPlan?.recommendations && store.lastCarbonPlan.recommendations.length > 0 && (
              <div className="grid md:grid-cols-2 gap-4 mt-6">
                {store.lastCarbonPlan.recommendations.slice(0, 4).map((rec, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-white font-black text-sm leading-relaxed">{rec.action}</div>
                        <div className="text-slate-500 text-xs font-bold italic mt-1">{rec.why_it_matters}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-green-400 font-black text-sm">~{Math.round(rec.savings_kg_month)}kg/mo</div>
                        <div className={clsx(
                          "mt-1 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border inline-block",
                          rec.difficulty === "Easy" && "bg-green-500/10 text-green-400 border-green-500/20",
                          rec.difficulty === "Medium" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                          rec.difficulty === "Hard" && "bg-red-500/10 text-red-400 border-red-500/20",
                        )}>
                          {rec.difficulty}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* Global Impact Mode — more compact */}
      <GlobalImpactSection />
    </motion.div>
  );
}

// --- User Profile Strip ---

const UserProfileStrip = memo(function UserProfileStrip({ store }: { store: ReturnType<typeof getStore> }) {
  const memberSince = useMemo(() => {
    if (store.history.length > 0) {
      const oldest = store.history[store.history.length - 1];
      return new Date(oldest.date).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }
    return new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }, [store.history]);

  return (
    <Card className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 py-5 px-6" glow="green">
      <div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0 w-full sm:w-auto">
        {/* Score Ring */}
        <EcoScoreRing score={store.ecoScore} size={64} strokeWidth={5} />

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-white font-black text-base truncate">Eco Citizen</h3>
            <div className="px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-black uppercase tracking-wider shrink-0">
              Active
            </div>
            <div className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-wider shrink-0 hidden sm:block">
              Level {Math.min(10, Math.floor(store.ecoScore / 10) + 1)}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-slate-500 text-[10px] font-bold">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Since {memberSince}</span>
            <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> {store.analyses} analyses</span>
            <span className="flex items-center gap-1"><Award className="w-3 h-3" /> {store.completedQuests} quests</span>
            <span className="flex items-center gap-1"><Footprints className="w-3 h-3" /> {store.history.length} actions</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {store.completedQuests >= 5 && (
              <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold">Quest Master</span>
            )}
            {store.totalCO2Saved > 100 && (
              <span className="px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-bold">Climate Hero</span>
            )}
            {store.analyses > 10 && (
              <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-bold">Data Driven</span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="flex items-center gap-4 sm:gap-5 shrink-0 w-full sm:w-auto justify-around sm:justify-end pt-3 sm:pt-0 border-t sm:border-t-0 sm:border-l border-white/5 sm:pl-6">
        <div className="text-center min-w-[60px]">
          <div className="text-lg font-black text-white">{store.totalCO2Saved.toFixed(1)}</div>
          <div className="text-slate-500 text-[9px] font-black uppercase tracking-wider">kg CO₂ Saved</div>
        </div>
        <div className="text-center min-w-[50px]">
          <div className="text-lg font-black text-green-400">{store.ecoScore}</div>
          <div className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Eco Score</div>
        </div>
        <div className="text-center min-w-[50px] hidden sm:block">
          <div className="text-lg font-black text-blue-400">{Math.round(store.totalCO2Saved / 10)}</div>
          <div className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Trees Equiv.</div>
        </div>
      </div>
    </Card>
  );
});

// --- Celebration Overlay ---

function CelebrationOverlay({ celebration }: { celebration: { show: boolean; message: string } | null }) {
  if (!celebration?.show) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
    >
      <div className="absolute inset-0 bg-black/40" />
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-8 text-center shadow-2xl shadow-green-500/30 mx-4"
      >
        <PartyPopper className="w-16 h-16 text-white mx-auto mb-4" />
        <h2 className="text-3xl font-black text-white mb-2">{celebration.message}</h2>
        <p className="text-green-100 font-bold">Keep up the great work!</p>
        <div className="absolute -top-4 -left-4 w-8 h-8 bg-yellow-400 rounded-full animate-bounce" />
        <div className="absolute -top-4 -right-4 w-6 h-6 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
        <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
      </motion.div>
    </motion.div>
  );
}

// --- Onboarding Banner ---

function OnboardingBanner({ onDismiss, onNavigate }: { onDismiss: () => void; onNavigate: (tab: string) => void }) {
  const steps = [
    { num: 1, title: "Measure Your Footprint", tab: "footprint", icon: <Wind className="w-4 h-4" />, color: "green" },
    { num: 2, title: "Complete a Daily Quest", tab: "dashboard", icon: <Trophy className="w-4 h-4" />, color: "blue" },
    { num: 3, title: "Simulate a Change", tab: "whatif", icon: <Target className="w-4 h-4" />, color: "amber" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10 border border-green-500/20 rounded-2xl p-6"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-xl text-green-400">
            <Footprints className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white font-black text-lg">First Steps</h3>
            <p className="text-slate-400 text-sm">Welcome to EcoOS! Complete these 3 actions to get started.</p>
          </div>
        </div>
        <button onClick={onDismiss} className="p-2 text-slate-500 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {steps.map((step) => (
          <button
            key={step.num}
            onClick={() => onNavigate(step.tab)}
            className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-left group"
          >
            <div className={clsx(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              step.color === "green" && "bg-green-500/20 text-green-400",
              step.color === "blue" && "bg-blue-500/20 text-blue-400",
              step.color === "amber" && "bg-amber-500/20 text-amber-400"
            )}>
              {step.num}
            </div>
            <span className="text-white font-bold text-sm group-hover:translate-x-1 transition-transform">{step.title}</span>
            <ArrowRight className="w-4 h-4 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// --- Stat Metric ---

const StatMetric = memo(function StatMetric({ label, value, suffix, className }: { label: string; value: number; suffix?: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-0.5">{label}</div>
      <div className="text-xl md:text-2xl font-black text-white">
        <AnimatedCounter value={value} duration={1500} />
        {suffix && <span className="text-xs text-green-500 ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
});

// --- Eco Quest Card ---

function EcoQuestCard() {
  const [quest, setQuest] = useState<QuestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [showPoints, setShowPoints] = useState(false);
  const { showToast } = useToast();

  // Hardcoded quests - no API call to save quota for main features
  const QUESTS: QuestResult[] = [
    { title: "Digital Declutter", description: "Delete 50 unneeded emails. Data centers use massive energy to store your 'trash'.", impact: "Saves ~0.1kg CO2", category: "Energy", difficulty: "Easy", points: 15 },
    { title: "Plant-Based Power", description: "Swap your dairy for oat or almond milk today. Cow's milk is 3x more carbon intensive.", impact: "Saves ~0.8kg CO2", category: "Food", difficulty: "Easy", points: 20 },
    { title: "Cold Wash Hero", description: "Wash your clothes at 30°C instead of 60°C. 90% of energy goes to heating water.", impact: "Saves ~0.5kg CO2", category: "Energy", difficulty: "Easy", points: 10 },
    { title: "Phantom Power Purge", description: "Unplug every device and charger not in use. The average home has 20+ phantom loads.", impact: "Saves ~0.35kg CO2", category: "Energy", difficulty: "Easy", points: 15 },
    { title: "Meatless Monday", description: "Eat only plant-based meals today. Try a lentil curry or veggie stir-fry!", impact: "Saves ~2.5kg CO2", category: "Food", difficulty: "Medium", points: 30 },
    { title: "Zero-Waste Lunch", description: "Pack a lunch using only reusable containers — no plastic wrap or disposable bags.", impact: "Prevents 3-5 plastic items", category: "Waste", difficulty: "Easy", points: 20 },
    { title: "Walk the Last Mile", description: "For trips under 2km, walk or cycle instead of driving.", impact: "Saves ~0.33kg CO2 per 2km", category: "Transport", difficulty: "Medium", points: 25 },
    { title: "Shower Speedrun", description: "Take showers under 5 minutes today. Heating water is energy-intensive.", impact: "Saves ~0.4kg CO2", category: "Energy", difficulty: "Easy", points: 10 },
    { title: "Light Switch Audit", description: "Turn off lights in unoccupied rooms all day. Check common areas and bedrooms.", impact: "Saves ~0.2kg CO2", category: "Energy", difficulty: "Easy", points: 10 },
    { title: "Reusable Bag Champion", description: "Use only reusable bags for any shopping today. No single-use plastic!", impact: "Prevents 3-5 plastic bags", category: "Waste", difficulty: "Easy", points: 15 },
    { title: "Coffee Cup Saver", description: "Bring your own reusable cup for coffee/tea. Disposable cups have plastic lining.", impact: "Prevents 1-2 cups", category: "Waste", difficulty: "Easy", points: 10 },
    { title: "Local Food Hero", description: "Buy one food item from a local producer today. Reduces transport emissions.", impact: "Saves ~0.15kg CO2", category: "Food", difficulty: "Easy", points: 15 },
  ];

  const [questIndex, setQuestIndex] = useState(0);

  const fetchQuest = async () => {
    setLoading(true);
    setAccepted(false);
    // Simulate async for UX consistency, but no API call
    await new Promise(resolve => setTimeout(resolve, 600));
    setQuestIndex(prev => (prev + 1) % QUESTS.length);
    setQuest(QUESTS[questIndex]);
    setLoading(false);
  };

  const acceptQuest = () => {
    if (!quest) return;
    setAccepted(true);
    const pts = quest.points || 20;
    setShowPoints(true);
    const store = getStore();
    updateStore({
      ecoScore: Math.min(100, store.ecoScore + 2),
      completedQuests: store.completedQuests + 1,
      totalCO2Saved: store.totalCO2Saved + 2.5,
      questHistory: [quest.title, ...store.questHistory.slice(0, 9)],
    });
    showToast(`+${pts} eco points earned! 🌱`, "🏆", "success");
    setTimeout(() => setShowPoints(false), 1500);
  };

  // Removed auto-fetch: quest only generates when user clicks the button

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-blue-600/10 to-indigo-600/10 h-full flex flex-col group/quest" glow="blue">
      <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover/quest:opacity-[0.1] transition-opacity">
        <Trophy className="w-24 h-24 rotate-12" />
      </div>
      <PointsPopup points={quest?.points || 20} show={showPoints} />
      <div className="flex items-center justify-between mb-5 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400"><Trophy className="w-4 h-4" /></div>
          <h3 className="text-lg font-black text-white">Eco Quest</h3>
        </div>
        <button 
          onClick={fetchQuest} 
          disabled={loading}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all px-3 py-1.5 bg-white/5 rounded-lg text-xs font-bold"
        >
          <Activity className={clsx("w-3.5 h-3.5", loading && "animate-spin")} />
          {loading ? "Loading..." : "New Quest"}
        </button>
      </div>

      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col items-center justify-center gap-3">
              <Spinner color="blue" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Generating Mission...</p>
            </motion.div>
          ) : quest ? (
            <motion.div key="quest" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} className="flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-blue-500/20 text-blue-300 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest">{quest.category}</div>
                {quest.difficulty && (
                  <div className={clsx(
                    "text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest",
                    quest.difficulty === "Easy" && "bg-green-500/20 text-green-300",
                    quest.difficulty === "Medium" && "bg-amber-500/20 text-amber-300",
                    quest.difficulty === "Hard" && "bg-red-500/20 text-red-300"
                  )}>{quest.difficulty}</div>
                )}
              </div>
              <h4 className="text-white font-bold text-base mb-1.5">{quest.title}</h4>
              <p className="text-slate-400 text-sm leading-relaxed mb-3 line-clamp-2 flex-1">{quest.description}</p>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1 text-[9px] font-black text-green-400 uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" /><span className="truncate max-w-[160px]">{quest.impact}</span>
                </div>
                {quest.points && <div className="text-amber-400 font-black text-sm shrink-0">+{quest.points} pts</div>}
              </div>
              <button
                onClick={acceptQuest}
                disabled={accepted}
                className={clsx(
                  "w-full font-black py-2.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm",
                  accepted
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/20"
                )}
              >
                {accepted ? "✓ Quest Accepted!" : <>Accept Task <ArrowUpRight className="w-3.5 h-3.5" /></>}
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="empty" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="flex-1 flex flex-col items-center justify-center gap-3"
            >
              <div className="p-3 bg-blue-500/10 rounded-full">
                <Trophy className="w-6 h-6 text-blue-400" />
              </div>
              <p className="text-slate-400 text-sm font-medium">No active quest</p>
              <button
                onClick={fetchQuest}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 text-white text-xs font-black rounded-lg transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
              >
                {loading ? (
                  <><Spinner color="white" /> Generating...</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> Generate Quest</>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}

// --- Quick Link Card ---

const QuickLinkCard = memo(function QuickLinkCard({ 
  title, 
  desc, 
  detail,
  icon, 
  color = "green",
  onClick, 
  className 
}: { 
  title: string; 
  desc: string; 
  detail?: string;
  icon: React.ReactNode; 
  color?: "green" | "blue" | "emerald" | "amber" | "purple";
  onClick: () => void; 
  className?: string 
}) {
  const colorClasses = {
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  
  return (
    <button
      onClick={onClick}
      className={clsx(
        "group text-left p-3 md:p-4 glass rounded-2xl hover:bg-white/5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex flex-col h-full",
        className
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500", colorClasses[color])}>
          {icon}
        </div>
        <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all" />
      </div>
      <h4 className="text-white font-black text-sm mb-0.5">
        {title}
      </h4>
      <p className="text-slate-400 text-[10px] font-medium mb-1.5">{desc}</p>
      {detail && (
        <div className="mt-auto pt-2 border-t border-white/5">
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{detail}</p>
        </div>
      )}
    </button>
  );
});

// --- Global Impact Section ---

function GlobalImpactSection() {
  const [userCount, setUserCount] = useState(10000);
  const debouncedCount = useDebounce(userCount, 150);

  const stats = useMemo(() => ({
    co2: Math.round(debouncedCount * 24.5),
    trees: Math.round(debouncedCount * 24.5 / 22),
    savings: Math.round(debouncedCount * 85),
  }), [debouncedCount]);

  return (
    <Card className="relative overflow-hidden py-8 md:py-10 text-center" glow="green">
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-blue-500/5" />
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-black uppercase tracking-widest mb-4">
          <Brain className="w-3 h-3" /> Global Impact Simulation
        </div>
        <h3 className="text-2xl md:text-3xl font-black text-white mb-2 tracking-tight">
          If <span className="text-gradient"><AnimatedCounter value={debouncedCount} duration={800} /></span> people used EcoOS
        </h3>
        <div className="flex flex-wrap justify-center gap-6 md:gap-10 mt-6 mb-6">
          <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-center">
            <div className="text-3xl md:text-4xl font-black text-white mb-0.5">
              <AnimatedCounter value={stats.co2} duration={1000} />
            </div>
            <div className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Tons CO₂ saved/year</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center">
            <div className="text-3xl md:text-4xl font-black text-green-400 mb-0.5">
              <AnimatedCounter value={stats.trees} duration={1000} />
            </div>
            <div className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Equivalent trees</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center">
            <div className="text-3xl md:text-4xl font-black text-blue-400 mb-0.5">
              $<AnimatedCounter value={stats.savings} duration={1000} />
            </div>
            <div className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Collective savings</div>
          </motion.div>
        </div>
        <div className="flex items-center justify-center gap-3">
          <span className="text-slate-500 text-[10px] font-bold">1K</span>
          <input
            type="range"
            min={1000}
            max={100000}
            step={1000}
            value={userCount}
            onChange={(e) => setUserCount(Number(e.target.value))}
            className="w-48 md:w-64 eco-range cursor-pointer"
          />
          <span className="text-slate-500 text-[10px] font-bold">100K</span>
        </div>
      </div>
    </Card>
  );
}
