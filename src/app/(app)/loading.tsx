"use client";

import { motion } from "framer-motion";
import { Leaf } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        {/* Animated logo */}
        <motion.div
          animate={{ 
            rotate: 360,
          }}
          transition={{ 
            duration: 2, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="w-14 h-14 bg-gradient-to-br from-green-400/20 to-emerald-600/20 rounded-2xl flex items-center justify-center border border-green-500/30"
        >
          <Leaf className="w-7 h-7 text-green-400" />
        </motion.div>
        
        {/* Loading indicator */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{ 
                duration: 1.2, 
                repeat: Infinity, 
                delay: i * 0.15,
                ease: "easeInOut" 
              }}
              className="w-2.5 h-2.5 bg-green-400/60 rounded-full"
            />
          ))}
        </div>
        
        <motion.p
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="text-slate-500 text-sm font-medium"
        >
          Loading experience...
        </motion.p>
      </motion.div>
    </div>
  );
}
