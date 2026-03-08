"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import NavSidebar from "@/components/NavSidebar";
import { getSessionId } from "@/lib/session";
import { Sample, DataSubmission } from "@/types";
import {
  ArrowLeft,
  FlaskConical,
  Loader2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  Play,
  Send,
  ChevronDown,
  LinkIcon,
  Plus,
  X,
  ExternalLink,
  Upload,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Wallet,
  Sparkles,
  Undo2,
  Paperclip,
} from "lucide-react";
import { BUDGET_CATEGORIES } from "@/types";

const STATUS_ICON: Record<string, React.ElementType> = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
  failed: AlertCircle,
};

const STATUS_STYLE: Record<string, string> = {
  pending: "text-gray-400",
  in_progress: "text-blue-500",
  completed: "text-green-500",
  failed: "text-red-500",
};

const NEXT_STATUS: Record<string, string> = {
  pending: "in_progress",
  in_progress: "completed",
};

interface ModuleDetail {
  id: string;
  experiment_id: string;
  module_name: string;
  description: string;
  expertise_required: string;
  status: string;
  assigned_lab: string;
  total_modules_in_study: number;
  budget_pct: number | null;
  budget_rationale: string | null;
  experiment: {
    title: string;
    hypothesis: string;
    study_design: string;
    tags: string[];
    funding_goal: number;
    funded_amount: number;
  };
}

export default function ModuleWorkbench({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = use(params);
  const [mod, setMod] = useState<ModuleDetail | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [submissions, setSubmissions] = useState<DataSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submission form state
  const [resultsSummary, setResultsSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [dataLinks, setDataLinks] = useState<string[]>([""]);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Per-sample upload state
  const [expandedSampleId, setExpandedSampleId] = useState<string | null>(null);
  const [sampleUploading, setSampleUploading] = useState(false);
  const sampleFileInputRef = useRef<HTMLInputElement>(null);
  const [fileUploadTarget, setFileUploadTarget] = useState<string | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [sampleDragOver, setSampleDragOver] = useState(false);

  const sessionId = typeof window !== "undefined" ? getSessionId() : "";

  const loadData = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch(
      `/api/my-experiments/${moduleId}?session_id=${sessionId}`
    );
    if (!res.ok) {
      setError("Could not load this module. You may not have access.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setMod(data.module);
    setSamples(data.samples || []);
    setSubmissions(data.submissions || []);
    setLoading(false);
  }, [moduleId, sessionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSampleStatus(sampleId: string, newStatus: string) {
    await fetch(`/api/my-experiments/${moduleId}/samples/${sampleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setSamples((prev) =>
      prev.map((s) =>
        s.id === sampleId
          ? {
              ...s,
              status: newStatus as Sample["status"],
              processed_at: newStatus === "completed" ? new Date().toISOString() : null,
            }
          : s
      )
    );
  }

  async function handleModuleStatus(status: string) {
    await fetch(`/api/modules/${moduleId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, session_id: sessionId }),
    });
    setMod((prev) => (prev ? { ...prev, status } : prev));
  }

  async function handleSampleFileUpload(sampleId: string, rawFiles: File[]) {
    const allowed = [
      "application/pdf", "image/png", "image/jpeg", "image/webp",
      "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel", "text/plain", "application/json",
    ];
    const maxSize = 10 * 1024 * 1024;
    const files = rawFiles.filter((f) => allowed.includes(f.type) && f.size <= maxSize);
    if (files.length === 0) return;

    setSampleUploading(true);
    const sample = samples.find((s) => s.id === sampleId);
    const existingUrls = sample?.file_urls || [];
    const newUrls: string[] = [];

    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      form.append("module_id", moduleId);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (data.url) newUrls.push(data.url);
      } catch {
        // skip failed uploads
      }
    }

    if (newUrls.length === 0) {
      setSampleUploading(false);
      return;
    }

    const allUrls = [...existingUrls, ...newUrls];
    await fetch(`/api/my-experiments/${moduleId}/samples/${sampleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_urls: allUrls }),
    });

    setSamples((prev) =>
      prev.map((s) => (s.id === sampleId ? { ...s, file_urls: allUrls } : s))
    );
    setSampleUploading(false);
  }

  async function handleRemoveSampleFile(sampleId: string, fileIndex: number) {
    const sample = samples.find((s) => s.id === sampleId);
    if (!sample) return;
    const updated = (sample.file_urls || []).filter((_, i) => i !== fileIndex);
    await fetch(`/api/my-experiments/${moduleId}/samples/${sampleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_urls: updated }),
    });
    setSamples((prev) =>
      prev.map((s) => (s.id === sampleId ? { ...s, file_urls: updated } : s))
    );
  }

  async function handleBulkFileUpload(rawFiles: File[]) {
    const allowed = [
      "application/pdf", "image/png", "image/jpeg", "image/webp",
      "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel", "text/plain", "application/json",
    ];
    const maxSize = 10 * 1024 * 1024;
    const files = rawFiles.filter((f) => allowed.includes(f.type) && f.size <= maxSize);
    if (files.length === 0) return;

    setSampleUploading(true);
    const newUrls: string[] = [];

    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      form.append("module_id", moduleId);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (data.url) newUrls.push(data.url);
      } catch {
        // skip failed uploads
      }
    }

    if (newUrls.length === 0) {
      setSampleUploading(false);
      return;
    }

    await Promise.all(
      samples.map((s) =>
        fetch(`/api/my-experiments/${moduleId}/samples/${s.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_urls: [...(s.file_urls || []), ...newUrls] }),
        })
      )
    );

    setSamples((prev) =>
      prev.map((s) => ({
        ...s,
        file_urls: [...(s.file_urls || []), ...newUrls],
      }))
    );
    setSampleUploading(false);
  }

  function addFiles(files: File[]) {
    const allowed = [
      "application/pdf", "image/png", "image/jpeg", "image/webp",
      "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel", "text/plain", "application/json",
    ];
    const maxSize = 10 * 1024 * 1024;
    const valid = files.filter((f) => allowed.includes(f.type) && f.size <= maxSize);
    setAttachedFiles((prev) => [...prev, ...valid].slice(0, 10));
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon(type: string) {
    if (type === "application/pdf") return FileText;
    if (type.startsWith("image/")) return ImageIcon;
    if (type.includes("spreadsheet") || type.includes("csv") || type.includes("excel")) return FileSpreadsheet;
    return FileText;
  }

  async function handleSubmitResults() {
    if (!resultsSummary.trim()) return;
    setSubmitting(true);

    // Upload attached files first
    const uploadedUrls: string[] = [];
    if (attachedFiles.length > 0) {
      setUploadingFiles(true);
      for (const file of attachedFiles) {
        const form = new FormData();
        form.append("file", file);
        form.append("module_id", moduleId);
        try {
          const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
          const uploadData = await uploadRes.json();
          if (uploadData.url) uploadedUrls.push(uploadData.url);
        } catch {
          // skip failed uploads
        }
      }
      setUploadingFiles(false);
    }

    // Combine manual links + uploaded file URLs
    const allUrls = [
      ...dataLinks.filter((l) => l.trim()),
      ...uploadedUrls,
    ];

    const res = await fetch(`/api/my-experiments/${moduleId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        results_summary: resultsSummary,
        notes,
        submission_type: "results",
        file_urls: allUrls,
      }),
    });
    const data = await res.json();
    if (data.submission) {
      setSubmissions((prev) => [data.submission, ...prev]);
      setMod((prev) => (prev ? { ...prev, status: "completed" } : prev));
      setSubmitted(true);
    }
    setSubmitting(false);
  }

  const samplesCompleted = samples.filter((s) => s.status === "completed").length;
  const samplesProgress =
    samples.length > 0 ? Math.round((samplesCompleted / samples.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-48px)]">
        <NavSidebar />
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <Loader2 size={24} className="animate-spin text-gray-400" />
          <p className="text-sm text-gray-400">Loading module &amp; generating samples...</p>
        </div>
      </div>
    );
  }

  if (error || !mod) {
    return (
      <div className="flex min-h-[calc(100vh-48px)]">
        <NavSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-lg">{error || "Module not found."}</p>
            <Link
              href="/my-experiments"
              className="text-orange-500 hover:underline text-sm mt-2 inline-block"
            >
              Back to your experiments
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isCompleted = mod.status === "completed";

  return (
    <div className="flex min-h-[calc(100vh-48px)]">
      <NavSidebar />

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-6 py-4">
          {/* Breadcrumb */}
          <Link
            href="/my-experiments"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft size={14} />
            Your Experiments
          </Link>

          {/* Module header */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {mod.module_name}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Part of:{" "}
                <Link
                  href={`/experiment/${mod.experiment_id}`}
                  className="text-orange-500 hover:underline"
                >
                  {mod.experiment?.title}
                </Link>
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    mod.status === "claimed"
                      ? "bg-yellow-100 text-yellow-700"
                      : mod.status === "in_progress"
                        ? "bg-blue-100 text-blue-700"
                        : mod.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {mod.status.replace("_", " ")}
                </span>
                <span className="text-xs text-gray-400">
                  Lab: {mod.assigned_lab}
                </span>
              </div>
            </div>

            {/* Status action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {mod.status === "claimed" && (
                <button
                  onClick={() => handleModuleStatus("in_progress")}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Play size={14} />
                  Start Work
                </button>
              )}
            </div>
          </div>

          {/* Module context */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 mb-5">
            <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
              <FlaskConical size={16} className="text-blue-500" />
              Your Module
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              {mod.description}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              <span className="font-semibold">Expertise:</span>{" "}
              {mod.expertise_required}
            </p>
          </div>

          {/* Budget card */}
          {(() => {
            const totalModules = mod.total_modules_in_study || 1;
            const studyFunded = mod.experiment?.funded_amount || 0;
            const studyGoal = mod.experiment?.funding_goal || 0;
            const pct = mod.budget_pct ?? (100 / totalModules);
            const moduleBudget = studyFunded * (pct / 100);
            const moduleBudgetGoal = studyGoal * (pct / 100);
            const fundingPercent = moduleBudgetGoal > 0 ? Math.min(100, (moduleBudget / moduleBudgetGoal) * 100) : 0;

            if (studyGoal <= 0) return null;

            // SVG donut chart values
            const radius = 40;
            const circumference = 2 * Math.PI * radius;
            const filled = circumference * (fundingPercent / 100);

            return (
              <div className="bg-white border border-gray-200 rounded-lg mb-5 px-5 py-4">
                <div className="flex items-center gap-5">
                  {/* Donut chart */}
                  <div className="relative shrink-0 w-24 h-24">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="10" />
                      <circle
                        cx="50" cy="50" r={radius} fill="none"
                        stroke="#22c55e" strokeWidth="10"
                        strokeDasharray={`${filled} ${circumference - filled}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-bold text-gray-900">{Math.round(fundingPercent)}%</span>
                      <span className="text-[9px] text-gray-400">funded</span>
                    </div>
                  </div>

                  {/* Budget details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet size={14} className="text-green-500 shrink-0" />
                      <h2 className="text-sm font-bold text-gray-900">Module Budget</h2>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {Math.round(pct)}% of study
                      </span>
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-bold text-green-600">
                        {studyFunded > 0 ? `$${Math.round(moduleBudget).toLocaleString()}` : "—"}
                      </span>
                      <span className="text-xs text-gray-400">
                        / ${Math.round(moduleBudgetGoal).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-400 mt-1">
                      Study: ${studyFunded.toLocaleString()} / ${studyGoal.toLocaleString()} across {totalModules} module{totalModules !== 1 ? "s" : ""}
                    </p>

                    {mod.budget_rationale && (
                      <div className="flex items-start gap-1.5 mt-2">
                        <Sparkles size={11} className="text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-gray-500 italic leading-relaxed">
                          {mod.budget_rationale}
                        </p>
                      </div>
                    )}

                    {/* Compact category bar */}
                    <div className="mt-3">
                      <div className="flex h-2 rounded-full overflow-hidden">
                        {BUDGET_CATEGORIES.map((cat) => (
                          <div
                            key={cat.key}
                            style={{ width: `${cat.percent}%`, backgroundColor: cat.color }}
                            title={`${cat.label}: ${cat.percent}% — $${Math.round(moduleBudgetGoal * cat.percent / 100).toLocaleString()}`}
                          />
                        ))}
                      </div>
                      <div className="flex gap-3 mt-1.5 flex-wrap">
                        {BUDGET_CATEGORIES.map((cat) => (
                          <span key={cat.key} className="flex items-center gap-1 text-[10px] text-gray-500">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            {cat.label.split(" ")[0]} {cat.percent}%
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Sample tracker */}
          <div className="bg-white border border-gray-200 rounded-lg mb-5">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">
                Sample Tracker
              </h2>
              <div className="flex items-center gap-3">
                {!isCompleted && samples.length > 0 && (
                  <button
                    onClick={() => bulkFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    <Upload size={12} />
                    Upload for All
                  </button>
                )}
                <span className="text-xs text-gray-500">
                  {samplesCompleted}/{samples.length} completed
                </span>
                <div className="w-24 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-green-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${samplesProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_1fr_80px_90px_160px] gap-3 px-5 py-2 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              <span>Sample</span>
              <span>Description</span>
              <span>Status</span>
              <span>Processed</span>
              <span>Action</span>
            </div>

            {samples.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <Loader2 size={18} className="animate-spin mx-auto mb-2 text-gray-300" />
                Generating samples for this module...
                <button onClick={loadData} className="ml-2 text-orange-500 hover:underline">
                  Retry
                </button>
              </div>
            ) : (
              <div>
                {samples.map((sample) => {
                  const Icon = STATUS_ICON[sample.status] || Circle;
                  const nextStatus = NEXT_STATUS[sample.status];
                  const fileCount = (sample.file_urls || []).length;
                  const isExpanded = expandedSampleId === sample.id;

                  return (
                    <div key={sample.id}>
                      <div
                        className={`grid grid-cols-[1fr_1fr_80px_90px_160px] gap-3 px-5 py-2.5 border-b border-gray-50 items-center ${
                          sample.status === "completed"
                            ? "bg-green-50/30"
                            : sample.status === "failed"
                              ? "bg-red-50/30"
                              : ""
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon
                            size={16}
                            className={`shrink-0 ${STATUS_STYLE[sample.status]}`}
                          />
                          <span className={`text-sm truncate ${sample.status === "completed" ? "line-through text-gray-400" : "text-gray-900"}`}>
                            {sample.sample_name}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {sample.description || "—"}
                        </p>
                        <span className={`text-[11px] font-medium ${STATUS_STYLE[sample.status]}`}>
                          {sample.status.replace("_", " ")}
                        </span>
                        <span className="text-xs text-gray-400">
                          {sample.processed_at
                            ? new Date(sample.processed_at).toLocaleDateString()
                            : "—"}
                        </span>
                        <div className="flex items-center gap-2">
                          {nextStatus && !isCompleted && (
                            <button
                              onClick={() => handleSampleStatus(sample.id, nextStatus)}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
                            >
                              {nextStatus === "in_progress" ? "Start" : "Done"}
                            </button>
                          )}
                          {sample.status === "in_progress" && (
                            <button
                              onClick={() => handleSampleStatus(sample.id, "failed")}
                              className="text-xs text-red-500 hover:text-red-600 font-medium hover:underline"
                            >
                              Fail
                            </button>
                          )}
                          {(sample.status === "completed" || sample.status === "failed") && !isCompleted && (
                            <button
                              onClick={() => handleSampleStatus(sample.id, "in_progress")}
                              className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium hover:underline"
                              title="Undo — revert to in progress"
                            >
                              <Undo2 size={12} />
                              Undo
                            </button>
                          )}
                          {!isCompleted && (
                            <button
                              onClick={() => setExpandedSampleId(isExpanded ? null : sample.id)}
                              className={`relative inline-flex items-center gap-1 text-xs font-medium hover:underline ${
                                isExpanded ? "text-purple-700" : "text-purple-500 hover:text-purple-600"
                              }`}
                              title={fileCount > 0 ? `${fileCount} file${fileCount !== 1 ? "s" : ""} attached` : "Upload data"}
                            >
                              <Upload size={12} />
                              {fileCount > 0 && (
                                <span className="bg-purple-500 text-white text-[9px] rounded-full min-w-[14px] h-3.5 px-1 flex items-center justify-center">
                                  {fileCount}
                                </span>
                              )}
                            </button>
                          )}
                          {isCompleted && fileCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-purple-400">
                              <Paperclip size={12} />
                              {fileCount}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expanded upload area */}
                      {isExpanded && (
                        <div className="px-5 py-3 bg-purple-50/40 border-b border-gray-100">
                          <p className="text-xs font-medium text-gray-700 mb-2">
                            Data for &ldquo;{sample.sample_name}&rdquo;
                          </p>

                          {/* Existing files */}
                          {fileCount > 0 && (
                            <div className="space-y-1 mb-2">
                              {(sample.file_urls || []).map((url, i) => {
                                const name = (() => {
                                  try {
                                    return decodeURIComponent(url.split("/").pop() || `File ${i + 1}`).replace(/^\d+_/, "");
                                  } catch {
                                    return `File ${i + 1}`;
                                  }
                                })();
                                return (
                                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-white rounded border border-gray-100 group">
                                    <FileText size={13} className="text-gray-400 shrink-0" />
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate flex-1">
                                      {name}
                                    </a>
                                    <button
                                      onClick={() => handleRemoveSampleFile(sample.id, i)}
                                      className="p-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Drop zone */}
                          <div
                            onDragOver={(e) => { e.preventDefault(); setSampleDragOver(true); }}
                            onDragLeave={() => setSampleDragOver(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setSampleDragOver(false);
                              handleSampleFileUpload(sample.id, Array.from(e.dataTransfer.files));
                            }}
                            onClick={() => {
                              setFileUploadTarget(sample.id);
                              sampleFileInputRef.current?.click();
                            }}
                            className={`border border-dashed rounded-lg px-3 py-2.5 text-center cursor-pointer transition-all ${
                              sampleDragOver
                                ? "border-purple-400 bg-purple-50"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          >
                            {sampleUploading ? (
                              <Loader2 size={14} className="animate-spin mx-auto text-purple-400" />
                            ) : (
                              <p className="text-[11px] text-gray-500">
                                <span className="text-purple-600 font-medium">Click to upload</span> or drag &amp; drop
                                <span className="block text-gray-400 mt-0.5">PDF, images, CSV, Excel, JSON — max 10 MB</span>
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Data submission form — auto-shown when in progress */}
          {mod.status === "in_progress" && !submitted && submissions.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 mb-5">
              <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Send size={16} className="text-green-500" />
                Submit Results
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Results Summary
                  </label>
                  <textarea
                    value={resultsSummary}
                    onChange={(e) => setResultsSummary(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-300"
                    placeholder="Summarize your findings, key measurements, and observations..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-300"
                    placeholder="Any issues, deviations from protocol, or additional observations..."
                  />
                </div>

                {/* Data links */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <LinkIcon size={14} />
                    Data Links
                    <span className="text-xs font-normal text-gray-400">optional</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    Link to datasets, spreadsheets, notebooks, or repositories (e.g. Google Drive, GitHub, Figshare)
                  </p>
                  <div className="space-y-2">
                    {dataLinks.map((link, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="url"
                          value={link}
                          onChange={(e) => {
                            const updated = [...dataLinks];
                            updated[i] = e.target.value;
                            setDataLinks(updated);
                          }}
                          placeholder="https://..."
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-300"
                        />
                        {dataLinks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setDataLinks(dataLinks.filter((_, j) => j !== i))}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {dataLinks.length < 5 && (
                    <button
                      type="button"
                      onClick={() => setDataLinks([...dataLinks, ""])}
                      className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium mt-2"
                    >
                      <Plus size={12} />
                      Add another link
                    </button>
                  )}
                </div>

                {/* File attachments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                    <Upload size={14} />
                    File Attachments
                    <span className="text-xs font-normal text-gray-400">optional</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    Upload raw data, figures, or reports (PDF, images, CSV, Excel, JSON — max 10 MB each, up to 10 files)
                  </p>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      addFiles(Array.from(e.dataTransfer.files));
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                      dragOver
                        ? "border-green-400 bg-green-50"
                        : "border-gray-200 bg-gray-50 hover:border-gray-300"
                    }`}
                  >
                    <Upload size={20} className={`mx-auto mb-1 ${dragOver ? "text-green-500" : "text-gray-400"}`} />
                    <p className="text-xs text-gray-500">
                      <span className="text-green-600 font-medium">Click to upload</span> or drag and drop
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={(e) => {
                        if (e.target.files) addFiles(Array.from(e.target.files));
                        e.target.value = "";
                      }}
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,.txt,.json"
                      multiple
                      className="hidden"
                    />
                  </div>

                  {attachedFiles.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {attachedFiles.map((file, i) => {
                        const Icon = getFileIcon(file.type);
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 group"
                          >
                            <Icon size={16} className="text-gray-500 shrink-0" />
                            <span className="text-sm text-gray-700 truncate flex-1">{file.name}</span>
                            <span className="text-xs text-gray-400 shrink-0">{formatFileSize(file.size)}</span>
                            <button
                              type="button"
                              onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
                              className="p-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSubmitResults}
                    disabled={submitting || !resultsSummary.trim()}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors flex items-center gap-1.5"
                  >
                    {submitting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    {uploadingFiles ? "Uploading files..." : "Submit Results"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Previous submissions */}
          {submissions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg mb-5">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-500" />
                  Submitted Results
                </h2>
              </div>
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="px-5 py-4 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                      {sub.submission_type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(sub.submitted_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {sub.results_summary}
                  </p>
                  {sub.file_urls && sub.file_urls.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {sub.file_urls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <ExternalLink size={11} />
                          {(() => {
                            try {
                              return new URL(url).hostname.replace("www.", "");
                            } catch {
                              return `Link ${i + 1}`;
                            }
                          })()}
                        </a>
                      ))}
                    </div>
                  )}
                  {sub.notes && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 flex items-center gap-1">
                        <ChevronDown size={12} />
                        Notes
                      </summary>
                      <p className="text-xs text-gray-500 mt-1 pl-4">
                        {sub.notes}
                      </p>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Completed banner */}
          {submitted && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-5 text-center">
              <CheckCircle2 size={24} className="text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-800">
                Results submitted successfully! This module is now complete.
              </p>
              <Link
                href="/my-experiments"
                className="text-sm text-green-600 hover:underline mt-1 inline-block"
              >
                Back to your experiments
              </Link>
            </div>
          )}
        </div>

        {/* Hidden file inputs for sample uploads */}
        <input
          ref={sampleFileInputRef}
          type="file"
          onChange={(e) => {
            if (e.target.files && fileUploadTarget) {
              handleSampleFileUpload(fileUploadTarget, Array.from(e.target.files));
            }
            e.target.value = "";
          }}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,.txt,.json"
          multiple
          className="hidden"
        />
        <input
          ref={bulkFileInputRef}
          type="file"
          onChange={(e) => {
            if (e.target.files) {
              handleBulkFileUpload(Array.from(e.target.files));
            }
            e.target.value = "";
          }}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,.txt,.json"
          multiple
          className="hidden"
        />
      </main>
    </div>
  );
}
