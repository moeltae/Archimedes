"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AnalysisJob } from "@/types";
import { getFieldColor } from "@/types";
import { getSessionId } from "@/lib/session";
import { useSearch } from "@/components/SearchContext";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Brain,
  Cpu,
  Code2,
  BarChart3,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ZoomIn,
  Bot,
  ArrowRight,
  RotateCcw,
  RefreshCw,
  Square,
  Ban,
} from "lucide-react";

interface AnalysisJobWithContext extends AnalysisJob {
  module?: {
    id: string;
    module_name: string;
    experiment_id: string;
    is_analysis: boolean;
    assigned_lab: string | null;
    experiment?: {
      id: string;
      title: string;
      tags: string[];
    };
  };
}

const STATUS_BADGE: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: { label: "Queued", color: "bg-gray-100 text-gray-600", icon: Clock },
  generating_code: {
    label: "Generating code",
    color: "bg-blue-100 text-blue-700",
    icon: Code2,
  },
  executing: {
    label: "Executing",
    color: "bg-purple-100 text-purple-700",
    icon: Cpu,
  },
  retrying: {
    label: "Retrying",
    color: "bg-amber-100 text-amber-700",
    icon: RotateCcw,
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    color: "bg-red-100 text-red-700",
    icon: AlertCircle,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-gray-100 text-gray-600",
    icon: Ban,
  },
};

function timeAgo(dateStr: string) {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AnalysisTab() {
  const [jobs, setJobs] = useState<AnalysisJobWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [expandedFigure, setExpandedFigure] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "running" | "completed" | "failed">("all");
  const [rerunningJob, setRerunningJob] = useState<string | null>(null);
  const [cancellingJob, setCancellingJob] = useState<string | null>(null);
  const { searchQuery } = useSearch();

  useEffect(() => {
    async function load() {
      const sessionId = getSessionId();
      if (!sessionId) {
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/analysis/jobs?session_id=${sessionId}`);
      const data = await res.json();
      setJobs(data.jobs || []);
      setLoading(false);
    }
    load();

    // Poll for updates every 10s
    const interval = setInterval(async () => {
      const sessionId = getSessionId();
      if (!sessionId) return;
      const res = await fetch(`/api/analysis/jobs?session_id=${sessionId}`);
      const data = await res.json();
      setJobs(data.jobs || []);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  async function handleRerun(job: AnalysisJobWithContext) {
    setRerunningJob(job.id);
    try {
      const res = await fetch("/api/analysis/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: job.submission_id,
          module_id: job.module_id,
          session_id: "archimedes-ai",
        }),
      });
      const data = await res.json();
      if (data.job_id) {
        const newJob: AnalysisJobWithContext = {
          id: data.job_id,
          submission_id: job.submission_id,
          module_id: job.module_id,
          status: "pending",
          generated_code: null,
          code_language: "python",
          prompt_context: {},
          modal_call_id: null,
          execution_stdout: null,
          execution_stderr: null,
          execution_duration_ms: null,
          figure_urls: [],
          output_file_urls: [],
          statistical_results: {},
          interpretation: null,
          error_message: null,
          retry_count: 0,
          max_retries: 3,
          created_at: new Date().toISOString(),
          completed_at: null,
          follow_up_prompt: null,
          module: job.module,
        };
        setJobs((prev) => [newJob, ...prev]);
        setExpandedJob(data.job_id);
      }
    } catch (err) {
      console.error("Re-run failed:", err);
    }
    // Clear after a brief delay so the user sees the loading animation on the card
    setTimeout(() => setRerunningJob(null), 2000);
  }

  async function handleCancel(job: AnalysisJobWithContext) {
    setCancellingJob(job.id);
    try {
      await fetch(`/api/analysis/${job.id}/cancel`, { method: "POST" });
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? { ...j, status: "cancelled" as const, error_message: "Analysis was cancelled by user" }
            : j
        )
      );
    } catch (err) {
      console.error("Cancel failed:", err);
    }
    setCancellingJob(null);
  }

  // Group jobs by module_id and pick the latest job per module
  const latestByModule = (() => {
    const grouped = new Map<string, AnalysisJobWithContext[]>();
    for (const job of jobs) {
      const key = job.module_id;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(job);
    }
    // Sort each group by created_at descending and return the latest + run count
    const result: (AnalysisJobWithContext & { _runCount: number; _completedCount: number })[] = [];
    for (const [, group] of grouped) {
      group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const latest = group[0];
      const completedCount = group.filter((j) => j.status === "completed").length;
      result.push({ ...latest, _runCount: group.length, _completedCount: completedCount });
    }
    // Sort modules by latest job's created_at descending
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
  })();

  const filtered = latestByModule.filter((j) => {
    if (filter === "running" && ["completed", "failed", "cancelled"].includes(j.status)) return false;
    if (filter === "completed" && j.status !== "completed") return false;
    if (filter === "failed" && j.status !== "failed") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const moduleName = j.module?.module_name?.toLowerCase() || "";
      const studyTitle = j.module?.experiment?.title?.toLowerCase() || "";
      const tags = (j.module?.experiment?.tags || []).map((t) => t.toLowerCase());
      if (!moduleName.includes(q) && !studyTitle.includes(q) && !tags.some((t) => t.includes(q))) {
        return false;
      }
    }

    return true;
  });

  // Stats based on unique modules (latest job per module)
  const stats = {
    total: latestByModule.length,
    running: latestByModule.filter((j) => !["completed", "failed", "cancelled"].includes(j.status)).length,
    completed: latestByModule.filter((j) => j.status === "completed").length,
    failed: latestByModule.filter((j) => j.status === "failed").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-20">
        <Brain size={36} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-lg">No analysis jobs yet.</p>
        <p className="text-gray-400 text-sm mt-1">
          When you submit experiment data, the AI agent will automatically
          analyze it.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { key: "all" as const, label: "Total", value: stats.total, icon: Brain, color: "text-purple-500" },
          { key: "running" as const, label: "Running", value: stats.running, icon: Cpu, color: "text-blue-500" },
          { key: "completed" as const, label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-green-500" },
          { key: "failed" as const, label: "Failed", value: stats.failed, icon: AlertCircle, color: "text-red-500" },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`bg-white border rounded-lg px-3 py-2.5 text-left transition-colors ${
              filter === s.key
                ? "border-purple-300 ring-2 ring-purple-100"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-0.5">
              <s.icon size={12} className={s.color} />
              <span>{s.label}</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{s.value}</p>
          </button>
        ))}
      </div>

      {/* Job list */}
      <div className="flex flex-col gap-3">
        {filtered.map((job) => {
          const badge = STATUS_BADGE[job.status] || STATUS_BADGE.pending;
          const BadgeIcon = badge.icon;
          const isExpanded = expandedJob === job.id;
          const isRunning = !["completed", "failed", "cancelled"].includes(job.status);
          const studyTitle = job.module?.experiment?.title || "Unknown study";
          const moduleName = job.module?.module_name || "Unknown module";
          const isAiModule = job.module?.is_analysis;
          const tags = job.module?.experiment?.tags || [];
          const completedRuns = job._completedCount;

          return (
            <div
              key={job.id}
              className={`bg-white border border-gray-200 rounded-lg overflow-hidden relative ${
                rerunningJob === job.id ? "animate-pulse" : ""
              }`}
            >
              {/* Re-run loading overlay */}
              {rerunningJob === job.id && (
                <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[1px] flex items-center justify-center rounded-lg">
                  <div className="flex items-center gap-2.5 bg-white px-4 py-2.5 rounded-full shadow-sm border border-purple-100">
                    <Loader2 size={16} className="animate-spin text-purple-500" />
                    <span className="text-sm font-medium text-purple-700">Re-running analysis...</span>
                  </div>
                </div>
              )}

              {/* Job header */}
              <button
                onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isAiModule && (
                        <Bot size={14} className="text-purple-500 shrink-0" />
                      )}
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {moduleName}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${badge.color}`}
                      >
                        <BadgeIcon
                          size={10}
                          className={isRunning ? "animate-spin" : ""}
                        />
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {studyTitle}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {tags.map((tag) => {
                        const c = getFieldColor(tag);
                        return (
                          <span
                            key={tag}
                            className={`text-[10px] px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}
                          >
                            {tag}
                          </span>
                        );
                      })}
                      <span className="text-[10px] text-gray-400">
                        {timeAgo(job.created_at)}
                      </span>
                      {job.execution_duration_ms && job.status === "completed" && (
                        <span className="text-[10px] text-gray-400">
                          · {(job.execution_duration_ms / 1000).toFixed(1)}s
                        </span>
                      )}
                      {job.follow_up_prompt && (
                        <span className="text-[10px] text-purple-500 italic truncate max-w-[200px]">
                          &quot;{job.follow_up_prompt}&quot;
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 mt-1">
                    {job.figure_urls.length > 0 && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <BarChart3 size={10} />
                        {job.figure_urls.length}
                      </span>
                    )}
                    {completedRuns > 0 && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <BarChart3 size={10} />
                        {completedRuns}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={14} className="text-gray-400" />
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  {/* Running state */}
                  {isRunning && (
                    <div className="px-4 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Loader2
                          size={18}
                          className="animate-spin text-purple-500"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            {badge.label}...
                          </p>
                          <p className="text-xs text-gray-400">
                            This typically takes 15-45 seconds
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel(job);
                        }}
                        disabled={cancellingJob === job.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-40 transition-colors"
                      >
                        {cancellingJob === job.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Square size={12} />
                        )}
                        Stop
                      </button>
                    </div>
                  )}

                  {/* Completed */}
                  {job.status === "completed" && (
                    <div className="divide-y divide-gray-100">
                      {/* Interpretation */}
                      {job.interpretation && (
                        <div className="px-4 py-3">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Sparkles size={11} className="text-amber-400" />
                            Interpretation
                          </h4>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {job.interpretation}
                          </p>
                        </div>
                      )}

                      {/* Figures */}
                      {job.figure_urls.length > 0 && (
                        <div className="px-4 py-3">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <BarChart3 size={11} className="text-blue-500" />
                            Figures ({job.figure_urls.length})
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {job.figure_urls.map((url, i) => (
                              <div
                                key={i}
                                className="relative group border border-gray-100 rounded-lg overflow-hidden bg-gray-50 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedFigure(
                                    expandedFigure === url ? null : url
                                  );
                                }}
                              >
                                <img
                                  src={url}
                                  alt={`Figure ${i + 1}`}
                                  className={`w-full ${
                                    expandedFigure === url
                                      ? "max-h-none"
                                      : "max-h-48 object-contain"
                                  }`}
                                />
                                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <span className="bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                    <ZoomIn size={9} />
                                    {expandedFigure === url
                                      ? "Collapse"
                                      : "Expand"}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Stats summary */}
                      {job.statistical_results &&
                        Object.keys(job.statistical_results).length > 0 && (
                          <div className="px-4 py-3">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                              <BarChart3
                                size={11}
                                className="text-green-500"
                              />
                              Statistical Results
                            </h4>
                            <div className="bg-gray-50 rounded-lg p-2.5 overflow-x-auto">
                              <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap">
                                {JSON.stringify(
                                  job.statistical_results,
                                  null,
                                  2
                                )}
                              </pre>
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {/* Cancelled */}
                  {job.status === "cancelled" && (
                    <div className="px-4 py-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-600">
                          Analysis was stopped. You can re-run it at any time.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Failed */}
                  {job.status === "failed" && (
                    <div className="px-4 py-3">
                      <div className="bg-red-50 rounded-lg p-3">
                        <p className="text-sm text-red-700">
                          {job.error_message || "Analysis failed"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Actions footer */}
                  <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <Link
                      href={`/my-experiments/${job.module_id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700"
                    >
                      View full module details
                      <ArrowRight size={12} />
                    </Link>
                    {!isRunning && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRerun(job);
                        }}
                        disabled={rerunningJob === job.id}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-purple-600 disabled:opacity-40 transition-colors"
                      >
                        {rerunningJob === job.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        Re-run analysis
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
