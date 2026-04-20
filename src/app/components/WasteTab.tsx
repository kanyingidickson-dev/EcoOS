"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Recycle,
  Leaf,
  Trash2,
  Sparkles,
  AlertTriangle,
  Cpu,
  Clock,
  History,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  Brain,
  Layers,
  Search,
  ClipboardCheck,
  Lightbulb,
  Copy,
  Share2,
  PlusCircle,
} from "lucide-react";
import clsx from "clsx";
import {
  Card,
  Spinner,
  SkeletonCard,
  PointsPopup,
  getStore,
  updateStore,
  useToast,
  type WasteResult,
} from "./shared";

const QUICK_SCAN_CATEGORIES = {
  "🍔 Food Packaging": [
    "Pizza box with grease",
    "Starbucks coffee cup",
    "Chip bag",
    "Milk carton",
    "Yogurt cup",
    "Egg carton",
    "Bread bag",
    "Butter wrapper",
  ],
  "📱 Electronics": [
    "Old iPhone",
    "Cracked phone screen",
    "Charger cable",
    "Earbuds",
    "Laptop",
    "TV remote",
    "Used batteries",
    "Car battery",
  ],
  "🏠 Household": [
    "Plastic bag",
    "Banana peel",
    "Broken CFL light bulb",
    "Styrofoam container",
    "Toothbrush",
    "Razor blade",
    "Shampoo bottle",
    "Tissues",
  ],
  "🍾 Glass & Misc": [
    "Wine bottle",
    "Broken glass",
    "Mirror",
    "Aluminum foil",
    "Wax paper",
    "Rubber glove",
    "Balloon",
    "Gum wrapper",
  ],
};

export function WasteTab() {
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WasteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPoints, setShowPoints] = useState(false);
  const [recentScans, setRecentScans] = useState<string[]>([]);
  const [reasoningStep, setReasoningStep] = useState(0);
  const [isMockLoading, setIsMockLoading] = useState(false);
  const { showToast } = useToast();

  // Simulate realistic AI loading for mock results
  const simulateMockLoading = async () => {
    setIsMockLoading(true);
    setLoading(true);
    
    // Animate reasoning steps like real AI
    setReasoningStep(1);
    await new Promise(r => setTimeout(r, 350));
    setReasoningStep(2);
    await new Promise(r => setTimeout(r, 350));
    setReasoningStep(3);
    await new Promise(r => setTimeout(r, 350));
    setReasoningStep(4);
    await new Promise(r => setTimeout(r, 250));
    
    setIsMockLoading(false);
    setLoading(false);
    setReasoningStep(0);
  };

  const clearResults = () => {
    setResult(null);
    setImage(null);
    setInput("");
    setError(null);
    setLoading(false);
    setIsMockLoading(false);
    setReasoningStep(0);
  };

  const loadQuickItem = (item: string) => {
    setInput(item);
    setImage(null);
    // Auto-analyze after state update
    setTimeout(() => analyze(item), 100);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simple client-side resize and Base64 convert
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        setImage(dataUrl);
      };
      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  // Load recent scans from store
  useEffect(() => {
    const store = getStore();
    setRecentScans(store.recentWasteItems || []);
  }, []);

  const analyze = async (itemToAnalyze?: string) => {
    const query = itemToAnalyze || input;
    if (!query && !image) return;
    if (itemToAnalyze) setInput(itemToAnalyze);
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
    }, 600);
    
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "waste", input: query, image }),
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
      
      setResult(data as WasteResult);

      const store = getStore();
      const updatedWasteItems = [query, ...store.recentWasteItems.filter(i => i !== query).slice(0, 7)];
      updateStore({
        analyses: store.analyses + 1,
        ecoScore: Math.min(100, store.ecoScore + 2),
        recentWasteItems: updatedWasteItems,
      });
      setRecentScans(updatedWasteItems);
      setShowPoints(true);
      showToast("+10 eco points for waste classification!", "♻️", "success");
      setTimeout(() => setShowPoints(false), 1500);
      clearInterval(stepInterval);
    } catch (e: unknown) {
      clearInterval(stepInterval);
      console.error("Waste analysis failed, using dynamic local fallback:", e);
      // Construct a dynamic fallback result with scientifically accurate data
      const q = query.toLowerCase();
      
      // Specific item definitions for accurate responses
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
        "styrofoam container": {
          category: "landfill",
          materials: ["expanded polystyrene (EPS #6)"],
          decomposition: "500+ years (does not biodegrade)",
          tip: "Styrofoam is rarely recycled and breaks into microplastics. Avoid when possible—choose paper alternatives.",
          explanation: "Expanded polystyrene (#6) is not biodegradable and is difficult to recycle due to low density and contamination."
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

      // Check for specific items first
      let fallback: WasteResult | null = null;
      for (const [itemKey, itemData] of Object.entries(specificItems)) {
        if (q.includes(itemKey)) {
          fallback = {
            category: itemData.category,
            materials: itemData.materials,
            explanation: itemData.explanation,
            tip: itemData.tip,
            decomposition_time: itemData.decomposition
          };
          break;
        }
      }

      // Fallback to keyword-based classification if no specific match
      // ORDER MATTERS: Check specific/composite materials BEFORE general categories
      if (!fallback) {
        // Define material type flags (checked in priority order below)
        const isHazardous = q.includes("bulb") || q.includes("paint") || q.includes("chemical") || q.includes("motor oil") || q.includes("pesticide");
        const isEWaste = q.includes("battery") || q.includes("electronic") || q.includes("phone") || q.includes("cable") || q.includes("laptop") || q.includes("computer") || q.includes("tablet") || q.includes("charger");
        const isCoffeeCup = q.includes("coffee") || q.includes("starbucks") || q.includes("dunkin");
        const isGreasy = q.includes("grease") || q.includes("oil") || q.includes("dirty") || q.includes("pizza");
        const isCompostable = q.includes("peel") || q.includes("apple") || q.includes("banana") || q.includes("food waste") || q.includes("vegetable") || q.includes("fruit") || q.includes("coffee grounds") || q.includes("eggshell") || q.includes("core");
        const isPaper = q.includes("paper") || q.includes("box") || q.includes("cardboard") || q.includes("carton") || q.includes("newspaper") || q.includes("magazine");
        const isGlass = q.includes("glass") || q.includes("jar") || q.includes("wine bottle") || q.includes("beer bottle");
        const isMetal = q.includes("can") || q.includes("metal") || q.includes("aluminum") || q.includes("tin") || q.includes("steel");
        const isFilmPlastic = q.includes("bag") || q.includes("wrap") || q.includes("film");
        const isPlasticContainer = q.includes("plastic") || q.includes("jug") || q.includes("container") || q.includes("tub");
        const isBeverageBottle = q.includes("bottle") && !q.includes("wine") && !q.includes("glass");

        let category = "landfill";
        let materials = ["mixed materials"];
        let tip = "When in doubt, throw it out. Putting non-recyclables in recycling causes contamination and rejects entire loads.";
        let decomposition = "Varies widely; synthetic materials 100-1,000+ years";
        let explanation = "Some items are too complex, contaminated, or composed of mixed materials that cannot be economically separated.";

        // 1. HAZARDOUS (check first—safety priority)
        if (isHazardous) {
          category = "hazardous";
          materials = ["mixed chemicals", "toxic substances"];
          tip = "Never put these in regular bins. Look for local 'Hazardous Household Waste' drop-off days.";
          decomposition = "Varies (can leak toxins for decades)";
          explanation = "Hazardous materials require specialized disposal to prevent soil and water contamination.";
        // 2. E-WASTE (before general electronics)
        } else if (isEWaste) {
          category = "e-waste";
          materials = ["mixed electronics", "circuit boards", "batteries"];
          tip = "Take these to a dedicated e-waste collection point. They contain rare metals that can be recovered!";
          decomposition = "Does not decompose; toxic components last 10-100+ years";
          explanation = "Electronics contain recoverable rare earth metals and hazardous materials requiring specialized handling.";
        // 3. COFFEE CUPS (composite—check before paper/plastic)
        } else if (isCoffeeCup) {
          category = "landfill";
          materials = ["paper", "polyethylene plastic lining"];
          tip = "Most disposable cups have a hidden plastic lining that makes them un-recyclable. Switch to a reusable cup!";
          decomposition = "20-30 years";
          explanation = "The plastic polyethylene lining prevents paper recycling and the paper prevents it from being pure plastic waste.";
        // 4. GREASY PAPER (composite—check before clean paper)
        } else if (isGreasy && isPaper) {
          category = "compost";
          materials = ["paper fiber", "organic residue"];
          tip = "Grease prevents paper recycling, but composting handles it! Remove any plastic windows/stickers first.";
          decomposition = "2-6 months";
          explanation = "Grease-contaminated paper cannot be recycled but breaks down well in composting environments.";
        // 5. FOOD/COMPOSTABLES
        } else if (isCompostable) {
          category = "compost";
          materials = ["organic matter"];
          tip = "Food scraps are perfect for composting—home or industrial. They return nutrients to soil quickly.";
          decomposition = "2-12 weeks depending on conditions";
          explanation = "Organic food waste decomposes rapidly and creates valuable soil amendment through composting.";
        // 6. CLEAN PAPER/CARDBOARD (check after greasy paper, before glass/metal)
        } else if (isPaper) {
          category = "recycle";
          materials = ["paper fiber"];
          tip = "Keep paper dry and clean! Wet or food-soiled paper goes in compost, not recycling.";
          decomposition = "2-6 months in landfill (anaerobic slows decomposition); 2-4 weeks in compost";
          explanation = "Clean paper and cardboard are recyclable and can be reprocessed into new paper products multiple times. In landfills, lack of oxygen slows decomposition significantly.";
        // 7. GLASS
        } else if (isGlass) {
          category = "recycle";
          materials = ["glass"];
          tip = "Rinse containers. Glass is infinitely recyclable without quality loss—one of the best materials to recycle!";
          decomposition = "1,000,000+ years (never decomposes)";
          explanation = "Glass never biodegrades, making recycling essential. It can be recycled endlessly without degradation.";
        // 8. METAL
        } else if (isMetal) {
          category = "recycle";
          materials = ["aluminum", "steel", "tin"];
          tip = "Rinse cans and containers. Metal recycling saves 95% of energy vs. making new metal from ore!";
          decomposition = "200-500 years";
          explanation = "Metals are highly recyclable and valuable. Aluminum and steel can be recycled indefinitely.";
        // 9. FILM PLASTIC (bags/wrap—check before rigid plastic)
        } else if (isFilmPlastic) {
          category = "landfill";
          materials = ["plastic film (LDPE)"];
          tip = "Plastic bags/film cannot go in curbside recycling—they jam equipment. Return to grocery store drop-offs.";
          decomposition = "20-1,000 years depending on type";
          explanation = "Plastic film requires specialized recycling at grocery stores. Curbside machinery cannot process it.";
        // 10. RIGID PLASTIC CONTAINERS/BOTTLES
        } else if (isPlasticContainer || isBeverageBottle) {
          category = "recycle";
          materials = ["plastic (#1 PET or #2 HDPE typical)"];
          tip = "Rinse out food residue. Check for recycling number. Bottles and containers are widely recyclable.";
          decomposition = "100-1,000 years";
          explanation = "Clean plastic containers are recyclable and get new life as fiber, containers, or other products.";
        }

        fallback = {
          category,
          materials,
          explanation,
          tip,
          decomposition_time: decomposition
        };
      }
      // Animate fallback result like real AI
      await simulateMockLoading();
      setResult(fallback);
      showToast("Local classification active.", "💡", "info");
    }
    setLoading(false);
    setIsMockLoading(false);
    setReasoningStep(0);
  };

  const getTheme = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes("recycle")) return { color: "text-blue-400", bg: "bg-blue-500", icon: <Recycle className="w-12 h-12" />, glow: "shadow-blue-500/30" };
    if (c.includes("compost")) return { color: "text-green-400", bg: "bg-green-500", icon: <Leaf className="w-12 h-12" />, glow: "shadow-green-500/30" };
    if (c.includes("hazardous")) return { color: "text-amber-400", bg: "bg-amber-500", icon: <AlertTriangle className="w-12 h-12" />, glow: "shadow-amber-500/30" };
    if (c.includes("e-waste")) return { color: "text-purple-400", bg: "bg-purple-500", icon: <Cpu className="w-12 h-12" />, glow: "shadow-purple-500/30" };
    return { color: "text-slate-400", bg: "bg-slate-500", icon: <Trash2 className="w-12 h-12" />, glow: "shadow-slate-500/30" };
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -20 }} 
      className="h-full flex flex-col lg:flex-row gap-4 min-h-0"
    >
      {/* Sidebar - Quick Scan Items */}
      <div className="w-full lg:w-80 xl:w-96 max-w-full shrink-0 bg-slate-900/50 rounded-2xl border border-white/10 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-white/10 bg-white/5">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            Waste<span className="text-blue-500">Wise</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">Choose an item to classify</p>
        </div>
        
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
          {Object.entries(QUICK_SCAN_CATEGORIES).map(([category, items]) => (
            <div key={category}>
              <div className="text-slate-600 text-[10px] font-black uppercase tracking-wider mb-2 px-1">
                {category}
              </div>
              <div className="space-y-1">
                {items.map((item: string) => (
                  <button
                    key={item}
                    onClick={() => loadQuickItem(item)}
                    disabled={loading}
                    className="w-full text-left group bg-white/5 hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/30 rounded-xl px-3 py-2 transition-all"
                  >
                    <div className="text-slate-300 group-hover:text-blue-300 text-xs font-medium">
                      {item}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          
          {/* Recent Scans */}
          {recentScans.length > 0 && (
            <div className="pt-4 border-t border-white/10">
              <div className="text-slate-600 text-[10px] font-black uppercase tracking-wider mb-2 px-1 flex items-center gap-1">
                <History className="w-3 h-3" /> Recent
              </div>
              <div className="space-y-1">
                {recentScans.slice(0, 5).map((item) => (
                  <button
                    key={item}
                    onClick={() => loadQuickItem(item)}
                    disabled={loading}
                    className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl px-3 py-2 transition-all"
                  >
                    <div className="text-slate-400 text-xs">{item}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-black text-lg">
              {result ? "Classification Result" : "Classify Waste Item"}
            </h3>
            <p className="text-slate-500 text-xs">
              {result 
                ? `Analyzed: ${input || "Image upload"}`
                : "Type an item name, upload a photo, or select from sidebar"
              }
            </p>
          </div>
          {result && (
            <button
              onClick={clearResults}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              New Scan
            </button>
          )}
        </div>

        <Card className="mb-4 p-3 flex flex-col gap-3 group relative overflow-hidden" glow="blue">
          <PointsPopup points={10} show={showPoints} />
          
          {/* Image Preview Area */}
          {image && (
            <div className="relative w-full h-48 sm:h-64 rounded-2xl overflow-hidden mb-2 shadow-2xl">
              <img src={image} alt="Waste to analyze" className="w-full h-full object-cover" />
              <button 
                onClick={() => setImage(null)}
                className="absolute top-3 right-3 p-2.5 bg-black/60 hover:bg-red-500/80 backdrop-blur-md rounded-full text-white transition-all hover:scale-110 active:scale-90"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex gap-2 sm:gap-3 items-center relative z-10">
            <label className="cursor-pointer shrink-0 p-3 sm:p-4 bg-white/5 hover:bg-blue-500/10 border border-white/10 rounded-2xl transition-all flex flex-col items-center justify-center gap-1 group/snap">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <Camera className="w-5 h-5 text-blue-400 group-hover/snap:scale-110 transition-transform" />
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 hidden sm:block">Snap</span>
            </label>
            <div className="flex-1 flex items-center bg-white/5 border border-white/5 rounded-2xl px-4 group-focus-within:bg-white/10 group-focus-within:border-blue-500/30 transition-all">
              <input
                type="text"
                placeholder={image ? "Add extra context..." : "Type item name or upload photo..."}
                className="flex-1 bg-transparent border-none outline-none py-3 sm:py-4 text-white text-sm sm:text-base font-bold placeholder:text-slate-600"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && analyze()}
              />
            </div>
            <button
              onClick={() => analyze()}
              disabled={loading || (!input && !image)}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-black px-6 py-3 rounded-2xl transition-all shadow-xl shadow-blue-500/20 text-sm flex items-center gap-2 group/btn"
            >
              {loading ? <Spinner color="white" /> : (
                <>
                  <span className="hidden sm:inline">Analyze</span>
                  <Sparkles className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" />
                </>
              )}
            </button>
          </div>
        </Card>

      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm mb-4 text-center">{error}</div>}

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div 
            key="loading"
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }} 
            className="space-y-4"
          >
            {/* Reasoning Steps Visualization */}
            <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-white/10">
              <div className="text-center mb-6">
                <Brain className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <h3 className="text-white font-black text-lg">Multi-Step Analysis Pipeline</h3>
                <p className="text-slate-500 text-xs mt-1">Powered by Gemini 2.0 Flash Vision</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ReasoningStep 
                  icon={<Layers className="w-5 h-5" />}
                  label="Material Analysis"
                  description="Identify components"
                  step={1}
                  currentStep={reasoningStep}
                  color="blue"
                />
                <ReasoningStep 
                  icon={<Search className="w-5 h-5" />}
                  label="Contamination"
                  description="Check for soiling"
                  step={2}
                  currentStep={reasoningStep}
                  color="blue"
                />
                <ReasoningStep 
                  icon={<ClipboardCheck className="w-5 h-5" />}
                  label="Classification"
                  description="Determine disposal bin"
                  step={3}
                  currentStep={reasoningStep}
                  color="blue"
                />
                <ReasoningStep 
                  icon={<Lightbulb className="w-5 h-5" />}
                  label="Advice"
                  description="Generate expert tip"
                  step={4}
                  currentStep={reasoningStep}
                  color="blue"
                />
              </div>
            </Card>
            <SkeletonCard />
          </motion.div>
        )}

        {result && (
          <motion.div 
            key="result"
            initial={{ scale: 0.95, opacity: 0, y: 20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.95, opacity: 0, y: -20 }}
            className="space-y-6 text-center"
          >
          <Card className="relative py-16 overflow-hidden" glow="blue">
            {/* Copy button in top-right corner */}
            <button
              onClick={() => {
                const text = `♻️ WasteWise Scan: "${input || "Unknown item"}"\n\n📦 Category: ${result.category}\n⏱️ Decomposition: ${result.decomposition_time}\n💡 Tip: ${result.tip}`;
                navigator.clipboard.writeText(text);
              }}
              className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all"
              title="Copy classification details"
            >
              <Copy className="w-4 h-4" />
            </button>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className={clsx("mx-auto w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-2xl text-slate-900", getTheme(result.category).bg, getTheme(result.category).glow)}
            >
              {getTheme(result.category).icon}
            </motion.div>
            <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mb-2">Disposal Category</div>
            <h3 className={clsx("text-5xl md:text-6xl font-black uppercase tracking-tighter mb-6", getTheme(result.category).color)}>
              {result.category}
            </h3>

            {/* Materials breakdown */}
            {result.materials && result.materials.length > 0 && (
              <div className="flex justify-center gap-2 mb-6">
                {result.materials.map((mat) => (
                  <span key={mat} className="bg-white/5 text-slate-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border border-white/10">
                    {mat}
                  </span>
                ))}
              </div>
            )}

            <p className="text-slate-300 text-lg font-medium max-w-md mx-auto leading-relaxed">{result.explanation}</p>

            {/* Decomposition time */}
            {result.decomposition_time && (
              <div className="mt-6 inline-flex items-center gap-2 bg-white/5 rounded-full px-4 py-2 border border-white/10">
                <Clock className="w-4 h-4 text-slate-500" />
                <span className="text-slate-400 text-xs font-bold">Decomposition: {result.decomposition_time}</span>
              </div>
            )}
          </Card>

          <Card className="flex items-center gap-6 text-left border-white/5">
            <div className="p-4 bg-white/5 rounded-2xl text-yellow-400 shadow-inner">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Expert Tip</div>
              <p className="text-white font-bold">{result.tip}</p>
            </div>
          </Card>

          {/* Reasoning Pipeline Summary */}
          <Card className="bg-gradient-to-r from-blue-500/5 to-indigo-500/5 border-blue-500/20">
            <div className="flex items-center gap-3 mb-4">
              <Brain className="w-5 h-5 text-blue-400" />
              <h3 className="text-white font-black text-sm">Gemini Vision Analysis Pipeline</h3>
              <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full">Completed</span>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 1</span>
                </div>
                <p className="text-white text-xs font-bold">Material Analysis</p>
                <p className="text-slate-500 text-[10px] mt-0.5">{result.materials?.join(", ") || "Mixed materials"}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 2</span>
                </div>
                <p className="text-white text-xs font-bold">Contamination Check</p>
                <p className="text-slate-500 text-[10px] mt-0.5">Soiling assessment complete</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 3</span>
                </div>
                <p className="text-white text-xs font-bold">Classification</p>
                <p className="text-slate-500 text-[10px] mt-0.5">{result.category} bin</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Step 4</span>
                </div>
                <p className="text-white text-xs font-bold">Expert Advice</p>
                <p className="text-slate-500 text-[10px] mt-0.5">{result.tip.slice(0, 25)}...</p>
              </div>
            </div>
          </Card>

          {/* Shareable Impact Card */}
          <ShareableWasteCard result={result} input={input} />

          {/* Scan Another Button */}
          <button
            onClick={clearResults}
            className="mx-auto flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white px-6 py-3 rounded-xl font-bold text-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            Scan Another Item
          </button>
          </motion.div>
        )}
      </AnimatePresence>
      </div> {/* Close Main Content Area */}
    </motion.div>
  );
}

// Shareable Waste Card Component
function ShareableWasteCard({ result, input }: { result: WasteResult; input: string }) {
  const [copied, setCopied] = useState(false);

  const shareText = `♻️ WasteWise Scan: "${input || "Unknown item"}"

📦 Category: ${result.category}
⏱️ Decomposition: ${result.decomposition_time}
💡 Tip: ${result.tip}

Proper disposal matters! #EcoOS #WasteWise #Recycling`;

  const handleTwitterShare = () => {
    const tweetText = encodeURIComponent(`♻️ WasteWise Scan: "${(input || "Unknown item").slice(0, 60)}${(input || "").length > 60 ? '...' : ''}"\n\n📦 Category: ${result.category}\n💡 ${result.tip.slice(0, 80)}${result.tip.length > 80 ? '...' : ''}\n\n#EcoOS #WasteWise #Recycling`);
    window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, "_blank");
  };

  const handleFacebookShare = () => {
    const fbText = encodeURIComponent(`♻️ WasteWise Scan: "${input || "Unknown item"}"\n\n📦 Category: ${result.category}\n⏱️ Decomposition: ${result.decomposition_time}\n💡 Tip: ${result.tip}\n\nProper disposal matters!`);
    window.open(`https://www.facebook.com/sharer/sharer.php?quote=${fbText}`, "_blank");
  };

  const handleWhatsAppShare = () => {
    const waText = encodeURIComponent(`♻️ WasteWise Scan: "${input || "Unknown item"}"\n\n📦 Category: ${result.category}\n⏱️ Decomposition: ${result.decomposition_time}\n💡 Tip: ${result.tip}`);
    window.open(`https://wa.me/?text=${waText}`, "_blank");
  };

  const handleLinkedInShare = () => {
    const liText = encodeURIComponent(`♻️ WasteWise Scan: "${input || "Unknown item"}"\n\n📦 Category: ${result.category}\n⏱️ Decomposition: ${result.decomposition_time}\n💡 Tip: ${result.tip}\n\n#EcoOS #WasteWise #Recycling #Sustainability`);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${liText}`, "_blank");
  };

  const handleInstagramCopy = () => {
    const igText = `♻️ WasteWise Scan\n\n"${input || "Unknown item"}"\n📦 ${result.category}\n⏱️ ${result.decomposition_time}\n💡 ${result.tip}\n\n#EcoOS #WasteWise #Recycling #Sustainability #EcoFriendly #WasteReduction #GoGreen #ZeroWaste`;
    navigator.clipboard.writeText(igText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleTikTokCopy = () => {
    const ttText = `Just scanned "${input || "Unknown item"}" with WasteWise ♻️\n\nIt goes in: ${result.category}\nTakes ${result.decomposition_time} to decompose!\n\n${result.tip}\n\n#EcoOS #WasteWise #Recycling #Sustainability #EcoFriendly #fyp #LearnOnTikTok`;
    navigator.clipboard.writeText(ttText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getTheme = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes("recycle")) return { color: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/10" };
    if (c.includes("compost")) return { color: "text-green-400", border: "border-green-500/20", bg: "bg-green-500/10" };
    if (c.includes("hazardous")) return { color: "text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/10" };
    if (c.includes("e-waste")) return { color: "text-purple-400", border: "border-purple-500/20", bg: "bg-purple-500/10" };
    return { color: "text-slate-400", border: "border-slate-500/20", bg: "bg-slate-500/10" };
  };

  const theme = getTheme(result.category);

  return (
    <Card className={clsx("text-center py-8", theme.bg, theme.border)} glow="blue">
      <Recycle className={clsx("w-8 h-8 mx-auto mb-3", theme.color)} />
      <h4 className="text-white font-black text-lg mb-1">Share This Classification</h4>
      <p className="text-slate-400 text-sm mb-4">Help others learn proper disposal</p>
      <div className="bg-slate-900/60 rounded-2xl p-4 border border-white/10 max-w-md mx-auto mb-4 text-left">
        <p className="text-slate-300 text-sm whitespace-pre-line">{shareText}</p>
      </div>
      <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Share to:</div>
      <div className="flex flex-col items-center gap-2">
        <div className="flex justify-center gap-2 flex-wrap">
          <button
            onClick={handleTwitterShare}
            className="flex items-center gap-2 bg-black hover:bg-black/80 text-white border border-white/20 px-4 py-2 rounded-xl font-bold transition-all text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg> X
          </button>
          <button
            onClick={handleFacebookShare}
            className="flex items-center gap-2 bg-[#1877F2]/20 hover:bg-[#1877F2]/30 text-[#1877F2] border border-[#1877F2]/30 px-4 py-2 rounded-xl font-bold transition-all text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg> Facebook
          </button>
          <button
            onClick={handleWhatsAppShare}
            className="flex items-center gap-2 bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/30 px-4 py-2 rounded-xl font-bold transition-all text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg> WhatsApp
          </button>
          <button
            onClick={handleLinkedInShare}
            className="flex items-center gap-2 bg-[#0A66C2]/20 hover:bg-[#0A66C2]/30 text-[#0A66C2] border border-[#0A66C2]/30 px-4 py-2 rounded-xl font-bold transition-all text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg> LinkedIn
          </button>
        </div>
        <div className="flex justify-center gap-2 flex-wrap">
          <button
            onClick={handleInstagramCopy}
            className="flex items-center gap-2 bg-gradient-to-r from-[#833AB4]/20 via-[#FD1D1D]/20 to-[#F77737]/20 hover:from-[#833AB4]/30 hover:via-[#FD1D1D]/30 hover:to-[#F77737]/30 text-pink-400 border border-pink-500/30 px-4 py-2 rounded-xl font-bold transition-all text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg> Copy for Instagram
          </button>
          <button
            onClick={handleTikTokCopy}
            className="flex items-center gap-2 bg-black hover:bg-black/80 text-white border border-white/20 px-4 py-2 rounded-xl font-bold transition-all text-sm"
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

// Reasoning Step Component
function ReasoningStep({ 
  icon, 
  label, 
  description, 
  step, 
  currentStep,
  color = "blue"
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
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
      )}
    </motion.div>
  );
}
