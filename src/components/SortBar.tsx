"use client";

import { Flame, Clock, TrendingUp, DollarSign, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";

const SORTS = [
  { key: "hot", label: "Hot", icon: Flame },
  { key: "new", label: "New", icon: Clock },
  { key: "top", label: "Top", icon: TrendingUp },
  { key: "funded", label: "Most Funded", icon: DollarSign },
] as const;

export type SortType = (typeof SORTS)[number]["key"];

const STATUS_FILTERS: readonly { key: string; label: string; icon?: React.ElementType; color?: string }[] = [
  { key: "all", label: "All" },
  { key: "proposed", label: "Approved", icon: CheckCircle2, color: "text-green-600" },
  { key: "pending_review", label: "Under Review", icon: ShieldCheck, color: "text-amber-600" },
  { key: "rejected", label: "Rejected", icon: AlertCircle, color: "text-red-500" },
];

export type StatusFilter = "all" | "proposed" | "pending_review" | "rejected";

export default function SortBar({
  active,
  onChange,
  statusFilter,
  onStatusChange,
}: {
  active: SortType;
  onChange: (sort: SortType) => void;
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Sort buttons */}
      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1.5">
        {SORTS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active === key
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-1">
        {STATUS_FILTERS.map((sf) => {
          const isActive = statusFilter === sf.key;
          return (
            <button
              key={sf.key}
              onClick={() => onStatusChange(sf.key as StatusFilter)}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                isActive
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              {sf.icon && <sf.icon size={11} className={isActive ? "text-white" : sf.color} />}
              {sf.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
