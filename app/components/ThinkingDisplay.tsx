'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface ThinkingDisplayProps {
  steps: string[];
  isActive: boolean;
}

export default function ThinkingDisplay({ steps, isActive }: ThinkingDisplayProps) {
  if (!isActive && steps.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      <AnimatePresence mode="popLayout">
        {steps.map((step, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="flex items-start gap-3 text-sm text-gray-700 dark:text-purple-100 bg-orange-50/80 dark:bg-purple-900/30 p-3 rounded-xl border border-orange-200/50 dark:border-purple-500/30 backdrop-blur-sm transition-all duration-300"
          >
            <motion.div
              animate={isActive && index === steps.length - 1 ? {
                rotate: 360
              } : {}}
              transition={{
                duration: 1,
                repeat: isActive && index === steps.length - 1 ? Infinity : 0,
                ease: "linear"
              }}
              className="flex-shrink-0"
            >
              {isActive && index === steps.length - 1 ? (
                <span className="text-orange-600 dark:text-purple-400 text-lg">⚡</span>
              ) : (
                <span className="text-green-600 dark:text-green-400 text-lg">✓</span>
              )}
            </motion.div>
            <span className="flex-1 font-medium">{step}</span>
          </motion.div>
        ))}
      </AnimatePresence>

      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 text-sm text-orange-600 dark:text-purple-300 font-medium"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="w-2 h-2 bg-orange-500 dark:bg-purple-400 rounded-full"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
            className="w-2 h-2 bg-orange-500 dark:bg-purple-400 rounded-full"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
            className="w-2 h-2 bg-orange-500 dark:bg-purple-400 rounded-full"
          />
          <span className="ml-2">Processing...</span>
        </motion.div>
      )}
    </div>
  );
}