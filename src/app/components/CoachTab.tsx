"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  User,
  Bot,
  Sparkles,
  Zap,
  TrendingUp,
  Brain,
  Trash2,
  MessageCircle,
} from "lucide-react";
import clsx from "clsx";
import {
  Card,
  Spinner,
  PointsPopup,
  getStore,
  updateStore,
  getPersonalizationContext,
  useToast,
  type CoachMessage,
  type CoachResult,
} from "./shared";

const STARTER_CATEGORIES: Record<string, string[]> = {
  "🍽️ Food & Diet": [
    "I eat meat daily but want to improve",
    "What's the lowest effort way to eat more sustainably?",
    "How bad is cheese for the environment compared to meat?",
    "I want to reduce food waste — where do I start?",
    "Is local always better than organic?",
  ],
  "🚗 Transport": [
    "I drive 30 minutes to work every day",
    "My commute is killing my budget and the planet",
    "Should I buy an electric car or keep my old one longer?",
    "Is flying really that much worse than driving?",
    "How can I bike more without arriving sweaty?",
  ],
  "⚡ Home & Energy": [
    "How can I reduce my electricity bill and carbon footprint?",
    "My heating bills are enormous — what can I do?",
    "Are smart thermostats worth the investment?",
    "Which appliances use the most phantom power?",
    "Should I switch to a renewable energy provider?",
  ],
  "🛍️ Shopping & Waste": [
    "I buy a lot of clothes online — is that bad?",
    "How do I stop buying things I don't need?",
    "Is secondhand shopping actually better for the planet?",
    "What packaging is actually recyclable?",
    "How do I convince my family to reduce plastic?",
  ],
  "🌱 Getting Started": [
    "What are the easiest sustainability wins?",
    "I want to start composting but don't know how",
    "I feel overwhelmed — where do I even begin?",
    "How do I calculate my actual carbon footprint?",
    "What's the one change that would have the biggest impact?",
  ],
  "💭 Mindset": [
    "Does individual action even matter?",
    "How do I stay motivated when progress feels slow?",
    "My friends think eco-friendly is expensive",
    "I feel guilty about my lifestyle — help",
    "How do I talk to my partner about sustainability?",
  ],
};

// Flatten for compatibility
const STARTER_PROMPTS = Object.values(STARTER_CATEGORIES).flat();

export function CoachTab() {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPoints, setShowPoints] = useState(false);
  const [hasPersonalization, setHasPersonalization] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  // Load persisted conversation from localStorage
  useEffect(() => {
    const store = getStore();
    if (store.coachMessages && store.coachMessages.length > 0) {
      setMessages(store.coachMessages);
    }
    // Check if we have personalization data
    setHasPersonalization(
      store.analyses > 0 || store.completedQuests > 0 || store.lastCarbonEstimate !== null
    );
  }, []);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      updateStore({ coachMessages: messages.slice(-50) }); // Keep last 50 messages
    }
  }, [messages]);

  // Check if user is near bottom of chat
  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true; // Default to true if no container
    const threshold = 100; // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  // Scroll to show the START of the new assistant message
  const scrollToLatestMessage = () => {
    const el = lastMessageRef.current;
    const container = messagesContainerRef.current;
    if (!el || !container) return;

    // Only auto-scroll if user is near bottom (reading latest)
    if (!isNearBottom()) return;

    // Scroll to show the start of the new message with small padding
    const top = el.offsetTop - 16;
    container.scrollTo({
      top: Math.max(0, top),
      behavior: "smooth",
    });
  };

  // Scroll when new message appears (user or assistant)
  useEffect(() => {
    if (messages.length === 0) return;
    scrollToLatestMessage();
  }, [messages]);

  const sendMessage = useCallback(async (msg?: string) => {
    const text = msg || input;
    if (!text.trim() || loading) return;
    
    setInput("");
    const userMessage: CoachMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      // Build rich context from store + conversation
      const contextParts: string[] = [];
      const store = getStore();
      contextParts.push(`User eco-score: ${store.ecoScore}/100`);
      contextParts.push(`Total CO2 saved so far: ${store.totalCO2Saved.toFixed(1)}kg`);
      contextParts.push(`Analyses completed: ${store.analyses}`);
      contextParts.push(`Quests completed: ${store.completedQuests}`);
      
      if (store.lastCarbonEstimate !== null) {
        contextParts.push(`Last carbon footprint estimate: ${store.lastCarbonEstimate}kg CO2/month`);
      }

      if (store.recentWasteItems.length > 0) {
        contextParts.push(`Recent waste items analyzed: ${store.recentWasteItems.slice(0, 3).join(", ")}`);
      }

      if (store.questHistory.length > 0) {
        contextParts.push(`Recent quests: ${store.questHistory.slice(0, 3).join(", ")}`);
      }
      
      // Include recent conversation for memory
      const allMessages = [...messages, userMessage];
      const recentMsgs = allMessages.slice(-8);
      if (recentMsgs.length > 1) {
        contextParts.push("Recent conversation:");
        recentMsgs.forEach((m) => {
          contextParts.push(`${m.role}: ${m.content}`);
        });
      }

      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "coach",
          input: text,
          context: contextParts.join("\n"),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const coachData = data as CoachResult;
      const assistantMessage: CoachMessage = {
        role: "assistant",
        content: coachData.response,
        data: coachData,
      };
      setMessages((prev) => [...prev, assistantMessage].slice(-50));

      // Update eco score and track topics
      if (coachData.eco_score_delta) {
        const newTopics = [text.slice(0, 50), ...store.coachTopics.slice(0, 9)];
        updateStore({
          ecoScore: Math.min(100, Math.max(0, store.ecoScore + coachData.eco_score_delta)),
          coachTopics: newTopics,
        });
        if (coachData.eco_score_delta > 0) {
          setShowPoints(true);
          showToast(`+${coachData.eco_score_delta} eco score from coaching! 🌱`, "💬", "success");
          setTimeout(() => setShowPoints(false), 1500);
        }
      }
    } catch (e: unknown) {
      console.error("Coach response failed, using local fallback:", e);
      // Dynamic fallback based on keyword detection in user message
      const inputLower = text.toLowerCase();
      
      let fallbackContent = "";
      let actionItems: Array<{ action: string; impact: string }> = [];
      
      if (inputLower.includes("meat") || inputLower.includes("food") || inputLower.includes("diet") || inputLower.includes("eat")) {
        fallbackContent = "Great question about diet! While I can't access my full knowledge base right now, here are evidence-based recommendations:\n\n🥗 **Plant-Forward Eating**\nReducing meat consumption, especially beef, is one of the highest-impact personal changes. Even one meatless day per week saves ~150kg CO₂ yearly.";
        actionItems = [
          { action: "Try Meatless Mondays for 4 weeks", impact: "~12kg CO₂/month" },
          { action: "Swap beef for chicken or plant proteins", impact: "~18kg CO₂/month" },
          { action: "Reduce food waste by planning meals", impact: "~8kg CO₂/month" },
        ];
      } else if (inputLower.includes("car") || inputLower.includes("drive") || inputLower.includes("commute") || inputLower.includes("transport")) {
        fallbackContent = "Transportation is often our biggest emissions source! Here's what the data shows:\n\n🚗 **Smarter Mobility**\nTransportation accounts for ~29% of US emissions. Small changes to how we get around create outsized impact.";
        actionItems = [
          { action: "Use public transit 2 days/week", impact: "~25kg CO₂/month" },
          { action: "Carpool with colleagues or neighbors", impact: "~15kg CO₂/month" },
          { action: "Combine errands into single trips", impact: "~5kg CO₂/month" },
        ];
      } else if (inputLower.includes("energy") || inputLower.includes("electricity") || inputLower.includes("bill") || inputLower.includes("home")) {
        fallbackContent = "Home energy is a great place to start! Many improvements pay for themselves:\n\n⚡ **Home Energy Efficiency**\nHeating, cooling, and electricity typically represent 20-25% of household emissions. Many fixes are low-cost or free.";
        actionItems = [
          { action: "Switch to LED bulbs throughout home", impact: "~3kg CO₂/month" },
          { action: "Lower thermostat 2°F in winter", impact: "~8kg CO₂/month" },
          { action: "Use smart power strips to cut standby", impact: "~4kg CO₂/month" },
        ];
      } else if (inputLower.includes("waste") || inputLower.includes("recycle") || inputLower.includes("compost") || inputLower.includes("trash")) {
        fallbackContent = "Waste management is crucial! What we throw away has hidden carbon costs:\n\n♻️ **Circular Living**\nEvery kg of waste sent to landfill generates ~0.5kg CO₂ equivalent. Reducing and reusing beats recycling.";
        actionItems = [
          { action: "Start composting food scraps", impact: "~5kg CO₂/month" },
          { action: "Buy second-hand for next clothing purchase", impact: "~15kg CO₂/month" },
          { action: "Use reusable bags, bottles, containers", impact: "~2kg CO₂/month" },
        ];
      } else {
        fallbackContent = "Thanks for reaching out! While I'm operating in fallback mode right now, I can still help with these universal sustainability principles:\n\n🌱 **Universal Climate Actions**\nRegardless of your specific situation, these actions consistently deliver impact:";
        actionItems = [
          { action: "Calculate your carbon footprint", impact: "Awareness drives action" },
          { action: "Pick one high-impact habit to change", impact: "Focus beats perfection" },
          { action: "Share your goals with friends/family", impact: "Multiplies your impact" },
        ];
      }
      
      const fallbackMessage: CoachMessage = {
        role: "assistant",
        content: fallbackContent + "\n\n*(Note: Running in offline mode due to high API demand — these recommendations are based on established climate research. Try again in a moment for AI-personalized advice!)*",
        data: {
          response: fallbackContent,
          action_items: actionItems,
          encouragement: "Every small action compounds. You're already making a difference by seeking information!",
          eco_score_delta: 1,
        },
      };
      
      setMessages((prev) => [...prev, fallbackMessage].slice(-50));
      
      // Still give points for engagement
      const store = getStore();
      if (store) {
        updateStore({
          ecoScore: Math.min(100, store.ecoScore + 1),
          coachTopics: [text.slice(0, 50), ...store.coachTopics.slice(0, 9)],
        });
      }
    }
    setLoading(false);
  }, [input, loading, messages, showToast]);

  const clearConversation = () => {
    setMessages([]);
    updateStore({ coachMessages: [] });
    showToast("Conversation cleared", "🗑️", "info");
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }} 
      className="h-full flex flex-col lg:flex-row gap-4 min-h-0"
    >
      {/* Sidebar - Topic Categories */}
        <div className="w-full lg:w-80 xl:w-96 max-w-full shrink-0 bg-slate-900/50 rounded-2xl border border-white/10 overflow-hidden flex flex-col lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
        <div className="p-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center border border-purple-500/20">
              <Bot className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Carbon Coach</h2>
              <p className="text-slate-500 text-xs">AI sustainability advisor</p>
            </div>
          </div>
          {hasPersonalization && (
            <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[9px] font-black uppercase w-fit">
              <Brain className="w-3 h-3" /> Personalized to your history
            </div>
          )}
        </div>
        
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
          {Object.entries(STARTER_CATEGORIES).map(([category, prompts]) => (
            <div key={category}>
              <div className="text-slate-600 text-[10px] font-black uppercase tracking-wider mb-2 px-1">
                {category}
              </div>
              <div className="space-y-1">
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    disabled={loading}
                    className="w-full text-left group bg-white/5 hover:bg-purple-500/10 border border-white/5 hover:border-purple-500/30 rounded-xl px-3 py-2 transition-all"
                  >
                    <div className="text-slate-300 group-hover:text-purple-300 text-xs font-medium leading-snug">
                      {prompt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {messages.length > 0 && (
          <div className="p-3 border-t border-white/10 bg-white/5">
            <button
              onClick={clearConversation}
              className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-red-400 text-xs font-bold uppercase transition-colors px-3 py-2 rounded-lg hover:bg-red-500/10 border border-white/5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Conversation
            </button>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <Card className="relative overflow-hidden flex-1 flex flex-col" glow="purple">
          <PointsPopup points={5} show={showPoints} />

          {/* Chat Messages */}
          <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-4 px-4 py-4">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center mb-6 border border-purple-500/20">
                  <MessageCircle className="w-10 h-10 text-purple-400" />
                </div>
                <h3 className="text-white font-black text-xl mb-2">Start a Conversation</h3>
                <p className="text-slate-500 text-sm font-medium mb-2 max-w-sm">
                  Select a topic from the sidebar or type your own question below.
                </p>
                <p className="text-slate-600 text-xs">
                  I can help with diet, transport, energy, shopping, and more!
                </p>
              </div>
            )}

            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  ref={i === messages.length - 1 ? lastMessageRef : null}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={clsx("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
                >
                  {msg.role === "assistant" && (
                    <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={clsx(
                    "max-w-[80%] rounded-2xl p-4",
                    msg.role === "user"
                      ? "bg-purple-500/20 border border-purple-500/30 text-purple-100"
                      : "bg-white/5 border border-white/10 text-slate-300"
                  )}>
                    <p className="text-sm font-medium leading-relaxed whitespace-pre-line">{msg.content}</p>

                    {/* Action Items */}
                    {msg.data?.action_items && (
                      <div className="mt-4 space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-400" /> Action Items
                        </div>
                        {msg.data.action_items.map((item, j) => (
                          <div key={j} className="flex gap-3 bg-white/5 rounded-xl p-3 border border-white/5">
                            <div className="shrink-0 w-6 h-6 rounded-md bg-green-500/10 text-green-400 flex items-center justify-center font-black text-[10px]">{j + 1}</div>
                            <div>
                              <p className="text-slate-300 text-xs font-bold">{item.action}</p>
                              <p className="text-green-400 text-[10px] font-bold mt-0.5 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" /> {item.impact}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Encouragement */}
                    {msg.data?.encouragement && (
                      <div className="mt-4 p-3 bg-green-500/10 rounded-xl border border-green-500/20">
                        <p className="text-green-400 text-xs font-bold flex items-center gap-2">
                          <Sparkles className="w-3 h-3" /> {msg.data.encouragement}
                        </p>
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="shrink-0 w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-slate-400" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
                  <Spinner color="blue" />
                  <span className="text-slate-500 text-xs font-bold">Thinking...</span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Input Bar */}
          <div className="flex gap-2 p-4 border-t border-white/5 shrink-0 bg-slate-900/30">
            <input
              type="text"
              placeholder="Ask your carbon coach..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-200 font-bold text-sm outline-none focus:border-purple-500/50 transition-all min-w-0"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && sendMessage()}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 text-white p-3 rounded-xl transition-all shadow-lg shadow-purple-500/20 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
