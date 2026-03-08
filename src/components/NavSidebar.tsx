"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SCIENCE_FIELDS } from "@/types";
import {
  Brain,
  Dna,
  Shield,
  Bug,
  Pill,
  Binary,
  Microscope,
  Leaf,
  FlaskConical,
  Wrench,
  Activity,
  HeartPulse,
  Baby,
  Syringe,
  Home,
  Lightbulb,
  Beaker,
  TreeDeciduous,
  Sprout,
  Network,
  BookOpen,
  PawPrint,
  Bone,
  CloudSun,
  BrainCircuit,
} from "lucide-react";

const FIELD_ICONS: Record<string, React.ElementType> = {
  Neuroscience: Brain,
  "Molecular Biology": Dna,
  Genetics: Dna,
  Immunology: Shield,
  Oncology: Syringe,
  Microbiology: Bug,
  Pharmacology: Pill,
  Bioinformatics: Binary,
  "Cell Biology": Microscope,
  Ecology: Leaf,
  Biochemistry: FlaskConical,
  Bioengineering: Wrench,
  Epidemiology: Activity,
  Physiology: HeartPulse,
  "Developmental Biology": Baby,
  "Evolutionary Biology": TreeDeciduous,
  "Plant Biology": Sprout,
  "Systems Biology": Network,
  "Scientific Communication": BookOpen,
  Zoology: PawPrint,
  Paleontology: Bone,
  "Climate Science": CloudSun,
  Psychology: BrainCircuit,
};

export default function NavSidebar({
  activeTag,
  onTagChange,
  tagCounts,
}: {
  activeTag?: string | null;
  onTagChange?: (tag: string | null) => void;
  tagCounts?: Record<string, number>;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <aside className="w-[270px] shrink-0 hidden lg:flex flex-col h-[calc(100vh-48px)] sticky top-12 border-r border-gray-200 bg-white overflow-y-auto">
      {/* Main nav */}
      <div className="px-3 pt-4 pb-2">
        {isHome && onTagChange ? (
          <button
            onClick={() => onTagChange(null)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              !activeTag
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Home size={20} />
            Home
          </button>
        ) : (
          <Link
            href="/"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isHome && !activeTag
                ? "bg-gray-100 text-gray-900"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Home size={20} />
            Home
          </Link>
        )}
        <Link
          href="/submit"
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/submit"
              ? "bg-gray-100 text-gray-900"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Lightbulb size={20} />
          Submit Hypothesis
        </Link>
        <Link
          href="/my-experiments"
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/my-experiments" || pathname.startsWith("/my-experiments/")
              ? "bg-gray-100 text-gray-900"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Beaker size={20} />
          Your Experiments
        </Link>
      </div>

      <div className="mx-3 my-1 border-t border-gray-200" />

      {/* Fields section */}
      <div className="px-3 pt-2 pb-1">
        <h2 className="px-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
          Fields of Science
        </h2>
      </div>

      <div className="px-3 pb-4 flex-1 overflow-y-auto">
        {SCIENCE_FIELDS.map((field) => {
          const Icon = FIELD_ICONS[field] || FlaskConical;
          const count = tagCounts?.[field] || 0;
          const isActive = activeTag === field;

          if (onTagChange) {
            return (
              <button
                key={field}
                onClick={() => onTagChange(isActive ? null : field)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-orange-50 text-orange-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon size={18} className={isActive ? "text-orange-500" : "text-gray-400"} />
                <span className="truncate">{field}</span>
                {count > 0 && (
                  <span className={`ml-auto text-xs ${isActive ? "text-orange-400" : "text-gray-400"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          }

          return (
            <Link
              key={field}
              href={`/?tag=${encodeURIComponent(field)}`}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Icon size={18} className="text-gray-400" />
              <span className="truncate">{field}</span>
              {count > 0 && (
                <span className="ml-auto text-xs text-gray-400">{count}</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-gray-200 text-[11px] text-gray-400">
        Archimedes &middot; AI Principal Investigator
      </div>
    </aside>
  );
}
