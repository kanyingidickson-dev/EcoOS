# 🌍 EcoOS Intelligence: A Real-Time Behavioral OS for Climate Action

> "What if every daily decision showed its carbon cost instantly?"

**EcoOS Intelligence** is a premium, AI-powered sustainability platform that transforms environmental intention into measurable action. Built for the [**DEV Weekend Challenge: Earth Day Edition**](https://dev.to/challenges/weekend-2026-04-16), it leverages the speed and reasoning of **Google Gemini 2.5 Flash** (with automatic 2.0 Flash fallback) to deliver a unified, gamified, and deeply personalized experience.

- **Live Demo**: https://eco-os.vercel.app/
- **Repo**: https://github.com/kanyingidickson-dev/EcoOS.git

## ⚡ TL;DR

EcoOS is an AI-powered sustainability platform that helps users:

- Understand their carbon footprint  
- Simulate future impact of decisions  
- Get personalized recommendations  
- Take action through gamified challenges  

Built with **Google Gemini (2.5 Flash + fallback)** and designed for **real-world reliability**.

---

## 📸 Screenshots

### 🌱 Carbon Mirror — AI-Powered Footprint Analysis
![Carbon Mirror](https://raw.githubusercontent.com/kanyingidickson-dev/EcoOS/main/public/screenshot-carbon-mirror.png)

### 🎯 What-If Simulator — See Impact Before You Act
![What-If Simulator](https://raw.githubusercontent.com/kanyingidickson-dev/EcoOS/main/public/screenshot-whatif.png)

### ♻️ WasteWise — Image-Based Waste Classification
![WasteWise](https://raw.githubusercontent.com/kanyingidickson-dev/EcoOS/main/public/screenshot-wastewise.png)

### 🚗 EcoRoute — 9-Mode Transport Comparison
![EcoRoute](https://raw.githubusercontent.com/kanyingidickson-dev/EcoOS/main/public/screenshot-ecoroute.png)

### 💬 Carbon Coach — Personalized AI Advisor
![Carbon Coach](https://raw.githubusercontent.com/kanyingidickson-dev/EcoOS/main/public/screenshot-carboncoach.png)

### 📊 Intelligence Dashboard
![Dashboard](https://raw.githubusercontent.com/kanyingidickson-dev/EcoOS/main/public/screenshot-dashboard.png)

---

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **Next.js 16** (App Router) | Framework |
| **Google Gemini 2.5 Flash** | AI reasoning engine (with 2.0 fallback) |
| **Tailwind CSS 4** | Utility-first styling |
| **Framer Motion** | Animations & transitions |
| **Outfit + Inter** | Typography (Google Fonts) |
| **localStorage** | Personalization persistence |
| **Vitest** | Unit & component testing (51 tests) |

---

## ✨ Core Features

### 1. 📊 Intelligence Dashboard
A central command center for your planet-friendly lifestyle.
- **Global Impact Counter**: Live simulation of community-wide CO₂ savings with interactive slider
- **Animated Eco-Score Ring**: Real-time SVG ring visualization of your sustainability grade
- **Dynamic Activity Feed**: Rotating community contribution stream
- **History Sparkline**: Visual chart of your recent activity

### 2. 🌱 Carbon Mirror (Primary Intelligence Engine)
Describe your lifestyle in plain English — AI does the rest.
- **Multi-Step Reasoning**: Decomposition → Category Scoring → Synthesis → Recommendations
- **4-Category Breakdown**: Transport, Food, Energy, Consumer Goods with animated progress bars
- **Confidence Scoring**: High/Medium/Low analysis confidence indicator
- **Multi-Platform Sharing**: Share to X/Twitter, Facebook, LinkedIn, or copy formatted text for Instagram & TikTok

### 3. 🏆 Eco-Quest (Behavior Engine)
AI-generated daily challenges that adapt to your history.
- **Personalized Missions**: Gemini generates unique quests based on completed quest history
- **Impact Metrics**: Every quest shows quantified environmental benefit
- **Points System**: Earn eco-points that feed into your overall score

### 4. 🎯 What-If Simulator (WOW Feature)
Explore behavioral changes before committing.
- **Timeline Projections**: See impact at 1 month, 6 months, and 1 year
- **Impact Equivalences**: Trees planted, flights avoided, driving distance equivalent
- **Money Savings**: Financial benefit of sustainability changes
- **Community Scale**: "If 10,000 people did this..." projections

### 5. 💬 Carbon Coach (Conversational AI)
Your personal AI sustainability advisor with memory.
- **Persistent Conversations**: Chat survives tab switches via localStorage
- **Personalized Context**: Coach knows your eco-score, past analyses, completed quests
- **Action Items**: Specific steps with CO₂ savings estimates
- **Adaptive Scoring**: Coach interactions adjust your eco-score

### 6. ♻️ WasteWise Vision (New WOW Feature)
Multi-modal AI reasoning engine for complex disposal decisions.
- **Image-Based Analysis**: Upload or snap a photo of any waste item
- **Material Decomposition**: Gemini 2.0 Flash visually identifies component materials
- **Contamination Check**: Automatically detects food residue or mixed materials
- **Instant Advice**: Accurate disposal category and specific waste-reduction tips

### 7. 🚗 EcoRoute
Transport optimization with comparative metrics.
- **9 Transport Modes**: Car, EV, Bus, Train, Bicycle, Walking, Motorcycle, Airplane, Ferry,
- **Annual Projections**: Year-long savings calculations
- **Scale Impact**: Community-level impact if 10,000 users switched
Transport optimization comparing 9 modes with annual projections and community scale impact.

---

## 🌍 Why This Matters

Most people want to help the planet—but lack clear, actionable guidance.

EcoOS bridges that gap by turning:
- Awareness → measurable insights  
- Intent → simulated outcomes  
- Actions → tracked progress  

👉 Making sustainability practical, not theoretical.

---

## 🧠 The AI Magic: Why Gemini 2.5 Flash?

We built a **production-grade AI reasoning engine**, not just a chat wrapper. Our architecture prioritizes **speed, reliability, and cost-efficiency** through a multi-layered approach:

### 1. Model Cascade with Automatic Failover
Production resilience through tiered fallback:
```
Gemini 2.5-flash (primary) → Gemini 2.0-flash (fallback) → Intelligent Mock (offline)
```

### 2. Multi-Step Chain-of-Thought Reasoning
Every prompt follows a structured reasoning pipeline:
```
Input → Decomposition → Category Scoring → Synthesis → Recommendation
```

### 3. Structured JSON Output
100% reliable UI rendering through `responseMimeType: "application/json"`:
```json
{
  "estimate": 245,
  "confidence": "medium",
  "breakdown": [
    { "category": "Transport", "value": 120, "detail": "..." },
    { "category": "Food", "value": 75, "detail": "..." }
  ],
  "suggestions": ["Switch to transit — saves ~48kg CO2/month", "..."]
}
```

### 4. Response Validation & Sanitization
- **6 custom validators** ensure every response matches expected schema
- **Numeric sanitization** prevents NaN/undefined from reaching UI
- **Retry with exponential backoff** before graceful mock fallback
- **12-second timeout** prevents UI hangs on slow networks

### 5. Request Optimization
Performance optimizations for scale:
- **In-memory caching**: 5-minute TTL for identical requests
- **Token usage logging**: Cost monitoring and optimization

### 6. Circuit Breaker Pattern
Quota protection for production reliability:
- **Automatic detection** of rate limit errors
- **5-minute cooldown** after quota exhaustion
- **Graceful degradation** to intelligent mock responses

### 7. Personalization Engine
The system **learns and adapts** across sessions:
- Stores carbon footprint history, completed quests, coach topics
- Injects personalization context into all AI prompts
- Quest generator avoids repeating previously completed challenges
- Coach references your past analyses in conversations

---

## 🎨 Design Philosophy: "Premium Sustainability"

EcoOS moves beyond the "boring green" of typical eco-apps:

- **Modern Dark Aesthetic**: Deep slate backgrounds with emerald and electric blue accents
- **Glassmorphism**: Layered, translucent components with backdrop blur
- **Animated SVG Ring Score**: Real-time eco-grade with glow effects
- **Framer Motion**: Smooth page transitions, staggered card animations, spring physics
- **Custom Range Slider**: Gradient thumb with glow shadow for Global Impact
- **Micro-Interactions**: Points popup, toast notifications, pulsing badges

---

## 📦 Getting Started

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Set up `.env.local`** (copy from `.env.example`):
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
4. **Run**: `npm run dev`

> Do not commit secrets. Keep your API keys in `.env.local` (gitignored).

> The app works without an API key using intelligent mock fallbacks — perfect for demos and local development.

---

## 🧪 Testing

Comprehensive test coverage ensures reliability:

- **10 test files** with 51+ tests across validators, sanitization, and UI components
- **Response validation** tests ensure Gemini JSON schema compliance
- **Mock fallback** tests verify 100% offline functionality
- **Vitest + React Testing Library** for fast, reliable test execution

---

## 🎥 Demo Flow (Recommended)

1. **Dashboard** → See the animated eco-score ring, live stats, and Eco-Quest
2. **Carbon Mirror** → Describe a lifestyle, watch multi-step analysis unfold
3. **What-If Simulator** → Try "What if I stop using Uber?" — see timeline projections
4. **Carbon Coach** → Ask "I eat meat daily but want to improve"
5. **Return to Dashboard** → Notice eco-score has increased from your interactions

---

## 🌍 Vision

Most people want to help the planet but don't know where to start. EcoOS bridges the gap between **intention** and **action**, proving that with the right data and a little bit of AI, everyone can be a green champion.

**Built with 💚 for the planet.**

#devchallenge #earthday #gemini #nextjs #sustainability #ai
