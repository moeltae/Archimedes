"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Reply,
  Trash2,
  ChevronDown,
  ChevronUp,
  Send,
  Loader2,
} from "lucide-react";
import { Comment } from "@/types";
import { getSessionId } from "@/lib/session";

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

/** Build a tree from flat comments list */
function buildTree(comments: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];

  for (const c of comments) {
    map.set(c.id, { ...c, replies: [] });
  }

  for (const c of comments) {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ── Single comment ──────────────────────────────────────────
function CommentNode({
  comment,
  depth,
  sessionId,
  onReply,
  onDelete,
}: {
  comment: Comment;
  depth: number;
  sessionId: string;
  onReply: (parentId: string, body: string, authorName: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyName, setReplyName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const isOwn = comment.session_id === sessionId;
  const hasReplies = comment.replies && comment.replies.length > 0;

  async function handleSubmitReply() {
    if (!replyBody.trim()) return;
    setSubmitting(true);
    await onReply(comment.id, replyBody, replyName);
    setReplyBody("");
    setReplyName("");
    setReplying(false);
    setSubmitting(false);
  }

  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-gray-100 pl-4" : ""}>
      <div className="group py-2.5">
        {/* Header */}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-gray-800">
            {comment.author_name}
          </span>
          {isOwn && (
            <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded text-[10px] font-medium">
              you
            </span>
          )}
          <span className="text-gray-400">{timeAgo(comment.created_at)}</span>
        </div>

        {/* Body */}
        <p className="text-sm text-gray-700 mt-1 leading-relaxed whitespace-pre-wrap">
          {comment.body}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-1.5">
          {depth < 4 && (
            <button
              onClick={() => setReplying(!replying)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-orange-500 transition-colors"
            >
              <Reply size={12} />
              Reply
            </button>
          )}
          {isOwn && (
            <button
              onClick={() => onDelete(comment.id)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
          {hasReplies && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              {collapsed
                ? `Show ${comment.replies!.length} ${comment.replies!.length === 1 ? "reply" : "replies"}`
                : "Collapse"}
            </button>
          )}
        </div>

        {/* Inline reply form */}
        {replying && (
          <div className="mt-2 space-y-2">
            <input
              type="text"
              placeholder="Your name (optional)"
              value={replyName}
              onChange={(e) => setReplyName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-300"
            />
            <div className="flex gap-2">
              <textarea
                autoFocus
                placeholder="Write a reply..."
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                rows={2}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-300 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmitReply();
                }}
              />
              <button
                onClick={handleSubmitReply}
                disabled={submitting || !replyBody.trim()}
                className="self-end px-3 py-2 bg-orange-500 text-white text-xs font-medium rounded-md hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nested replies */}
      {!collapsed &&
        comment.replies?.map((reply) => (
          <CommentNode
            key={reply.id}
            comment={reply}
            depth={depth + 1}
            sessionId={sessionId}
            onReply={onReply}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}

// ── Main CommentThread component ────────────────────────────
export default function CommentThread({ experimentId }: { experimentId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const sessionId = typeof window !== "undefined" ? getSessionId() : "";

  const loadComments = useCallback(async () => {
    const res = await fetch(`/api/comments?experiment_id=${experimentId}`);
    if (res.ok) {
      const data = await res.json();
      setComments(data);
    }
    setLoading(false);
  }, [experimentId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  async function handlePost() {
    if (!body.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        experiment_id: experimentId,
        session_id: sessionId,
        author_name: authorName || "Anonymous",
        body,
      }),
    });
    if (res.ok) {
      setBody("");
      await loadComments();
    }
    setSubmitting(false);
  }

  async function handleReply(parentId: string, replyBody: string, replyName: string) {
    await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        experiment_id: experimentId,
        parent_id: parentId,
        session_id: sessionId,
        author_name: replyName || authorName || "Anonymous",
        body: replyBody,
      }),
    });
    await loadComments();
  }

  async function handleDelete(id: string) {
    await fetch("/api/comments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, session_id: sessionId }),
    });
    await loadComments();
  }

  const tree = buildTree(comments);

  return (
    <div id="comments" className="mt-6 scroll-mt-4">
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-4 hover:text-orange-600 transition-colors"
      >
        <MessageSquare size={16} className="text-orange-500" />
        Discussion
        <span className="text-xs font-normal text-gray-400">
          ({comments.length} {comments.length === 1 ? "comment" : "comments"})
        </span>
        {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {expanded && (
        <>
          {/* New comment form */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <input
              type="text"
              placeholder="Your name (optional, defaults to Anonymous)"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-300 mb-2"
            />
            <div className="flex gap-2">
              <textarea
                placeholder="Share your thoughts on this study..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-300 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePost();
                }}
              />
              <button
                onClick={handlePost}
                disabled={submitting || !body.trim()}
                className="self-end px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <>
                    <Send size={14} />
                    Post
                  </>
                )}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              Press Ctrl+Enter / Cmd+Enter to submit
            </p>
          </div>

          {/* Comments list */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : tree.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              No comments yet. Be the first to discuss this study.
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg px-4 divide-y divide-gray-100">
              {tree.map((comment) => (
                <CommentNode
                  key={comment.id}
                  comment={comment}
                  depth={0}
                  sessionId={sessionId}
                  onReply={handleReply}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
