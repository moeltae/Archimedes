"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NavSidebar from "@/components/NavSidebar";
import { getSessionId } from "@/lib/session";
import { MyModule } from "@/types";
import { FlaskConical, ArrowRight, Loader2, Sparkles } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  claimed: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-gray-200 text-gray-600",
};

const PALETTE = [
  { solid: "#3b82f6", text: "#1d4ed8", light: "#eff6ff" },
  { solid: "#10b981", text: "#047857", light: "#ecfdf5" },
  { solid: "#f59e0b", text: "#b45309", light: "#fffbeb" },
  { solid: "#8b5cf6", text: "#6d28d9", light: "#f5f3ff" },
  { solid: "#f43f5e", text: "#be123c", light: "#fff1f2" },
];

export default function MyExperiments() {
  const [modules, setModules] = useState<MyModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const sessionId = getSessionId();
      if (!sessionId) { setLoading(false); return; }
      const res = await fetch(`/api/my-experiments?session_id=${sessionId}`);
      const data = await res.json();
      setModules(data.modules || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-48px)]">
      <NavSidebar />

      <main className="flex-1 min-w-0 px-6 py-4">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FlaskConical size={22} className="text-indigo-500" />
            Your Experiments
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Modules you&apos;ve volunteered your lab for.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : modules.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No experiments yet.</p>
            <p className="text-gray-400 text-sm mt-1">
              Browse studies and volunteer your lab for open modules.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 mt-4 text-sm text-orange-500 hover:underline"
            >
              Browse studies
              <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {modules.map((mod, idx) => {
              const color = PALETTE[idx % PALETTE.length];
              const progress = mod.samples_total > 0
                ? Math.round((mod.samples_completed / mod.samples_total) * 100)
                : 0;
              const pct = mod.budget_pct ?? (100 / mod.total_modules_in_study);
              const moduleBudget = mod.study_funded_amount * (pct / 100);
              const moduleBudgetGoal = mod.study_funding_goal * (pct / 100);

              return (
                <Link
                  key={mod.id}
                  href={`/my-experiments/${mod.id}`}
                  className="block bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                  style={{ borderLeft: `3px solid ${color.solid}` }}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: color.solid }}
                          />
                          <h3 className="text-sm font-semibold truncate" style={{ color: color.text }}>
                            {mod.module_name}
                          </h3>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLES[mod.status] || "bg-gray-100 text-gray-600"}`}>
                            {mod.status.replace("_", " ")}
                          </span>
                          {mod.has_submission && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 shrink-0">
                              submitted
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          Part of: {mod.experiment_title}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {moduleBudgetGoal > 0 && (
                          <div className="text-right">
                            <div className="text-sm font-bold text-green-600 flex items-center gap-1 justify-end">
                              {moduleBudget > 0 ? `$${Math.round(moduleBudget).toLocaleString()}` : "—"}
                              {mod.budget_rationale && <Sparkles size={10} className="text-amber-400" />}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {Math.round(pct)}% — ${Math.round(moduleBudgetGoal).toLocaleString()} goal
                            </div>
                          </div>
                        )}
                        <ArrowRight size={16} className="text-gray-400 mt-1" />
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                        <span>Sample progress</span>
                        <span>{mod.samples_completed}/{mod.samples_total} samples</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${progress}%`, backgroundColor: color.solid }}
                        />
                      </div>
                    </div>

                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
