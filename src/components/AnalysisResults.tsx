"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnalysisJob } from "@/types";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Code2,
  BarChart3,
  Brain,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Send,
  Sparkles,
  Clock,
  Cpu,
  RotateCcw,
  ZoomIn,
  Download,
  FileSpreadsheet,
  Square,
  Ban,
} from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType; pulse?: boolean }
> = {
  pending: {
    label: "Queued",
    color: "text-gray-500 bg-gray-50",
    icon: Clock,
    pulse: true,
  },
  generating_code: {
    label: "Generating analysis code...",
    color: "text-blue-600 bg-blue-50",
    icon: Code2,
    pulse: true,
  },
  executing: {
    label: "Running on Modal...",
    color: "text-purple-600 bg-purple-50",
    icon: Cpu,
    pulse: true,
  },
  retrying: {
    label: "Fixing & retrying...",
    color: "text-amber-600 bg-amber-50",
    icon: RotateCcw,
    pulse: true,
  },
  completed: {
    label: "Analysis complete",
    color: "text-green-600 bg-green-50",
    icon: CheckCircle2,
  },
  failed: {
    label: "Analysis failed",
    color: "text-red-600 bg-red-50",
    icon: AlertCircle,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-gray-600 bg-gray-50",
    icon: Ban,
  },
};

interface Props {
  moduleId: string;
  submissionId: string;
  initialJobs: AnalysisJob[];
}

export default function AnalysisResults({
  moduleId,
  submissionId,
  initialJobs,
}: Props) {
  const [jobs, setJobs] = useState<AnalysisJob[]>(
    initialJobs.filter((j) => j.submission_id === submissionId)
  );
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [showStdout, setShowStdout] = useState(false);
  const [reanalysisPrompt, setReanalysisPrompt] = useState("");
  const [showReanalysis, setShowReanalysis] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [expandedFigure, setExpandedFigure] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Find the latest job for this submission
  const latestJob = jobs.length > 0 ? jobs[0] : null;
  const terminalStatuses = ["completed", "failed", "cancelled"];
  const isRunning =
    latestJob &&
    !terminalStatuses.includes(latestJob.status);

  // Stream status updates for in-progress jobs
  const startPolling = useCallback(
    (jobId: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource(`/api/analysis/status?job_id=${jobId}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId ? { ...j, ...data } : j
            )
          );

          // Close on terminal states
          if (data.status === "completed" || data.status === "failed" || data.status === "cancelled" || data.status === "timeout") {
            es.close();
            eventSourceRef.current = null;
            // Refresh the full job data
            fetch(`/api/analysis/${jobId}`)
              .then((r) => r.json())
              .then((d) => {
                if (d.job) {
                  setJobs((prev) =>
                    prev.map((j) => (j.id === jobId ? d.job : j))
                  );
                }
              })
              .catch(() => {});
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
      };
    },
    []
  );

  // Start polling for any in-progress job on mount
  useEffect(() => {
    if (latestJob && isRunning) {
      startPolling(latestJob.id);
    }
    return () => {
      eventSourceRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger new analysis (manual or re-analysis)
  async function triggerAnalysis(followUpPrompt?: string) {
    setTriggering(true);

    let url: string;
    let body: Record<string, string>;

    if (latestJob && followUpPrompt) {
      // Re-analysis
      url = `/api/analysis/${latestJob.id}/rerun`;
      body = { follow_up_prompt: followUpPrompt };
    } else {
      // First-time trigger
      url = "/api/analysis/trigger";
      body = { submission_id: submissionId, module_id: moduleId } as Record<string, string>;
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.job_id) {
        const newJob: AnalysisJob = {
          id: data.job_id,
          submission_id: submissionId,
          module_id: moduleId,
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
          follow_up_prompt: followUpPrompt || null,
        };
        setJobs((prev) => [newJob, ...prev]);
        setShowReanalysis(false);
        setReanalysisPrompt("");
        startPolling(data.job_id);
      }
    } catch (err) {
      console.error("[AnalysisResults] trigger error:", err);
    } finally {
      setTriggering(false);
    }
  }

  async function cancelJob() {
    if (!latestJob || !isRunning) return;
    setCancelling(true);
    try {
      await fetch(`/api/analysis/${latestJob.id}/cancel`, { method: "POST" });
      // Close the SSE stream
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setJobs((prev) =>
        prev.map((j) =>
          j.id === latestJob.id ? { ...j, status: "cancelled" as const, error_message: "Analysis was cancelled by user" } : j
        )
      );
    } catch (err) {
      console.error("[AnalysisResults] cancel error:", err);
    } finally {
      setCancelling(false);
    }
  }

  if (!latestJob && !triggering) {
    return null; // No analysis yet and none being triggered
  }

  const config = latestJob
    ? STATUS_CONFIG[latestJob.status] || STATUS_CONFIG.pending
    : STATUS_CONFIG.pending;
  const StatusIcon = config.icon;

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Brain size={16} className="text-purple-500" />
          AI Analysis
        </h2>
        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${config.color}`}
          >
            <StatusIcon
              size={12}
              className={config.pulse ? "animate-spin" : ""}
            />
            {config.label}
            {latestJob && latestJob.retry_count > 0 && latestJob.status !== "completed" && (
              <span className="text-[10px] opacity-70">
                (attempt {latestJob.retry_count + 1})
              </span>
            )}
          </span>
          {latestJob?.execution_duration_ms && latestJob.status === "completed" && (
            <span className="text-[10px] text-gray-400">
              {(latestJob.execution_duration_ms / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>

      {/* Loading state with progress phases */}
      {isRunning && (
        <div className="px-5 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Loader2 size={20} className="animate-spin text-purple-500" />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {config.label}
                </p>
                <p className="text-xs text-gray-400">
                  This typically takes 15-45 seconds
                </p>
              </div>
            </div>
            <button
              onClick={cancelJob}
              disabled={cancelling}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-40 transition-colors"
            >
              {cancelling ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Square size={12} />
              )}
              Stop
            </button>
          </div>

          {/* Phase indicators */}
          <div className="flex items-center gap-2">
            {["generating_code", "executing", "completed"].map(
              (phase, i) => {
                const isPast =
                  ["generating_code", "executing", "retrying", "completed"].indexOf(
                    latestJob!.status
                  ) > i ||
                  (latestJob!.status === "completed");
                const isCurrent = latestJob!.status === phase || (phase === "executing" && latestJob!.status === "retrying");
                return (
                  <div key={phase} className="flex items-center gap-2">
                    {i > 0 && (
                      <div
                        className={`w-8 h-0.5 ${
                          isPast ? "bg-purple-400" : "bg-gray-200"
                        }`}
                      />
                    )}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isPast
                          ? "bg-purple-500 text-white"
                          : isCurrent
                            ? "bg-purple-100 text-purple-600 ring-2 ring-purple-300"
                            : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {isPast && !isCurrent ? (
                        <CheckCircle2 size={12} />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={`text-[11px] ${
                        isCurrent
                          ? "text-purple-600 font-medium"
                          : isPast
                            ? "text-gray-600"
                            : "text-gray-400"
                      }`}
                    >
                      {phase === "generating_code"
                        ? "Generate"
                        : phase === "executing"
                          ? "Execute"
                          : "Interpret"}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}

      {/* Completed results */}
      {latestJob?.status === "completed" && (
        <div className="divide-y divide-gray-100">
          {/* Interpretation */}
          {latestJob.interpretation && (
            <div className="px-5 py-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-400" />
                Interpretation
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                {latestJob.interpretation}
              </p>
            </div>
          )}

          {/* Figures */}
          {latestJob.figure_urls && latestJob.figure_urls.length > 0 && (
            <div className="px-5 py-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <BarChart3 size={12} className="text-blue-500" />
                Figures ({latestJob.figure_urls.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {latestJob.figure_urls.map((url, i) => (
                  <div
                    key={i}
                    className="relative group border border-gray-100 rounded-lg overflow-hidden bg-gray-50 cursor-pointer"
                    onClick={() =>
                      setExpandedFigure(
                        expandedFigure === url ? null : url
                      )
                    }
                  >
                    <img
                      src={url}
                      alt={`Analysis figure ${i + 1}`}
                      className={`w-full ${
                        expandedFigure === url
                          ? "max-h-none"
                          : "max-h-64 object-contain"
                      }`}
                    />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="bg-black/60 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1">
                        <ZoomIn size={10} />
                        {expandedFigure === url ? "Collapse" : "Expand"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Statistical Results */}
          {latestJob.statistical_results &&
            Object.keys(latestJob.statistical_results).length > 0 && (
              <div className="px-5 py-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <BarChart3 size={12} className="text-green-500" />
                  Statistical Results
                </h3>
                <div className="bg-gray-50 rounded-lg p-3 overflow-x-auto">
                  <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap">
                    {JSON.stringify(latestJob.statistical_results, null, 2)}
                  </pre>
                </div>
              </div>
            )}

          {/* Output Files (CSV, JSON, etc.) */}
          {latestJob.output_file_urls && latestJob.output_file_urls.length > 0 && (
            <div className="px-5 py-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileSpreadsheet size={12} className="text-orange-500" />
                Generated Files ({latestJob.output_file_urls.length})
              </h3>
              <div className="space-y-1.5">
                {latestJob.output_file_urls.map((url, i) => {
                  const filename = (() => {
                    try {
                      const path = new URL(url).pathname;
                      return decodeURIComponent(path.split("/").pop() || `File ${i + 1}`);
                    } catch {
                      return `File ${i + 1}`;
                    }
                  })();
                  return (
                    <a
                      key={i}
                      href={url}
                      download={filename}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-3 py-2 bg-orange-50 rounded-lg border border-orange-100 hover:bg-orange-100 transition-colors group"
                    >
                      <FileSpreadsheet size={14} className="text-orange-500 shrink-0" />
                      <span className="text-sm text-gray-700 truncate flex-1">{filename}</span>
                      <Download size={14} className="text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Generated Code (collapsible) */}
          {latestJob.generated_code && (
            <div className="px-5 py-3">
              <button
                onClick={() => setShowCode(!showCode)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                {showCode ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                <Code2 size={12} />
                View generated code
              </button>
              {showCode && (
                <div className="mt-2 bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-xs text-gray-100 font-mono whitespace-pre-wrap">
                    {latestJob.generated_code}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Raw stdout (collapsible) */}
          {latestJob.execution_stdout && (
            <div className="px-5 py-3">
              <button
                onClick={() => setShowStdout(!showStdout)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                {showStdout ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                Raw output
              </button>
              {showStdout && (
                <div className="mt-2 bg-gray-50 rounded-lg p-3 overflow-x-auto max-h-60 overflow-y-auto">
                  <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap">
                    {latestJob.execution_stdout}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Re-analysis */}
          <div className="px-5 py-3">
            {!showReanalysis ? (
              <button
                onClick={() => setShowReanalysis(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors"
              >
                <RefreshCw size={12} />
                Re-analyze with different focus
              </button>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">
                  What should the re-analysis focus on?
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={reanalysisPrompt}
                    onChange={(e) => setReanalysisPrompt(e.target.value)}
                    placeholder="e.g., Focus on correlation between X and Y, use Mann-Whitney U test..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && reanalysisPrompt.trim()) {
                        triggerAnalysis(reanalysisPrompt.trim());
                      }
                    }}
                  />
                  <button
                    onClick={() =>
                      triggerAnalysis(
                        reanalysisPrompt.trim() || "Re-run with different visualizations and additional statistical tests"
                      )
                    }
                    disabled={triggering}
                    className="px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors flex items-center gap-1.5"
                  >
                    {triggering ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    Run
                  </button>
                  <button
                    onClick={() => {
                      setShowReanalysis(false);
                      setReanalysisPrompt("");
                    }}
                    className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Previous analysis runs */}
          {jobs.length > 1 && (
            <div className="px-5 py-3">
              <button
                onClick={() =>
                  setActiveJobId(activeJobId ? null : jobs[1]?.id || null)
                }
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                {activeJobId ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                {jobs.length - 1} previous analysis run
                {jobs.length > 2 ? "s" : ""}
              </button>
              {activeJobId && (
                <div className="mt-2 space-y-1">
                  {jobs.slice(1).map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            job.status === "completed"
                              ? "bg-green-400"
                              : job.status === "failed"
                                ? "bg-red-400"
                                : "bg-gray-400"
                          }`}
                        />
                        <span className="text-gray-600">
                          {job.follow_up_prompt
                            ? `"${job.follow_up_prompt.slice(0, 50)}..."`
                            : "Initial analysis"}
                        </span>
                      </div>
                      <span className="text-gray-400">
                        {new Date(job.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cancelled state */}
      {latestJob?.status === "cancelled" && (
        <div className="px-5 py-4 space-y-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">
              Analysis was stopped. You can re-run it at any time.
            </p>
          </div>
          <button
            onClick={() => triggerAnalysis()}
            disabled={triggering}
            className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700"
          >
            {triggering ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Re-run analysis
          </button>
        </div>
      )}

      {/* Failed state */}
      {latestJob?.status === "failed" && (
        <div className="px-5 py-4 space-y-3">
          <div className="bg-red-50 rounded-lg p-3">
            <p className="text-sm text-red-700">
              {latestJob.error_message || "Analysis failed"}
            </p>
            {latestJob.execution_stderr && (
              <details className="mt-2">
                <summary className="text-xs text-red-500 cursor-pointer hover:underline">
                  Error details
                </summary>
                <pre className="mt-1 text-xs text-red-600 font-mono whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto">
                  {latestJob.execution_stderr}
                </pre>
              </details>
            )}
          </div>
          {latestJob.generated_code && (
            <div>
              <button
                onClick={() => setShowCode(!showCode)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                {showCode ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Code2 size={12} />
                View attempted code
              </button>
              {showCode && (
                <div className="mt-2 bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-xs text-gray-100 font-mono whitespace-pre-wrap">
                    {latestJob.generated_code}
                  </pre>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => triggerAnalysis()}
            disabled={triggering}
            className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700"
          >
            {triggering ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Retry analysis
          </button>
        </div>
      )}
    </div>
  );
}
