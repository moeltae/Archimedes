"use client";

import { Study, getFieldColor } from "@/types";
import { TrendingUp, FlaskConical, DollarSign, Microscope, Eye } from "lucide-react";
import Link from "next/link";

/** Deterministic demo view count derived from study engagement */
function getDemoViews(study: Study): number {
  const base = (study.upvotes + study.downvotes) * 12 + study.funded_amount * 2;
  // Simple hash from id to add variance
  let hash = 0;
  for (let i = 0; i < study.id.length; i++) {
    hash = ((hash << 5) - hash + study.id.charCodeAt(i)) | 0;
  }
  return Math.max(base + (Math.abs(hash) % 200) + 50, 80);
}

function formatViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function RightPanel({
  studies,
}: {
  studies: Study[];
}) {
  // Top funded studies
  const topFunded = [...studies]
    .sort((a, b) => b.funded_amount - a.funded_amount)
    .filter((e) => e.funded_amount > 0)
    .slice(0, 5);

  // Most upvoted
  const trending = [...studies]
    .sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes))
    .slice(0, 5);

  // Tag distribution
  const tagMap: Record<string, number> = {};
  for (const study of studies) {
    for (const tag of study.tags || []) {
      tagMap[tag] = (tagMap[tag] || 0) + 1;
    }
  }
  const topTags = Object.entries(tagMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="w-[316px] shrink-0 hidden xl:block">
      <div className="sticky top-16 space-y-3">
        {/* Trending studies */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
            <TrendingUp size={14} className="text-orange-500" />
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Trending Studies
            </h3>
          </div>
          <div className="p-2">
            {trending.map((study, i) => (
              <Link
                key={study.id}
                href={`/study/${study.id}`}
                className="flex items-start gap-3 px-2 py-2 rounded-md hover:bg-gray-50 transition-colors"
              >
                <span className="text-lg font-bold text-gray-300 w-5 text-right shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <FlaskConical size={12} className="text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-500 truncate">
                      {(study.tags || [])[0] || "Science"}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 leading-tight line-clamp-2">
                    {study.title}
                  </p>
                  <div className="flex items-center gap-2.5 mt-0.5">
                    <span className="text-xs text-gray-400">
                      {study.upvotes - study.downvotes} votes
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Eye size={11} />
                      {formatViews(getDemoViews(study))}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Top funded */}
        {topFunded.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <DollarSign size={14} className="text-green-500" />
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Most Funded
              </h3>
            </div>
            <div className="p-2">
              {topFunded.map((study) => (
                <Link
                  key={study.id}
                  href={`/study/${study.id}`}
                  className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <p className="text-sm text-gray-800 truncate mr-2">
                    {study.title}
                  </p>
                  <span className="text-xs font-semibold text-green-600 whitespace-nowrap">
                    ${study.funded_amount.toLocaleString()}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Active fields */}
        {topTags.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <Microscope size={14} className="text-blue-500" />
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Active Fields
              </h3>
            </div>
            <div className="p-3">
              <div className="flex flex-wrap gap-2">
                {topTags.map(([tag, count]) => {
                  const c = getFieldColor(tag);
                  return (
                    <span
                      key={tag}
                      className={`px-2.5 py-1 text-xs font-medium ${c.bg} ${c.text} rounded-full`}
                    >
                      {tag} &middot; {count}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer links */}
        <div className="px-4 pt-2 text-[11px] text-gray-400 leading-relaxed">
          <span>About</span> &middot; <span>GitHub</span> &middot;{" "}
          <span>API</span>
        </div>
      </div>
    </div>
  );
}
