"use client";

import { motion } from "framer-motion";

export function ChatTypingIndicator({ name }: { name: string }) {
  return (
    <motion.div
      className="flex justify-start"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-[#1f2c34] px-3.5 py-2.5">
        <span className="sr-only">{name} is typing</span>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full bg-white/55"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
            transition={{
              duration: 0.85,
              repeat: Infinity,
              delay: i * 0.14,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
