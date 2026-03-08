"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowBigUp,
  ArrowBigDown,
  DollarSign,
  FlaskConical,
  Clock,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { Study, getFieldColor } from "@/types";
import { getSessionId } from "@/lib/session";
import FundModal from "./FundModal";
import RejectionCountdown from "./RejectionCountdown";

function timeAgo(dateStr: string) {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function StudyCard({
  study,
  onVote,
}: {
  study: Study;
  onVote?: () => void;
}) {
  const [upvotes, setUpvotes] = useState(study.upvotes);
  const [downvotes, setDownvotes] = useState(study.downvotes);
  const [userVote, setUserVote] = useState<"up" | "down" | null>(null);
  const [voting, setVoting] = useState(false);
  const [showFund, setShowFund] = useState(false);
  const [funded, setFunded] = useState(study.funded_amount);
  const [expired, setExpired] = useState(false);

  const score = upvotes - downvotes;

  async function handleVote(type: "up" | "down") {
    if (voting) return;
    setVoting(true);

    const sessionId = getSessionId();
    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        experiment_id: study.id,
        vote_type: type,
        session_id: sessionId,
      }),
    });

    const data = await res.json();

    if (data.action === "removed") {
      if (type === "up") setUpvotes((v) => v - 1);
      else setDownvotes((v) => v - 1);
      setUserVote(null);
    } else if (data.action === "switched") {
      if (type === "up") {
        setUpvotes((v) => v + 1);
        setDownvotes((v) => v - 1);
      } else {
        setDownvotes((v) => v + 1);
        setUpvotes((v) => v - 1);
      }
      setUserVote(type);
    } else {
      if (type === "up") setUpvotes((v) => v + 1);
      else setDownvotes((v) => v + 1);
      setUserVote(type);
    }

    setVoting(false);
    onVote?.();
  }

  return (
    <>
      <div className="flex gap-3 bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
        {/* Vote column */}
        <div className="flex flex-col items-center gap-0.5 min-w-[40px]">
          <button
            onClick={() => handleVote("up")}
            className={`p-1 rounded hover:bg-orange-50 transition-colors ${
              userVote === "up" ? "text-orange-500" : "text-gray-400"
            }`}
          >
            <ArrowBigUp size={24} fill={userVote === "up" ? "currentColor" : "none"} />
          </button>
          <span
            className={`text-sm font-bold ${
              score > 0
                ? "text-orange-500"
                : score < 0
                  ? "text-blue-500"
                  : "text-gray-500"
            }`}
          >
            {score}
          </span>
          <button
            onClick={() => handleVote("down")}
            className={`p-1 rounded hover:bg-blue-50 transition-colors ${
              userVote === "down" ? "text-blue-500" : "text-gray-400"
            }`}
          >
            <ArrowBigDown
              size={24}
              fill={userVote === "down" ? "currentColor" : "none"}
            />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <FlaskConical size={12} />
            <span className="font-medium text-gray-700">
              {study.paper?.title
                ? `From: ${study.paper.title.slice(0, 60)}${study.paper.title.length > 60 ? "..." : ""}`
                : "User submission"}
            </span>
            <span>·</span>
            <Clock size={12} />
            <span>{timeAgo(study.created_at)}</span>
          </div>

          <Link
            href={`/experiment/${study.id}`}
            className="block group"
          >
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-orange-600 transition-colors leading-tight">
              {study.title}
            </h3>
          </Link>

          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {study.hypothesis}
          </p>

          {study.tags && study.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {study.tags.map((tag) => {
                const c = getFieldColor(tag);
                return (
                  <span
                    key={tag}
                    className={`px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text} rounded-full`}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
          )}

          {study.status === "rejected" && study.rejected_at && !expired && (
            <div className="mt-2">
              <RejectionCountdown
                rejectedAt={study.rejected_at}
                onExpired={() => setExpired(true)}
              />
            </div>
          )}

          {expired && (
            <div className="mt-2 text-xs text-red-500 font-medium italic">
              This study has been removed.
            </div>
          )}

          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={() => setShowFund(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-full hover:bg-green-100 transition-colors"
            >
              <DollarSign size={14} />
              <span>Fund</span>
              <span className="text-green-600">
                ${funded.toLocaleString()} / ${study.funding_goal.toLocaleString()}
              </span>
            </button>

            <Link
              href={`/experiment/${study.id}`}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {study.experiments?.length || 0} experiment{study.experiments?.length === 1 ? "" : "s"}
            </Link>

            <Link
              href={`/experiment/${study.id}#comments`}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <MessageSquare size={14} />
              {study.comments?.length || 0}
            </Link>

            {study.paper?.source_url && (
              <a
                href={study.paper.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600"
              >
                <ExternalLink size={12} />
                Source Paper
              </a>
            )}

            <span
              className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                study.status === "pending_review"
                  ? "bg-amber-100 text-amber-800 animate-pulse"
                  : study.status === "proposed"
                    ? "bg-green-100 text-green-800"
                    : study.status === "rejected"
                      ? "bg-red-100 text-red-700"
                      : study.status === "funded"
                        ? "bg-emerald-100 text-emerald-800"
                        : study.status === "in_progress"
                          ? "bg-blue-100 text-blue-800"
                          : study.status === "completed"
                            ? "bg-gray-100 text-gray-800"
                            : "bg-gray-100 text-gray-800"
              }`}
            >
              {study.status === "pending_review"
                ? "Under Review"
                : study.status === "proposed"
                  ? "Approved"
                  : study.status === "rejected"
                    ? "Rejected"
                    : study.status === "funded"
                      ? "Funded"
                      : study.status === "in_progress"
                        ? "In Progress"
                        : study.status === "completed"
                          ? "Completed"
                          : study.status}
            </span>
          </div>
        </div>
      </div>

      {showFund && (
        <FundModal
          study={study}
          currentFunded={funded}
          onClose={() => setShowFund(false)}
          onFund={(amount) => setFunded((f) => f + amount)}
        />
      )}
    </>
  );
}
