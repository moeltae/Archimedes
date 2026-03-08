"use client";

import { useState, useRef, useEffect } from "react";
import { StudyExperiment } from "@/types";
import { getSessionId } from "@/lib/session";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  FlaskConical,
  Hand,
  X,
  Check,
  ChevronDown,
  DollarSign,
  RefreshCw,
  Loader2,
  Sparkles,
} from "lucide-react";

interface Props {
  experiments: StudyExperiment[];
  studyId: string;
  onUpdate: () => void;
  fundedAmount?: number;
  fundingGoal?: number;
}

const PHASES = [
  { key: "setup", label: "Setup", weeks: 3 },
  { key: "execution", label: "Execution", weeks: 6 },
  { key: "analysis", label: "Analysis", weeks: 4 },
  { key: "delivery", label: "Delivery", weeks: 2 },
];
const TOTAL_WEEKS = PHASES.reduce((s, p) => s + p.weeks, 0);

const PALETTE = [
  { solid: "#3b82f6", text: "#1d4ed8", light: "#eff6ff", border: "#93c5fd" },
  { solid: "#10b981", text: "#047857", light: "#ecfdf5", border: "#6ee7b7" },
  { solid: "#f59e0b", text: "#b45309", light: "#fffbeb", border: "#fcd34d" },
  { solid: "#8b5cf6", text: "#6d28d9", light: "#f5f3ff", border: "#c4b5fd" },
  { solid: "#f43f5e", text: "#be123c", light: "#fff1f2", border: "#fda4af" },
];

const STATUS_FILL: Record<string, number> = {
  open: 0,
  claimed: 1,
  in_progress: 2,
  completed: 4,
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-green-100 text-green-700",
  claimed: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-gray-200 text-gray-600",
};

export default function ExperimentModules({ experiments, studyId, onUpdate, fundedAmount = 0, fundingGoal = 0 }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [allocating, setAllocating] = useState(false);

  const hasAllocations = experiments.some((e) => e.budget_pct != null);
  const showBudgetCol = fundedAmount > 0 || fundingGoal > 0;

  // Auto-trigger allocation if modules exist but none have budget_pct
  useEffect(() => {
    if (experiments.length > 0 && !hasAllocations && fundingGoal > 0 && !allocating) {
      handleAllocateBudget();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiments.length, hasAllocations, fundingGoal]);

  async function handleAllocateBudget() {
    if (allocating || experiments.length === 0) return;
    setAllocating(true);
    try {
      await fetch(`/api/experiments/${studyId}/allocate-budget`, { method: "POST" });
      onUpdate();
    } catch {
      // silently fail
    }
    setAllocating(false);
  }

  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const completedCount = experiments.filter((e) => e.status === "completed").length;
  const overallPercent = experiments.length > 0
    ? Math.round((completedCount / experiments.length) * 100)
    : 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => { if (renamingId) renameInputRef.current?.focus(); }, [renamingId]);
  useEffect(() => { if (addingNew) addInputRef.current?.focus(); }, [addingNew]);

  async function handleRename(id: string) {
    if (!renameValue.trim() || busy) return;
    setBusy(true);
    await fetch(`/api/modules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module_name: renameValue }),
    });
    setRenamingId(null);
    setRenameValue("");
    setBusy(false);
    onUpdate();
  }

  async function handleDelete(id: string) {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/modules/${id}`, { method: "DELETE" });
    setBusy(false);
    setMenuOpenId(null);
    onUpdate();
  }

  async function handleAdd() {
    if (!newName.trim() || busy) return;
    setBusy(true);
    await fetch("/api/modules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experiment_id: studyId, module_name: newName }),
    });
    setAddingNew(false);
    setNewName("");
    setBusy(false);
    onUpdate();
  }

  const sessionId = getSessionId();

  async function handleVolunteer(id: string) {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/modules/${id}/volunteer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lab_name: "Your Lab", session_id: sessionId }),
    });
    setBusy(false);
    onUpdate();
  }

  async function handleUnclaim(id: string) {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/modules/${id}/volunteer?session_id=${sessionId}`, {
      method: "DELETE",
    });
    setBusy(false);
    onUpdate();
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg mt-4">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <FlaskConical size={16} className="text-indigo-500" />
          Experiment Modules
        </h2>
        <div className="flex items-center gap-3">
          {showBudgetCol && experiments.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAllocateBudget(); }}
              disabled={allocating}
              className="flex items-center gap-1.5 text-[11px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded transition-colors font-medium disabled:opacity-40"
              title="Recalculate budget allocation using AI"
            >
              {allocating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {allocating ? "Allocating..." : "Recalculate budget"}
            </button>
          )}
          <span className="text-xs text-gray-500">
            {completedCount}/{experiments.length} complete
          </span>
        </div>
      </div>

      {/* Column header */}
      <div className={`grid gap-3 px-5 py-2 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider ${showBudgetCol ? "grid-cols-[1fr_100px_140px_100px_minmax(180px,1fr)_36px]" : "grid-cols-[1fr_100px_140px_minmax(200px,1.2fr)_36px]"}`}>
        <span>Module</span>
        <span>Status</span>
        <span>Owner</span>
        {showBudgetCol && <span>Budget</span>}
        <span>Timeline</span>
        <span />
      </div>

      {/* Rows */}
      {experiments.length === 0 && !addingNew ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          No modules yet. Add one to get started.
        </div>
      ) : (
        <div>
          {experiments.map((exp, idx) => {
            const color = PALETTE[idx % PALETTE.length];
            const filled = STATUS_FILL[exp.status] || 0;
            const isExpanded = expandedId === exp.id;

            return (
              <div key={exp.id}>
                {/* Main row */}
                <div
                  className={`grid gap-3 pl-4 pr-5 py-2.5 border-b border-gray-50 items-center transition-colors cursor-pointer ${showBudgetCol ? "grid-cols-[1fr_100px_140px_100px_minmax(180px,1fr)_36px]" : "grid-cols-[1fr_100px_140px_minmax(200px,1.2fr)_36px]"}`}
                  style={{
                    borderLeft: `3px solid ${color.solid}`,
                    backgroundColor: hoveredId === exp.id ? color.light : undefined,
                  }}
                  onMouseEnter={() => setHoveredId(exp.id)}
                  onMouseLeave={() => {
                    if (menuOpenId !== exp.id) setHoveredId(null);
                  }}
                  onClick={() => {
                    if (!renamingId) {
                      setExpandedId(isExpanded ? null : exp.id);
                    }
                  }}
                >
                  {/* Name */}
                  <div className="min-w-0" onClick={(e) => renamingId === exp.id && e.stopPropagation()}>
                    {renamingId === exp.id ? (
                      <form
                        onSubmit={(e) => { e.preventDefault(); handleRename(exp.id); }}
                        className="flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="text-sm border border-blue-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                          onKeyDown={(e) => {
                            if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
                          }}
                        />
                        <button type="submit" disabled={busy} className="p-1 text-green-600 hover:bg-green-50 rounded">
                          <Check size={14} />
                        </button>
                        <button type="button" onClick={() => { setRenamingId(null); setRenameValue(""); }} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                          <X size={14} />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronDown
                          size={14}
                          className={`shrink-0 text-gray-400 transition-transform ${isExpanded ? "" : "-rotate-90"}`}
                        />
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: color.solid }}
                        />
                        <span className="text-[13px] font-semibold truncate" style={{ color: color.text }}>
                          {exp.module_name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium w-fit ${STATUS_STYLES[exp.status] || "bg-gray-100 text-gray-600"}`}>
                    {exp.status.replace("_", " ")}
                  </span>

                  {/* Owner */}
                  <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                    {exp.assigned_lab ? (
                      <span className="group/lab inline-flex items-center gap-1 text-xs font-medium text-gray-700 truncate">
                        {exp.assigned_lab}
                        {exp.claimed_by === sessionId && (
                          <button
                            onClick={() => handleUnclaim(exp.id)}
                            disabled={busy}
                            className="opacity-0 group-hover/lab:opacity-100 p-0.5 rounded hover:bg-red-100 hover:text-red-600 transition-all disabled:opacity-40"
                            title="Unclaim this experiment"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleVolunteer(exp.id)}
                        disabled={busy}
                        className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2 py-1 rounded transition-colors font-medium disabled:opacity-40"
                      >
                        <Hand size={12} />
                        Volunteer
                      </button>
                    )}
                  </div>

                  {/* Budget */}
                  {showBudgetCol && (() => {
                    const pct = exp.budget_pct ?? (100 / experiments.length);
                    const amount = fundedAmount * (pct / 100);
                    return (
                      <div
                        className="flex items-center gap-1 group/budget relative"
                        title={exp.budget_rationale || `${Math.round(pct)}% of total budget`}
                      >
                        {allocating ? (
                          <Loader2 size={12} className="animate-spin text-gray-300" />
                        ) : (
                          <>
                            <DollarSign size={12} className="text-green-500 shrink-0" />
                            <span className="text-xs font-semibold text-green-700">
                              {fundedAmount > 0 ? Math.round(amount).toLocaleString() : "—"}
                            </span>
                            <span className="text-[10px] text-gray-400 ml-0.5">
                              {Math.round(pct)}%
                            </span>
                            {exp.budget_rationale && (
                              <Sparkles size={10} className="text-amber-400 shrink-0" />
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Inline Gantt phases */}
                  <div className="flex h-6 rounded-md overflow-hidden border border-gray-200">
                    {PHASES.map((phase, phaseIdx) => {
                      const isFilled = phaseIdx < filled;
                      return (
                        <div
                          key={phase.key}
                          className="relative flex items-center justify-center text-[10px] font-medium transition-colors"
                          style={{
                            width: `${(phase.weeks / TOTAL_WEEKS) * 100}%`,
                            background: isFilled ? color.solid : "#f3f4f6",
                            color: isFilled ? "#fff" : "#9ca3af",
                            borderRight: phaseIdx < PHASES.length - 1
                              ? `1px solid ${isFilled ? "rgba(255,255,255,0.3)" : "#e5e7eb"}`
                              : undefined,
                          }}
                          title={phase.label}
                        >
                          <span className="truncate px-1">{phase.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions (... menu) */}
                  <div className="relative flex justify-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === exp.id ? null : exp.id)}
                      className={`p-1 rounded hover:bg-gray-200 transition-opacity ${
                        hoveredId === exp.id || menuOpenId === exp.id ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <MoreHorizontal size={16} className="text-gray-500" />
                    </button>

                    {menuOpenId === exp.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-36"
                      >
                        <button
                          onClick={() => { setRenamingId(exp.id); setRenameValue(exp.module_name); setMenuOpenId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Pencil size={14} />
                          Rename
                        </button>
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div
                    className="px-5 py-3 border-b border-gray-100"
                    style={{ borderLeft: `3px solid ${color.solid}`, backgroundColor: color.light }}
                  >
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="font-semibold text-gray-700">Description</span>
                        <p className="text-gray-600 mt-0.5 leading-relaxed">
                          {exp.description || "No description provided."}
                        </p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">Expertise Required</span>
                        <p className="text-gray-600 mt-0.5 leading-relaxed">
                          {exp.expertise_required || "Not specified."}
                        </p>
                      </div>
                    </div>
                    {exp.assigned_lab && (
                      <p className="text-xs text-gray-400 mt-2">Assigned lab: {exp.assigned_lab}</p>
                    )}
                    {showBudgetCol && experiments.length > 0 && (() => {
                      const pct = exp.budget_pct ?? (100 / experiments.length);
                      const amount = fundedAmount * (pct / 100);
                      const goalAmount = fundingGoal * (pct / 100);
                      return (
                        <div className="mt-3 pt-3 border-t border-gray-200/60">
                          <div className="flex items-center gap-2">
                            <DollarSign size={12} className="text-green-600" />
                            <span className="text-xs font-semibold text-green-700">
                              Module Budget: {fundedAmount > 0 ? `$${Math.round(amount).toLocaleString()}` : "—"}{" "}
                              <span className="font-normal text-gray-400">
                                ({Math.round(pct)}% of ${fundingGoal.toLocaleString()} goal = ${Math.round(goalAmount).toLocaleString()})
                              </span>
                            </span>
                          </div>
                          {exp.budget_rationale && (
                            <div className="flex items-start gap-1.5 mt-1.5 ml-0.5">
                              <Sparkles size={11} className="text-amber-400 mt-0.5 shrink-0" />
                              <p className="text-[11px] text-gray-500 italic leading-relaxed">
                                {exp.budget_rationale}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add section row */}
      <div className="px-5 py-3 border-b border-gray-100">
        {addingNew ? (
          <form
            onSubmit={(e) => { e.preventDefault(); handleAdd(); }}
            className="flex items-center gap-2"
          >
            <input
              ref={addInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Module name..."
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
              onKeyDown={(e) => {
                if (e.key === "Escape") { setAddingNew(false); setNewName(""); }
              }}
            />
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              Add
            </button>
            <button type="button" onClick={() => { setAddingNew(false); setNewName(""); }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
              <X size={16} />
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAddingNew(true)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Add module
          </button>
        )}
      </div>

      {/* Overall progress bar */}
      <div className="px-5 py-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span>Overall Progress</span>
          <span>{overallPercent}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-indigo-500 h-2 rounded-full transition-all"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
