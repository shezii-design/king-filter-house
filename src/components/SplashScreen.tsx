import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Cpu, ShieldCheck, Database, Zap } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

const LOADING_STEPS = [
  { text: "Booting KFH Intelligent Engine...", icon: Cpu, color: "text-sky-400" },
  { text: "Loading local catalog index...", icon: Database, color: "text-indigo-400" },
  { text: "Establishing cost cryptography...", icon: Zap, color: "text-amber-400" },
  { text: "Verifying local ledger tables...", icon: ShieldCheck, color: "text-emerald-400" },
  { text: "Engine optimized. Launching...", icon: Sparkles, color: "text-sky-400" }
];

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  useEffect(() => {
    // Progress increment timer
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        // Random incremental jumps for realistic loading feel
        const increment = Math.floor(Math.random() * 8) + 4;
        const next = Math.min(prev + increment, 100);
        
        // Dynamically advance step index based on progress
        const stepIndex = Math.min(
          Math.floor((next / 100) * LOADING_STEPS.length),
          LOADING_STEPS.length - 1
        );
        setCurrentStepIdx(stepIndex);
        
        return next;
      });
    }, 120);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress === 100) {
      // Small delay after 100% before closing to let the user see 'Ready!'
      const timeout = setTimeout(() => {
        onComplete();
      }, 600);
      return () => clearTimeout(timeout);
    }
  }, [progress, onComplete]);

  const CurrentIcon = LOADING_STEPS[currentStepIdx].icon;

  return (
    <div className="fixed inset-0 z-[10000] bg-[#070D18] flex flex-col items-center justify-center overflow-hidden font-sans antialiased select-none" id="splash-screen">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.12)_0%,transparent_70%)] pointer-events-none" />
      
      {/* Absolute micro-grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111C30_1px,transparent_1px),linear-gradient(to_bottom,#111C30_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-25 pointer-events-none" />

      {/* Floating abstract rings simulating mechanical filter dimensions */}
      <div className="absolute w-[450px] h-[450px] rounded-full border border-sky-500/5 animate-[spin_40s_linear_infinite]" />
      <div className="absolute w-[350px] h-[350px] rounded-full border border-dashed border-indigo-500/5 animate-[spin_25s_linear_infinite_reverse]" />
      <div className="absolute w-[250px] h-[250px] rounded-full border border-slate-800/20" />

      {/* Center visual card */}
      <div className="relative flex flex-col items-center max-w-sm w-full px-6 text-center z-10">
        
        {/* Animated Brand Symbol representing Filter & Core Engine */}
        <div className="relative mb-8">
          {/* Pulsing ring */}
          <motion.div 
            animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="absolute -inset-4 rounded-full bg-gradient-to-r from-sky-500/20 to-indigo-500/20 blur-xl"
          />

          {/* Golden Gear/Ring Border Container */}
          <motion.div 
            initial={{ rotate: -45, scale: 0.8, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="w-20 h-20 rounded-2xl bg-slate-900/95 border-2 border-slate-850 flex items-center justify-center shadow-2xl relative overflow-hidden group"
          >
            {/* Corner tech accents */}
            <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-sky-400 rounded-full opacity-40" />
            <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-indigo-400 rounded-full opacity-40" />
            
            {/* Floating Filter Core Lines representation */}
            <div className="absolute inset-x-0 h-full flex flex-col justify-around py-2 px-1 opacity-20 pointer-events-none">
              <div className="h-0.5 w-full bg-sky-400" />
              <div className="h-0.5 w-full bg-sky-400" />
              <div className="h-0.5 w-full bg-sky-400" />
              <div className="h-0.5 w-full bg-sky-400" />
            </div>

            <CurrentIcon className={`w-9 h-9 transition-all duration-300 ${LOADING_STEPS[currentStepIdx].color} drop-shadow-[0_2px_10px_rgba(14,165,233,0.3)]`} />
          </motion.div>
        </div>

        {/* System Title */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="space-y-1"
        >
          <h1 className="text-xl font-black text-white tracking-widest uppercase font-mono">
            KFH <span className="text-[#0EA5E9]">INTELLIGENT</span> SUITE
          </h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
            Automotive Ledger &amp; Stock Terminal
          </p>
        </motion.div>

        {/* Loading Bar Container */}
        <div className="w-full mt-10 space-y-3.5">
          {/* Animated step feedback text */}
          <div className="h-5 flex items-center justify-center gap-1.5 text-[11px] font-mono font-semibold text-slate-350">
            <motion.span
              key={currentStepIdx}
              initial={{ y: 4, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -4, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="inline-flex items-center gap-1.5"
            >
              <CurrentIcon className={`w-3.5 h-3.5 ${LOADING_STEPS[currentStepIdx].color}`} />
              {LOADING_STEPS[currentStepIdx].text}
            </motion.span>
          </div>

          {/* Progress outer track */}
          <div className="h-1 w-full bg-slate-900/90 rounded-full overflow-hidden border border-slate-800/40 relative">
            <motion.div 
              className="h-full bg-gradient-to-r from-sky-400 via-[#0EA5E9] to-indigo-500 rounded-full"
              style={{ width: `${progress}%` }}
              transition={{ ease: "easeInOut" }}
            />
          </div>

          {/* Percentage Indicator */}
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
            <span>OFFLINE DISTRIBUTOR DATABASE</span>
            <span className="font-bold text-sky-400">{progress}%</span>
          </div>
        </div>

        {/* Footer Integrity Certificate */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="absolute bottom-[-100px] text-[9px] font-mono uppercase tracking-[0.15em] text-slate-500"
        >
          Secured with SHA-256 local Cryptography
        </motion.p>

      </div>
    </div>
  );
}
