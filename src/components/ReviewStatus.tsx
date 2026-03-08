"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

interface ReviewEvent {
  phase: string;
  message?: string;
  status?: string;
  novelty_score?: number;
  answer?: string;
}

export default function ReviewStatus({
  studyId,
  initialExplanation,
  initialStatus,
  onComplete,
}: {
  studyId: string;
  initialExplanation?: string | null;
  initialStatus?: string;
  onComplete?: (status: string) => void;
}) {
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [done, setDone] = useState(false);
  const [finalStatus, setFinalStatus] = useState<string | null>(
    initialStatus === "proposed" || initialStatus === "rejected" ? initialStatus : null
  );
  const [expanded, setExpanded] = useState(false);

  const explanation = events.find((e) => e.answer)?.answer || initialExplanation || "";

  useEffect(() => {
    // Don't stream if already reviewed
    if (initialStatus === "proposed" || initialStatus === "rejected") {
      setTimeout(() => {
        setDone(true);
      }, 1000);
      return;
    }

    const evtSource = new EventSource(`/api/review-status?id=${studyId}`);

    evtSource.onmessage = (e) => {
      if (e.data === "[DONE]") {
        evtSource.close();
        setDone(true);
        return;
      }

      try {
        const event: ReviewEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, event]);

        if (event.phase === "done" && event.status) {
          setFinalStatus(event.status);
          onComplete?.(event.status);
        }
      } catch {
        // ignore parse errors
      }
    };

    evtSource.onerror = () => {
      evtSource.close();
      setDone(true);
    };

    return () => evtSource.close();
  }, [studyId, initialStatus, onComplete]);

  const latestEvent = events[events.length - 1];

  // Still connecting
  if (!finalStatus && !latestEvent) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-600 mt-2">
        <Loader2 size={12} className="animate-spin" />
        <span>Connecting to FutureHouse...</span>
      </div>
    );
  }

  // Final result
  if (finalStatus || done) {
    const isProposed = finalStatus === "proposed";
    return (
      <div className={`mt-2 rounded-md border px-3 py-2 ${
        isProposed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
      }`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 w-full text-left"
        >
          {isProposed
            ? <CheckCircle size={14} className="text-green-600 shrink-0" />
            : <XCircle size={14} className="text-red-500 shrink-0" />
          }
          <span className={`text-xs font-semibold flex-1 ${isProposed ? "text-green-700" : "text-red-700"}`}>
            {isProposed
              ? "FutureHouse Owl Agent: Novel hypothesis — approved"
              : "FutureHouse Owl Agent: Prior work exists — rejected"
            }
          </span>
          {explanation && (
            expanded
              ? <ChevronUp size={14} className="text-gray-400 shrink-0" />
              : <ChevronDown size={14} className="text-gray-400 shrink-0" />
          )}
        </button>
        {expanded && explanation && (
          <p className="text-xs text-gray-600 mt-2 leading-relaxed whitespace-pre-line">
            {explanation.slice(0, 1000)}
            {explanation.length > 1000 && "..."}
          </p>
        )}
      </div>
    );
  }

  // In progress — streaming updates
  return (
    <div className="flex items-start gap-2 text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
      <ShieldCheck size={14} className="mt-0.5 shrink-0 animate-pulse" />
      <div>
        <span className="font-semibold">{latestEvent?.message || "Reviewing..."}</span>
        {events.length > 2 && (
          <div className="mt-1 space-y-0.5">
            {events.slice(-3, -1).map((ev, i) => (
              <p key={i} className="text-[11px] text-amber-500">
                {ev.message}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
