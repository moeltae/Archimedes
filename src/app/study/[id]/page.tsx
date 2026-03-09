"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FlaskConical,
  DollarSign,
  ExternalLink,
  Loader2,
  ArrowBigUp,
  ArrowBigDown,
  Clock,
  Users,
  Target,
  Beaker,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Study, StudyExperiment, getFieldColor } from "@/types";
import { getSessionId } from "@/lib/session";
import FundModal from "@/components/FundModal";
import NavSidebar from "@/components/NavSidebar";
import ExperimentModules from "@/components/ExperimentModules";
import CommentThread from "@/components/CommentThread";
import ReviewStatus from "@/components/ReviewStatus";
import RejectionCountdown from "@/components/RejectionCountdown";

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function StudyDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [study, setStudy] = useState<Study | null>(null);
  const [experiments, setExperiments] = useState<StudyExperiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState<"up" | "down" | null>(null);
  const [upvotes, setUpvotes] = useState(0);
  const [downvotes, setDownvotes] = useState(0);
  const [showFund, setShowFund] = useState(false);
  const [funded, setFunded] = useState(0);

  const reloadModules = useCallback(async () => {
    const { data: exps } = await supabase
      .from("modules")
      .select("*")
      .eq("experiment_id", id)
      .order("created_at", { ascending: true });
    setExperiments(exps || []);
  }, [id]);

  useEffect(() => {
    async function load() {
      const { data: studyData } = await supabase
        .from("experiments")
        .select("*, paper:papers(*)")
        .eq("id", id)
        .single();

      const { data: exps } = await supabase
        .from("modules")
        .select("*")
        .eq("experiment_id", id)
        .order("created_at", { ascending: true });

      setStudy(studyData);
      setExperiments(exps || []);
      if (studyData) {
        setUpvotes(studyData.upvotes);
        setDownvotes(studyData.downvotes);
        setFunded(studyData.funded_amount);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  // Scroll to hash fragment (e.g. #comments) after data loads
  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash;
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        // Small delay to let the comment section render
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 100);
      }
    }
  }, [loading]);

  async function handleVote(type: "up" | "down") {
    const sessionId = getSessionId();
    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experiment_id: id, vote_type: type, session_id: sessionId }),
    });
    const data = await res.json();
    if (data.action === "removed") {
      if (type === "up") setUpvotes((v) => v - 1);
      else setDownvotes((v) => v - 1);
      setUserVote(null);
    } else if (data.action === "switched") {
      if (type === "up") { setUpvotes((v) => v + 1); setDownvotes((v) => v - 1); }
      else { setDownvotes((v) => v + 1); setUpvotes((v) => v - 1); }
      setUserVote(type);
    } else {
      if (type === "up") setUpvotes((v) => v + 1);
      else setDownvotes((v) => v + 1);
      setUserVote(type);
    }
  }

  const score = upvotes - downvotes;

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-48px)]">
        <NavSidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="flex min-h-[calc(100vh-48px)]">
        <NavSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-lg">Study not found.</p>
            <Link href="/" className="text-orange-500 hover:underline text-sm mt-2 inline-block">
              Back to feed
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const fundingPercent = Math.min(100, (funded / study.funding_goal) * 100);
  const totalExperiments = experiments.length;

  return (
    <div className="flex min-h-[calc(100vh-48px)]">
      <NavSidebar />

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-6 py-4">
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft size={14} />
            Back to feed
          </Link>

          {/* ── Hero row: Title + vote + funding ── */}
          <div className="flex gap-4 items-start mb-5">
            {/* Vote column */}
            <div className="flex flex-col items-center gap-0.5 pt-1">
              <button
                onClick={() => handleVote("up")}
                className={`p-1 rounded hover:bg-orange-50 ${userVote === "up" ? "text-orange-500" : "text-gray-400"}`}
              >
                <ArrowBigUp size={28} fill={userVote === "up" ? "currentColor" : "none"} />
              </button>
              <span className={`text-base font-bold ${score > 0 ? "text-orange-500" : score < 0 ? "text-blue-500" : "text-gray-500"}`}>
                {score}
              </span>
              <button
                onClick={() => handleVote("down")}
                className={`p-1 rounded hover:bg-blue-50 ${userVote === "down" ? "text-blue-500" : "text-gray-400"}`}
              >
                <ArrowBigDown size={28} fill={userVote === "down" ? "currentColor" : "none"} />
              </button>
            </div>

            {/* Title area */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                {study.title}
              </h1>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Clock size={12} />{timeAgo(study.created_at)}</span>
                <span className="flex items-center gap-1"><Users size={12} />{totalExperiments} experiments</span>
              </div>
              {study.tags && study.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {study.tags.map((tag) => {
                    const c = getFieldColor(tag);
                    return (
                      <span key={tag} className={`px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text} rounded-full`}>{tag}</span>
                    );
                  })}
                </div>
              )}
              {(study.status === "pending_review" || study.status === "rejected" || study.status === "proposed") && (
                <ReviewStatus
                  studyId={study.id}
                  initialExplanation={study.review_explanation}
                  initialStatus={study.status}
                  onComplete={(newStatus) => {
                    setStudy((prev) => prev ? { ...prev, status: newStatus as Study["status"], rejected_at: newStatus === "rejected" ? new Date().toISOString() : prev.rejected_at } : prev);
                  }}
                />
              )}
              {study.status === "rejected" && (
                <div className="mt-2">
                  <RejectionCountdown
                    rejectedAt={study.rejected_at || study.created_at}
                    onExpired={() => {
                      // Delete the study and redirect to feed
                      fetch(`/api/experiments/${study.id}`, { method: "DELETE" }).finally(() => {
                        window.location.href = "/";
                      });
                    }}
                  />
                </div>
              )}
            </div>

            {/* Fund CTA */}
            <div className="shrink-0 w-48">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">${funded.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mb-2">of ${study.funding_goal.toLocaleString()} goal</div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3">
                  <div className="bg-green-500 h-2.5 rounded-full transition-all" style={{ width: `${fundingPercent}%` }} />
                </div>
                <button
                  onClick={() => setShowFund(true)}
                  className="w-full py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <DollarSign size={14} />
                  Fund This
                </button>
              </div>
            </div>
          </div>

          {/* ── Two-column grid: Hypothesis+Design | Source Paper ── */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            {/* Left: Hypothesis + Study design */}
            <div className="xl:col-span-3 flex flex-col gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Target size={16} className="text-orange-500" />
                  Hypothesis
                </h2>
                <p className="text-sm text-gray-700 leading-relaxed">{study.hypothesis}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-5 flex-1">
                <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Beaker size={16} className="text-purple-500" />
                  Study Design
                </h2>
                <p className="text-sm text-gray-700 leading-relaxed">{study.study_design}</p>
              </div>
            </div>

            {/* Right: Source paper */}
            {study.paper && (
              <div className="xl:col-span-2">
                <div className="bg-white border border-gray-200 rounded-lg p-5 h-full">
                  <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <FlaskConical size={16} className="text-blue-500" />
                    Source Paper
                  </h2>
                  <h3 className="font-semibold text-gray-800 text-sm leading-tight">
                    {study.paper.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    {study.paper.abstract.slice(0, 250)}...
                  </p>
                  <div className="mt-3 space-y-1.5">
                    <div className="text-xs">
                      <span className="font-semibold text-gray-700">Claims: </span>
                      <span className="text-gray-500">{study.paper.claims}</span>
                    </div>
                    <div className="text-xs">
                      <span className="font-semibold text-gray-700">Gap: </span>
                      <span className="text-gray-500">{study.paper.research_gap}</span>
                    </div>
                  </div>
                  {study.paper.source_url && (
                    <a
                      href={study.paper.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-3 text-xs text-orange-500 hover:underline"
                    >
                      <ExternalLink size={11} />
                      View original paper
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Experiment Modules — unified timeline + management ── */}
          <ExperimentModules
            experiments={experiments}
            studyId={id}
            onUpdate={reloadModules}
            fundedAmount={funded}
            fundingGoal={study.funding_goal}
          />

          {/* ── Comment Threads ── */}
          <CommentThread experimentId={id} />
        </div>
      </main>

      {showFund && (
        <FundModal
          study={study}
          currentFunded={funded}
          onClose={() => setShowFund(false)}
          onFund={(amount) => setFunded((f) => f + amount)}
        />
      )}
    </div>
  );
}
