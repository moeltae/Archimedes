"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Lightbulb,
  Loader2,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Sparkles,
  ChevronDown,
  Info,
  Search,
  FlaskConical,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import NavSidebar from "@/components/NavSidebar";
import { SCIENCE_FIELDS } from "@/types";

interface NoveltyResult {
  is_novel: boolean;
  similar_work?: string;
  novelty_score: number;
  suggestion?: string;
}

interface SubmitResponse {
  status: "created" | "rejected";
  novelty: NoveltyResult;
  experiment?: { id: string };
  similar_existing: { id: string; title: string; hypothesis: string }[];
  message?: string;
}

interface AttachedFile {
  file: File;
  id: string;
  preview?: string;
}

const PROGRESS_STEPS = [
  { label: "Searching existing studies", icon: Search },
  { label: "Checking novelty against literature", icon: BookOpen },
  { label: "Generating study design", icon: FlaskConical },
];

export default function SubmitHypothesis() {
  const router = useRouter();
  const [hypothesis, setHypothesis] = useState("");
  const [context, setContext] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [fieldDropdownOpen, setFieldDropdownOpen] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const HYPOTHESIS_MAX = 500;

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  function addFiles(files: File[]) {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/csv"];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const newAttachments: AttachedFile[] = files
      .filter((f) => allowed.includes(f.type) && f.size <= maxSize)
      .map((file) => ({
        file,
        id: crypto.randomUUID(),
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      }));

    setAttachments((prev) => [...prev, ...newAttachments].slice(0, 5));
  }

  function removeFile(id: string) {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((a) => a.id !== id);
    });
  }

  function toggleField(field: string) {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : prev.length < 3 ? [...prev, field] : prev
    );
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hypothesis.trim()) return;

    setSubmitting(true);
    setResult(null);
    setProgressStep(0);

    // Simulate progress through steps
    const progressInterval = setInterval(() => {
      setProgressStep((prev) => (prev < PROGRESS_STEPS.length - 1 ? prev + 1 : prev));
    }, 2500);

    try {
      // Build context with field info
      const fullContext = [
        context,
        selectedFields.length > 0 ? `Fields: ${selectedFields.join(", ")}` : "",
        attachments.length > 0
          ? `Attached files: ${attachments.map((a) => a.file.name).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/submit-hypothesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hypothesis,
          context: fullContext,
          tags: selectedFields,
        }),
      });

      const data: SubmitResponse = await res.json();
      setResult(data);
    } finally {
      clearInterval(progressInterval);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-48px)]">
      <NavSidebar />
      <div className="flex-1 min-w-0 px-6 py-6">
        <div className="max-w-2xl mx-auto">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 w-fit"
          >
            <ArrowLeft size={14} />
            Back to feed
          </Link>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                <Lightbulb size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Submit a Hypothesis</h1>
                <p className="text-sm text-gray-500">
                  Propose a new research direction for the community
                </p>
              </div>
            </div>
          </div>

          {/* Info banner */}
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-6 flex gap-3">
            <Info size={18} className="text-orange-400 shrink-0 mt-0.5" />
            <div className="text-sm text-orange-800 space-y-1">
              <p className="font-medium">How it works</p>
              <ol className="list-decimal list-inside text-orange-700 space-y-0.5 text-[13px]">
                <li>Write your hypothesis clearly and specifically</li>
                <li>Our AI checks it against existing literature and studies</li>
                <li>If novel enough, it becomes a study post on the feed</li>
                <li>The community can then vote, fund, and collaborate</li>
              </ol>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Hypothesis */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Hypothesis <span className="text-orange-500">*</span>
              </label>
              <p className="text-xs text-gray-400 mb-3">
                State your hypothesis clearly. Be specific about the mechanism, population, and expected outcome.
              </p>
              <textarea
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value.slice(0, HYPOTHESIS_MAX))}
                rows={4}
                placeholder="e.g., Intermittent fasting (16:8 protocol) reduces neuroinflammation markers (TNF-α, IL-6) in adults with early-stage Alzheimer's disease over a 12-week period..."
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none bg-gray-50 placeholder:text-gray-400"
                required
              />
              <div className="flex justify-between items-center mt-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-gray-400" />
                  <span className="text-[11px] text-gray-400">
                    Tip: Include measurable outcomes for better novelty scoring
                  </span>
                </div>
                <span
                  className={`text-xs tabular-nums ${
                    hypothesis.length > HYPOTHESIS_MAX * 0.9
                      ? "text-orange-500 font-medium"
                      : "text-gray-400"
                  }`}
                >
                  {hypothesis.length}/{HYPOTHESIS_MAX}
                </span>
              </div>
            </div>

            {/* Field selector */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Scientific Field
              </label>
              <p className="text-xs text-gray-400 mb-3">Select up to 3 relevant fields</p>

              {/* Selected tags */}
              {selectedFields.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedFields.map((field) => (
                    <span
                      key={field}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-medium border border-orange-200"
                    >
                      {field}
                      <button
                        type="button"
                        onClick={() => toggleField(field)}
                        className="hover:text-orange-900"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setFieldDropdownOpen(!fieldDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-gray-300 transition-colors bg-gray-50"
                >
                  <span>
                    {selectedFields.length === 0
                      ? "Select fields..."
                      : `${selectedFields.length} field${selectedFields.length > 1 ? "s" : ""} selected`}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${fieldDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {fieldDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-52 overflow-y-auto">
                    {SCIENCE_FIELDS.map((field) => {
                      const isSelected = selectedFields.includes(field);
                      const isDisabled = !isSelected && selectedFields.length >= 3;
                      return (
                        <button
                          key={field}
                          type="button"
                          onClick={() => {
                            if (!isDisabled) toggleField(field);
                          }}
                          disabled={isDisabled}
                          className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors ${
                            isSelected
                              ? "bg-orange-50 text-orange-700"
                              : isDisabled
                                ? "text-gray-300 cursor-not-allowed"
                                : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <span>{field}</span>
                          {isSelected && <CheckCircle size={14} className="text-orange-500" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Additional Context */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Additional Context
                <span className="text-xs font-normal text-gray-400 ml-1.5">optional</span>
              </label>
              <p className="text-xs text-gray-400 mb-3">
                Background information, related papers, preliminary data, or reasoning behind your hypothesis.
              </p>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={4}
                placeholder="Share any supporting evidence, literature references, pilot data, or theoretical reasoning..."
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none bg-gray-50 placeholder:text-gray-400"
              />
            </div>

            {/* File Attachments */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Attachments
                <span className="text-xs font-normal text-gray-400 ml-1.5">optional</span>
              </label>
              <p className="text-xs text-gray-400 mb-3">
                Upload supporting documents, figures, or datasets (PDF, PNG, JPG, CSV — max 10 MB each, up to 5 files)
              </p>

              {/* Drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                  dragOver
                    ? "border-orange-400 bg-orange-50"
                    : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
                }`}
              >
                <Upload
                  size={24}
                  className={`mx-auto mb-2 ${dragOver ? "text-orange-500" : "text-gray-400"}`}
                />
                <p className="text-sm text-gray-600">
                  <span className="text-orange-500 font-medium">Click to upload</span> or drag and
                  drop
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG, or CSV</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.csv"
                  multiple
                  className="hidden"
                />
              </div>

              {/* Attached files list */}
              {attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100 group"
                    >
                      {att.preview ? (
                        <img
                          src={att.preview}
                          alt={att.file.name}
                          className="w-9 h-9 rounded object-cover border border-gray-200"
                        />
                      ) : att.file.type === "application/pdf" ? (
                        <div className="w-9 h-9 rounded bg-red-50 border border-red-100 flex items-center justify-center">
                          <FileText size={16} className="text-red-500" />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded bg-blue-50 border border-blue-100 flex items-center justify-center">
                          <ImageIcon size={16} className="text-blue-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 truncate">{att.file.name}</p>
                        <p className="text-xs text-gray-400">{formatFileSize(att.file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(att.id)}
                        className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting || !hypothesis.trim()}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Analyzing hypothesis...
                </>
              ) : (
                <>
                  <Lightbulb size={18} />
                  Submit Hypothesis
                </>
              )}
            </button>
          </form>

          {/* Progress indicator during submission */}
          {submitting && (
            <div className="mt-5 bg-white border border-gray-200 rounded-xl p-5">
              <div className="space-y-3">
                {PROGRESS_STEPS.map((step, i) => {
                  const StepIcon = step.icon;
                  const isActive = i === progressStep;
                  const isDone = i < progressStep;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          isDone
                            ? "bg-green-100"
                            : isActive
                              ? "bg-orange-100"
                              : "bg-gray-100"
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle size={14} className="text-green-600" />
                        ) : isActive ? (
                          <Loader2 size={14} className="text-orange-500 animate-spin" />
                        ) : (
                          <StepIcon size={14} className="text-gray-400" />
                        )}
                      </div>
                      <span
                        className={`text-sm ${
                          isDone
                            ? "text-green-700"
                            : isActive
                              ? "text-gray-900 font-medium"
                              : "text-gray-400"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="mt-6 space-y-4">
              {result.status === "created" ? (
                <div className="border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <CheckCircle size={20} className="text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-green-800 text-base">
                        Hypothesis Accepted!
                      </h3>
                      <p className="text-sm text-green-700 mt-1">
                        Your hypothesis scored{" "}
                        <span className="font-bold">{result.novelty.novelty_score}/10</span> on
                        novelty. A study has been created and posted to the feed for the community
                        to review.
                      </p>

                      {/* Novelty score bar */}
                      <div className="mt-3 mb-4">
                        <div className="flex justify-between text-xs text-green-600 mb-1">
                          <span>Novelty Score</span>
                          <span className="font-semibold">{result.novelty.novelty_score}/10</span>
                        </div>
                        <div className="h-2 bg-green-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-700"
                            style={{ width: `${result.novelty.novelty_score * 10}%` }}
                          />
                        </div>
                      </div>

                      {result.experiment && (
                        <button
                          onClick={() =>
                            router.push(`/experiment/${result.experiment!.id}`)
                          }
                          className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm"
                        >
                          View Study →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <AlertTriangle size={20} className="text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-amber-800 text-base">
                        Not Novel Enough
                      </h3>
                      <p className="text-sm text-amber-700 mt-1">
                        Novelty score:{" "}
                        <span className="font-bold">{result.novelty.novelty_score}/10</span>.{" "}
                        {result.novelty.similar_work}
                      </p>

                      {/* Novelty score bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-amber-600 mb-1">
                          <span>Novelty Score</span>
                          <span className="font-semibold">{result.novelty.novelty_score}/10</span>
                        </div>
                        <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-300 to-amber-500 rounded-full transition-all duration-700"
                            style={{ width: `${result.novelty.novelty_score * 10}%` }}
                          />
                        </div>
                      </div>

                      {result.novelty.suggestion && (
                        <div className="mt-3 px-3 py-2 bg-white/60 rounded-lg border border-amber-100">
                          <p className="text-sm text-amber-700">
                            <span className="font-semibold">Suggestion:</span>{" "}
                            {result.novelty.suggestion}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {result.similar_existing.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
                    <BookOpen size={16} className="text-gray-500" />
                    Similar studies in our database
                  </h3>
                  <div className="space-y-2">
                    {result.similar_existing.map((exp) => (
                      <Link
                        key={exp.id}
                        href={`/experiment/${exp.id}`}
                        className="block px-3 py-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-100"
                      >
                        <p className="text-sm font-medium text-gray-800">{exp.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {exp.hypothesis}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom spacing */}
          <div className="h-10" />
        </div>
      </div>
    </div>
  );
}
