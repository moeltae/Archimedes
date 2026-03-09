"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import StudyCard from "@/components/StudyCard";
import SortBar, { SortType, StatusFilter } from "@/components/SortBar";
import NavSidebar from "@/components/NavSidebar";
import RightPanel from "@/components/RightPanel";
import { useSearch } from "@/components/SearchContext";
import { Study } from "@/types";
import { Loader2 } from "lucide-react";

export default function Home() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [allStudies, setAllStudies] = useState<Study[]>([]);
  const [sort, setSort] = useState<SortType>("hot");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const { searchQuery } = useSearch();

  const fetchStudies = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ sort });
    if (activeTag) params.set("tag", activeTag);
    if (statusFilter !== "all") params.set("status", statusFilter);

    const res = await fetch(`/api/experiments?${params}`);
    const data = await res.json();
    setStudies(data.experiments || []);
    setLoading(false);
  }, [sort, activeTag, statusFilter]);

  // Fetch all studies once for tag counts + right panel
  useEffect(() => {
    async function loadAll() {
      const res = await fetch("/api/experiments?sort=hot");
      const data = await res.json();
      const all = data.experiments || [];
      setAllStudies(all);
      const counts: Record<string, number> = {};
      for (const study of all) {
        for (const tag of study.tags || []) {
          counts[tag] = (counts[tag] || 0) + 1;
        }
      }
      setTagCounts(counts);
    }
    loadAll();
  }, []);

  useEffect(() => {
    fetchStudies();
  }, [fetchStudies]);

  const filteredStudies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return studies;
    return studies.filter((s) => {
      const title = s.title?.toLowerCase() || "";
      const hypothesis = s.hypothesis?.toLowerCase() || "";
      const tags = (s.tags || []).map((t) => t.toLowerCase());
      return (
        title.includes(q) ||
        hypothesis.includes(q) ||
        tags.some((tag) => tag.includes(q))
      );
    });
  }, [studies, searchQuery]);

  return (
    <div className="flex min-h-[calc(100vh-48px)]">
      {/* Left sidebar — full height */}
      <NavSidebar
        activeTag={activeTag}
        onTagChange={setActiveTag}
        tagCounts={tagCounts}
      />

      {/* Center feed */}
      <main className="flex-1 min-w-0 px-6 py-4">
        <div>
          {/* Sort bar */}
          <div className="mb-3">
            <SortBar
              active={sort}
              onChange={setSort}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
            />
          </div>

          {/* Feed */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : filteredStudies.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg">No studies found.</p>
              <p className="text-gray-400 text-sm mt-1">
                {searchQuery.trim()
                  ? `No results for "${searchQuery.trim()}". Try a different search.`
                  : activeTag
                    ? `No studies found for "${activeTag}". Try a different field.`
                    : "Run the seed script to pull papers from BioRxiv, or submit your own hypothesis."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredStudies.map((study) => (
                <StudyCard
                  key={study.id}
                  study={study}
                  onDelete={(id) => setStudies((prev) => prev.filter((s) => s.id !== id))}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Right panel */}
      <div className="pr-4 py-4">
        <RightPanel studies={allStudies} />
      </div>
    </div>
  );
}
