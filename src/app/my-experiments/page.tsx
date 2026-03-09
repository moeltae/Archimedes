"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import NavSidebar from "@/components/NavSidebar";
import { useSearch } from "@/components/SearchContext";
import { getSessionId } from "@/lib/session";
import { MyModule } from "@/types";
import { getFieldColor } from "@/types";
import AnalysisTab from "@/components/AnalysisTab";
import {
  FlaskConical,
  ArrowRight,
  Loader2,
  Sparkles,
  Search,
  SlidersHorizontal,
  ChevronDown,
  X,
  CheckCircle2,
  Clock,
  Beaker,
  DollarSign,
  BarChart3,
  Brain,
} from "lucide-react";

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

type StatusFilter = "all" | "claimed" | "in_progress" | "completed";
type SortOption = "newest" | "oldest" | "progress" | "budget";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "claimed", label: "Claimed" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "progress", label: "Most progress" },
  { key: "budget", label: "Highest budget" },
];

type SubTab = "modules" | "analysis";

export default function MyExperiments() {
  return (
    <Suspense>
      <MyExperimentsContent />
    </Suspense>
  );
}

function MyExperimentsContent() {
  const [modules, setModules] = useState<MyModule[]>([]);
  const [loading, setLoading] = useState(true);
  const { searchQuery: search } = useSearch();
  const searchParams = useSearchParams();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>(
    searchParams.get("tab") === "analysis" ? "analysis" : "modules"
  );

  // Filters & search state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showSubmittedOnly, setShowSubmittedOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  useEffect(() => {
    async function load() {
      const sessionId = getSessionId();
      if (!sessionId) {
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/my-experiments?session_id=${sessionId}`);
      const data = await res.json();
      setModules(data.modules || []);
      setLoading(false);
    }
    load();
  }, []);

  // Collect unique tags from all modules
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    modules.forEach((m) => m.experiment_tags?.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [modules]);

  // Filter & sort
  const filtered = useMemo(() => {
    let result = [...modules];

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.module_name.toLowerCase().includes(q) ||
          m.experiment_title.toLowerCase().includes(q) ||
          m.expertise_required?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((m) => m.status === statusFilter);
    }

    // Submission filter
    if (showSubmittedOnly) {
      result = result.filter((m) => m.has_submission);
    }

    // Tag filter
    if (selectedTag) {
      result = result.filter((m) =>
        m.experiment_tags?.includes(selectedTag)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.claimed_at).getTime() - new Date(b.claimed_at).getTime();
        case "progress": {
          const pA = a.samples_total > 0 ? a.samples_completed / a.samples_total : 0;
          const pB = b.samples_total > 0 ? b.samples_completed / b.samples_total : 0;
          return pB - pA;
        }
        case "budget": {
          const bA = a.study_funded_amount * ((a.budget_pct ?? (100 / a.total_modules_in_study)) / 100);
          const bB = b.study_funded_amount * ((b.budget_pct ?? (100 / b.total_modules_in_study)) / 100);
          return bB - bA;
        }
        case "newest":
        default:
          return new Date(b.claimed_at).getTime() - new Date(a.claimed_at).getTime();
      }
    });

    return result;
  }, [modules, search, statusFilter, sortBy, showSubmittedOnly, selectedTag]);

  // Stats
  const stats = useMemo(() => {
    const total = modules.length;
    const completed = modules.filter((m) => m.status === "completed").length;
    const inProgress = modules.filter((m) => m.status === "in_progress").length;
    const totalSamples = modules.reduce((s, m) => s + m.samples_total, 0);
    const completedSamples = modules.reduce((s, m) => s + m.samples_completed, 0);
    const totalBudget = modules.reduce((s, m) => {
      const pct = m.budget_pct ?? (100 / m.total_modules_in_study);
      return s + m.study_funded_amount * (pct / 100);
    }, 0);
    return { total, completed, inProgress, totalSamples, completedSamples, totalBudget };
  }, [modules]);

  const hasActiveFilters = search || statusFilter !== "all" || showSubmittedOnly || selectedTag;

  function clearFilters() {
    setStatusFilter("all");
    setShowSubmittedOnly(false);
    setSelectedTag(null);
  }

  return (
    <div className="flex min-h-[calc(100vh-48px)]">
      <NavSidebar />

      <main className="flex-1 min-w-0 px-6 py-4">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FlaskConical size={22} className="text-indigo-500" />
            Experiments
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Modules you&apos;ve volunteered your lab for.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 mb-5 border-b border-gray-200">
          <button
            onClick={() => setActiveSubTab("modules")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeSubTab === "modules"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Beaker size={15} />
            My Modules
          </button>
          <button
            onClick={() => setActiveSubTab("analysis")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeSubTab === "analysis"
                ? "border-purple-500 text-purple-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Brain size={15} />
            AI Analysis
          </button>
        </div>

        {activeSubTab === "analysis" ? (
          <AnalysisTab />
        ) : loading ? (
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
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-0.5">
                  <Beaker size={12} />
                  <span>Total Modules</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-0.5">
                  <CheckCircle2 size={12} />
                  <span>Completed</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {stats.completed}
                  <span className="text-xs font-normal text-gray-400 ml-1">
                    / {stats.total}
                  </span>
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-0.5">
                  <BarChart3 size={12} />
                  <span>Sample Progress</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {stats.totalSamples > 0
                    ? Math.round((stats.completedSamples / stats.totalSamples) * 100)
                    : 0}
                  %
                  <span className="text-xs font-normal text-gray-400 ml-1">
                    ({stats.completedSamples}/{stats.totalSamples})
                  </span>
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-0.5">
                  <DollarSign size={12} />
                  <span>Total Budget</span>
                </div>
                <p className="text-lg font-bold text-green-600">
                  ${Math.round(stats.totalBudget).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3 mb-4">
              {/* Sort row */}
              <div className="flex items-center gap-2 justify-end">
                {/* Sort dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-600"
                  >
                    <SlidersHorizontal size={14} />
                    <span className="hidden sm:inline">
                      {SORT_OPTIONS.find((o) => o.key === sortBy)?.label}
                    </span>
                    <ChevronDown size={12} />
                  </button>
                  {showSortDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowSortDropdown(false)}
                      />
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
                        {SORT_OPTIONS.map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => {
                              setSortBy(opt.key);
                              setShowSortDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${
                              sortBy === opt.key
                                ? "text-indigo-600 font-medium"
                                : "text-gray-700"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Status filter tabs + submission toggle */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  {STATUS_TABS.map((tab) => {
                    const count =
                      tab.key === "all"
                        ? modules.length
                        : modules.filter((m) => m.status === tab.key).length;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setStatusFilter(tab.key)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          statusFilter === tab.key
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {tab.label}
                        <span
                          className={`ml-1 ${
                            statusFilter === tab.key
                              ? "text-indigo-500"
                              : "text-gray-400"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setShowSubmittedOnly(!showSubmittedOnly)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                    showSubmittedOnly
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  <CheckCircle2 size={11} />
                  Submitted
                </button>

                {/* Tag filter pills */}
                {allTags.length > 0 && (
                  <div className="flex items-center gap-1 ml-1">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider mr-0.5">
                      Field:
                    </span>
                    {allTags.map((tag) => {
                      const fc = getFieldColor(tag);
                      const isActive = selectedTag === tag;
                      return (
                        <button
                          key={tag}
                          onClick={() =>
                            setSelectedTag(isActive ? null : tag)
                          }
                          className={`px-2 py-0.5 text-[11px] font-medium rounded-full border transition-colors ${
                            isActive
                              ? `${fc.bg} ${fc.text} border-current`
                              : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Clear filters */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                  >
                    <X size={12} />
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {/* Results count */}
            {hasActiveFilters && (
              <p className="text-xs text-gray-400 mb-3">
                Showing {filtered.length} of {modules.length} module
                {modules.length !== 1 ? "s" : ""}
              </p>
            )}

            {/* Module list */}
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <Search size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">
                  No modules match your filters.
                </p>
                <button
                  onClick={clearFilters}
                  className="mt-2 text-sm text-indigo-500 hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map((mod, idx) => {
                  const color = PALETTE[idx % PALETTE.length];
                  const progress =
                    mod.samples_total > 0
                      ? Math.round(
                          (mod.samples_completed / mod.samples_total) * 100
                        )
                      : 0;
                  const pct =
                    mod.budget_pct ?? 100 / mod.total_modules_in_study;
                  const moduleBudget =
                    mod.study_funded_amount * (pct / 100);
                  const moduleBudgetGoal =
                    mod.study_funding_goal * (pct / 100);

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
                              <h3
                                className="text-sm font-semibold truncate"
                                style={{ color: color.text }}
                              >
                                {mod.module_name}
                              </h3>
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                                  STATUS_STYLES[mod.status] ||
                                  "bg-gray-100 text-gray-600"
                                }`}
                              >
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
                            {/* Tags row */}
                            {mod.experiment_tags?.length > 0 && (
                              <div className="flex gap-1 mt-1.5 flex-wrap">
                                {mod.experiment_tags.map((tag) => {
                                  const fc = getFieldColor(tag);
                                  return (
                                    <span
                                      key={tag}
                                      className={`text-[10px] px-1.5 py-0.5 rounded ${fc.bg} ${fc.text}`}
                                    >
                                      {tag}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {moduleBudgetGoal > 0 && (
                              <div className="text-right">
                                <div className="text-sm font-bold text-green-600 flex items-center gap-1 justify-end">
                                  {moduleBudget > 0
                                    ? `$${Math.round(moduleBudget).toLocaleString()}`
                                    : "\u2014"}
                                  {mod.budget_rationale && (
                                    <Sparkles
                                      size={10}
                                      className="text-amber-400"
                                    />
                                  )}
                                </div>
                                <div className="text-[10px] text-gray-400">
                                  {Math.round(pct)}% — $
                                  {Math.round(
                                    moduleBudgetGoal
                                  ).toLocaleString()}{" "}
                                  goal
                                </div>
                              </div>
                            )}
                            <ArrowRight
                              size={16}
                              className="text-gray-400 mt-1"
                            />
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                            <span>Sample progress</span>
                            <span>
                              {mod.samples_completed}/{mod.samples_total}{" "}
                              samples
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{
                                width: `${progress}%`,
                                backgroundColor: color.solid,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
