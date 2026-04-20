"use client";

import React, { useState, useEffect, useCallback, createContext, useContext, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import {
  Globe,
} from "lucide-react";

// --- Types ---

export interface CarbonResult {
  estimate: number;
  confidence?: string;
  breakdown: { category: string; value: number; detail?: string }[];
  explanations?: {
    summary: string;
    top_drivers: string[];
    assumptions: string[];
  };
  recommendations?: {
    action: string;
    savings_kg_month: number;
    difficulty: "Easy" | "Medium" | "Hard";
    why_it_matters: string;
  }[];
  suggestions: string[];
  comparison?: string;
}

export interface WasteResult {
  category: string;
  materials?: string[];
  explanation: string;
  tip: string;
  decomposition_time?: string;
}

export interface TransportResult {
  emitted: number;
  emission_factor?: string;
  greener_option: string;
  greener_emission?: number;
  savings: number;
  annual_savings?: number;
  scale_impact?: string;
  equivalence?: string;
  route_context?: string;
}

export interface QuestResult {
  title: string;
  description: string;
  impact: string;
  category: string;
  difficulty?: string;
  points?: number;
  duration?: string;
}

export interface WhatIfResult {
  scenario: string;
  current_impact: { monthly_co2_kg: number; description: string };
  projected_savings: {
    monthly: { co2_kg: number; money_saved: string };
    six_months: { co2_kg: number; money_saved: string };
    yearly: { co2_kg: number; money_saved: string };
  };
  equivalence: {
    trees_equivalent: number;
    flights_equivalent: string;
    driving_equivalent: string;
  };
  difficulty: string;
  tips: string[];
  community_scale: string;
}

export interface CoachResult {
  response: string;
  action_items: { action: string; impact: string }[];
  encouragement: string;
  eco_score_delta: number;
}

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
  data?: CoachResult;
}

// --- Eco Store (localStorage persistence with personalization) ---

interface EcoStore {
  ecoScore: number;
  totalCO2Saved: number;
  completedQuests: number;
  analyses: number;
  history: { date: string; type: string; co2: number }[];
  // Personalization fields
  lastCarbonEstimate: number | null;
  lastCarbonPlan: {
    updatedAt: string;
    explanations: NonNullable<CarbonResult["explanations"]>;
    recommendations: NonNullable<CarbonResult["recommendations"]>;
  } | null;
  recentWasteItems: string[];
  questHistory: string[];
  coachTopics: string[];
  coachMessages: CoachMessage[];
}

const STORE_KEY = "eco-store";

const DEFAULT_STORE: EcoStore = {
  ecoScore: 50,
  totalCO2Saved: 0,
  completedQuests: 0,
  analyses: 0,
  history: [],
  lastCarbonEstimate: null,
  lastCarbonPlan: null,
  recentWasteItems: [],
  questHistory: [],
  coachTopics: [],
  coachMessages: [],
};

export function getStore(): EcoStore {
  if (typeof window === "undefined") return DEFAULT_STORE;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return DEFAULT_STORE;
    return { ...DEFAULT_STORE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STORE;
  }
}

export function saveStore(store: EcoStore) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e: unknown) {
    if (e instanceof Error && (e.name === "QuotaExceededError" || (e as any).code === 22 || e.message.includes("quota"))) {
      // Clear oldest history and messages to free up space
      store.history = store.history.slice(0, 20);
      store.coachMessages = store.coachMessages.slice(-10);
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(store));
      } catch {
        console.error("Failed to save store even after cleanup");
      }
    }
  }
}

export function updateStore(patch: Partial<EcoStore>): EcoStore {
  const current = getStore();
  const next = { ...current, ...patch };
  saveStore(next);
  return next;
}

export function addHistoryEntry(type: string, co2: number) {
  const store = getStore();
  store.history = [
    { date: new Date().toISOString(), type, co2 },
    ...store.history.slice(0, 49),
  ];
  saveStore(store);
}

// --- Personalization Context Builder ---

export function getPersonalizationContext(): string {
  const store = getStore();
  const parts: string[] = [];

  parts.push(`Eco Score: ${store.ecoScore}/100`);
  parts.push(`Total CO₂ Saved: ${store.totalCO2Saved}kg`);
  parts.push(`Analyses completed: ${store.analyses}`);
  parts.push(`Quests completed: ${store.completedQuests}`);

  if (store.lastCarbonEstimate !== null) {
    parts.push(`Last carbon footprint estimate: ${store.lastCarbonEstimate}kg CO2/month`);
  }

  if (store.recentWasteItems.length > 0) {
    parts.push(`Recent waste items analyzed: ${store.recentWasteItems.slice(0, 5).join(", ")}`);
  }

  if (store.questHistory.length > 0) {
    parts.push(`Previously completed quests: ${store.questHistory.slice(0, 5).join(", ")}`);
    parts.push(`IMPORTANT: Generate a DIFFERENT quest than these previously completed ones.`);
  }

  if (store.coachTopics.length > 0) {
    parts.push(`Topics discussed with coach: ${store.coachTopics.slice(0, 5).join(", ")}`);
  }

  if (store.history.length > 0) {
    const recentActions = store.history.slice(0, 5).map(h =>
      `${h.type} (${h.co2 > 0 ? h.co2 + "kg CO2" : "completed"})`
    );
    parts.push(`Recent activity: ${recentActions.join(", ")}`);
  }

  return parts.join("\n");
}

// --- Toast Context ---

interface Toast {
  id: string;
  message: string;
  icon?: string;
  type?: "success" | "info" | "warning";
}

interface ToastContextType {
  showToast: (message: string, icon?: string, type?: Toast["type"]) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, icon?: string, type?: Toast["type"]) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, icon, type: type || "success" }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className={clsx(
                "px-5 py-3 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-center gap-3 font-bold text-sm",
                toast.type === "success" && "bg-green-500/20 border-green-500/30 text-green-300",
                toast.type === "info" && "bg-blue-500/20 border-blue-500/30 text-blue-300",
                toast.type === "warning" && "bg-amber-500/20 border-amber-500/30 text-amber-300"
              )}
            >
              {toast.icon && <span className="text-lg">{toast.icon}</span>}
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// --- Shared UI Components ---

export const Card = memo(function Card({ children, className, glow }: { children: React.ReactNode; className?: string; glow?: "green" | "blue" | "amber" | "purple" | "none" }) {
  return (
    <div
      className={clsx(
        "glass rounded-[2.5rem] p-8 transition-all duration-500 min-h-0",
        glow === "green" && "hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.2)]",
        glow === "blue" && "hover:shadow-[0_0_40px_-10px_rgba(59,130,246,0.2)]",
        glow === "amber" && "hover:shadow-[0_0_40px_-10px_rgba(245,158,11,0.2)]",
        glow === "purple" && "hover:shadow-[0_0_40px_-10px_rgba(139,92,246,0.2)]",
        className
      )}
    >
      {children}
    </div>
  );
});

export const Spinner = memo(function Spinner({ color = "green" }: { color?: "green" | "blue" | "white" | "amber" }) {
  const colors: Record<string, string> = {
    green: "border-green-500",
    blue: "border-blue-500",
    white: "border-white",
    amber: "border-amber-500",
  };
  return (
    <div className="relative w-5 h-5">
      <div className="absolute top-0 left-0 w-full h-full border-3 border-white/10 rounded-full" />
      <div className={clsx("absolute top-0 left-0 w-full h-full border-3 border-transparent border-t-current rounded-full animate-spin", colors[color])} />
    </div>
  );
});

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

export const SkeletonCard = memo(function SkeletonCard() {
  return (
    <Card className="space-y-4">
      <SkeletonBlock className="h-4 w-1/3" />
      <SkeletonBlock className="h-8 w-2/3" />
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-4/5" />
    </Card>
  );
});

export const AnimatedCounter = memo(function AnimatedCounter({ value, duration = 2000, suffix = "" }: { value: number; duration?: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const start = 0;
    const startTime = Date.now();
    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (value - start) * eased);
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span>
      {display.toLocaleString()}
      {suffix}
    </span>
  );
});

export const ScaleInsight = memo(function ScaleInsight({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-5 bg-white/5 rounded-3xl p-6 border border-white/5">
      <div className="p-3 bg-blue-500/10 rounded-2xl shrink-0">
        <Globe className="w-6 h-6 text-blue-400 animate-pulse" />
      </div>
      <div>
        <h5 className="text-blue-400 font-black text-xs uppercase tracking-widest mb-1.5">Global Perspective</h5>
        <p className="text-slate-400 text-sm leading-relaxed font-medium italic">&quot;{message}&quot;</p>
      </div>
    </div>
  );
});

export const StatItem = memo(function StatItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 text-slate-400 font-bold text-sm tracking-tight group">
      <div className="p-2 bg-white/5 rounded-lg group-hover:scale-110 transition-transform">{icon}</div>
      {label}
    </div>
  );
});

export const PointsPopup = memo(function PointsPopup({ points, show }: { points: number; show: boolean }) {
  if (!show) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 0, scale: 0.5 }}
      animate={{ opacity: [0, 1, 1, 0], y: [0, -20, -30, -50], scale: [0.5, 1.2, 1, 0.8] }}
      transition={{ duration: 1.5, ease: "easeOut" }}
      className="absolute -top-2 right-4 text-green-400 font-black text-lg pointer-events-none z-50"
    >
      +{points} 🌱
    </motion.div>
  );
});

export const EcoScoreBadge = memo(function EcoScoreBadge({ score, pulsing = false }: { score: number; pulsing?: boolean }) {
  const getColor = (s: number) => {
    if (s >= 90) return "from-green-400 to-emerald-600";
    if (s >= 70) return "from-blue-400 to-indigo-600";
    if (s >= 50) return "from-amber-400 to-orange-600";
    return "from-red-400 to-rose-600";
  };

  const getGrade = (s: number) => {
    if (s >= 95) return "S";
    if (s >= 90) return "A+";
    if (s >= 80) return "A";
    if (s >= 70) return "B+";
    if (s >= 60) return "B";
    if (s >= 50) return "C";
    return "D";
  };

  return (
    <div className={clsx("relative", pulsing && "animate-score-pulse")}>
      <div className={clsx("w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-xl font-black text-white text-xl", getColor(score))}>
        {getGrade(score)}
      </div>
      <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full px-1.5 py-0.5 text-[9px] font-black text-slate-400 border border-white/10">
        {score}
      </div>
    </div>
  );
});

// --- Animated SVG Ring Score ---

export const EcoScoreRing = memo(function EcoScoreRing({ score, size = 140, strokeWidth = 10 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 90) return { stroke: "#34d399", glow: "rgba(52, 211, 153, 0.3)" };
    if (s >= 70) return { stroke: "#60a5fa", glow: "rgba(96, 165, 250, 0.3)" };
    if (s >= 50) return { stroke: "#fbbf24", glow: "rgba(251, 191, 36, 0.3)" };
    return { stroke: "#f87171", glow: "rgba(248, 113, 113, 0.3)" };
  };

  const getGrade = (s: number) => {
    if (s >= 95) return "S";
    if (s >= 90) return "A+";
    if (s >= 80) return "A";
    if (s >= 70) return "B+";
    if (s >= 60) return "B";
    if (s >= 50) return "C";
    return "D";
  };

  const colors = getColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />
        {/* Animated progress ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 2, ease: "easeOut" }}
          style={{
            filter: `drop-shadow(0 0 8px ${colors.glow})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="font-black text-white"
          style={{ fontSize: Math.max(12, size * 0.2) }}
        >
          {getGrade(score)}
        </motion.span>
        {size >= 80 && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="font-bold text-slate-500"
          style={{ fontSize: Math.max(8, size * 0.08) }}
        >
          {score}/100
        </motion.span>
        )}
      </div>
    </div>
  );
});

// --- Debounce Hook ---

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
