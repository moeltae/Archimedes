"use client";

import { Flame, Clock, TrendingUp, DollarSign, ShieldCheck } from "lucide-react";

const SORTS = [
  { key: "hot", label: "Hot", icon: Flame },
  { key: "new", label: "New", icon: Clock },
  { key: "top", label: "Top", icon: TrendingUp },
  { key: "funded", label: "Most Funded", icon: DollarSign },
  { key: "review", label: "Under Review", icon: ShieldCheck },
] as const;

export type SortType = (typeof SORTS)[number]["key"];

export default function SortBar({
  active,
  onChange,
}: {
  active: SortType;
  onChange: (sort: SortType) => void;
}) {
  return (
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
  );
}
