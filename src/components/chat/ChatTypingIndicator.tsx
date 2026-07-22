"use client";

import { motion } from "framer-motion";

export function ChatTypingIndicator({ name }: { name: string }) {
  return (
    <motion.p
      className="text-xs text-white/45"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <span className="inline-flex items-center gap-1">
        {name} is typing
        <span className="inline-flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="inline-block h-1 w-1 rounded-full bg-white/50"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                delay: i * 0.15,
              }}
            />
          ))}
        </span>
      </span>
    </motion.p>
  );
}
