"use client";

import { AnimatePresence, motion } from "framer-motion";

export function ChatImageViewer({
  url,
  onClose,
}: {
  url: string | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {url ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-label="Image preview"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            src={url}
            alt="Full size"
            className="max-h-[85dvh] max-w-full rounded-2xl object-contain"
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.92 }}
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
