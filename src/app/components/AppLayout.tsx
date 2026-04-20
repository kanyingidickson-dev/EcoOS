"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Leaf,
  Activity,
  Zap,
  Wind,
  Recycle,
  Car,
  Globe,
  Sparkles,
  ShieldCheck,
  Menu,
  X,
  Target,
  MessageCircle,
  Users,
  CheckCircle,
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastProvider, StatItem, useToast, Card } from "./shared";

const tabs = [
  { id: "dashboard", label: "Overview", icon: Activity, href: "/dashboard" },
  { id: "footprint", label: "Carbon Mirror", icon: Wind, href: "/footprint" },
  { id: "waste", label: "WasteWise", icon: Recycle, href: "/waste" },
  { id: "transport", label: "EcoRoute", icon: Car, href: "/transport" },
  { id: "whatif", label: "What-If", icon: Target, href: "/what-if" },
  { id: "coach", label: "Carbon Coach", icon: MessageCircle, href: "/coach" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const normalizedPath = pathname.replace(/\/$/, '') || '/';
  const activeTab = tabs.find(t => t.href === normalizedPath)?.id || "dashboard";
  
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const { showToast } = useToast();

  const handleJoinCommunity = useCallback(() => {
    setShowCommunityModal(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-mesh text-slate-200 selection:bg-green-500/30 flex flex-col">
        {/* Animated Eco Background - Dashboard only */}
        {activeTab === "dashboard" && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          {/* Large gradient orbs */}
          <motion.div 
            className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-green-500/10 blur-[120px] rounded-full"
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.1, 0.15, 0.1],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute bottom-[10%] right-[-5%] w-[35%] h-[35%] bg-blue-500/10 blur-[120px] rounded-full"
            animate={{ 
              scale: [1, 1.15, 1],
              opacity: [0.1, 0.12, 0.1],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
          <motion.div 
            className="absolute top-[40%] left-[30%] w-[25%] h-[25%] bg-emerald-500/8 blur-[100px] rounded-full"
            animate={{ 
              x: [0, 30, 0],
              y: [0, -20, 0],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          
          {/* Main rotating ring with feature icons */}
          <motion.div
            className="absolute top-[15%] right-[15%] w-72 h-72"
            animate={{ rotate: 360 }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          >
            {/* Ring border */}
            <div className="absolute inset-0 border-2 border-green-500/15 rounded-full" />
            
            {/* Feature icons positioned on the ring */}
            <motion.div 
              className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-slate-900/80 rounded-xl border border-green-500/30 flex items-center justify-center"
              animate={{ rotate: -360 }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            >
              <Activity className="w-6 h-6 text-green-400" />
            </motion.div>
            
            <motion.div 
              className="absolute top-1/2 -right-6 -translate-y-1/2 w-12 h-12 bg-slate-900/80 rounded-xl border border-blue-500/30 flex items-center justify-center"
              animate={{ rotate: -360 }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            >
              <Wind className="w-6 h-6 text-blue-400" />
            </motion.div>
            
            <motion.div 
              className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-slate-900/80 rounded-xl border border-emerald-500/30 flex items-center justify-center"
              animate={{ rotate: -360 }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            >
              <Recycle className="w-6 h-6 text-emerald-400" />
            </motion.div>
            
            <motion.div 
              className="absolute top-1/2 -left-6 -translate-y-1/2 w-12 h-12 bg-slate-900/80 rounded-xl border border-amber-500/30 flex items-center justify-center"
              animate={{ rotate: -360 }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            >
              <Car className="w-6 h-6 text-amber-400" />
            </motion.div>
            
            {/* Center glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-green-500/10 rounded-full blur-xl" />
          </motion.div>
          
          {/* Inner dashed ring */}
          <motion.div
            className="absolute top-[15%] right-[15%] w-52 h-52 border-2 border-dashed border-emerald-400/20 rounded-full"
            animate={{ rotate: -360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          />
          
          {/* Secondary ring with more icons */}
          <motion.div
            className="absolute bottom-[20%] left-[10%] w-56 h-56"
            animate={{ rotate: -360 }}
            transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
          >
            <div className="absolute inset-0 border border-green-500/10 rounded-full" />
            
            <motion.div 
              className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 bg-slate-900/80 rounded-lg border border-purple-500/30 flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
            >
              <Target className="w-5 h-5 text-purple-400" />
            </motion.div>
            
            <motion.div 
              className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-10 h-10 bg-slate-900/80 rounded-lg border border-pink-500/30 flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
            >
              <MessageCircle className="w-5 h-5 text-pink-400" />
            </motion.div>
            
            <motion.div 
              className="absolute top-1/2 -left-5 -translate-y-1/2 w-10 h-10 bg-slate-900/80 rounded-lg border border-cyan-500/30 flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
            >
              <Leaf className="w-5 h-5 text-cyan-400" />
            </motion.div>
            
            <motion.div 
              className="absolute top-1/2 -right-5 -translate-y-1/2 w-10 h-10 bg-slate-900/80 rounded-lg border border-yellow-500/30 flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-5 h-5 text-yellow-400" />
            </motion.div>
          </motion.div>
          
          {/* Floating eco icons */}
          <motion.div
            className="absolute top-[10%] left-[8%] w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center opacity-40"
            animate={{ y: [0, -15, 0], rotate: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Leaf className="w-5 h-5 text-green-400" />
          </motion.div>
          <motion.div
            className="absolute top-[55%] right-[10%] w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center opacity-30"
            animate={{ y: [0, -20, 0], rotate: [0, -15, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          >
            <Globe className="w-5 h-5 text-blue-400" />
          </motion.div>
          <motion.div
            className="absolute bottom-[20%] left-[20%] w-7 h-7 bg-emerald-500/10 rounded-lg flex items-center justify-center opacity-40"
            animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          >
            <Recycle className="w-4 h-4 text-emerald-400" />
          </motion.div>
        </div>
        )}

        <header
          className={clsx(
            "fixed top-0 w-full z-50 transition-all duration-500 px-6 py-4",
            isScrolled ? "bg-slate-900/40 backdrop-blur-xl border-b border-white/5 py-3" : "bg-transparent"
          )}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/dashboard">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2.5 group cursor-pointer"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-green-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
                  <div className="relative bg-gradient-to-br from-green-400 to-emerald-600 p-2 rounded-xl shadow-xl">
                    <Leaf className="w-5 h-5 text-slate-900" />
                  </div>
                </div>
                <span className="text-white font-black text-2xl tracking-tighter">
                  EcoOS<span className="text-green-500">.</span>
                </span>
              </motion.div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-md">
              {tabs.map((tab) => (
                <NavButton
                  key={tab.id}
                  active={activeTab === tab.id}
                  href={tab.href}
                  icon={<tab.icon className="w-4 h-4" />}
                >
                  {tab.label}
                </NavButton>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleJoinCommunity}
                className="hidden xl:flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-slate-900 px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-green-500/20 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                Join Community
                <span className="ml-1 px-1.5 py-0.5 bg-slate-900/30 text-[9px] rounded">Preview</span>
              </motion.button>
              <button className="lg:hidden text-white" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                {isMobileMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed inset-0 z-40 bg-slate-900/95 backdrop-blur-2xl pt-24 px-6 lg:hidden"
            >
              <div className="flex flex-col gap-4">
                {tabs.map((tab) => (
                  <MobileNavButton
                    key={tab.id}
                    active={activeTab === tab.id}
                    href={tab.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {tab.label}
                  </MobileNavButton>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-4 flex-1 flex flex-col w-full">
          {children}
        </main>

        {/* Footer */}
        <footer className="relative z-10 max-w-6xl mx-auto px-6 border-t border-white/5 pt-12 pb-12 text-center shrink-0">
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-6 mb-12">
            <StatItem icon={<Globe className="w-5 h-5 text-emerald-400" />} label="Real-time Analytics" />
            <StatItem icon={<Zap className="w-5 h-5 text-amber-400" />} label="Gemini 2.0 Flash Powered" />
            <StatItem icon={<ShieldCheck className="w-5 h-5 text-blue-400" />} label="Verified Insights" />
          </div>
          <div className="max-w-md mx-auto mb-8">
            <p className="text-slate-500 text-sm leading-relaxed">
              EcoOS Intelligence is an AI-powered behavioral operating system for climate action — making personal sustainability accessible, actionable, and visually clear for everyone.
            </p>
          </div>

          <p className="mt-12 text-slate-600 text-[10px] font-medium tracking-[0.2em] uppercase">
            © 2026 EcoOS Intelligence Systems. All Rights Reserved.
          </p>
        </footer>
      </div>
      
      {/* Community Waitlist Modal */}
      <CommunityModal 
        isOpen={showCommunityModal} 
        onClose={() => setShowCommunityModal(false)} 
        showToast={showToast}
      />
    </ToastProvider>
  );
}

// --- Nav Components ---

function NavButton({ active, href, children, icon }: { active: boolean; href: string; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300",
        active
          ? "bg-white/10 text-white shadow-sm"
          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
      )}
    >
      <span className={clsx("transition-colors", active ? "text-green-400" : "text-slate-500")}>{icon}</span>
      {children}
    </Link>
  );
}

function MobileNavButton({ active, href, onClick, children }: { active: boolean; href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={clsx(
        "w-full text-left px-6 py-4 rounded-2xl text-xl font-bold transition-all",
        active ? "bg-green-500 text-slate-900" : "bg-white/5 text-slate-300"
      )}
    >
      {children}
    </Link>
  );
}

// --- Community Waitlist Modal ---

function CommunityModal({ isOpen, onClose, showToast }: { isOpen: boolean; onClose: () => void; showToast: (message: string, icon?: string, type?: "success" | "info" | "warning") => void }) {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    
    setLoading(true);
    // DEMO ONLY: Simulate API call - no email is actually stored
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    setJoined(true);
    showToast("Demo: Feature coming soon! 🌍", "🌱", "info");
    
    // Auto-close after delay
    setTimeout(() => {
      onClose();
      setJoined(false);
      setEmail("");
    }, 6000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4"
          >
            <Card className="w-full max-w-md pointer-events-auto overflow-hidden" glow="green">
              {/* Header */}
              <div className="relative p-6 pb-4 border-b border-white/10">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-black text-lg">EcoOS Community</h3>
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-black uppercase rounded">Preview</span>
                    </div>
                    <p className="text-slate-500 text-xs">Future feature preview - Coming in v2.0</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {joined ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-6"
                  >
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-10 h-10 text-green-400" />
                    </div>
                    <h4 className="text-white font-bold text-xl mb-2">Demo Complete! 🎉</h4>
                    <p className="text-slate-400 text-sm">Community feature coming in v2.0</p>
                    <p className="text-slate-600 text-[10px] mt-2 mb-4">(No email was actually stored)</p>
                  </motion.div>
                ) : (
                  <>
                    <div className="space-y-4 mb-6">
                      <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                        <span className="text-xl">📊</span>
                        <div>
                          <p className="text-white text-sm font-bold">Monthly Impact Reports</p>
                          <p className="text-slate-500 text-xs">See your contribution to global CO₂ reduction</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                        <span className="text-xl">🏆</span>
                        <div>
                          <p className="text-white text-sm font-bold">Community Challenges</p>
                          <p className="text-slate-500 text-xs">Join group quests with collective goals</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                        <span className="text-xl">💡</span>
                        <div>
                          <p className="text-white text-sm font-bold">Early Access</p>
                          <p className="text-slate-500 text-xs">Be first to try new AI features</p>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-3">
                      <input
                        type="email"
                        placeholder="Enter your email (demo only)"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm font-bold outline-none focus:border-green-500/50 transition-all"
                        required
                      />
                      <button
                        type="submit"
                        disabled={loading || !email}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 text-slate-900 font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full"
                          />
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Try Demo Signup
                          </>
                        )}
                      </button>
                    </form>

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mt-4">
                      <p className="text-amber-400 text-[10px] text-center font-bold">
                        ⚠️ DEMO ONLY: No emails are stored. This is a UI preview for the upcoming v2.0 community feature.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
