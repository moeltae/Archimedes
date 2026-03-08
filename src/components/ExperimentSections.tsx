"use client";

import { useState, useRef, useEffect } from "react";
import { StudyExperiment } from "@/types";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  FlaskConical,
  Hand,
  X,
  Check,
} from "lucide-react";

interface Props {
  experiments: StudyExperiment[];
  studyId: string;
  onUpdate: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-green-100 text-green-700",
  claimed: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-gray-200 text-gray-600",
};

const ROW_COLORS = [
  { dot: "#3b82f6", text: "#1d4ed8", light: "#eff6ff" },
  { dot: "#10b981", text: "#047857", light: "#ecfdf5" },
  { dot: "#f59e0b", text: "#b45309", light: "#fffbeb" },
  { dot: "#8b5cf6", text: "#6d28d9", light: "#f5f3ff" },
  { dot: "#f43f5e", text: "#be123c", light: "#fff1f2" },
];

export default function ExperimentSections({ experiments, studyId, onUpdate }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [volunteeringId, setVolunteeringId] = useState<string | null>(null);
  const [labName, setLabName] = useState("");
  const [busy, setBusy] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const labInputRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Focus inputs when they appear
  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);
  useEffect(() => {
    if (addingNew) addInputRef.current?.focus();
  }, [addingNew]);
  useEffect(() => {
    if (volunteeringId) labInputRef.current?.focus();
  }, [volunteeringId]);

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

  async function handleVolunteer(id: string) {
    if (!labName.trim() || busy) return;
    setBusy(true);
    await fetch(`/api/modules/${id}/volunteer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lab_name: labName }),
    });
    setVolunteeringId(null);
    setLabName("");
    setBusy(false);
    onUpdate();
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg mt-4">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <FlaskConical size={16} className="text-indigo-500" />
          Experiment Sections
        </h2>
        <span className="text-xs text-gray-400">
          {experiments.length} section{experiments.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_1fr_180px_100px_160px_40px] gap-3 px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
        <span>Name</span>
        <span>Description</span>
        <span>Expertise</span>
        <span>Status</span>
        <span>Owner</span>
        <span />
      </div>

      {/* Rows */}
      {experiments.length === 0 && !addingNew ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          No sections yet. Add one to get started.
        </div>
      ) : (
        <div>
          {experiments.map((exp, idx) => {
            const rowColor = ROW_COLORS[idx % ROW_COLORS.length];
            return (
            <div
              key={exp.id}
              className="grid grid-cols-[1fr_1fr_180px_100px_160px_40px] gap-3 pl-4 pr-5 py-3 border-b border-gray-50 items-center transition-colors group"
              style={{
                borderLeft: `3px solid ${rowColor.dot}`,
                backgroundColor: hoveredId === exp.id ? rowColor.light : undefined,
              }}
              onMouseEnter={() => setHoveredId(exp.id)}
              onMouseLeave={() => {
                if (menuOpenId !== exp.id) setHoveredId(null);
              }}
            >
              {/* Name */}
              <div className="min-w-0">
                {renamingId === exp.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRename(exp.id);
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="text-sm border border-blue-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setRenamingId(null);
                          setRenameValue("");
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(null);
                        setRenameValue("");
                      }}
                      className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                    >
                      <X size={14} />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: rowColor.dot }}
                    />
                    <span
                      className="text-[13px] font-semibold truncate"
                      style={{ color: rowColor.text }}
                    >
                      {exp.module_name}
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-gray-500 truncate">
                {exp.description || "—"}
              </p>

              {/* Expertise */}
              <span className="text-xs text-gray-500 truncate">
                {exp.expertise_required || "—"}
              </span>

              {/* Status */}
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium w-fit ${
                  STATUS_STYLES[exp.status] || "bg-gray-100 text-gray-600"
                }`}
              >
                {exp.status.replace("_", " ")}
              </span>

              {/* Owner */}
              <div className="min-w-0">
                {volunteeringId === exp.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleVolunteer(exp.id);
                    }}
                    className="flex items-center gap-1"
                  >
                    <input
                      ref={labInputRef}
                      value={labName}
                      onChange={(e) => setLabName(e.target.value)}
                      placeholder="Lab name"
                      className="text-xs border border-blue-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-200"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setVolunteeringId(null);
                          setLabName("");
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="p-1 text-green-600 hover:bg-green-50 rounded shrink-0"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVolunteeringId(null);
                        setLabName("");
                      }}
                      className="p-1 text-gray-400 hover:bg-gray-100 rounded shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </form>
                ) : exp.assigned_lab ? (
                  <span className="text-xs font-medium text-gray-700 truncate block">
                    {exp.assigned_lab}
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setVolunteeringId(exp.id);
                      setLabName("");
                    }}
                    className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2 py-1 rounded transition-colors font-medium"
                  >
                    <Hand size={12} />
                    Volunteer
                  </button>
                )}
              </div>

              {/* Actions (... menu) */}
              <div className="relative flex justify-center">
                <button
                  onClick={() =>
                    setMenuOpenId(menuOpenId === exp.id ? null : exp.id)
                  }
                  className={`p-1 rounded hover:bg-gray-200 transition-opacity ${
                    hoveredId === exp.id || menuOpenId === exp.id
                      ? "opacity-100"
                      : "opacity-0"
                  }`}
                >
                  <MoreHorizontal size={16} className="text-gray-500" />
                </button>

                {menuOpenId === exp.id && (
                  <div
                    ref={menuRef}
                    className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-36 animate-in fade-in zoom-in-95 duration-100"
                  >
                    <button
                      onClick={() => {
                        setRenamingId(exp.id);
                        setRenameValue(exp.module_name);
                        setMenuOpenId(null);
                      }}
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
            );
          })}
        </div>
      )}

      {/* Add section row */}
      <div className="px-5 py-3">
        {addingNew ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={addInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Section name..."
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setAddingNew(false);
                  setNewName("");
                }
              }}
            />
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingNew(false);
                setNewName("");
              }}
              className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
            >
              <X size={16} />
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAddingNew(true)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Add section
          </button>
        )}
      </div>
    </div>
  );
}
