"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";

export default function RejectionCountdown({
  rejectedAt,
  onExpired,
}: {
  rejectedAt: string;
  onExpired?: () => void;
}) {
  const [remaining, setRemaining] = useState<number>(() => {
    const expiresAt = new Date(rejectedAt).getTime() + 60 * 60 * 1000;
    return Math.max(0, expiresAt - Date.now());
  });

  useEffect(() => {
    if (remaining <= 0) {
      onExpired?.();
      return;
    }

    const interval = setInterval(() => {
      const expiresAt = new Date(rejectedAt).getTime() + 60 * 60 * 1000;
      const left = Math.max(0, expiresAt - Date.now());
      setRemaining(left);

      if (left <= 0) {
        clearInterval(interval);
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [rejectedAt, remaining, onExpired]);

  if (remaining <= 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
        <Trash2 size={12} />
        <span>Expired — deleting...</span>
      </div>
    );
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const progress = (remaining / (60 * 60 * 1000)) * 100;

  // Color shifts from amber to red as time runs out
  const isUrgent = minutes < 10;
  const isCritical = minutes < 2;

  return (
    <div className={`rounded-md border px-3 py-2 ${
      isCritical
        ? "bg-red-50 border-red-300"
        : isUrgent
          ? "bg-orange-50 border-orange-200"
          : "bg-amber-50 border-amber-200"
    }`}>
      <div className="flex items-center gap-2">
        <Trash2
          size={13}
          className={`shrink-0 ${
            isCritical
              ? "text-red-500 animate-pulse"
              : isUrgent
                ? "text-orange-500"
                : "text-amber-500"
          }`}
        />
        <span className={`text-xs font-semibold ${
          isCritical
            ? "text-red-700"
            : isUrgent
              ? "text-orange-700"
              : "text-amber-700"
        }`}>
          Auto-delete in {minutes}:{seconds.toString().padStart(2, "0")}
        </span>
      </div>
      {/* Progress bar */}
      <div className="mt-1.5 w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all duration-1000 ${
            isCritical
              ? "bg-red-500"
              : isUrgent
                ? "bg-orange-400"
                : "bg-amber-400"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className={`text-[11px] mt-1 ${
        isCritical ? "text-red-500" : isUrgent ? "text-orange-500" : "text-amber-500"
      }`}>
        Rejected by AI agent. Community can override with 10+ net upvotes.
      </p>
    </div>
  );
}
