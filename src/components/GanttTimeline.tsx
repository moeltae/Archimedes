"use client";

import { useRef, useEffect, useState } from "react";
import { StudyExperiment } from "@/types";
import { Users } from "lucide-react";
import "vis-timeline/styles/vis-timeline-graph2d.css";

// Phase definitions with colors
const PHASES = [
  { key: "setup", label: "Setup", weeks: 3 },
  { key: "execution", label: "Execution", weeks: 6 },
  { key: "analysis", label: "Analysis", weeks: 4 },
  { key: "delivery", label: "Delivery", weeks: 2 },
] as const;

// Color palette per experiment (solid hex for vis-timeline inline styles)
const PALETTE = [
  { solid: "#3b82f6", light: "#dbeafe", border: "#93c5fd", text: "#1d4ed8" },
  { solid: "#10b981", light: "#d1fae5", border: "#6ee7b7", text: "#047857" },
  { solid: "#f59e0b", light: "#fef3c7", border: "#fcd34d", text: "#b45309" },
  { solid: "#8b5cf6", light: "#ede9fe", border: "#c4b5fd", text: "#6d28d9" },
  { solid: "#f43f5e", light: "#ffe4e6", border: "#fda4af", text: "#be123c" },
];

// Map status to which phases are filled
const STATUS_PHASES: Record<string, number> = {
  open: 0,
  claimed: 1,
  in_progress: 2,
  completed: 4,
};

const STATUS_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  open: { bg: "#dcfce7", fg: "#15803d", label: "Open" },
  claimed: { bg: "#fef9c3", fg: "#a16207", label: "Claimed" },
  in_progress: { bg: "#dbeafe", fg: "#1d4ed8", label: "Active" },
  completed: { bg: "#f3f4f6", fg: "#4b5563", label: "Done" },
};

interface Props {
  experiments: StudyExperiment[];
}

export default function GanttTimeline({ experiments }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<InstanceType<typeof import("vis-timeline").Timeline> | null>(null);
  const [selectedExp, setSelectedExp] = useState<StudyExperiment | null>(null);

  const completedCount = experiments.filter((e) => e.status === "completed").length;
  const totalCount = experiments.length;
  const overallPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  useEffect(() => {
    if (!containerRef.current || experiments.length === 0) return;

    let mounted = true;

    async function init() {
      const { Timeline } = await import("vis-timeline/standalone");
      const { DataSet } = await import("vis-data/standalone");

      if (!mounted || !containerRef.current) return;

      // Build groups (one per experiment)
      const groups = new DataSet(
        experiments.map((exp, i) => {
          const color = PALETTE[i % PALETTE.length];
          const badge = STATUS_BADGE[exp.status] || STATUS_BADGE.open;
          return {
            id: exp.id,
            content: `
              <div class="gantt-group" style="--dot-color: ${color.solid}; --name-color: ${color.text}; --badge-bg: ${badge.bg}; --badge-fg: ${badge.fg};">
                <span class="gantt-group-dot"></span>
                <span class="gantt-group-name">${exp.module_name}</span>
                <span class="gantt-group-badge">${badge.label}</span>
              </div>
            `,
            order: i,
          };
        })
      );

      // Build items (phases per experiment, staggered)
      const items = new DataSet<{
        id: string;
        group: string;
        content: string;
        start: Date;
        end: Date;
        className: string;
        style: string;
        type: string;
      }>();

      const baseDate = new Date();
      baseDate.setHours(0, 0, 0, 0);

      experiments.forEach((exp, expIdx) => {
        const color = PALETTE[expIdx % PALETTE.length];
        const filledPhases = STATUS_PHASES[exp.status] || 0;
        // Stagger experiment start by 1 week per experiment
        const expOffsetDays = expIdx * 7;

        let dayOffset = expOffsetDays;

        PHASES.forEach((phase, phaseIdx) => {
          const start = new Date(baseDate);
          start.setDate(start.getDate() + dayOffset);
          const end = new Date(start);
          end.setDate(end.getDate() + phase.weeks * 7);

          const isFilled = phaseIdx < filledPhases;
          const isActive = phaseIdx === filledPhases - 1 || (filledPhases === 0 && phaseIdx === 0);

          let bgColor: string;
          let borderColor: string;
          let textColor: string;
          let fontWeight: string;

          if (isFilled) {
            bgColor = color.solid;
            borderColor = color.solid;
            textColor = "#ffffff";
            fontWeight = "600";
          } else if (isActive && filledPhases > 0) {
            bgColor = color.solid;
            borderColor = color.solid;
            textColor = "#ffffff";
            fontWeight = "600";
          } else {
            bgColor = color.light;
            borderColor = color.border;
            textColor = color.text;
            fontWeight = "500";
          }

          items.add({
            id: `${exp.id}-${phase.key}`,
            group: exp.id,
            content: `<span style="font-size: 11px; letter-spacing: 0.02em;">${phase.label}</span>`,
            start,
            end,
            className: `gantt-phase gantt-phase-${phase.key}`,
            style: `background: ${bgColor}; border-color: ${borderColor}; color: ${textColor}; font-weight: ${fontWeight}; border-radius: 6px; border-width: 1.5px; height: 28px; line-height: 28px;`,
            type: "range",
          });

          dayOffset += phase.weeks * 7;
        });
      });

      // Timeline options
      const options = {
        stack: false,
        showMajorLabels: true,
        showMinorLabels: true,
        showCurrentTime: true,
        orientation: { axis: "top" as const, item: "top" as const },
        margin: { item: { horizontal: 2, vertical: 4 }, axis: 8 },
        selectable: true,
        multiselect: false,
        zoomMin: 1000 * 60 * 60 * 24 * 7,      // 1 week
        zoomMax: 1000 * 60 * 60 * 24 * 365,     // 1 year
        verticalScroll: true,
        horizontalScroll: true,
        maxHeight: 420,
        minHeight: 200,
        groupHeightMode: "fixed" as const,
        format: {
          minorLabels: {
            week: "w",
            day: "D",
          },
        },
        showTooltips: false,
      };

      // Clean up previous instance
      if (timelineRef.current) {
        timelineRef.current.destroy();
      }

      const timeline = new Timeline(containerRef.current!, items, groups, options);
      timelineRef.current = timeline;

      // Fit to show all items
      setTimeout(() => {
        if (mounted) timeline.fit({ animation: { duration: 400, easingFunction: "easeInOutQuad" } });
      }, 100);

      // Item select handler
      timeline.on("select", (props: { items: string[] }) => {
        if (props.items.length > 0) {
          const itemId = props.items[0];
          const expId = itemId.split("-").slice(0, -1).join("-"); // Remove phase suffix
          const exp = experiments.find((e) => e.id === expId);
          setSelectedExp(exp || null);
        } else {
          setSelectedExp(null);
        }
      });
    }

    init();

    return () => {
      mounted = false;
      if (timelineRef.current) {
        timelineRef.current.destroy();
        timelineRef.current = null;
      }
    };
  }, [experiments]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Users size={16} className="text-indigo-500" />
          Experiments Timeline
        </h2>
        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-[10px] text-gray-500 mr-2">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />
              Completed
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-blue-100 border border-blue-200" />
              Pending
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {completedCount}/{totalCount} complete
          </span>
        </div>
      </div>

      {/* Timeline container */}
      {experiments.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No experiments defined yet.</div>
      ) : (
        <div
          ref={containerRef}
          className="gantt-timeline-container rounded-lg border border-gray-100 overflow-hidden"
        />
      )}

      {/* Selected experiment detail panel */}
      {selectedExp && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100 animate-in fade-in duration-200">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{selectedExp.module_name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{selectedExp.expertise_required}</p>
            </div>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                selectedExp.status === "open" ? "bg-green-100 text-green-700"
                : selectedExp.status === "claimed" ? "bg-yellow-100 text-yellow-700"
                : selectedExp.status === "completed" ? "bg-gray-200 text-gray-600"
                : "bg-blue-100 text-blue-700"
              }`}
            >
              {selectedExp.status}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-2 leading-relaxed">{selectedExp.description}</p>
          {selectedExp.assigned_lab && (
            <p className="text-xs text-gray-400 mt-1">Lab: {selectedExp.assigned_lab}</p>
          )}
        </div>
      )}

      {/* Overall progress bar */}
      <div className="mt-4 pt-3 border-t border-gray-100">
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
